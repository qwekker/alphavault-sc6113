import {Interface} from 'ethers';
// A whitelist of business method signatures, excluding deployments/mints/getters.
export const transactionKinds={PortfolioVault:['deposit','redeem','setAutomation','rebalance'],StrategyEngine:['selectStrategy','configure','setEnabled'],RiskManager:['updateMarket','setAssetEnabled','setLimits','setPaused','setRole'],MockERC20:['approve']};
export async function receiptEvidence(ctx,hash) {
 if(!/^0x[\da-fA-F]{64}$/.test(hash))throw new Error('Invalid transaction hash');
 const {provider,manifest,artifacts}=ctx;
 const [tx,receipt]=await Promise.all([provider.getTransaction(hash),provider.getTransactionReceipt(hash)]);
 if(!tx||!receipt)return {hash,status:'pending-or-unknown',chainId:manifest.chainId};
 if(Number(tx.chainId)!==manifest.chainId)throw new Error('Transaction chain mismatch');
 const candidates=[...Object.entries(manifest.contracts),[ 'MockERC20',manifest.assets[0].address]];
 const match=candidates.find(([,address])=>address.toLowerCase()===tx.to?.toLowerCase());
 if(!match)throw new Error('Transaction does not target this AlphaVault deployment');
 const [contract]=match;let decoded;try{decoded=new Interface(artifacts[contract].abi).parseTransaction({data:tx.data,value:tx.value});}catch{}
 const known=decoded&&transactionKinds[contract]?.includes(decoded.name);
 if(!known)throw new Error('Not a supported AlphaVault business transaction');
 if(contract==='MockERC20'&&decoded.args[0].toLowerCase()!==manifest.contracts.PortfolioVault.toLowerCase())throw new Error('Approval does not authorize this vault');
 const block=await provider.getBlock(receipt.blockNumber);if(!block||block.hash!==receipt.blockHash)throw new Error('Receipt is no longer canonical');
 const head=Number(await provider.send('eth_blockNumber',[]));
 return {chainId:manifest.chainId,vault:manifest.contracts.PortfolioVault,hash:receipt.hash,from:receipt.from,to:receipt.to,contract,method:decoded.name,kind:contract+'.'+decoded.name,status:receipt.status===1?'confirmed':'reverted',blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,timestamp:block.timestamp,confirmations:Math.max(0,head-receipt.blockNumber+1),gasUsed:receipt.gasUsed.toString(),effectiveGasPrice:receipt.gasPrice.toString(),feeWei:(receipt.gasUsed*receipt.gasPrice).toString(),explorerUrl:manifest.chainId===11155111?'https://sepolia.etherscan.io/tx/'+receipt.hash:null};
}
export function createReceiptService(service) {
 const {db}=service.store;db.exec('CREATE TABLE IF NOT EXISTS receipts(scope TEXT,hash TEXT,payload TEXT,PRIMARY KEY(scope,hash));');
 const remember=async hash=>{const evidence=await receiptEvidence(service.ctx,hash);if(evidence.status==='pending-or-unknown')throw new Error('Transaction not yet confirmed; try again later');db.prepare('INSERT OR REPLACE INTO receipts VALUES(?,?,?)').run(service.scope,hash,JSON.stringify(evidence));return evidence;};
 const exportAll=async()=>{
  const saved=db.prepare('SELECT hash FROM receipts WHERE scope=? ORDER BY rowid LIMIT 300').all(service.scope);
  const totalSaved=Number(db.prepare('SELECT count(*) n FROM receipts WHERE scope=?').get(service.scope).n);
  const receipts=[],excluded=[];
  // Revalidate before export so reorged/pending receipts are never counted as success.
  for(const {hash} of saved){try{const r=await receiptEvidence(service.ctx,hash);if(r.status==='pending-or-unknown')excluded.push({hash,reason:r.status});else receipts.push(r);}catch(e){excluded.push({hash,reason:e.message});}}
  const completed=[...new Set(receipts.filter(r=>r.status==='confirmed').map(r=>r.kind))];
  const required=Object.entries(transactionKinds).flatMap(([c,methods])=>methods.map(m=>c+'.'+m));
  return {generatedAt:new Date().toISOString(),chainId:service.ctx.manifest.chainId,vault:service.ctx.manifest.contracts.PortfolioVault,source:'RPC-verified transactions submitted to this deployment',totalSaved,exportLimit:300,truncated:totalSaved>300,finality:'Canonical at export time; confirmations are reported, not a finality guarantee',successfulKinds:completed.length,minimumTenKindsMet:completed.length>=10,coverage:required.map(kind=>({kind,completed:completed.includes(kind)})),receipts,excluded};
 };
 return {remember,exportAll};
}
