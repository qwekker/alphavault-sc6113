# AlphaVault 免费公网部署

当前状态：独立 GitHub 仓库 `qwekker/alphavault-sc6113` 已建立并授权 Render 读取。默认部署配置已改为 Render Free + Supabase PostgreSQL；真实云连接、API 验收和服务重启持久化验收已于 2026-10-18 完成。公网地址：https://alphavault-sepolia.onrender.com 。验证记录：`../evidence/hosted-acceptance.json`。原本地 SQLite 数据和已部署 Sepolia 合约继续保留。

## 免费资源与限制

- Render：一个 Free Docker Web Service，新加坡区域，不创建持久化磁盘。
- Supabase：Free PostgreSQL，500 MB 数据库额度；后端通过 Session pooler 连接。
- Render 空闲 15 分钟后休眠，下次访问通常约一分钟唤醒；每个工作区共享每月 750 免费实例小时。已有 escrow 服务也可能消耗此额度。
- Supabase 免费项目一周无活动会暂停。演示前检查项目状态并提前打开网站。
- 免费额度有限；不要升级套餐、添加磁盘或开启收费选项。当前方案不需要之前的每月 US$7.25 资源。
- 云端只部署钱包模式 API，不运行自动签名 Keeper。Sepolia 已验证的交易和合约无需重新部署。

## 1. Supabase

1. 在 https://supabase.com/dashboard 登录；如出现 GitHub 授权或服务条款，请本人审阅。
2. 选择 Free 组织，新建 `alphavault-sc6113` 数据库项目，选择 Singapore 或可用的邻近区域。确认页面显示 Free / $0。
3. 设置强数据库密码并保存在密码管理器。不要将密码、连接串或服务密钥发送到聊天或写入 Git。
4. 项目就绪后点 **Connect → Session pooler**，复制完整 PostgreSQL URI（通常端口 5432）。用数据库密码替换占位符；密码特殊字符必须进行 URL 编码。
5. 将完整连接串直接填到 Render 的秘密环境变量 `DATABASE_URL`。不要用项目 HTTPS URL、anon key 或 service-role key 代替数据库 URI。

后端会自动创建 `alphavault` schema 和八张表：events、snapshots、prices、strategies、jobs、backtests、cursors、receipts。它不使用 Supabase `public` schema；表开启 RLS、无公共策略，前端仅访问我们的 REST API。连接串只留在服务器环境变量中。

连接默认校验证书。Supabase 域名自动使用随项目打包的官方 `config/supabase-ca.crt`（来自项目 Database Settings 的 Download certificate）。若供应商要求其他 CA，在 Render 增加 `DATABASE_CA_CERT`，填供应商提供的 PEM（可使用字面量 `\n` 表示换行）。不要通过关闭 TLS 校验解决连接问题。

## 2. Render

1. 取消旧付费 Blueprint 的绑卡弹窗。新建或重新进入 Blueprint，选 `qwekker/alphavault-sc6113`、`main` 分支、根目录 `render.yaml`，名称 `alphavault`。
2. 配置 `RPC_URL=https://ethereum-sepolia-rpc.publicnode.com`（也可使用自己的 Sepolia RPC）。
3. 配置秘密 `DATABASE_URL`。模板已固定 `DATABASE_REQUIRED=postgres`，遗漏数据库时启动报错，避免静默使用临时 SQLite。
4. 核对只创建一个 **Free** Web Service，**没有 disk**，没有付费数据库或套餐升级，再点击创建。
5. 模板已包含公开 manifest 和历史回执哈希；启动会验证合约、导入回执并同步事件。日志应出现 `Receipt bootstrap` 和 `AlphaVault wallet mode`。
6. `/api/health` 应显示 `ok:true`、`database:"postgres"`、`mode:"wallet"`、`chainId:11155111`。数据库或链不可用时返回 503。
7. 获取 Render 分配的 HTTPS 地址，连接钱包时由本人批准新站点权限。

自动源码部署关闭；后续更新需要 Manual Deploy。Blueprint 配置变更仍可能自动同步，所以后续修改 `render.yaml` 前应检查是否会创建收费资源。

## 3. 验收

Node 22，在项目目录执行：

```sh
EXPECTED_DATABASE=postgres node scripts/check-hosted.mjs https://实际域名 evidence/hosted-before-restart.json
```

脚本检查 HTTPS、链/Vault 绑定、PostgreSQL、签名接口禁用、调仓和赎回事件、至少十种已验证业务交易。它不会签名。

持久化不能仅用链上历史证明，因为历史可以重建。可在 Supabase SQL Editor 中插入一条不会从链上生成的测试记录（使用本项目的 chain:vault scope）：

```sql
INSERT INTO alphavault.jobs(scope,created_at,kind,status,tx_hash,message)
VALUES('11155111:0x4076f1c885ef0f0651005e862d3264d538c941c9',
       (extract(epoch from now())*1000)::bigint,
       'persistence-check','confirmed','','cloud-restart-sentinel');
```

先确认 `/api/jobs` 包含它，再重启 Render 服务，确认该记录仍在、回执导入跳过已存在哈希，并运行：

```sh
EXPECTED_DATABASE=postgres node scripts/check-hosted.mjs https://实际域名 evidence/hosted-after-restart.json evidence/hosted-before-restart.json
```

组合、价格和策略定期快照每个部署保留最近 2,000 个区块，API 展示最近 200 条；事件账本和回执不随快照裁剪。不要把定期估值快照当作完整市场历史。价格报告超过合约时限时，网页应显示 stale 风险状态；上线不需要为了消除提示而重新做所有业务交易。

## 本地与 VPS

`npm run dev` 仍使用本地持久化 SQLite。钱包模式不设置 `DATABASE_URL` 时使用 `DB_PATH`；本地开发不要设置 `DATABASE_REQUIRED=postgres`。`compose.yaml` 是 SQLite 持久化卷备选，不是本次免费 Render 路线。不要把含解锁测试账户的 demo 服务器暴露到公网。

## 测试范围

`evidence/free-hosting-tests.tap` 记录完整测试；新增 PostgreSQL 测试使用 PGlite 的真实 PostgreSQL WASM 引擎，覆盖 API、原子事务回滚、去重、重新打开数据库、链回滚、健康检查和快照裁剪。它不等于 Supabase 网络/TLS 验收。可设置 `TEST_DATABASE_URL` 对专用测试库运行 `node --test test/postgres.test.mjs`，不要使用生产库。

参考（2026-10-18 核对）：[Render Free](https://render.com/docs/free)、[Supabase Free](https://supabase.com/pricing)、[Supabase 连接方式](https://supabase.com/docs/guides/database/connecting-to-postgres)。
