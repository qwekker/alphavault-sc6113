import { formatEther, isAddress } from 'ethers';
export const stringify=value=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v);
const amount=x=>Number(formatEther(x));
export function createService(ctx,store) {
 const {provider,manifest,vault,risk,strategy}=ctx,{db}=store;
 const scope=manifest.chainId+':'+manifest.contracts.PortfolioVault.toLowerCase();
 let pending;
 const job=(kind,status,hash='',message='')=>db.prepare('INSERT INTO jobs(scope,created_at,kind,status,tx_hash,message) VALUES(?,?,?,?,?,?)').run(scope,Date.now(),kind,status,hash,message);
 async function read() {
  const blockNumber=Number(await provider.send('eth_blockNumber',[]));const block=await provider.getBlock(blockNumber);const opt={blockTag:blockNumber};
  const markets=[];const balances=[];
  for(let i=0;i<3;i++) {const a=manifest.assets[i],m=await risk.markets(a.address,opt),balance=await ctx.tokens[i].balanceOf(manifest.contracts.PortfolioVault,opt);markets.push({...a,price:m.price.toString(),priceUsd:amount(m.price),volatility:Number(m.volatility),momentum:Number(m.momentum),updatedAt:Number(m.updatedAt),enabled:m.enabled,stale:i>0&&block.timestamp>Number(m.updatedAt)+Number(await risk.maxAge(opt))});balances.push(balance);}
  const supply=await vault.totalSupply(opt);let nav=0n;for(let i=0;i<3;i++)nav+=balances[i]*BigInt(markets[i].price)/10n**18n;
  const weights=balances.map((b,i)=>nav>0n?Number(b*BigInt(markets[i].price)/10n**18n*10000n/nav):0);
  let target=[],validationError=null;
  try {target=Array.from(await strategy.targetWeights(opt),Number);await risk.validate(target,opt);} catch(e) {validationError=e.reason||e.shortMessage||e.message;}
  const selected=Number(await strategy.selected(opt));
  return {scope,blockNumber,blockHash:block.hash,timestamp:block.timestamp,nav:nav.toString(),navUsd:amount(nav),totalSupply:supply.toString(),shareIndex:supply>0n?Number(nav)*1e8/Number(supply):100,assets:markets.map((m,i)=>({...m,balance:balances[i].toString(),balanceFormatted:amount(balances[i]),valueUsd:amount(balances[i]*BigInt(m.price)/10n**18n),weightBps:weights[i]})),weights,target,validationError,selected,paused:await risk.paused(opt),automationEnabled:await vault.automationEnabled(opt),lastRebalance:Number(await vault.lastRebalance(opt)),cooldown:Number(await strategy.cooldown(opt)),cashBuffer:Number(await strategy.cashBuffer(opt)),targetVolatility:Number(await strategy.targetVolatility(opt)),strategyEnabled:await Promise.all([0,1,2].map(i=>strategy.enabled(i,opt))),limits:{maxWeight:Number(await risk.maxWeight(opt)),minCash:Number(await risk.minCash(opt)),maxVolatility:Number(await risk.maxVolatility(opt)),maxSlippage:Number(await risk.maxSlippage(opt)),maxAge:Number(await risk.maxAge(opt))},valuationStale:markets.some((m,i)=>m.stale&&balances[i]>0n)};
 }
 async function syncOnce() {
  const state=await read(); const cursor=db.prepare('SELECT * FROM cursors WHERE scope=?').get(scope);
  let start=manifest.deploymentBlock;
  if(cursor) {const previous=await provider.getBlock(cursor.block_number);if(previous?.hash===cursor.block_hash) start=cursor.block_number+1;}
  const eventRows=[];
  const contracts=[['RiskManager',risk],['StrategyEngine',strategy],['PortfolioVault',vault],['MockExchange',ctx.exchange]];
  // First deploys precede vault; all relevant initial market/business events follow it.
  if(start<=state.blockNumber) for(let from=start;from<=state.blockNumber;from+=2000) {
   const logs=await provider.getLogs({address:contracts.map(([,c])=>c.target),fromBlock:from,toBlock:Math.min(from+1999,state.blockNumber)});
   for(const log of logs) {const [name,c]=contracts.find(([,c])=>c.target.toLowerCase()===log.address.toLowerCase());try {const ev=c.interface.parseLog(log);eventRows.push([scope,log.transactionHash,log.index,log.blockNumber,log.blockHash,name,ev.name,stringify(ev.args.toArray())]);}catch{}}
  }
  db.exec('BEGIN IMMEDIATE');
  try {
   if(cursor&&start===manifest.deploymentBlock) for(const table of ['events','snapshots','prices','strategies']) db.prepare(`DELETE FROM ${table} WHERE scope=?`).run(scope);
   const put=db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?,?,?)');for(const row of eventRows)put.run(...row);
   db.prepare('INSERT OR REPLACE INTO snapshots VALUES(?,?,?,?,?,?,?,?)').run(scope,state.blockNumber,state.blockHash,state.timestamp,state.nav,state.totalSupply,state.shareIndex,stringify(state.weights));
   for(const a of state.assets)db.prepare('INSERT OR REPLACE INTO prices VALUES(?,?,?,?,?,?,?)').run(scope,a.address,state.blockNumber,a.price,a.volatility,a.momentum,a.updatedAt);
   db.prepare('INSERT OR REPLACE INTO strategies VALUES(?,?,?,?,?)').run(scope,state.blockNumber,state.selected,stringify(state.target),stringify({cashBuffer:state.cashBuffer,targetVolatility:state.targetVolatility,cooldown:state.cooldown}));
   db.prepare('INSERT OR REPLACE INTO cursors VALUES(?,?,?)').run(scope,state.blockNumber,state.blockHash);db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  return state;
 }
 const sync=()=>pending??=(syncOnce().finally(()=>{pending=null;}));
 function history(limit=50) {return db.prepare('SELECT * FROM events WHERE scope=? ORDER BY block_number DESC,log_index DESC LIMIT ?').all(scope,limit).map(x=>({...x,payload:JSON.parse(x.payload)}));}
 function snapshots() {return db.prepare('SELECT * FROM snapshots WHERE scope=? ORDER BY block_number DESC LIMIT 200').all(scope).reverse();}
 async function account(address) {if(!isAddress(address))throw new Error('Invalid account');return {address,shares:(await vault.balanceOf(address)).toString(),cash:(await ctx.tokens[0].balanceOf(address)).toString(),allowance:(await ctx.tokens[0].allowance(address,vault.target)).toString()};}
 return {ctx,store,scope,sync,read,history,snapshots,account,job};
}
