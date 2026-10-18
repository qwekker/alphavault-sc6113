# 提交材料与项目现状核对

核对日期：2026-10-18。结论：发现的过期状态说明已修正，当前提交材料与已检查的源码、公开仓库、部署接口及证据一致。以下保留实际功能边界，不把历史录屏当成实时状态。

## 修正的内容

| 项目 | 原说明 | 当前说明及处理 |
|---|---|---|
| GitHub 可见性 | 私有仓库、老师需要邀请 | 无认证 GitHub API 确认 public；更新 README、报告、贡献报告、PPT、视频结尾和清单 |
| 公网部署 | 部署和持久化验收待完成 | 公网 HTTPS/API 正常，PostgreSQL 和 wallet 模式；保留此前数据库重启验证证据 |
| 托管方案 | 付费 Blueprint 和持久磁盘，尚未应用 | 当前 render.yaml 为 Render Free + 外部 Supabase PostgreSQL，无 Render disk；自动部署关闭 |
| 材料与署名 | 姓名、最终 rubric 对照待完成 | Du zhuotong；14 页报告、12 页 PPT、10 分钟英文视频、4 页手册、2 页贡献报告和覆盖表已具备 |
| 版本描述 | 将 52aca85 直接称为当前部署版本 | 改为初始托管版本；当前应用源码与该版本相同，线上前端文件与本地逐字节匹配；健康接口不暴露服务端 Git SHA |

## 核验结果

| 核验项 | 结果 | 可复查证据 |
|---|---|---|
| GitHub | public；核对起点的本地 HEAD 与远端 main 均为 32efd3e | evidence/submission-consistency.json；修订提交见 git log |
| 公网 API | 09:12:06 UTC 验收通过；Sepolia 11155111，PostgreSQL，wallet 模式；本地签名接口返回 403 | evidence/current-hosted-check.json |
| 部署清单 | 四个业务/基础合约、三个代币、角色地址和 artifactHash 与公网配置一致 | config/sepolia-deployment.json；evidence/current-config.json |
| 组合状态 | NAV 748.80 mUSD，750 份，指数 99.84，Momentum，paused=false，cooldown=120 秒；两个风险资产价格已过期 | evidence/current-portfolio.json |
| 公网前端 | index.html、app.js、styles.css 的 SHA-256 与本地相同 | evidence/submission-consistency.json |
| 测试 | 重新运行 64/64，零失败、零跳过，约 22.68 秒 | evidence/current-tests.tap |
| 合约与数据模型 | 三核心合约调用、角色限制、暂停后实物赎回与实现相符；八张表、逻辑关联及快照保留描述相符 | contracts/；server/store.mjs；server/postgres-store.mjs；server/service.mjs |
| 量化结果 | 当前 quant.mjs 重算三个策略，完整结果与 backtests.json 一致 | evidence/submission-consistency.json |
| 材料规格 | 报告 14 页、五类图、PPT 12 页、视频 600 秒，英文字幕与旁白，手册 4 页、贡献报告 2 页 | evidence/submission-artifacts.json |

## 必须保留的边界

1. Sepolia 有 12 笔成功交易、10 种不同方法，其中包含 ERC20 approve；核心合约方法为 9 种。本地为 13 种、核心 12 种。若老师要求十种公网核心方法，需要另补一种。
2. 公网 Keeper 调仓由钱包手动签名；无人值守 Keeper 仅在本地验证，不能写成公网已经持续自动运行。
3. 视频含 3 分 23 秒真实应用录屏，其余为问题、设计和结果讲解，总时长 10 分钟。录屏属于已记录的历史演示，不能声称所有操作都在当前公网重做。
4. 当前 API 允许查看历史估值，但两种风险资产价格已过期；现场交易前需要风险官刷新。回测使用确定性合成数据，不代表真实市场收益。
5. 当前检查没有再次重启云服务；持久化结论引用此前保留的非链上 jobs 哨兵记录。
6. 部署回执及连接关系验证不等于浏览器源码验证。本次 PortfolioVault 页面仍显示 Verify and Publish；另两个核心合约页面抓取返回 403，未重新确认其浏览器验证状态，材料不声称已全部验证。
7. package.json 的 private:true 用于防止 npm 发布，和 GitHub 仓库 public 状态无冲突。

## 使用文件

提交时使用当前 submission/ 文件及重新打包的 AlphaVault-MVP.zip。旧版仅保存在私有工作目录，未混入提交包。姓名保持 Du zhuotong，无学号栏，视频第一页无日期。个人贡献报告按职责、成果、决策和验证证据组织。
