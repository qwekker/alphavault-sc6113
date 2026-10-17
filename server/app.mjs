import express from 'express';
import { backtest } from './quant.mjs';
import {createReceiptService} from './receipts.mjs';
import { fileURLToPath } from 'node:url';
import { buildAction, demoAction } from './actions.mjs';
export function createApp(service,{demo=false}={}) {
 const receipts=createReceiptService(service);
 const app=express();app.disable('x-powered-by');app.use(express.json({limit:'12kb'}));
 app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','same-origin');res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");next();});
 const run=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
 app.post('/api/receipts',run(async(req,res)=>res.json(await receipts.remember(req.body.hash))));
 app.get('/api/evidence',run(async(req,res)=>res.json(await receipts.exportAll())));
 app.get('/api/health',async(req,res)=>{try{await service.ctx.provider.getBlockNumber();await service.store.health();res.json({ok:true,database:service.store.kind,mode:demo?'local-demo':'wallet',chainId:service.ctx.manifest.chainId});}catch{res.status(503).json({ok:false,error:'Chain or database unavailable'});}});
 if(demo)app.get('/api/setup/artifacts',(req,res)=>res.json(service.ctx.artifacts));
 app.get('/api/config',(req,res)=>res.json({...service.ctx.manifest,demo,strategies:['Equal Weight','Momentum','Volatility Target'],disclosures:['Mock prices reported by risk officer','Prefunded mock exchange; 20 bp fee','Nontransferable shares; in-kind redemption']}));
 app.get('/api/portfolio',run(async(req,res)=>res.json(await service.sync())));
 app.get('/api/prices',run(async(req,res)=>res.json((await service.sync()).assets)));
 app.get('/api/strategies',run(async(req,res)=>{const s=await service.sync();res.json({selected:s.selected,enabled:s.strategyEnabled,target:s.target,validationError:s.validationError,cashBuffer:s.cashBuffer,targetVolatility:s.targetVolatility,cooldown:s.cooldown});}));
 app.get('/api/history',run(async(req,res)=>{const limit=Number(req.query.limit??50);if(!Number.isInteger(limit)||limit<1||limit>200)return res.status(400).json({error:'limit must be 1..200'});await service.sync();res.json(await service.history(limit));}));
 app.get('/api/snapshots',run(async(req,res)=>{await service.sync();res.json(await service.snapshots());}));
 app.get('/api/account/:address',run(async(req,res)=>res.json(await service.account(req.params.address))));
 app.get('/api/backtests/:id',run(async(req,res)=>{const id=Number(req.params.id);if(!Number.isInteger(id)||id<0||id>2)return res.status(400).json({error:'strategy must be 0..2'});const result=backtest(id);await service.store.db.prepare('INSERT INTO backtests VALUES(?,?,?,?) ON CONFLICT(strategy) DO UPDATE SET created_at=excluded.created_at,source=excluded.source,result=excluded.result').run(id,Date.now(),result.source,JSON.stringify(result));res.json(result);}));
 app.get('/api/jobs',run(async(req,res)=>res.json(await service.store.db.prepare('SELECT * FROM jobs WHERE scope=? ORDER BY id DESC LIMIT 50').all(service.scope))));
 app.post('/api/transactions/build',run(async(req,res)=>res.json(await buildAction(service.ctx,req.body.action,req.body.args))));
 let busy=false;
 app.post('/api/demo/action',run(async(req,res)=>{
  if(!demo)return res.status(403).json({error:'Demo signing disabled; use your wallet'});
  if(!['localhost','127.0.0.1','[::1]'].includes(req.hostname))return res.status(403).json({error:'Local Host required'});
  const address=req.socket.remoteAddress;
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address))return res.status(403).json({error:'Loopback only'});
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return res.status(403).json({error:'Cross-origin action rejected'});
  if(req.headers['x-alphavault-demo']!=='1')return res.status(403).json({error:'Explicit demo header required'});
  if(busy)return res.status(409).json({error:'Another transaction is pending'});busy=true;
  try {res.json(await demoAction(service,req.body.action,req.body.args,req.body.role));}finally{busy=false;}
 }));
 app.get('/vendor/ethers.js',(req,res)=>res.sendFile(fileURLToPath(new URL('../node_modules/ethers/dist/ethers.min.js',import.meta.url))));
 app.use(express.static(fileURLToPath(new URL('../public',import.meta.url))));
 app.use('/api',(req,res)=>res.status(404).json({error:'Unknown API route'}));
 app.use((err,req,res,next)=>res.status(err.type==='entity.parse.failed'?400:400).json({error:err.reason||err.info?.error?.data?.reason||err.shortMessage||err.message||'Request failed'}));
 return app;
}
