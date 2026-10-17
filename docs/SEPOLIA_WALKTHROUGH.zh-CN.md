# AlphaVault：MetaMask 部署步骤

当前状态：七份合约及全部 17 步初始化已在真实 Sepolia 完成并核验；两笔智能账户包装失败交易已恢复并保留回执。本工作区已配置钱包模式服务，运行 `nvm use 22`、`npm run sepolia` 后打开 http://127.0.0.1:3102；以下部署步骤供复现，不必重新部署。部署向导运行在独立端口，不会覆盖现有本地链。

## 1. 准备三个账户

| 账户 | 角色 | 用途 |
|---|---|---|
| A | Admin / Investor / Keeper | 部署、存取、执行调仓 |
| B | Strategy manager | 选择和配置策略、开关自动调仓 |
| C | Risk officer | 行情报告、风险限额、暂停与恢复 |

三个地址必须不同；都需要少量 Sepolia 测试 ETH 来发送自己的交易。A 需支付 17 笔部署和初始化费用，向导会逐笔估算，不能仅凭非零余额保证足够。也可以使用五个独立账户。

部署账户使用普通 EOA。若费用检查提示当前账户带有智能账户/委托代码，可切换到另一个普通部署账户，重新连接后点击「修改未发送计划」，再创建计划；Investor、Manager、Risk officer、Keeper 地址会保留。此入口仅允许修改完全没有提交记录或失败记录的计划。当前验证器不支持通过智能账户/委托账户包装的合约创建交易，遇到该提示时使用一个普通测试账户。所有私钥与助记词留在 MetaMask；向导只读取公开地址和交易。

## 2. 启动独立部署向导

在项目目录另开终端：

```sh
nvm use 22
npm run setup
```

在**安装了 MetaMask 的 Chrome/Edge**打开：

http://127.0.0.1:3101/setup.html

内置浏览器若没有 MetaMask 扩展，会显示明确提示。现有 dashboard 可继续运行在 3100。端口占用时使用 `SETUP_PORT=3103 npm run setup`。

## 3. 逐笔部署

1. 点击「连接 MetaMask」，选择账户 A。
2. 必要时点击「切换到 Sepolia」，在钱包确认网络切换。
3. Investor 填 A，Strategy manager 填 B，Risk officer 填 C，Keeper 填 A。
4. 点击「创建部署计划」。检查角色地址。角色一旦用于部署，不应在恢复时更换。
5. 查看下一笔的名称、预计 gas、估算费用上限和余额。
6. 点击「确认下一步」，亲自在钱包检查并确认这一笔交易。
7. 页面确认上链后，再点击下一步。每笔单独确认，共 17 步。
8. 点击「下载进度 JSON」保留备份，特别是在暂停之前。
9. 全部完成后下载 `deployment.json` 和部署回执 JSON。

部署顺序：三个测试代币 → RiskManager → StrategyEngine → MockExchange → PortfolioVault → 两资产行情/白名单 → 交易所流动性 → 投资者测试资金 → 授予 C 风险角色 → 撤销 A 的临时风险角色。

部署阶段不会自动替 B 启用调仓，也不会替 A 存入资金；这些属于之后的业务演示。

## 4. 中断与恢复

同一浏览器、同一地址、同一端口重新打开向导并连接原 A 账户，点击「检查 / 恢复进度」。已确认步骤会通过网络、发送者、目标、完整 calldata、回执状态、区块哈希和部署代码校验，不会再次部署。

