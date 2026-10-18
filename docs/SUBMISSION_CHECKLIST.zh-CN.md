# AlphaVault 提交材料清单

材料整理日期：2026-10-18。当前版本是可审阅草稿；署名为 Du zhuotong，已按要求移除学号栏；原始课程 handout 尚未提供。

## 已生成的文件

- `submission/AlphaVault-Report-Draft.docx`：7 页英文技术报告，可编辑；署名 Du zhuotong。
- `docs/FINAL_REPORT_DRAFT.md`：报告正文的可检索文本版本。
- `submission/AlphaVault-Presentation.pptx`：10 页英文演示文稿，附讲稿备注，可按约 7 分钟讲解。
- `submission/AlphaVault-Demo.mp4`：约 4 分钟实机演示剪辑，英文字幕及英文合成旁白。
- `submission/AlphaVault-Demo.en.srt`：视频字幕，可单独修改或翻译。
- `evidence/video-recording.json`：录制环境、操作、计数和视频剪辑范围。
- 项目上一级 `AlphaVault-MVP.zip`：源码、测试、证据和提交材料；旁边有 SHA-256 校验文件。

## 视频内容

视频前半段在独立本地链（31337）操作：投资者授权/存款，经理选择 Momentum，Keeper 调仓，风险官暂停，投资者暂停后赎回，查看账本与合成回测。

本地初始 10,000 mUSD，再存 1,000 后调仓，NAV 为 10,982.40；赎回 25% 后剩余 8,250 份。它与 Sepolia 历史测试使用不同金额。

后半段展示 https://alphavault-sepolia.onrender.com 的 Sepolia 状态和历史交易证据，没有发送新公网交易。页面 NAV 748.80，份额指数 99.84，价格报告已过期。证据计数 10 种包含 ERC20 approve，核心方法是 9 种。

视频为真实标签页捕获并加上说明幻灯片，不含钱包签名弹窗。本片采用英文合成语音（en-US-GuyNeural），并非学生本人录音。若老师要求本人讲解或实时钱包签名，请以本片为操作参考重新配音/补录。原始素材和工具放在工作目录 `work/submission-build`，不进入提交压缩包。

## 提交前必须由学生核对

1. 提供原始 rubric 后核对个人项目许可、报告页数、演示时长、文件命名、截止时间及 AI 辅助使用要求（若课程有规定）。
2. 如果老师不把 approve 计入十种交易，在 Sepolia 补做 `StrategyEngine.setEnabled` 等未覆盖的核心方法，并重新导出证据；不要重复计算 pause/resume 或两种资产的 updateMarket。
3. 源码浏览器验证仍待完成。现有证据验证了部署交易、字节码存在和合约连接关系，不等于 Etherscan 已验证源码。编译配置为 Solidity 0.8.30、optimizer 200、Shanghai。
4. 仓库目前为私有。确认老师能访问仓库，或按课程要求提交源码 ZIP。不要为了演示随意改成公开，也不要打包 .env、数据库口令或运行数据。
5. 检查免费 Render/Supabase 服务在评分窗口内可用。交易演示前由风险官刷新两种模拟市场报告，检查钱包 Sepolia 测试 ETH。
6. 先完整播放视频确认字幕、配音和时长是否满足课程要求。当前成片约 4 分钟，PPT 讲解安排约 7 分钟，两者不是同一个时长要求。

## 可直接使用的演示入口

- 公网应用：https://alphavault-sepolia.onrender.com
- 项目启动：Node 22 环境，`npm ci`，`npm run dev`；默认本地页面 http://127.0.0.1:3100。
- Sepolia 配置与重启：参考 `HOSTING.zh-CN.md`、`SEPOLIA_WALKTHROUGH.zh-CN.md`。
- 原始证据：`SEPOLIA_RESULTS.md`、`VERIFICATION.md` 及 `evidence/hosted-acceptance.json`。
