import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export function createStore(filename=':memory:') {
 if(filename!==':memory:') mkdirSync(dirname(filename),{recursive:true});
 const db=new DatabaseSync(filename);
 db.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS events(scope TEXT,tx_hash TEXT,log_index INTEGER,block_number INTEGER,block_hash TEXT,contract TEXT,name TEXT,payload TEXT,PRIMARY KEY(scope,tx_hash,log_index));
 CREATE TABLE IF NOT EXISTS snapshots(scope TEXT,block_number INTEGER,block_hash TEXT,timestamp INTEGER,nav TEXT,supply TEXT,share_index REAL,weights TEXT,PRIMARY KEY(scope,block_number));
 CREATE TABLE IF NOT EXISTS prices(scope TEXT,asset TEXT,block_number INTEGER,price TEXT,volatility INTEGER,momentum INTEGER,updated_at INTEGER,PRIMARY KEY(scope,asset,block_number));
 CREATE TABLE IF NOT EXISTS strategies(scope TEXT,block_number INTEGER,selected INTEGER,weights TEXT,config TEXT,PRIMARY KEY(scope,block_number));
 CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY,scope TEXT,created_at INTEGER,kind TEXT,status TEXT,tx_hash TEXT,message TEXT);
 CREATE TABLE IF NOT EXISTS backtests(strategy INTEGER PRIMARY KEY,created_at INTEGER,source TEXT,result TEXT);
 CREATE TABLE IF NOT EXISTS cursors(scope TEXT PRIMARY KEY,block_number INTEGER,block_hash TEXT);`);
 db.exec('CREATE TABLE IF NOT EXISTS receipts(scope TEXT,hash TEXT,payload TEXT,PRIMARY KEY(scope,hash));');
 return {kind:'sqlite',db,close:()=>db.close(),async health(){db.prepare('SELECT 1').get();},
  async batch(statements){
   db.exec('BEGIN IMMEDIATE');
   try{for(const [sql,params=[]] of statements)db.prepare(sql).run(...params);db.exec('COMMIT');}
   catch(error){db.exec('ROLLBACK');throw error;}
  }
 };
}
