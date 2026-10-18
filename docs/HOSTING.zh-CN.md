# Render 公网部署

当前版本为 Python 3.12 + Flask + Web3.py + Gunicorn，公网地址：
https://alphavault-sepolia.onrender.com

沿用已有 Docker 类型 Render 服务、Sepolia 合约和 Supabase PostgreSQL。详细变量与启动命令见 DEPLOYMENT.md。Docker 构建阶段用 Node 编译合约，运行阶段只运行 Python。

1. 本地按 README 创建 Python 虚拟环境，安装 requirements-dev.txt，执行 npm ci 和 npm run compile。
2. 执行 python -m pytest -v 和 npm test。
3. 推送到 GitHub 后部署相应提交。Blueprint 配置变更可能触发自动部署。
4. 检查 /api/health 中 backend 为 python-flask、database 为 postgres、mode 为 wallet、chainId 为 11155111。
5. 核对 /api/config、/api/portfolio、/api/jobs、/api/evidence。公网 /api/demo/action 应返回 403。

免费服务可能休眠。数据库密码与 RPC 密钥仅保留在 Render 环境变量中，不能提交到代码或报告。当前迁移保留了旧数据库记录；验证结果见 evidence/flask-hosted-acceptance.json。
