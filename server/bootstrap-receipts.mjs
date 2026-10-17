import {createReceiptService} from './receipts.mjs';

// Import only transaction hashes. Cached status, fees and claims are never trusted.
export async function bootstrapReceipts(service,seed) {
 const manifest=service.ctx.manifest;
 if(seed.chainId!==manifest.chainId||seed.vault?.toLowerCase()!==manifest.contracts.PortfolioVault.toLowerCase())throw new Error('Receipt seed deployment mismatch');
 if(!Array.isArray(seed.hashes)||seed.hashes.length>300||seed.hashes.some(h=>typeof h!=='string'||!/^0x[\da-fA-F]{64}$/.test(h)))throw new Error('Invalid receipt seed hashes');
 const receipts=createReceiptService(service);let imported=0,skipped=0;
 for(const hash of new Set(seed.hashes.map(h=>h.toLowerCase()))){
  if(service.store.db.prepare('SELECT 1 FROM receipts WHERE scope=? AND hash=?').get(service.scope,hash)){skipped++;continue;}
  await receipts.remember(hash);imported++;
 }
 return {imported,skipped};
}
