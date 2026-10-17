import * as ethers from '/vendor/ethers.js';
import {deploymentTools} from './deployment-core.js';
const tools=deploymentTools(ethers),$=s=>document.querySelector(s),key='alphavault:sepolia:deployment:v1';
let provider,signer,artifacts,journal,verified,busy=false;
const message=(text,error=false)=>{$('#setup-status').textContent=text;$('#setup-status').className='status'+(error?' error':'');};
const save=async value=>{localStorage.setItem(key,JSON.stringify(value));};
const download=(filename,value)=>{const u=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=filename;a.click();URL.revokeObjectURL(u);};
const errorText=e=>{const text=e.reason||e.info?.error?.data?.reason||e.shortMessage||e.message;return text?.includes('Use a standard EOA')?(journal?.steps.length||journal?.failedAttempts?.length?'原部署账户在 Sepolia 启用了智能账户或委托代码。请在 MetaMask 关闭该网络的 Smart account，保持原账户，然后检查 / 恢复进度。已有部署不可修改。':'当前部署账户带有智能账户或委托代码，此部署器需要普通账户。请关闭 Sepolia 的 Smart account；或切换普通部署账户，重新连接后点击「修改未发送计划」。'):text;};
function render(state) {
 verified=state;const plan=tools.plan(journal.roles);
 $('#setup-steps').replaceChildren(...plan.map((s,i)=>{const li=document.createElement('li');li.className=i<state.next?'done':i===state.next?'next':'';li.textContent=`${i+1}. ${s.label}${i<state.next?' · confirmed':''}`;const hash=journal.steps[i]?.hash;if(hash){const a=document.createElement('a');a.href='https://sepolia.etherscan.io/tx/'+hash;a.target='_blank';a.rel='noreferrer';a.textContent=' ↗ '+hash.slice(0,12);li.append(a);}return li;}));
 $('#setup-next').textContent=state.complete?'部署已完成。下载 deployment.json，然后配置钱包模式服务。':`下一笔：${state.next+1}/${plan.length} · ${plan[state.next].label}`;
 $('#setup-cost').textContent=state.estimate?`本次估算 gas ${state.estimate.gas}；按当前 RPC 费用和 20% gas 缓冲估算上限 ${ethers.formatEther(state.estimate.feeCeilingWei)} ETH。余额 ${ethers.formatEther(state.estimate.balanceWei)} ETH。钱包最终报价为准。`:'';
 $('#setup-execute').disabled=busy||state.complete||!state.estimate?.funded;$('#setup-manifest').disabled=!state.complete;
 $('#setup-roles').querySelectorAll('input,button').forEach(e=>e.disabled=true);
}
async function check(){if(!provider||!journal)throw new Error('先连接钱包并创建或恢复计划');const s=await tools.estimate(provider,journal,artifacts);await save(journal);render(s);return s;}
async function run(fn){if(busy)return;busy=true;$('#setup-execute').disabled=true;try{await fn();}catch(e){verified=null;$('#setup-execute').disabled=true;message(errorText(e),true);}finally{busy=false;if(verified)render(verified);}}
$('#setup-connect').onclick=()=>run(async()=>{if(!window.ethereum)throw new Error('此浏览器没有检测到 MetaMask。请在安装扩展的 Chrome/Edge 打开该地址。');provider=new ethers.BrowserProvider(window.ethereum,undefined,{cacheTimeout:-1});await provider.send('eth_requestAccounts',[]);signer=await provider.getSigner();const address=await signer.getAddress();$('#setup-account').textContent='部署账户：'+address;const raw=localStorage.getItem(key);if(raw){journal=JSON.parse(raw);tools.validateJournal(journal,artifacts);for(const r of ['investor','manager','risk','keeper'])$('#setup-roles [name='+r+']').value=journal.roles[r];message('发现已保存进度。请检查 / 恢复；不要创建重复部署。');await check();}else{for(const r of ['investor','keeper'])$('#setup-roles [name='+r+']').value=address;message('已连接。填入不同的经理和风险管理员地址，然后创建计划。');}});
$('#setup-network').onclick=()=>run(async()=>{if(!window.ethereum)throw new Error('请使用 MetaMask 浏览器');await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0xaa36a7'}]});message('已请求切换至 Sepolia，请重新连接。');});
$('#setup-roles').onsubmit=e=>{e.preventDefault();void run(async()=>{if(!signer)throw new Error('先连接部署钱包');if(journal||localStorage.getItem(key))throw new Error('已有部署计划，请先恢复进度');journal=tools.createJournal({admin:await signer.getAddress(),...Object.fromEntries(new FormData(e.target))},artifacts);await save(journal);await check();message('计划已保存。核对角色和下一笔费用后，逐笔确认。');});};
$('#setup-edit').onclick=()=>run(async()=>{
 if(!journal)throw new Error('没有已保存的计划，可直接填写角色');
 const keep=tools.unsentRoles(journal,artifacts);
 const stored=localStorage.getItem(key);
 if(stored&&stored!==JSON.stringify(journal))throw new Error('浏览器保存的进度已变化，请重新连接并检查');
 localStorage.removeItem(key);journal=null;verified=null;
 $('#setup-roles').querySelectorAll('input,button').forEach(e=>e.disabled=false);
 for(const r of ['investor','manager','risk','keeper'])$('#setup-roles [name='+r+']').value=keep[r];
 $('#setup-steps').replaceChildren();$('#setup-next').textContent='尚未创建部署计划。';$('#setup-cost').textContent='';$('#setup-manifest').disabled=true;
 message('未发送计划已解锁，业务角色已保留。确认已连接的部署账户后重新创建计划。');
});
$('#setup-check').onclick=()=>run(async()=>{await check();message('链上回执与交易内容核验完成。');});
$('#setup-execute').onclick=()=>run(async()=>{message('请在 MetaMask 中核对并确认这一笔交易。');verified=null;await tools.executeNext({provider,signer,journal,artifacts,save});await check();message('交易已确认，进度已保存。下一笔需要再次点击确认。');});
$('#setup-backup').onclick=()=>{if(journal)download('alphavault-sepolia-progress.json',journal);else message('尚无部署进度',true);};
$('#setup-manifest').onclick=()=>run(async()=>{const state=await tools.inspect(provider,journal,artifacts);download('deployment.json',tools.manifest(journal,state));download('alphavault-deployment-receipts.json',journal);message('部署文件与公开回执已导出。');});
$('#setup-import').onchange=e=>run(async()=>{const f=e.target.files[0];if(!f||f.size>1000000)throw new Error('请选择小于 1 MB 的进度 JSON');const incoming=JSON.parse(await f.text());tools.validateJournal(incoming,artifacts);const existing=localStorage.getItem(key);if(existing){const old=JSON.parse(existing);if(incoming.steps.length<old.steps.length)throw new Error('不能用更早的备份覆盖已有进度；请先核对最新交易');if(old.steps.some((s,i)=>s.hash&&incoming.steps[i]?.hash!==s.hash))throw new Error('备份交易与现有进度不一致，请使用交易恢复功能');if(old.createdAt!==incoming.createdAt||JSON.stringify(old.roles)!==JSON.stringify(incoming.roles))throw new Error('此浏览器已有另一份部署。保留原进度，使用另一浏览器配置恢复其他部署');}if(!provider)throw new Error('请先连接钱包');try{await tools.inspect(provider,incoming,artifacts);}catch(original){const last=incoming.steps.at(-1);if(!last||!['submitting','submitted'].includes(last.status))throw original;const prefix=structuredClone(incoming);prefix.steps.pop();const confirmed=await tools.inspect(provider,prefix,artifacts);if(confirmed.complete||confirmed.plan[confirmed.next].key!==last.key)throw original;}journal=incoming;await save(journal);await check();message('进度已导入并经链上校验。');});
$('#setup-recover').onclick=()=>run(async()=>{if(!journal?.steps.length)throw new Error('没有待恢复的步骤');const hash=$('#setup-recovery-hash').value.trim();if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new Error('交易哈希格式不正确');const candidate=structuredClone(journal);candidate.steps.at(-1).hash=hash;await tools.inspect(provider,candidate,artifacts);journal=candidate;await save(journal);await check();message('原交易已核验，无需重复发送。');});
$('#setup-retry').onclick=()=>run(async()=>{journal=await tools.retryFailed(provider,journal,artifacts);await save(journal);await check();message('已核验并保留失败回执，允许重新提交该步骤。');});
window.ethereum?.on?.('accountsChanged',()=>location.reload());window.ethereum?.on?.('chainChanged',()=>location.reload());
try{const res=await fetch('/api/setup/artifacts');if(!res.ok)throw new Error('部署资源不可用。请运行 npm run setup，或重启更新后的本地 demo。');artifacts=await res.json();}catch(e){message(errorText(e),true);}
