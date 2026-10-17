import { JsonRpcProvider } from 'ethers';
import { readFileSync } from 'node:fs';
import {projectRoot as root} from './deployment.mjs';
import { attach } from './contracts.mjs';
import { createStore } from './store.mjs';
import { createService } from './service.mjs';
import { createApp } from './app.mjs';
import {verifyDeployment} from './deployment.mjs';
import {bootstrapReceipts} from './bootstrap-receipts.mjs';
if(!process.env.RPC_URL||!process.env.DEPLOYMENT_FILE)throw new Error('Set RPC_URL and DEPLOYMENT_FILE; for local demo use npm run dev');
const manifest=JSON.parse(readFileSync(process.env.DEPLOYMENT_FILE,'utf8')),provider=new JsonRpcProvider(process.env.RPC_URL);
if(Number((await provider.getNetwork()).chainId)!==manifest.chainId)throw new Error('Chain mismatch');
if(await provider.getCode(manifest.contracts.PortfolioVault)==='0x')throw new Error('Vault not deployed on this chain');
const artifacts=Object.fromEntries(['RiskManager','StrategyEngine','PortfolioVault','MockExchange','MockERC20'].map(n=>[n,JSON.parse(readFileSync(root+'artifacts/'+n+'.json','utf8'))]));
await verifyDeployment(provider,manifest,artifacts);
const store=createStore(process.env.DB_PATH||root+'data/hosted.sqlite'),service=createService(attach(provider,manifest,artifacts),store);
if(process.env.RECEIPT_SEED_FILE){const result=await bootstrapReceipts(service,JSON.parse(readFileSync(process.env.RECEIPT_SEED_FILE,'utf8')));console.log('Receipt bootstrap:',JSON.stringify(result));}
await service.sync();
const port=Number(process.env.PORT||3100),host=process.env.HOST||'127.0.0.1';
const server=createApp(service).listen(port,host,()=>console.log(`AlphaVault wallet mode: http://${host}:${port}`));
// The HTTP service NEVER loads a wallet/private key. Public writes require client signatures.
let timer,busy=false;timer=setInterval(async()=>{if(busy)return;busy=true;try{await service.sync();}catch(e){console.error('Indexer:',e.shortMessage||e.message);}finally{busy=false;}},15000);
const stop=()=>{clearInterval(timer);server.close(()=>{store.close();provider.destroy();process.exit(0);});};process.on('SIGTERM',stop);process.on('SIGINT',stop);
