import ganache from 'ganache';
import { BrowserProvider, ContractFactory, parseEther } from 'ethers';
import { compile } from './compile.mjs';
export const MNEMONIC='test test test test test test test test test test test junk';
export async function localChain(options={}) {
 const rpc=ganache.provider({logging:{quiet:true},chain:{chainId:31337,hardfork:'shanghai'},wallet:{mnemonic:MNEMONIC,totalAccounts:8},...options});
 const provider=new BrowserProvider(rpc,undefined,{cacheTimeout:-1}); provider.pollingInterval=20;
 const signers=await Promise.all(Array.from({length:6},(_,i)=>provider.getSigner(i)));
 return {rpc,provider,signers,close:()=>rpc.disconnect()};
}
export async function deploy(provider, signers, artifacts=compile(), record=async()=>{}) {
 const [admin,investor,manager,officer,keeper]=signers;
 const addresses=await Promise.all(signers.map(s=>s.getAddress()));
 const make=async(name,args=[])=>{const c=await new ContractFactory(artifacts[name].abi,artifacts[name].bytecode,admin).deploy(...args);await c.waitForDeployment();await record('deploy '+name,c.deploymentTransaction());return c;};
 const tokens=[];for(const [name,symbol] of [['Mock USD','mUSD'],['Mock Ether','mETH'],['Mock Bitcoin','mBTC']]) tokens.push(await make('MockERC20',[name,symbol]));
 const assets=await Promise.all(tokens.map(c=>c.getAddress()));
 const risk=await make('RiskManager',[assets,addresses[2],addresses[3],addresses[4]]);
 const strategy=await make('StrategyEngine',[await risk.getAddress()]);
 const exchange=await make('MockExchange',[await risk.getAddress()]);
 const vault=await make('PortfolioVault',[await risk.getAddress(),await strategy.getAddress(),await exchange.getAddress()]);
 const tx=async(name,p)=>{const t=await p;await t.wait();await record(name,t);};
 for(let i=1;i<3;i++) {
  await tx('updateMarket',risk.connect(officer).updateMarket(assets[i],parseEther(i===1?'3000':'60000'),i===1?4000:3000,i===1?800:400));
  await tx('setAssetEnabled',risk.connect(officer).setAssetEnabled(assets[i],true));
 }
 for(let i=0;i<3;i++) await tx('mint exchange liquidity',tokens[i].mint(await exchange.getAddress(),parseEther(i===0?'100000000':'1000000')));
 await tx('mint investor funds',tokens[0].mint(addresses[1],parseEther('100000')));
 const contracts={risk,strategy,exchange,vault,tokens};
 const network=await provider.getNetwork();
 const manifest={chainId:Number(network.chainId),networkName:Number(network.chainId)===31337?'Local EVM':'Sepolia',mode:'mock-assets',createdAt:new Date().toISOString(),deploymentBlock:await vault.deploymentTransaction().wait().then(r=>r.blockNumber),roles:{admin:addresses[0],investor:addresses[1],manager:addresses[2],risk:addresses[3],keeper:addresses[4]},contracts:{RiskManager:await risk.getAddress(),StrategyEngine:await strategy.getAddress(),MockExchange:await exchange.getAddress(),PortfolioVault:await vault.getAddress()},assets:assets.map((address,i)=>({address,symbol:['mUSD','mETH','mBTC'][i],decimals:18}))};
 return {...contracts,manifest,artifacts,provider,signers,tx};
}
export {attach} from '../server/contracts.mjs';
export async function seed(ctx) {
 const {signers:[,investor,manager,officer],tx,vault,tokens,risk,strategy}=ctx;
 await tx('approve',tokens[0].connect(investor).approve(await vault.getAddress(),parseEther('100000')));
 await tx('deposit',vault.connect(investor).deposit(parseEther('10000'),0));
 await tx('configure',strategy.connect(manager).configure(1200,2000,60));
 await tx('selectStrategy',strategy.connect(manager).selectStrategy(0));
 await tx('setAutomation',vault.connect(manager).setAutomation(true));
 await tx('setLimits',risk.connect(officer).setLimits(7000,1000,5000,100,3600));
}
