// Shared by the MetaMask wizard, CLI and local EVM rehearsal. No embedded keys.
export function deploymentTools(ethers) {
 const {ContractFactory,Interface,getAddress,ZeroAddress,keccak256,toUtf8Bytes,parseEther,id}=ethers;
 const names=['MockERC20','RiskManager','StrategyEngine','MockExchange','PortfolioVault'];
 const chainId=11155111;
 const redemption=new Interface(['function redeemDelegations(bytes[] permissionContexts, bytes32[] modes, bytes[] executionCallDatas)']);
 // Recovery only: this Sepolia wallet route was observed wrapping a failed call.
 // Successful wrapped calls still require a separate verifier and are NOT accepted.
 const recoveryWrapper='0xdb9b1e94b5b69df7e401ddbede43491141047db3';
 function matchesFailedCall(tx,expected) {
  if((tx.to||'').toLowerCase()===(expected.to||'').toLowerCase()&&tx.data.toLowerCase()===expected.data.toLowerCase())return 'direct';
  if(!expected.to||tx.type!==4||tx.to?.toLowerCase()!==recoveryWrapper)return null;
  try {
   const [contexts,modes,calls]=redemption.decodeFunctionData('redeemDelegations',tx.data);
   if(contexts.length!==1||modes.length!==1||calls.length!==1||modes[0]!=='0x'+'00'.repeat(32))return null;
   const packed='0x'+expected.to.slice(2).toLowerCase()+'00'.repeat(32)+expected.data.slice(2).toLowerCase();
   if(calls[0].toLowerCase()!==packed)return null;
   if(redemption.encodeFunctionData('redeemDelegations',[contexts,modes,calls]).toLowerCase()!==tx.data.toLowerCase())return null;
   return 'reverted-wallet-wrapper';
  }catch{return null;}
 }
 const normalize=address=>{const a=getAddress(address);if(a===ZeroAddress)throw new Error('Zero addresses are not allowed');return a;};
 function roles(input) {
  const r=Object.fromEntries(['admin','investor','manager','risk','keeper'].map(k=>[k,normalize(input[k])]));
  if(new Set([r.investor,r.manager,r.risk].map(x=>x.toLowerCase())).size!==3)throw new Error('Investor, manager and risk officer must use three distinct addresses');
  return r;
 }
 function artifactHash(artifacts) {
  return keccak256(toUtf8Bytes(JSON.stringify(names.map(n=>{if(!artifacts[n]?.bytecode?.startsWith('0x'))throw new Error('Missing artifact '+n);return [n,artifacts[n].abi,artifacts[n].bytecode];}))));
 }
 function createJournal(input,artifacts) {return {version:1,chainId,roles:roles(input),artifactHash:artifactHash(artifacts),createdAt:new Date().toISOString(),steps:[]};}
 function validateJournal(j,artifacts) {
  if(j?.version!==1||j.chainId!==chainId||!Array.isArray(j.steps))throw new Error('Unsupported deployment journal');
  roles(j.roles);if(j.artifactHash!==artifactHash(artifacts))throw new Error('Compiler artifacts changed. Use the original artifacts to resume this deployment');
  if(j.steps.length>plan(j.roles).length)throw new Error('Unexpected deployment journal length');
 }
 function unsentRoles(journal,artifacts) {
  validateJournal(journal,artifacts);
  if(journal.steps.length||(journal.failedAttempts!==undefined&&(!Array.isArray(journal.failedAttempts)||journal.failedAttempts.length)))throw new Error('Cannot edit a deployment with submitted, uncertain or failed attempts; recover the original plan');
  return {...journal.roles};
 }
 function plan(r) {
  const p=[
   {key:'usd',label:'Deploy mock USD',contract:'MockERC20',args:()=>['Mock USD','mUSD']},
   {key:'eth',label:'Deploy mock Ether',contract:'MockERC20',args:()=>['Mock Ether','mETH']},
   {key:'btc',label:'Deploy mock Bitcoin',contract:'MockERC20',args:()=>['Mock Bitcoin','mBTC']},
   {key:'risk',label:'Deploy RiskManager',contract:'RiskManager',args:a=>[[a.usd,a.eth,a.btc],r.manager,r.admin,r.keeper]},
   {key:'strategy',label:'Deploy StrategyEngine',contract:'StrategyEngine',args:a=>[a.risk]},
   {key:'exchange',label:'Deploy mock exchange',contract:'MockExchange',args:a=>[a.risk]},
   {key:'vault',label:'Deploy PortfolioVault',contract:'PortfolioVault',args:a=>[a.risk,a.strategy,a.exchange]},
   {key:'price-eth',label:'Initialize mETH market report',at:'risk',contract:'RiskManager',method:'updateMarket',args:a=>[a.eth,parseEther('3000'),4000,800]},
   {key:'enable-eth',label:'Enable mETH',at:'risk',contract:'RiskManager',method:'setAssetEnabled',args:a=>[a.eth,true]},
   {key:'price-btc',label:'Initialize mBTC market report',at:'risk',contract:'RiskManager',method:'updateMarket',args:a=>[a.btc,parseEther('60000'),3000,400]},
   {key:'enable-btc',label:'Enable mBTC',at:'risk',contract:'RiskManager',method:'setAssetEnabled',args:a=>[a.btc,true]},
   ...[['usd','100000000'],['eth','1000000'],['btc','1000000']].map(([asset,n])=>({key:'liquidity-'+asset,label:'Fund exchange '+asset.toUpperCase(),at:asset,contract:'MockERC20',method:'mint',args:a=>[a.exchange,parseEther(n)]})),
   {key:'investor-funds',label:'Mint 100,000 mock USD to investor',at:'usd',contract:'MockERC20',method:'mint',args:()=>[r.investor,parseEther('100000')]},
   {key:'grant-risk',label:'Grant risk role to designated officer',at:'risk',contract:'RiskManager',method:'setRole',args:()=>[id('RISK'),r.risk,true]}
  ];
  if(r.admin.toLowerCase()!==r.risk.toLowerCase())p.push({key:'revoke-bootstrap',label:'Revoke temporary deployer risk role',at:'risk',contract:'RiskManager',method:'setRole',args:()=>[id('RISK'),r.admin,false]});
  return p;
 }
 async function request(step,addresses,artifacts) {
  const args=step.args(addresses),a=artifacts[step.contract];
  if(!step.method)return new ContractFactory(a.abi,a.bytecode).getDeployTransaction(...args);
  return {to:addresses[step.at],data:new Interface(a.abi).encodeFunctionData(step.method,args),value:0n};
 }
 async function inspect(provider,journal,artifacts) {
  validateJournal(journal,artifacts);
  if(Number((await provider.getNetwork()).chainId)!==chainId)throw new Error('Switch wallet/RPC to Sepolia (11155111)');
  const p=plan(journal.roles),addresses={};let next=0;
  for(let i=0;i<journal.steps.length;i++) {
   const entry=journal.steps[i],step=p[i];if(entry.key!==step.key)throw new Error('Deployment journal step order mismatch');
   if(!entry.hash)throw new Error('Uncertain wallet submission at '+step.label+'. Recover its transaction hash before proceeding');
   const [tx,receipt]=await Promise.all([provider.getTransaction(entry.hash),provider.getTransactionReceipt(entry.hash)]);
   if(!tx||!receipt)throw new Error('Transaction is pending or unavailable: '+entry.hash+'. Wait or verify the RPC; do not redeploy');
   const expected=await request(step,addresses,artifacts);
   if(tx.from.toLowerCase()!==journal.roles.admin.toLowerCase()||Number(tx.chainId)!==chainId||(tx.to||'').toLowerCase()!==(expected.to||'').toLowerCase()||tx.data.toLowerCase()!==expected.data.toLowerCase()||tx.value!==0n)throw new Error('Transaction does not match deployment step '+step.label);
   const block=await provider.getBlock(receipt.blockNumber);
   if(!block||block.hash!==receipt.blockHash)throw new Error('Receipt is not on the canonical chain; wait and recheck');
   if(receipt.status!==1)throw new Error('Mined transaction reverted: '+entry.hash+'. Use retry-failed after reviewing the receipt');
   if(!step.method){if(!receipt.contractAddress||await provider.getCode(receipt.contractAddress)==='0x')throw new Error('Deployment bytecode is missing');addresses[step.key]=receipt.contractAddress;}
   Object.assign(entry,{status:'confirmed',blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,contractAddress:receipt.contractAddress,gasUsed:receipt.gasUsed.toString(),feeWei:(receipt.gasUsed*receipt.gasPrice).toString()});next=i+1;
  }
  return {plan:p,addresses,next,complete:next===p.length};
 }
 async function estimate(provider,journal,artifacts) {
  const state=await inspect(provider,journal,artifacts);if(state.complete)return {...state,estimate:null};
  if(await provider.getCode(journal.roles.admin)!=='0x')throw new Error('Use a standard EOA deployer account without smart-account/delegation code; wrapped deployments are not supported by this receipt verifier');
  const step=state.plan[state.next],tx=await request(step,state.addresses,artifacts);
  const gas=await provider.estimateGas({...tx,from:journal.roles.admin});const fee=await provider.getFeeData();const price=fee.maxFeePerGas??fee.gasPrice;
  if(price===null)throw new Error('RPC did not return a gas price');
  const gasLimit=gas*120n/100n;const feeCeilingWei=gasLimit*price;
  const balance=await provider.getBalance(journal.roles.admin);
  return {...state,transaction:tx,estimate:{gas:gas.toString(),gasLimit:gasLimit.toString(),feeCeilingWei:feeCeilingWei.toString(),balanceWei:balance.toString(),funded:balance>=feeCeilingWei}};
 }
 async function executeNext({provider,signer,journal,artifacts,save}) {
  if((await signer.getAddress()).toLowerCase()!==journal.roles.admin.toLowerCase())throw new Error('Reconnect the original deployer account');
  const state=await estimate(provider,journal,artifacts);if(state.complete)return state;
  if(!state.estimate.funded)throw new Error('Insufficient Sepolia ETH for the next estimated transaction');
  const step=state.plan[state.next],entry={key:step.key,label:step.label,status:'submitting'};
  journal.steps.push(entry);await save(journal); // Durable checkpoint BEFORE wallet approval.
  let tx;
  try {tx=await signer.sendTransaction({...state.transaction,chainId,gasLimit:BigInt(state.estimate.gasLimit)});}
  catch(e){if(e.code===4001||e.code==='ACTION_REJECTED'){journal.steps.pop();await save(journal);}throw e;}
  entry.hash=tx.hash;entry.status='submitted';await save(journal);
  try {await tx.wait();}catch(e){if(e.code==='TRANSACTION_REPLACED'&&!e.cancelled&&e.replacement){entry.hash=e.replacement.hash;await save(journal);}else throw e;}
  const result=await inspect(provider,journal,artifacts);await save(journal);return result;
 }
 async function retryFailed(provider,journal,artifacts) {
  const previous=structuredClone(journal),failed=previous.steps.pop();
  if(!failed?.hash)throw new Error('Recover the original transaction hash before retrying');
  const state=await inspect(provider,previous,artifacts),step=state.plan[state.next];
  if(step.key!==failed.key)throw new Error('Failed step order mismatch');
  const [tx,r]=await Promise.all([provider.getTransaction(failed.hash),provider.getTransactionReceipt(failed.hash)]);
  if(!tx||!r||r.status!==0)throw new Error('Only a canonically mined reverted transaction may be retried');
  const block=await provider.getBlock(r.blockNumber),expected=await request(step,state.addresses,artifacts);
  const route=matchesFailedCall(tx,expected);
  if(block?.hash!==r.blockHash||tx.from.toLowerCase()!==journal.roles.admin.toLowerCase()||Number(tx.chainId)!==chainId||!route||tx.value!==0n)throw new Error('Failed receipt does not match the expected deployment transaction');
  previous.failedAttempts=[...(previous.failedAttempts||[]),{...failed,status:'reverted',blockNumber:r.blockNumber,blockHash:r.blockHash,gasUsed:r.gasUsed.toString(),feeWei:(r.gasUsed*r.gasPrice).toString(),route}];return previous;
 }
 function manifest(journal,state) {
  if(!state.complete)throw new Error('Finish all deployment steps before exporting the manifest');
  const a=state.addresses;
  return {chainId,networkName:'Sepolia',mode:'mock-assets',createdAt:journal.createdAt,deploymentBlock:journal.steps.find(x=>x.key==='risk').blockNumber,roles:journal.roles,contracts:{RiskManager:a.risk,StrategyEngine:a.strategy,MockExchange:a.exchange,PortfolioVault:a.vault},assets:[['usd','mUSD'],['eth','mETH'],['btc','mBTC']].map(([k,symbol])=>({address:a[k],symbol,decimals:18})),artifactHash:journal.artifactHash};
 }
 return {chainId,roles,plan,createJournal,validateJournal,unsentRoles,inspect,estimate,executeNext,retryFailed,manifest};
}
