import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {PGlite} from '@electric-sql/pglite';
import pg from 'pg';
import request from 'supertest';
import {localChain,deploy,seed} from '../scripts/chain.mjs';
import {createPostgresStore,connectionOptions,openHostedStore} from '../server/postgres-store.mjs';
import {createService} from '../server/service.mjs';
import {createApp} from '../server/app.mjs';
import {bootstrapReceipts} from '../server/bootstrap-receipts.mjs';
let chain,ctx,store,service,app,dir;
async function pool(){
 if(process.env.TEST_DATABASE_URL)return new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:'-c search_path=alphavault',max:3});
 // Actual PostgreSQL engine in WASM. A live pg connection can run the same suite.
 const engine=new PGlite(dir);await engine.exec('SET search_path TO alphavault');
 let tail=Promise.resolve();
 const connect=async()=>{let release;const previous=tail;tail=new Promise(resolve=>release=resolve);await previous;return {
  async query(sql,values){return values?engine.query(sql,values):(await engine.exec(sql)).at(-1);},release
 };};
 return {connect,async query(sql,values){const c=await connect();try{return await c.query(sql,values);}finally{c.release();}},end:()=>engine.close()};
}
before(async()=>{dir=mkdtempSync(tmpdir()+'/alphavault-pg-');chain=await localChain();ctx=await deploy(chain.provider,chain.signers);await seed(ctx);store=await createPostgresStore(await pool());service=createService(ctx,store);app=createApp(service);});
after(async()=>{await store?.close();await chain?.close();rmSync(dir,{recursive:true,force:true});});
test('PostgreSQL indexes chain state through all read API routes and deduplicates concurrent sync',async()=>{
 await Promise.all([service.sync(),service.sync(),service.sync()]);const count=(await service.history(200)).length;await service.sync();assert.equal((await service.history(200)).length,count);
 for(const route of ['/api/health','/api/portfolio','/api/prices','/api/strategies','/api/history','/api/snapshots','/api/jobs','/api/backtests/1']){const response=await request(app).get(route).expect(200);assert(!JSON.stringify(response.body).includes('DATABASE_URL'));}
 assert.equal((await request(app).get('/api/health')).body.database,'postgres');
 assert.equal((await store.db.prepare('SELECT count(*) n FROM prices').get()).n,3);
 await request(app).post('/api/demo/action').send({}).expect(403);
});
test('PostgreSQL transaction failure rolls back both records and cursor',async()=>{
 const old=await store.db.prepare('SELECT * FROM cursors WHERE scope=?').get(service.scope);
 await assert.rejects(store.batch([
  ['UPDATE cursors SET block_number=? WHERE scope=?',[999999,service.scope]],
  ['INSERT INTO jobs(scope,created_at,kind,status,tx_hash,message) VALUES(?,?,?,?,?,?)',[service.scope,Date.now(),'rollback-test','test','','must disappear']],
  ['INSERT INTO nonexistent_table VALUES(?)',[1]]
 ]));
 assert.deepEqual(await store.db.prepare('SELECT * FROM cursors WHERE scope=?').get(service.scope),old);
 assert.equal((await store.db.prepare('SELECT count(*) n FROM jobs WHERE kind=?').get('rollback-test')).n,0);
 await store.health();
});
test('PostgreSQL verified receipts, backtests and non-chain jobs survive database reopen',async()=>{
 const deposit=(await service.history(200)).find(e=>e.name==='Deposited');
 const receiptSeed={chainId:ctx.manifest.chainId,vault:ctx.vault.target,hashes:[deposit.tx_hash,deposit.tx_hash]};
 assert.deepEqual(await bootstrapReceipts(service,receiptSeed),{imported:1,skipped:0});
 await service.job('persistence-check','confirmed','','PostgreSQL durable sentinel');
 await store.close();store=await createPostgresStore(await pool());service=createService(ctx,store);app=createApp(service);
 assert.deepEqual(await bootstrapReceipts(service,receiptSeed),{imported:0,skipped:1});
 const evidence=await request(app).get('/api/evidence').expect(200);assert.equal(evidence.body.successfulKinds,1);assert.equal(evidence.body.receipts[0].kind,'PortfolioVault.deposit');
 const jobs=await request(app).get('/api/jobs').expect(200);assert(jobs.body.some(j=>j.message==='PostgreSQL durable sentinel'));assert.equal(typeof jobs.body[0].created_at,'number');
 assert.equal((await store.db.prepare('SELECT count(*) n FROM backtests').get()).n,1);
});
test('PostgreSQL reorg discards orphaned state and resumes indexing',async()=>{
 const snapshot=await chain.rpc.request({method:'evm_snapshot',params:[]});await(await ctx.strategy.connect(ctx.signers[2]).selectStrategy(1)).wait();await service.sync();
 assert((await service.history(200)).some(e=>e.name==='StrategySelected'&&e.payload[0]==='1'));
 await chain.rpc.request({method:'evm_revert',params:[snapshot]});await service.sync();
 assert(!(await service.history(200)).some(e=>e.name==='StrategySelected'&&e.payload[0]==='1'));
 assert.equal((await service.read()).selected,0);
});
test('PostgreSQL health failures are reported instead of claiming a healthy database',async()=>{
 const app=createApp({...service,store:{...store,async health(){throw new Error('Database unavailable');}}});
 const result=await request(app).get('/api/health');assert.equal(result.status,503);assert.equal(result.body.ok,false);
});
test('cloud configuration fails closed and verifies TLS even with insecure URL options',async()=>{
 await assert.rejects(openHostedStore({DATABASE_REQUIRED:'postgres'},'/tmp/'),/DATABASE_URL is required/);
 assert.throws(()=>connectionOptions({DATABASE_URL:'not-a-url'}),/Invalid DATABASE_URL/);
 const config=connectionOptions({DATABASE_URL:'postgresql://postgres.test:pass%40word@host.example:5432/postgres?sslmode=disable'});
 assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.password,'pass@word');assert.equal(config.max,3);
 assert.equal(config.options,'-c search_path=alphavault');
});

test('PostgreSQL telemetry retention bounds storage without deleting the event ledger',async()=>{
 const historyCount=(await service.history(200)).length;
 for(let block=-5;block<0;block++)await store.db.prepare('INSERT INTO snapshots VALUES(?,?,?,?,?,?,?,?)').run(service.scope,block,'old',1,'1','1',100,'[]');
 const limited=createService(ctx,store,{snapshotRetention:3});await limited.sync();
 assert.equal((await store.db.prepare('SELECT count(*) n FROM snapshots WHERE scope=?').get(service.scope)).n,3);
 assert.equal((await service.history(200)).length,historyCount);
});
