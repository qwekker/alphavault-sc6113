# AlphaVault 最终提交清单

署名：Du zhuotong。材料不包含学号栏；视频第一页不显示日期。以下内容对应已提供的六组提交要求，详细页码见 [SUBMISSION_MAP.md](SUBMISSION_MAP.md)。

| 材料 | 文件 | 规格 |
|---|---|---|
| 技术报告 | submission/AlphaVault-Technical-Report.docx | 14 页英文；问题、利益相关者、证据和可衡量影响 |
| 五类图 | docs/diagrams/，已嵌入报告与 PPT | 架构、合约交互、数据模型、流程、UI；SVG + PNG |
| 演示文稿 | submission/AlphaVault-Presentation.pptx | 12 页，英文讲稿备注 |
| 演示视频 | submission/AlphaVault-Demo.mp4 | 10:00，英文旁白与字幕；实机片段 3:23，其余为问题、设计和验证讲解 |
| 独立字幕 | submission/AlphaVault-Demo.en.srt | 英文 |
| 用户手册 | submission/AlphaVault-User-Manual.docx | 4 页，启动、角色操作、确认和排错 |
| 个人贡献报告 | submission/AlphaVault-Individual-Contribution.docx | 2 页，职责、成果、决策和 Git 记录 |
| 测试报告 | docs/TESTING_REPORT.md | 最新 64/64，公网 API 和数据库持久化证据 |
| 源码与证据 | GitHub 及上一级 AlphaVault-MVP.zip | README、配置模板、源码、锁文件、测试、部署证据和全部材料 |

公网：https://alphavault-sepolia.onrender.com

GitHub：https://github.com/qwekker/alphavault-sc6113

视频中的本地链操作与 Sepolia 历史状态分别标注。录屏保留真实操作顺序与速度，展示授权、存款、选策略、调仓、暂停、暂停后赎回、账本及研究输出。公网部分没有新增签名，价格过期状态如实保留。

GitHub 仓库已公开，老师无需邀请即可查看；评分期间需保持公网服务可用。现场交易前由风险官刷新两个模拟价格报告。Sepolia 10 种方法包括 ERC20 approve；若老师另行要求十种核心合约方法，需要补充一种。源码浏览器验证尚未完成，现有材料提供部署交易、字节码与合约连接验证。

旧的 7 页报告草稿和短视频已由最终版替代。可编辑文字稿位于 docs/，证据在 evidence/；压缩包不包含环境口令、运行数据库或 node_modules。
