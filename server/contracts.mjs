import {Contract} from 'ethers';
export function attach(provider,manifest,artifacts) {
 const get=name=>new Contract(manifest.contracts[name],artifacts[name].abi,provider);
 return {provider,manifest,artifacts,risk:get('RiskManager'),strategy:get('StrategyEngine'),exchange:get('MockExchange'),vault:get('PortfolioVault'),tokens:manifest.assets.map(a=>new Contract(a.address,artifacts.MockERC20.abi,provider))};
}
