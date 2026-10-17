# AlphaVault 公网部署交接

当前状态：部署文件和本地钱包模式启动演练已完成；尚未创建付费资源或公网服务。需要用户选择托管账户/服务器。原 3102 服务与 SQLite 数据保持独立。

## 配置与资源

`render.yaml` 定义一个 Docker Web Service、新加坡区域、`0.5c-512mb` 付费计算实例与 1 GB 持久化磁盘。实际费用以创建资源时平台显示为准。不要选择无持久化磁盘的免费实例来存储此项目 SQLite。

- 仓库根目录应直接包含本项目的 `package.json`、`Dockerfile`、`render.yaml`，不要把旧 escrow 项目放进来。
- 公开配置 `config/sepolia-deployment.json` 包含已验证的现有合约地址；不会重新部署合约。
- `config/sepolia-receipts.json` 只保存 12 个公开交易哈希；启动时重新通过 RPC 验证并写入空数据库。已存在的哈希跳过，重复启动不会重复计数；导出证据时仍逐笔重新验证。
- `DB_PATH=/app/data/alphavault.sqlite`，磁盘挂载在 `/app/data`。SQLite 的主文件、WAL 和 SHM 必须处于同一持久化目录。
- 前端和 REST API 同域部署，钱包在浏览器签名，服务器无私钥。
- 自动部署关闭；只运行一个实例。这里不部署持有签名密钥的 Keeper worker。

## Render 操作

1. 登录 Render，并将独立 AlphaVault 仓库连接到 GitHub/GitLab。不要覆盖旧 escrow 仓库；当前本地项目还没有配置新的远程仓库。
2. 创建 Blueprint，选该仓库的 `render.yaml`。
3. 填入 `RPC_URL`。可以先使用 `https://ethereum-sepolia-rpc.publicnode.com`；专用 RPC 可降低限流风险。若使用带密钥的 RPC，在平台环境变量中填写，不写入 Git。
4. 检查计算实例、磁盘与价格，再创建服务。这个步骤会产生托管费用。
5. 等待首次启动：核对七份合约连接，重新验证并导入交易回执，回填链上事件后才开始监听。
6. 日志应出现 `Receipt bootstrap` 和 `AlphaVault wallet mode`。健康检查路径为 `/api/health`。
7. 获取平台实际分配的 HTTPS URL，访问 Dashboard 并在 MetaMask 单独授权新域名。已有本地网站授权不会自动成为新域名授权。

首次磁盘部署需确保运行用户能写 `/app/data`。Docker 镜像使用非 root 的 `node` 用户；镜像层预建该目录，但平台挂载目录的权限仍需以上线结果核验。

## 上线验收

在本地项目目录（Node 22）运行：

```sh
node scripts/check-hosted.mjs https://实际域名 evidence/hosted-before-restart.json
```

脚本检查 HTTPS、Sepolia 链、Vault 地址、钱包模式、本地签名接口禁用、历史调仓/赎回事件，以及至少十种成功业务方法。脚本不需要私钥，也不会发送链上交易。

完成一次托管服务重启后运行：

```sh
node scripts/check-hosted.mjs https://实际域名 evidence/hosted-after-restart.json evidence/hosted-before-restart.json
```

历史事件可从链上重建、回执可重新导入，因此仅 API 前后相同不能证明持久化磁盘正确。另在托管 Shell 检查 `DB_PATH`、持久化磁盘挂载、重启后的同一数据库文件，以及不会由链上索引自动重建的本地记录。启动日志在第二次启动应显示 `imported:0, skipped:12`。在最终报告中区分“本地进程重启演练”与“公网持久化磁盘验收”。

手动核验网页：MetaMask 连接正确网络，当前策略和份额正确，交易列表可打开 Sepolia 浏览器。若价格超过 3600 秒，风险提示应阻止新调仓；历史数据和暂停期间赎回机制仍可查看。无需为了上线再次发送已演示的业务交易。

## VPS 备选

已有 Docker 主机可运行 `RPC_URL=... docker compose up -d --build`；Compose 使用命名持久化卷，HTTP 仅映射到主机 loopback。用自己的 HTTPS 反向代理转发到 `127.0.0.1:3100`。不要运行 `docker compose down -v`，否则会删除数据库卷。生产入口是 `npm start`，不是含已解锁本地账户的 `npm run dev`。

## 验证范围

新增回执导入测试覆盖：错误链/部署拒绝、无效哈希拒绝、真实交易验证、去重、数据库重开和未知交易拒绝。完整测试记录见 `../evidence/hosting-preparation-tests.tap`。Docker Compose 配置已能解析；本机 Docker 引擎未启动，未宣称镜像构建或云端上线成功。

参考（2026-10-17 核对）：[Render Blueprint](https://render.com/docs/blueprint-spec)、[持久化磁盘](https://render.com/docs/disks)、[计算套餐](https://render.com/docs/compute-plans)、[健康检查](https://render.com/docs/health-checks)。
