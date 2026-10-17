import {Contract,isAddress,ZeroAddress} from 'ethers';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export const projectRoot=fileURLToPath(new URL('../',import.meta.url));
export function readArtifacts() {return Object.fromEntries(['RiskManager','StrategyEngine','PortfolioVault','MockExchange','MockERC20'].map(n=>[n,JSON.parse(readFileSync(projectRoot+'artifacts/'+n+'.json','utf8'))]));}
export async function verifyDeployment(provider,manifest,artifacts) {
 if(!Number.isSafeInteger(manifest.chainId)||![31337,11155111].includes(manifest.chainId))throw new Error('Unsupported chain ID');
 if(Number((await provider.getNetwork()).chainId)!==manifest.chainId)throw new Error('Chain mismatch');
 if(!Number.isSafeInteger(manifest.deploymentBlock)||manifest.deploymentBlock<0)throw new Error('Invalid deployment block');
 const check=a=>{if(!isAddress(a)||a===ZeroAddress)throw new Error('Invalid deployment address');return a.toLowerCase();};
 const values=['PortfolioVault','StrategyEngine','RiskManager','MockExchange'].map(n=>manifest.contracts?.[n]);
 if(!Array.isArray(manifest.assets)||manifest.assets.length!==3)throw new Error('Expected exactly three assets');
 values.push(...manifest.assets.map(a=>a.address));if(new Set(values.map(check)).size!==7)throw new Error('Contract addresses must be distinct');
 for(const role of ['admin','investor','manager','risk','keeper'])check(manifest.roles?.[role]);
 for(const a of values)if(await provider.getCode(a)==='0x')throw new Error('No deployed code at '+a);
 const c=name=>new Contract(manifest.contracts[name],artifacts[name].abi,provider);
 const vault=c('PortfolioVault'),strategy=c('StrategyEngine'),risk=c('RiskManager'),exchange=c('MockExchange');
 const same=(actual,expected,label)=>{if(actual.toLowerCase()!==expected.toLowerCase())throw new Error('Deployment wiring mismatch: '+label);};
 same(await vault.risk(),risk.target,'vault.risk');same(await vault.strategy(),strategy.target,'vault.strategy');same(await vault.exchange(),exchange.target,'vault.exchange');same(await strategy.risk(),risk.target,'strategy.risk');same(await exchange.risk(),risk.target,'exchange.risk');same(await risk.admin(),manifest.roles.admin,'risk.admin');
 for(let i=0;i<3;i++){same(await risk.assets(i),manifest.assets[i].address,'risk.asset '+i);const t=new Contract(manifest.assets[i].address,artifacts.MockERC20.abi,provider);same(await t.owner(),manifest.roles.admin,'token.owner');if(await t.decimals()!==18n||manifest.assets[i].decimals!==18)throw new Error('Expected 18-decimal mock assets');if(await t.symbol()!==manifest.assets[i].symbol)throw new Error('Token symbol mismatch');}
 return {ok:true,chainId:manifest.chainId,vault:vault.target,checkedContracts:7};
}
