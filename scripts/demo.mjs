import ganache from 'ganache';
import { JsonRpcProvider } from 'ethers';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deploy, attach, seed, MNEMONIC } from './chain.mjs';
import { compile, root } from './compile.mjs';
import { createStore } from '../server/store.mjs';
import { createService } from '../server/service.mjs';
import { createApp } from '../server/app.mjs';
import { runKeeper } from './keeper.mjs';
const dir=resolve(process.env.DATA_DIR||root+'data/local');mkdirSync(dir,{recursive:true});
const port=Number(process.env.PORT||3100),rpcPort=Number(process.env.RPC_PORT||18547);
const chain=ganache.server({logging:{quiet:true},chain:{chainId:31337,hardfork:'shanghai'},wallet:{mnemonic:MNEMONIC,totalAccounts:8},database:{dbPath:dir+'/chain'}});
await chain.listen(rpcPort,'127.0.0.1');
const provider=new JsonRpcProvider(`http://127.0.0.1:${rpcPort}`,undefined,{cacheTimeout:-1});provider.pollingInterval=50;
const signers=await Promise.all(Array.from({length:6},(_,i)=>provider.getSigner(i)));
const artifacts=compile();let ctx;const file=dir+'/deployment.json';
if(existsSync(file)) {const manifest=JSON.parse(readFileSync(file,'utf8'));if(await provider.getCode(manifest.contracts.PortfolioVault)==='0x')throw new Error('Manifest does not match persisted chain. Choose a new DATA_DIR.');ctx={...attach(provider,manifest,artifacts),signers};}
else {ctx=await deploy(provider,signers,artifacts);await seed(ctx);writeFileSync(file,JSON.stringify(ctx.manifest,null,2));}
const store=createStore(dir+'/alphavault.sqlite');const service=createService(ctx,store);await service.sync();
const server=createApp(service,{demo:true}).listen(port,'127.0.0.1',()=>console.log(`AlphaVault: http://127.0.0.1:${port}\nLocal RPC: http://127.0.0.1:${rpcPort}\nPersisted data: ${dir}\nPublic test accounts only. Demo controls sign on the local chain.`));
// Optional automated process uses a non-overlapping loop; transactions are gated on chain.
const stopKeeper=process.env.AUTO_KEEPER==='1'?runKeeper(service,signers[4]):()=>{};
let stopped=false;async function stop(){if(stopped)return;stopped=true;stopKeeper();server.close();provider.destroy();store.close();await chain.close();}
process.on('SIGINT',()=>stop().then(()=>process.exit(0)));process.on('SIGTERM',()=>stop().then(()=>process.exit(0)));
