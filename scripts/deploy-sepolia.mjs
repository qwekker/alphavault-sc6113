import * as ethers from 'ethers';
import {mkdirSync,existsSync,readFileSync,writeFileSync,renameSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {deploymentTools} from '../public/deployment-core.js';
import {root,compile} from './compile.mjs';
const dir=root+'data/sepolia',path=dir+'/progress.json',lock=dir+'/deployment.lock';let provider,lockFd;
const save=async j=>{writeFileSync(path+'.tmp',JSON.stringify(j,null,2));renameSync(path+'.tmp',path);};
try{
 if(!process.env.RPC_URL||!process.env.DEPLOYER_PRIVATE_KEY)throw new Error('CLI requires RPC_URL and a local test-only DEPLOYER_PRIVATE_KEY. Prefer npm run setup for MetaMask without exporting a key.');
 mkdirSync(dir,{recursive:true});lockFd=openSync(lock,'wx');
 const tools=deploymentTools(ethers),artifacts=compile();provider=new ethers.JsonRpcProvider(process.env.RPC_URL,undefined,{cacheTimeout:-1});
 if((await provider.getNetwork()).chainId!==11155111n)throw new Error('Sepolia only');
 const signer=new ethers.NonceManager(new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY,provider));
 const roles={admin:await signer.getAddress(),investor:process.env.INVESTOR_ADDRESS,manager:process.env.MANAGER_ADDRESS,risk:process.env.RISK_ADDRESS,keeper:process.env.KEEPER_ADDRESS};
 tools.roles(roles);let journal=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):tools.createJournal(roles,artifacts);
 if(JSON.stringify(tools.roles(journal.roles))!==JSON.stringify(tools.roles(roles)))throw new Error('Existing progress uses different role addresses. Do not overwrite it.');
 if(existsSync(dir+'/deployment.json')&&!existsSync(path))throw new Error('A deployment manifest already exists without this journal; inspect it rather than deploying duplicates');
 await save(journal);
 while(true){const state=await tools.estimate(provider,journal,artifacts);if(state.complete){writeFileSync(dir+'/deployment.json',JSON.stringify(tools.manifest(journal,state),null,2));writeFileSync(dir+'/receipts.json',JSON.stringify(journal,null,2));console.log('Deployment complete. Manifest and receipts saved in data/sepolia.');break;}
 console.log(`${state.next+1}/${state.plan.length}: ${state.plan[state.next].label}; estimated ceiling ${ethers.formatEther(state.estimate.feeCeilingWei)} test ETH`);
 await tools.executeNext({provider,signer,journal,artifacts,save});}
}catch(e){console.error(e.code==='EEXIST'?'Another deployment is running, or an interrupted process left data/sepolia/deployment.lock. Inspect the saved progress and pending wallet transactions before clearing that lock.':e.reason||e.shortMessage||e.message);process.exitCode=1;}
finally{provider?.destroy();if(lockFd!==undefined){closeSync(lockFd);unlinkSync(lock);}}
