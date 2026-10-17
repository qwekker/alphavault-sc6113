import pg from 'pg';
import {readFileSync} from 'node:fs';
import {createStore} from './store.mjs';

// Separate from Supabase's public Data API schema; only the backend uses this database.
export const postgresSchema=`
CREATE SCHEMA IF NOT EXISTS alphavault;
REVOKE ALL ON SCHEMA alphavault FROM PUBLIC;
CREATE TABLE IF NOT EXISTS alphavault.events(scope TEXT,tx_hash TEXT,log_index INTEGER,block_number INTEGER,block_hash TEXT,contract TEXT,name TEXT,payload TEXT,PRIMARY KEY(scope,tx_hash,log_index));
CREATE TABLE IF NOT EXISTS alphavault.snapshots(scope TEXT,block_number INTEGER,block_hash TEXT,timestamp BIGINT,nav TEXT,supply TEXT,share_index DOUBLE PRECISION,weights TEXT,PRIMARY KEY(scope,block_number));
CREATE TABLE IF NOT EXISTS alphavault.prices(scope TEXT,asset TEXT,block_number INTEGER,price TEXT,volatility INTEGER,momentum INTEGER,updated_at BIGINT,PRIMARY KEY(scope,asset,block_number));
CREATE TABLE IF NOT EXISTS alphavault.strategies(scope TEXT,block_number INTEGER,selected INTEGER,weights TEXT,config TEXT,PRIMARY KEY(scope,block_number));
CREATE TABLE IF NOT EXISTS alphavault.jobs(id BIGSERIAL PRIMARY KEY,scope TEXT,created_at BIGINT,kind TEXT,status TEXT,tx_hash TEXT,message TEXT);
CREATE TABLE IF NOT EXISTS alphavault.backtests(strategy INTEGER PRIMARY KEY,created_at BIGINT,source TEXT,result TEXT);
CREATE TABLE IF NOT EXISTS alphavault.cursors(scope TEXT PRIMARY KEY,block_number INTEGER,block_hash TEXT);
CREATE TABLE IF NOT EXISTS alphavault.receipts(scope TEXT,hash TEXT,payload TEXT,PRIMARY KEY(scope,hash));
${['events','snapshots','prices','strategies','jobs','backtests','cursors','receipts'].map(t=>`ALTER TABLE alphavault.${t} ENABLE ROW LEVEL SECURITY;`).join('\n')}
`;

export function connectionOptions(env) {
 let url;try{url=new URL(env.DATABASE_URL);}catch{throw new Error('Invalid DATABASE_URL; copy the Supabase Session pooler connection string');}
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||!url.username||!url.password||url.password.includes('YOUR-PASSWORD'))throw new Error('DATABASE_URL must contain the actual PostgreSQL host, user and password');
 const supabaseHost=url.hostname.endsWith('.pooler.supabase.com')||url.hostname.endsWith('.supabase.co');
 const ca=env.DATABASE_CA_CERT?env.DATABASE_CA_CERT.replace(/\\n/g,'\n'):(supabaseHost?readFileSync(new URL('../config/supabase-ca.crt',import.meta.url),'utf8'):undefined);
 // Never allow URL SSL parameters to silently disable certificate verification.
 return {host:url.hostname,port:Number(url.port||5432),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database:decodeURIComponent(url.pathname.slice(1)||'postgres'),
  ssl:{rejectUnauthorized:true,minVersion:'TLSv1.2',...(ca?{ca}:{})},
  options:'-c search_path=alphavault',max:3,idleTimeoutMillis:30000,connectionTimeoutMillis:15000,statement_timeout:20000};
}
// SQL comes exclusively from server code. Values are always passed separately.
const parameters=sql=>{let index=0;return sql.replace(/\?/g,()=>'$'+(++index));};
const rows=result=>result.rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[
 key,['id','created_at','timestamp','updated_at','n'].includes(key)&&typeof value==='string'&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):value
])));
export async function createPostgresStore(pool) {
 const client=await pool.connect();
 try{await client.query('BEGIN');await client.query(postgresSchema);await client.query('COMMIT');}
 catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 return {kind:'postgres',
  db:{prepare(sql){const query=parameters(sql);return {
   async all(...values){return rows(await pool.query(query,values));},
   async get(...values){return rows(await pool.query(query,values))[0];},
   async run(...values){const r=await pool.query(query,values);return {changes:r.rowCount};}
  };}},
  async health(){await pool.query('SELECT 1');},
  async batch(statements){
   const connection=await pool.connect();
   try{await connection.query('BEGIN');for(const [sql,values=[]] of statements)await connection.query(parameters(sql),values);await connection.query('COMMIT');}
   catch(error){await connection.query('ROLLBACK');throw error;}finally{connection.release();}
  },
  close:()=>pool.end()
 };
}
export async function openHostedStore(env,root) {
 if(!env.DATABASE_URL){
  if(env.DATABASE_REQUIRED==='postgres')throw new Error('DATABASE_URL is required for free hosting; refusing ephemeral SQLite storage');
  return createStore(env.DB_PATH||root+'data/hosted.sqlite');
 }
 const pool=new pg.Pool(connectionOptions(env));
 pool.on('error',()=>console.error('PostgreSQL idle connection failed; the next request will reconnect'));
 try{return await createPostgresStore(pool);}catch(error){await pool.end();throw new Error('PostgreSQL initialization failed. Check the Session pooler URL, password, TLS certificate and project availability.',{cause:error});}
}
