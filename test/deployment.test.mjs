import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import * as ethers from 'ethers';
import {localChain} from '../scripts/chain.mjs';
import {compile} from '../scripts/compile.mjs';
import {deploymentTools} from '../public/deployment-core.js';
import {verifyDeployment} from '../server/deployment.mjs';
let chain,artifacts,journal,saved;const tools=deploymentTools(ethers);
before(async()=>{chain=await localChain({chain:{chainId:11155111,hardfork:'shanghai'}});artifacts=compile();const a=await Promise.all(chain.signers.map(s=>s.getAddress()));journal=tools.createJournal({admin:a[0],investor:a[1],manager:a[2],risk:a[3],keeper:a[4]},artifacts);});
after(async()=>{await chain.close();});
const save=async j=>{saved=JSON.stringify(j);};
test('role plan rejects zero or conflated core roles',()=>{assert.throws(()=>tools.roles({...journal.roles,risk:journal.roles.manager}),/distinct/);assert.throws(()=>tools.roles({...journal.roles,keeper:ethers.ZeroAddress}),/Zero/);assert.equal(tools.plan(journal.roles).length,17);});
test('wrong chain and changed artifacts are rejected before signing',async()=>{const wrong=await localChain();try{await assert.rejects(tools.inspect(wrong.provider,journal,artifacts),/Sepolia/);}finally{await wrong.close();}const edited=structuredClone(artifacts);edited.PortfolioVault.bytecode+='00';assert.throws(()=>tools.validateJournal(journal,edited),/changed/);});
test('wallet rejection clears only the unsent step; checkpoint failure sends nothing',async()=>{const rejected={getAddress:async()=>journal.roles.admin,sendTransaction:async()=>{const e=new Error('user rejected');e.code='ACTION_REJECTED';throw e;}};await assert.rejects(tools.executeNext({provider:chain.provider,signer:rejected,journal,artifacts,save}),/rejected/);assert.equal(journal.steps.length,0);let sent=false;const copy=structuredClone(journal);await assert.rejects(tools.executeNext({provider:chain.provider,signer:{getAddress:async()=>copy.roles.admin,sendTransaction:async()=>{sent=true;}},journal:copy,artifacts,save:async()=>{throw new Error('disk full');}}),/disk full/);assert.equal(sent,false);});
test('an uncertain wallet submission blocks automatic duplicate sends',async()=>{const copy=structuredClone(journal);const uncertain={getAddress:async()=>copy.roles.admin,sendTransaction:async()=>{throw new Error('wallet disconnected');}};await assert.rejects(tools.executeNext({provider:chain.provider,signer:uncertain,journal:copy,artifacts,save}),/disconnected/);assert.equal(copy.steps[0].status,'submitting');await assert.rejects(tools.inspect(chain.provider,copy,artifacts),/Uncertain/);});
test('deploy three assets, resume a JSON checkpoint without redeploying, and finish all 17 steps',async()=>{for(let i=0;i<3;i++)await tools.executeNext({provider:chain.provider,signer:chain.signers[0],journal,artifacts,save});const before=await chain.provider.send('eth_blockNumber',[]);journal=JSON.parse(saved);assert.equal((await tools.inspect(chain.provider,journal,artifacts)).next,3);assert.equal(await chain.provider.send('eth_blockNumber',[]),before);while(!(await tools.inspect(chain.provider,journal,artifacts)).complete)await tools.executeNext({provider:chain.provider,signer:chain.signers[0],journal,artifacts,save});assert.equal(journal.steps.length,17);assert(journal.steps.every(s=>s.status==='confirmed'&&BigInt(s.gasUsed)>0n));});
test('exported manifest has valid wiring and bootstrap risk permission is revoked',async()=>{const state=await tools.inspect(chain.provider,journal,artifacts);const m=tools.manifest(journal,state);assert.equal((await verifyDeployment(chain.provider,m,artifacts)).checkedContracts,7);const r=new ethers.Contract(m.contracts.RiskManager,artifacts.RiskManager.abi,chain.provider);assert.equal(await r.hasRole(await r.RISK(),m.roles.admin),false);assert.equal(await r.hasRole(await r.RISK(),m.roles.risk),true);const usd=new ethers.Contract(m.assets[0].address,artifacts.MockERC20.abi,chain.provider);assert.equal(await usd.balanceOf(m.roles.investor),ethers.parseEther('100000'));assert.equal(await usd.balanceOf(m.contracts.MockExchange),ethers.parseEther('100000000'));});
test('tampered journal hashes and bad manifest wiring are rejected',async()=>{const bad=structuredClone(journal);bad.steps[0].hash=bad.steps[1].hash;await assert.rejects(tools.inspect(chain.provider,bad,artifacts),/does not match/);const m=tools.manifest(journal,await tools.inspect(chain.provider,journal,artifacts));[m.assets[1],m.assets[2]]=[m.assets[2],m.assets[1]];await assert.rejects(verifyDeployment(chain.provider,m,artifacts),/mismatch/);});
test('completed deployment does not send another transaction when resumed',async()=>{const before=await chain.provider.send('eth_blockNumber',[]);assert.equal((await tools.executeNext({provider:chain.provider,signer:chain.signers[0],journal,artifacts,save})).complete,true);assert.equal(await chain.provider.send('eth_blockNumber',[]),before);});
test('retry requires a matching reverted deployment transaction and retains failed attempt',async()=>{const base=tools.createJournal(journal.roles,artifacts);const expected=await new ethers.ContractFactory(artifacts.MockERC20.abi,artifacts.MockERC20.bytecode).getDeployTransaction('Mock USD','mUSD');const tx=await chain.signers[0].sendTransaction({...expected,gasLimit:160000});await assert.rejects(tx.wait());base.steps.push({key:'usd',hash:tx.hash,status:'submitted'});const recovered=await tools.retryFailed(chain.provider,base,artifacts);assert.equal(recovered.steps.length,0);assert.equal(recovered.failedAttempts[0].hash,tx.hash);const bad=structuredClone(base);bad.steps[0].hash=journal.steps[0].hash;await assert.rejects(tools.retryFailed(chain.provider,bad,artifacts),/reverted/);});
test('smart-contract/delegated deployers are refused before wallet submission',async()=>{const copy=tools.createJournal({...journal.roles,admin:journal.steps[0].contractAddress},artifacts);await assert.rejects(tools.estimate(chain.provider,copy,artifacts),/standard EOA/);});

