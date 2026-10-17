import {JsonRpcProvider,formatEther} from 'ethers';
import {deploymentTools} from '../public/deployment-core.js';
import * as ethers from 'ethers';
const env=process.env;
const missing=['RPC_URL','DEPLOYER_ADDRESS','INVESTOR_ADDRESS','MANAGER_ADDRESS','RISK_ADDRESS','KEEPER_ADDRESS'].filter(n=>!env[n]);
if(missing.length){console.error('Missing public configuration: '+missing.join(', '));console.error('Copy setup/sepolia.env.example to .env.sepolia.local and fill public addresses. No private key is required for this check.');process.exitCode=1;}
else{
 let provider;try{
  const roles=deploymentTools(ethers).roles({admin:env.DEPLOYER_ADDRESS,investor:env.INVESTOR_ADDRESS,manager:env.MANAGER_ADDRESS,risk:env.RISK_ADDRESS,keeper:env.KEEPER_ADDRESS});
  provider=new JsonRpcProvider(env.RPC_URL,undefined,{cacheTimeout:-1});if((await provider.getNetwork()).chainId!==11155111n)throw new Error('RPC is not Sepolia');
  const balances=[];for(const [role,address] of Object.entries(roles)){const n=await provider.getBalance(address);balances.push({role,address,eth:formatEther(n),hasTestEth:n>0n});}
  console.log(JSON.stringify({network:'Sepolia',chainId:11155111,balances,note:'Positive balance is not a full-deployment cost guarantee. The wizard estimates each transaction before signing.'},null,2));
 }catch(e){console.error(e.reason||e.shortMessage||e.message);process.exitCode=1;}finally{provider?.destroy();}
}
