import { parseEther, id, isAddress } from 'ethers';
const num=(v,min,max,label)=>{if(!Number.isSafeInteger(Number(v))||Number(v)<min||Number(v)>max)throw new Error('Invalid '+label);return Number(v);};
const decimal=v=>{if(typeof v!=='string'||!/^\d{1,12}(\.\d{1,18})?$/.test(v)||parseEther(v)<=0n)throw new Error('Invalid positive amount');return parseEther(v);};
const bool=v=>{if(typeof v!=='boolean')throw new Error('Expected boolean');return v;};
export async function buildAction(ctx,action,args={}) {
 const {vault,risk,strategy,tokens,provider}=ctx;let c,method,params,role;
 switch(action) {
 case 'approve': c=tokens[0];method='approve';params=[vault.target,decimal(args.amount)];role='investor';break;
 case 'deposit': {c=vault;method='deposit';const n=decimal(args.amount);params=[n,(await vault.previewDeposit(n))*9950n/10000n];role='investor';break;}
 case 'redeem': {c=vault;method='redeem';if(!/^\d+$/.test(String(args.shares))||BigInt(args.shares)<=0n)throw new Error('Invalid shares');params=[BigInt(args.shares),[0,0,0]];role='investor';break;}
 case 'selectStrategy': c=strategy;method=action;params=[num(args.id,0,2,'strategy')];role='manager';break;
 case 'configure':c=strategy;method=action;params=[num(args.target,1,10000,'target'),num(args.cash,0,10000,'cash'),num(args.cooldown,30,604800,'cooldown')];role='manager';break;
 case 'setEnabled':c=strategy;method=action;params=[num(args.id,0,2,'strategy'),bool(args.enabled)];role='manager';break;
 case 'setAutomation':c=vault;method=action;params=[bool(args.enabled)];role='manager';break;
 case 'rebalance':c=vault;method=action;params=[num(args.slippage??100,0,500,'slippage'),(await provider.getBlock('latest')).timestamp+300];role='keeper';break;
 case 'setPaused':c=risk;method=action;params=[bool(args.paused)];role='risk';break;
 case 'setLimits':c=risk;method=action;params=[num(args.maxWeight,1,10000,'maxWeight'),num(args.minCash,0,10000,'minCash'),num(args.maxVolatility,1,100000,'volatility'),num(args.maxSlippage,0,500,'slippage'),num(args.maxAge,60,86400,'age')];role='risk';break;
 case 'updateMarket':c=risk;method=action;params=[tokens[num(args.asset,1,2,'asset')].target,decimal(args.price),num(args.volatility,0,100000,'volatility'),num(args.momentum,-10000,100000,'momentum')];role='risk';break;
 case 'setAssetEnabled':c=risk;method=action;params=[tokens[num(args.asset,1,2,'asset')].target,bool(args.enabled)];role='risk';break;
 case 'setRole':c=risk;method=action;if(!['MANAGER','RISK','KEEPER'].includes(args.role)||!isAddress(args.address))throw new Error('Invalid role/address');params=[id(args.role),args.address,bool(args.enabled)];role='admin';break;
 default:throw new Error('Unknown action');
 }
 return {to:c.target,data:c.interface.encodeFunctionData(method,params),value:'0x0',chainId:'0x'+ctx.manifest.chainId.toString(16),role};
}
export async function demoAction(service,action,args,role) {
 const {ctx}=service;const built=await buildAction(ctx,action,args);
 if(role!==built.role)throw new Error('This action requires '+built.role+' role');
 const index={admin:0,investor:1,manager:2,risk:3,keeper:4}[role];
 const {role:_,chainId,...transaction}=built;
 try {const tx=await ctx.signers[index].sendTransaction(transaction);const receipt=await tx.wait();service.job(action,'confirmed',tx.hash);await service.sync();return {hash:tx.hash,blockNumber:receipt.blockNumber,status:receipt.status,gasUsed:receipt.gasUsed.toString()};}
 catch(e) {service.job(action,'rejected','',e.reason||e.shortMessage||'Transaction rejected');throw e;}
}
