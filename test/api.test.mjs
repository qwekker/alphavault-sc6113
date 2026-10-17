import { before,after,test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { localChain,deploy,seed } from '../scripts/chain.mjs';
import { createStore } from '../server/store.mjs';
import { createService } from '../server/service.mjs';
import { createApp } from '../server/app.mjs';
import { keeperTick } from '../scripts/keeper.mjs';
import {bootstrapReceipts} from '../server/bootstrap-receipts.mjs';
let chain,c,store,service,app,dir;
before(async()=>{chain=await localChain();c=await deploy(chain.provider,chain.signers);await seed(c);dir=mkdtempSync(tmpdir()+'/alphavault-test-');store=createStore(dir+'/test.sqlite');service=createService(c,store);app=createApp(service,{demo:true});});
after(async()=>{store.close();await chain.close();rmSync(dir,{recursive:true,force:true});});
test('health, config and portfolio expose real chain state',async()=>{assert.equal((await request(app).get('/api/health')).body.ok,true);const s=await request(app).get('/api/portfolio');assert.equal(s.status,200);assert.equal(s.body.navUsd,10000);assert.equal(s.body.assets.length,3);assert.equal((await request(app).get('/api/config')).body.chainId,31337);});
test('prices and strategy endpoints persist snapshots and deduplicate event sync',async()=>{await request(app).get('/api/prices').expect(200);await request(app).get('/api/strategies').expect(200);const n=service.history().length;await Promise.all([service.sync(),service.sync(),service.sync()]);assert.equal(service.history().length,n);assert(store.db.prepare('SELECT count(*) n FROM prices').get().n>=3);assert(store.db.prepare('SELECT count(*) n FROM strategies').get().n>=1);});
test('database data survives close and reopen',async()=>{await service.sync();const count=store.db.prepare('SELECT count(*) n FROM events').get().n;const second=createStore(dir+'/test.sqlite');assert.equal(second.db.prepare('SELECT count(*) n FROM events').get().n,count);second.close();});
test('API validates address, pagination, action and numeric input',async()=>{await request(app).get('/api/account/nope').expect(400);await request(app).get('/api/history?limit=201').expect(400);await request(app).get('/api/history?limit=0').expect(400);await request(app).post('/api/transactions/build').send({action:'deposit',args:{amount:'NaN'}}).expect(400);await request(app).post('/api/transactions/build').send({action:'unknown'}).expect(400);});
test('public mode never signs transactions',async()=>{await request(createApp(service)).post('/api/demo/action').set('X-AlphaVault-Demo','1').send({action:'rebalance',role:'keeper'}).expect(403);});
test('demo signing needs explicit header and rejects foreign origin',async()=>{await request(app).post('/api/demo/action').send({action:'rebalance',role:'keeper'}).expect(403);await request(app).post('/api/demo/action').set('X-AlphaVault-Demo','1').set('Origin','https://evil.example').send({action:'rebalance',role:'keeper'}).expect(403);});
test('wrong demo role cannot perform a privileged action',async()=>{const r=await request(app).post('/api/demo/action').set('X-AlphaVault-Demo','1').send({action:'selectStrategy',args:{id:1},role:'investor'});assert.equal(r.status,400);assert.match(r.body.error,/manager/);assert.equal(await c.strategy.selected(),0n);});
test('calldata builder creates an unsigned transaction with chain binding',async()=>{const r=await request(app).post('/api/transactions/build').send({action:'selectStrategy',args:{id:1}});assert.equal(r.body.to,c.strategy.target);assert.equal(r.body.chainId,'0x7a69');assert.equal(c.strategy.interface.parseTransaction({data:r.body.data}).name,'selectStrategy');});
test('keeper executes eligible drift once and skips cooldown; receipt indexed',async()=>{const r=await keeperTick(service,c.signers[4]);assert.equal(r.status,'confirmed');const next=await keeperTick(service,c.signers[4]);assert.equal(next.status,'skipped');assert(service.history().some(e=>e.name==='Rebalanced'&&e.tx_hash===r.hash));assert.equal(store.db.prepare("SELECT count(*) n FROM jobs WHERE status='confirmed'").get().n,1);});
test('chain rollback is detected and orphaned events are removed',async()=>{const snap=await chain.rpc.request({method:'evm_snapshot',params:[]});await (await c.strategy.connect(c.signers[2]).selectStrategy(1)).wait();await service.sync();assert.equal((await service.read()).selected,1);await chain.rpc.request({method:'evm_revert',params:[snap]});await service.sync();assert.equal((await service.read()).selected,0);assert(!service.history().some(e=>e.name==='StrategySelected'&&e.payload[0]==='1'));});
test('dashboard and locally bundled ethers load with restrictive script CSP',async()=>{const r=await request(app).get('/');assert.equal(r.status,200);assert.match(r.text,/Your portfolio, in focus/);assert.match(r.headers['content-security-policy'],/script-src 'self'/);await request(app).get('/vendor/ethers.js').expect(200);});
test('verified evidence endpoints reject unknown hashes and export actual receipts',async()=>{await request(app).post('/api/receipts').send({hash:'invalid'}).expect(400);await request(app).post('/api/receipts').send({hash:'0x'+'cd'.repeat(32)}).expect(400);const deposit=service.history().find(e=>e.name==='Deposited');const saved=await request(app).post('/api/receipts').send({hash:deposit.tx_hash}).expect(200);assert.equal(saved.body.kind,'PortfolioVault.deposit');const evidence=await request(app).get('/api/evidence').expect(200);assert.equal(evidence.body.successfulKinds,1);assert.equal(evidence.body.coverage.length,13);assert.equal(evidence.body.minimumTenKindsMet,false);});
test('deployment artifacts are exposed only by explicit local setup/demo mode',async()=>{const r=await request(app).get('/api/setup/artifacts').expect(200);assert(r.body.PortfolioVault.bytecode.startsWith('0x'));await request(createApp(service)).get('/api/setup/artifacts').expect(404);await request(app).get('/setup.html').expect(200);});
test('receipt bootstrap rejects wrong deployment and malformed hashes before writes',async()=>{
 const seed={chainId:c.manifest.chainId,vault:c.vault.target,hashes:[]};
 await assert.rejects(bootstrapReceipts(service,{...seed,chainId:11155111}),/deployment mismatch/);
 await assert.rejects(bootstrapReceipts(service,{...seed,vault:c.risk.target}),/deployment mismatch/);
 await assert.rejects(bootstrapReceipts(service,{...seed,hashes:['not-a-hash']}),/Invalid receipt seed/);
});
test('receipt bootstrap verifies hashes and survives database reopen without duplication',async()=>{
 const tx=await c.strategy.connect(c.signers[2]).configure(1500,2000,120);await tx.wait();
 const seed={chainId:c.manifest.chainId,vault:c.vault.target,hashes:[tx.hash,tx.hash]};
 assert.deepEqual(await bootstrapReceipts(service,seed),{imported:1,skipped:0});
 const reopened=createStore(dir+'/test.sqlite');
 try{const again=createService(c,reopened);assert.deepEqual(await bootstrapReceipts(again,seed),{imported:0,skipped:1});
 const saved=JSON.parse(reopened.db.prepare('SELECT payload FROM receipts WHERE scope=? AND hash=?').get(service.scope,tx.hash).payload);assert.equal(saved.kind,'StrategyEngine.configure');assert.equal(saved.status,'confirmed');}
 finally{reopened.close();}
});
test('receipt bootstrap refuses unknown transactions instead of inventing evidence',async()=>{
 const hash='0x'+'ef'.repeat(32);
 await assert.rejects(bootstrapReceipts(service,{chainId:c.manifest.chainId,vault:c.vault.target,hashes:[hash]}),/not yet confirmed/);
 assert.equal(store.db.prepare('SELECT count(*) n FROM receipts WHERE hash=?').get(hash).n,0);
});
