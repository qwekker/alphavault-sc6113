import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const [baseArg,output,baselinePath]=process.argv.slice(2);
if(!baseArg)throw new Error('Usage: node scripts/check-hosted.mjs https://YOUR_HOST [output.json] [before-restart.json]');
const base=new URL(baseArg);
assert(base.protocol==='https:'||(['localhost','127.0.0.1'].includes(base.hostname)&&base.protocol==='http:'),'Use HTTPS for public deployment');
const manifest=JSON.parse(readFileSync(new URL('../config/sepolia-deployment.json',import.meta.url)));
async function read(path){const r=await fetch(new URL(path,base),{signal:AbortSignal.timeout(180000)});assert.equal(r.status,200,path);return r.json();}
const health=await read('/api/health'),config=await read('/api/config');
assert.equal(health.mode,'wallet');assert.equal(health.database,'sqlite');assert.equal(health.chainId,11155111);assert.equal(config.demo,false);
assert.equal(config.contracts.PortfolioVault.toLowerCase(),manifest.contracts.PortfolioVault.toLowerCase());
const denied=await fetch(new URL('/api/demo/action',base),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
assert.equal(denied.status,403,'Hosted service must not expose local signing');
const portfolio=await read('/api/portfolio'),history=await read('/api/history?limit=200'),evidence=await read('/api/evidence');
assert(evidence.successfulKinds>=10,'Import the demonstrated business receipts');assert.equal(evidence.excluded.length,0);assert.equal(evidence.truncated,false);
assert(history.some(e=>e.name==='Rebalanced'));assert(history.some(e=>e.name==='Redeemed'));
const result={checkedAt:new Date().toISOString(),url:base.origin,health,vault:config.contracts.PortfolioVault,blockNumber:portfolio.blockNumber,navUsd:portfolio.navUsd,paused:portfolio.paused,successfulKinds:evidence.successfulKinds,receiptHashes:evidence.receipts.map(r=>r.hash).sort(),eventKeys:history.map(e=>e.tx_hash+':'+e.log_index).sort(),databaseRestartVerified:false};
if(baselinePath){const before=JSON.parse(readFileSync(baselinePath));assert.equal(before.url,result.url);assert.equal(before.vault,result.vault);for(const h of before.receiptHashes)assert(result.receiptHashes.includes(h),'Receipt lost after restart: '+h);for(const key of before.eventKeys)assert(result.eventKeys.includes(key),'Historical event absent after restart: '+key);result.restartComparisonPassed=true;result.persistenceCaveat='API history can be reindexed and seeded receipts reimported. Verify the same SQLite volume/file separately before claiming durable storage.';}
if(output)writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