- **钱包拒绝签名：**没有广播的步骤可以再次提交。
- **已发送、尚未确认：**等待回执后再检查，不要重复发送。
- **页面在广播后断开，未记录哈希：**在钱包活动找到原交易哈希，使用恢复区域核验。
- **钱包重新启用智能账户：**本次实际故障中，钱包把第 8 步包装为 type-4 `redeemDelegations` 交易，并重新启用了账户委托。直接调用同一 RiskManager 方法的只读模拟成功。请保持原部署账户，关闭 Sepolia 的 Smart account，并在后续确认中保持普通交易模式。针对本项目已核验的测试合约，每次确认弹窗都检查并取消勾选可选 Added protection；它可能逐笔恢复默认勾选，无需关闭钱包全局安全功能。恢复器仅对已知包装入口、单次零值调用、完全匹配目标和 calldata、原发送者、正确网络及规范链 status=0 的失败回执开放重试；成功或不匹配的包装交易不会被自动接受。失败哈希和费用保留在 `failedAttempts`。
- **明确上链回滚：**在恢复区域检查失败回执；只有匹配当前步骤且状态为 reverted 的交易才能进入重试。
- **无哈希且结果不明、交易取消/替换成不同调用：**停止继续部署，保留进度并检查钱包活动；工具不会猜测未发送。
- **清除浏览器存储：**使用下载的进度文件恢复。不要用较旧备份覆盖已有较新进度。
- **更换代码或编译器：**原进度会因编译指纹不匹配而拒绝恢复；保留原版本再完成部署。

本 MVP 使用当前规范链回执检查，不把一次确认等同于最终性。

## 5. 配置 RPC 并导入部署

在项目目录执行：

```sh
cp setup/sepolia.env.example .env.sepolia.local
```

用编辑器填入自己的 Sepolia RPC 和公开角色地址。保持：

```dotenv
DEPLOYMENT_FILE=./data/sepolia/deployment.json
DB_PATH=./data/sepolia/alphavault.sqlite
HOST=127.0.0.1
PORT=3102
```

该文件被 Git 和源码打包规则排除。浏览器部署模式无需任何私钥配置。

```sh
npm run sepolia:check
npm run import:deployment -- "/实际下载路径/deployment.json"
npm run sepolia
```

导入器会核对链 ID、七个部署地址、三核心合约的连接、代币资产顺序、所有者和精度。发现已有不同部署时拒绝覆盖。服务器启动时也会核对部署连接。

打开 http://127.0.0.1:3102 ，使用真实 MetaMask 钱包操作，页面不再提供本地角色签名。

## 6. 完成真实业务演示并保存证据

1. B：连接钱包，配置并选择策略，启用 automation。
2. C：刷新两个资产的模拟行情、检查限额和暂停状态。
3. A：授权测试 mUSD、存款；以 Keeper 身份调仓。
4. A/B/C 分别完成 README 的交易类型清单；所有操作由对应钱包确认。
5. C 暂停；A 赎回；C 恢复。检查暂停不阻止退出。
6. Activity ledger 中点击「Export verified evidence」。

更新后的页面在成功操作后尝试保存回执；如保存失败，交易本身仍可能成功。把原哈希填入「Verify receipt」重试，不要重发业务交易。导出时再次检查规范链回执，记录 gas、费用、区块、确认数和成功方法覆盖。部署、mint、其他 vault 的批准以及失败交易不计入十种成功方法。导出最多包含 300 条已保存回执，并报告截断标记。

CLI/其他浏览器发出的交易不会自动出现在该回执集合中；可通过哈希补录。链上事件账本仍独立索引。

## 7. 接下来部署公网

测试网演示通过后，使用 Docker/Node 服务器加持久化磁盘部署同一套钱包模式 API，配置 HTTPS，再补充公网链接和演示截图。此步骤仍需实际托管目标，不能用 localhost 或旧 escrow 地址代替。

参考：ethers v6 的 [ContractFactory 和交易回执 API](https://docs.ethers.org/v6/single-page/)，MetaMask 的[账户连接说明](https://docs.metamask.io/metamask-connect/evm/guides/manage-user-accounts/)。


## 本轮业务演示已完成

三钱包已完成 12 笔成功业务交易，覆盖 10 种方法（含 ERC20 授权）。已验证调仓、暂停期间赎回和恢复运行；剩余 750 份额、金库净值约 748.80 mUSD。见 `SEPOLIA_RESULTS.md` 与 `../evidence/sepolia-business-evidence.json`。无需重复发送这些交易；下一步是公网网站/API 部署和最终提交材料。