test('only a never-submitted plan can be edited, preserving role addresses',()=>{
 const empty=tools.createJournal(journal.roles,artifacts),keep=tools.unsentRoles(empty,artifacts);
 assert.deepEqual(keep,empty.roles);assert.notEqual(keep,empty.roles);
 for(const status of ['submitting','submitted','confirmed'])assert.throws(()=>tools.unsentRoles({...empty,steps:[{key:'usd',status}]},artifacts),/Cannot edit/);
 assert.throws(()=>tools.unsentRoles({...empty,failedAttempts:[{status:'reverted'}]},artifacts),/Cannot edit/);
 assert.throws(()=>tools.unsentRoles({...empty,failedAttempts:{}},artifacts),/Cannot edit/);
 assert.throws(()=>tools.unsentRoles({...empty,artifactHash:'changed'},artifacts),/changed/);
});

test('wrapped failure recovery verifies exact single call and keeps successes or unrelated attempts blocked',async()=>{
 // Fixture provider isolates validation of a type-4 receipt; Ganache here uses Shanghai.
 const prefix={...structuredClone(journal),steps:structuredClone(journal.steps.slice(0,7))};
 const hash=ethers.id('wrapped-failure-fixture'),step={key:'price-eth',hash,status:'submitted'};
 const input={...prefix,steps:[...prefix.steps,step]};
 const block=await chain.provider.getBlock('latest');
 const expected=new ethers.Interface(artifacts.RiskManager.abi).encodeFunctionData('updateMarket',[journal.steps[1].contractAddress,ethers.parseEther('3000'),4000,800]);
 const packed=ethers.concat([journal.steps[3].contractAddress,ethers.ZeroHash,expected]);
 const abi=new ethers.Interface(['function redeemDelegations(bytes[],bytes32[],bytes[])']);
 const encode=(calls=[packed],modes=[ethers.ZeroHash])=>abi.encodeFunctionData('redeemDelegations',[['0x1234'],modes,calls]);
 const tx={hash,type:4,chainId:11155111n,from:journal.roles.admin,to:'0xdb9b1e94b5b69df7e401ddbede43491141047db3',value:0n,data:encode()};
 const receipt={hash,status:0,blockNumber:block.number,blockHash:block.hash,gasUsed:543779n,gasPrice:1500000020n};
 const provider=(t=tx,r=receipt)=>new Proxy(chain.provider,{get(target,key){if(key==='getTransaction')return async h=>h===hash?t:target.getTransaction(h);if(key==='getTransactionReceipt')return async h=>h===hash?r:target.getTransactionReceipt(h);const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;}});
 const recovered=await tools.retryFailed(provider(),input,artifacts);
 assert.equal(recovered.steps.length,7);assert.equal(recovered.failedAttempts[0].route,'reverted-wallet-wrapper');assert.equal(recovered.failedAttempts[0].gasUsed,'543779');assert.equal(input.steps.length,8);
 for(const change of [{type:2},{to:journal.roles.admin},{from:journal.roles.manager},{value:1n},{data:encode([packed+'00'])},{data:encode([packed,packed])},{data:encode([packed],['0x01'+'00'.repeat(31)])},{data:encode()+'00'}])await assert.rejects(tools.retryFailed(provider({...tx,...change}),input,artifacts),/does not match/);
 await assert.rejects(tools.retryFailed(provider(tx,{...receipt,status:1}),input,artifacts),/reverted/);
 await assert.rejects(tools.retryFailed(provider(tx,null),input,artifacts),/reverted/);
 await assert.rejects(tools.retryFailed(provider(tx,{...receipt,blockHash:ethers.ZeroHash}),input,artifacts),/does not match/);
 await assert.rejects(tools.inspect(provider(tx,{...receipt,status:1}),input,artifacts),/does not match/);
});
