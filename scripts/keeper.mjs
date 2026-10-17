import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { JsonRpcProvider, Wallet } from 'ethers';
import { attach } from '../server/contracts.mjs';
import { projectRoot as root } from '../server/deployment.mjs';
import { createStore } from '../server/store.mjs';
import { createService } from '../server/service.mjs';
export async function keeperTick(service,signer) {
 const s=await service.sync();
 if(!s.automationEnabled||s.paused||s.validationError||s.valuationStale||s.navUsd<=0||s.timestamp<s.lastRebalance+s.cooldown)return {status:'skipped',reason:'Not eligible'};
 const drift=Math.max(...s.target.map((x,i)=>Math.abs(x-s.weights[i])));
 if(drift<Number(process.env.DRIFT_BPS||300))return {status:'skipped',reason:'Within drift threshold'};
 try {const tx=await service.ctx.vault.connect(signer).rebalance(s.limits.maxSlippage,s.timestamp+300);await tx.wait();service.job('keeper','confirmed',tx.hash);await service.sync();return {status:'confirmed',hash:tx.hash};}
 catch(e){service.job('keeper','rejected','',e.reason||e.shortMessage);throw e;}
}
export function runKeeper(service,signer,interval=10000) {
 let stopped=false,timer;
 const loop=async()=>{try{await keeperTick(service,signer);}catch(e){console.error('Keeper:',e.reason||e.shortMessage||e.message);}finally{if(!stopped)timer=setTimeout(loop,interval);}};
 void loop();return()=>{stopped=true;clearTimeout(timer);};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
 if(!process.env.RPC_URL||!process.env.KEEPER_PRIVATE_KEY)throw new Error('Set RPC_URL and dedicated testnet KEEPER_PRIVATE_KEY');
 const provider=new JsonRpcProvider(process.env.RPC_URL);const manifest=JSON.parse(readFileSync(process.env.DEPLOYMENT_FILE||root+'data/sepolia/deployment.json','utf8'));
 if(Number((await provider.getNetwork()).chainId)!==manifest.chainId)throw new Error('Chain mismatch');
 const artifacts=Object.fromEntries(['RiskManager','StrategyEngine','PortfolioVault','MockExchange','MockERC20'].map(n=>[n,JSON.parse(readFileSync(root+'artifacts/'+n+'.json','utf8'))]));
 const service=createService(attach(provider,manifest,artifacts),createStore(process.env.DB_PATH||root+'data/sepolia/alphavault.sqlite'));
 runKeeper(service,new Wallet(process.env.KEEPER_PRIVATE_KEY,provider));
}
