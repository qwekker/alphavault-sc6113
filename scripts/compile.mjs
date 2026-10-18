import solc from 'solc';
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
export function compile() {
 const sources = Object.fromEntries(readdirSync(root+'contracts').filter(x=>x.endsWith('.sol')).map(f=>[f,{content:readFileSync(root+'contracts/'+f,'utf8')}]));
 const result=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}})));
 const errors=(result.errors||[]).filter(e=>e.severity==='error'); if(errors.length) throw new Error(errors.map(e=>e.formattedMessage).join('\n'));
 mkdirSync(root+'artifacts',{recursive:true});mkdirSync(root+'abi',{recursive:true}); const out={};
 for(const contracts of Object.values(result.contracts)) for(const [name,c] of Object.entries(contracts)) {out[name]={contractName:name,abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,compiler:solc.version()};writeFileSync(root+'artifacts/'+name+'.json',JSON.stringify(out[name],null,2));}
 for(const [name,artifact] of Object.entries(out))writeFileSync(root+'abi/'+name+'.abi',JSON.stringify(artifact.abi,null,2)+'\n');
 mkdirSync(root+'public/vendor',{recursive:true});
 writeFileSync(root+'public/vendor/ethers.js',readFileSync(root+'node_modules/ethers/dist/ethers.min.js'));
 return out;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) { const a=compile(); console.log('Compiled:',Object.keys(a).join(', ')); }
