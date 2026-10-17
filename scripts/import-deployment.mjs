// Validate a browser-exported deployment before activating wallet-mode configuration.
import {JsonRpcProvider} from 'ethers';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {verifyDeployment,readArtifacts,projectRoot} from '../server/deployment.mjs';
let provider;
try{
 const file=process.argv[2];if(!file||!process.env.RPC_URL)throw new Error('Usage: RPC_URL=... npm run import:deployment -- /path/to/deployment.json');
 const manifest=JSON.parse(readFileSync(file,'utf8'));if(manifest.chainId!==11155111)throw new Error('Expected Sepolia manifest');
 provider=new JsonRpcProvider(process.env.RPC_URL);const result=await verifyDeployment(provider,manifest,readArtifacts());
 const dir=projectRoot+'data/sepolia',dest=dir+'/deployment.json';mkdirSync(dir,{recursive:true});
 if(existsSync(dest)){const old=JSON.parse(readFileSync(dest,'utf8'));if(old.contracts.PortfolioVault.toLowerCase()!==manifest.contracts.PortfolioVault.toLowerCase())throw new Error('Different deployment already saved; keep both manifests separate instead of overwriting');}
 writeFileSync(dest,JSON.stringify(manifest,null,2));console.log(JSON.stringify({...result,saved:'data/sepolia/deployment.json'},null,2));
}catch(e){console.error(e.reason||e.shortMessage||e.message);process.exitCode=1;}finally{provider?.destroy();}
