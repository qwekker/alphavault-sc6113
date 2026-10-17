import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseEther,id } from 'ethers';
import { localChain, deploy, seed } from './chain.mjs';
import { root } from './compile.mjs';
import { createStore } from '../server/store.mjs';
import { createService } from '../server/service.mjs';
import { backtest } from '../server/quant.mjs';
const chain=await localChain();const receipts=[];let service;
const record=async(action,tx)=>{const r=await tx.wait();receipts.push({action,hash:tx.hash,from:tx.from,to:tx.to,block:r.blockNumber,status:r.status,gasUsed:r.gasUsed.toString()});if(service)await service.sync();};
const store=createStore();
try {
 const c=await deploy(chain.provider,chain.signers,undefined,record);service=createService(c,store);await seed(c);
 const [,investor,manager,officer,keeper]=c.signers;const tx=c.tx;
 await tx('rebalance',c.vault.connect(keeper).rebalance(100,9999999999));
 await tx('selectStrategy',c.strategy.connect(manager).selectStrategy(1));
 await tx('setEnabled',c.strategy.connect(manager).setEnabled(2,false));
 await tx('setEnabled',c.strategy.connect(manager).setEnabled(2,true));
 await tx('setRole',c.risk.setRole(id('KEEPER'),await c.signers[5].getAddress(),true));
 await tx('setRole',c.risk.setRole(id('KEEPER'),await c.signers[5].getAddress(),false));
 await tx('updateMarket',c.risk.connect(officer).updateMarket(c.tokens[1].target,parseEther('3120'),4200,1000));
 await chain.rpc.request({method:'evm_increaseTime',params:[61]});await chain.rpc.request({method:'evm_mine',params:[]});
 await tx('rebalance',c.vault.connect(keeper).rebalance(100,9999999999));
 await tx('setPaused',c.risk.connect(officer).setPaused(true));
 const rejections=[];
 for(const [action,fn] of [['paused deposit',()=>c.vault.connect(investor).deposit(parseEther('1'),0)],['unauthorized strategy change',()=>c.strategy.connect(investor).selectStrategy(2)]]){try{await fn();throw new Error('Expected rejection');}catch(e){if(e.message==='Expected rejection')throw e;rejections.push({action,stage:'gas-estimation or eth_call',transactionHash:null,error:e.reason||e.shortMessage});}}
 await tx('redeem',c.vault.connect(investor).redeem((await c.vault.balanceOf(c.manifest.roles.investor))/4n,[0,0,0]));
 await tx('setPaused',c.risk.connect(officer).setPaused(false));
 const final=await service.sync();const kinds=[...new Set(receipts.filter(r=>!r.action.startsWith('deploy')&&!r.action.startsWith('mint')).map(r=>r.action))];
 if(kinds.length<10||receipts.some(r=>r.status!==1))throw new Error('Evidence requirements failed');
 const sourceHashes=Object.fromEntries(['PortfolioVault','StrategyEngine','RiskManager','MockERC20','MockExchange'].map(n=>[n,createHash('sha256').update(readFileSync(root+'contracts/'+n+'.sol')).digest('hex')]));
 mkdirSync(root+'evidence',{recursive:true});writeFileSync(root+'evidence/transactions.json',JSON.stringify({generatedAt:new Date().toISOString(),network:'ephemeral LOCAL Ganache; not Sepolia',chainId:31337,compiler:c.artifacts.PortfolioVault.compiler,sourceHashes,distinctTransactionKinds:kinds,receipts,rejections,finalState:final},null,2));
 writeFileSync(root+'evidence/snapshots.json',JSON.stringify(await service.snapshots(),null,2));
 writeFileSync(root+'evidence/backtests.json',JSON.stringify([0,1,2].map(n=>backtest(n)),null,2));
 console.log(`${receipts.length} successful receipts; ${kinds.length} distinct transaction kinds; 2 expected rejections. Evidence saved.`);
}finally{store.close();await chain.close();}
