// Dedicated local chain for the Python backend. No Express HTTP server is started.
import ganache from 'ganache';
import {JsonRpcProvider} from 'ethers';
import {mkdirSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {deploy,seed,MNEMONIC} from './chain.mjs';
import {compile,root} from './compile.mjs';
const dir=resolve(process.env.DATA_DIR||root+'data/flask-local');mkdirSync(dir,{recursive:true});
const port=Number(process.env.RPC_PORT||18547);
const server=ganache.server({logging:{quiet:true},chain:{chainId:31337,hardfork:'shanghai'},wallet:{mnemonic:MNEMONIC,totalAccounts:8},database:{dbPath:dir+'/chain'}});
await server.listen(port,'127.0.0.1');
const provider=new JsonRpcProvider(`http://127.0.0.1:${port}`,undefined,{cacheTimeout:-1});provider.pollingInterval=50;
const file=dir+'/deployment.json';
if(existsSync(file)){const m=JSON.parse(readFileSync(file));if(await provider.getCode(m.contracts.PortfolioVault)==='0x')throw new Error('Persisted manifest does not match chain');}
else{const signers=await Promise.all(Array.from({length:6},(_,i)=>provider.getSigner(i)));const ctx=await deploy(provider,signers,compile());await seed(ctx);writeFileSync(file,JSON.stringify(ctx.manifest,null,2));}
console.log('CHAIN_READY '+file);
async function stop(){provider.destroy();await server.close();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
