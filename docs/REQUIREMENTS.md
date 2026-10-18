# SC6113 requirement mapping

Source: requirements explicitly supplied in the current request. No original assignment handout was available. Do not assume an eight-page report or the previous individual escrow rubric applies to this project.

| Requirement | Implementation / evidence | Status |
|---|---|---|
| Individual project | One independently structured source project; no modification of old escrow | Implemented as an individual project |
| At least three roles | Investor, manager, risk officer, Keeper, admin | Implemented with separate signers |
| At least three interacting contracts | Vault → StrategyEngine → RiskManager plus direct Vault → RiskManager | Implemented and tested |
| At least ten distinct on-chain transactions | 12 core methods + ERC20 approve; evidence script | Implemented; 13 methods locally, 10 methods across 12 successful Sepolia receipts (including ERC20 approval) |
| REST API | Health/config/prices/strategies/portfolio/account/history/snapshots/jobs/backtests/calldata | Implemented and HTTP-tested |
| Persistent database | Local SQLite WAL / hosted PostgreSQL; events, prices, strategies, snapshots, jobs, backtests, cursor and receipts | Implemented; local reopen/rollback and hosted restart sentinel verified |
| Public deployment | MetaMask deployment wizard, resumable CLI, verified manifest import, wallet-only server, Render Free container + Supabase PostgreSQL | Sepolia business acceptance and public HTTPS/API deployment complete; cloud restart verified |
| Submission materials | README, source, lockfile, tests, evidence, editable report/slides and recorded demo | 14-page final report, five diagrams, 12-slide presentation, 10-minute video, manual, contribution and testing reports; see SUBMISSION_MAP.md |
| Quantitative asset management | Three allocation rules, bounded execution, synthetic backtest | Implemented; empirical market validation pending |

## Existing-project inventory

Read-only inspection found the prior project under the 2026-08-22 Codex workspace:

- `sc6113-milestone-escrow`: completed single-contract individual assignment, existing report and Sepolia deployment.
- `sc6113-milestone-escrow 2` and `sc6113-milestone-escrow 3`: old copies.
- `sc6113-group-escrow`: partial RoleRegistry/MilestoneEscrow/DisputeBoard project with compile and indexer files; no README.

No existing source files, deployment files, .env files, wallets or reports were overwritten. Dependencies were initially copied locally for offline development; the new package name and lockfile belong to AlphaVault, with a separate clean installation check. No prior escrow financial results or transaction evidence are reused.

## Final submission coverage

The six supplied submission categories are mapped in [SUBMISSION_MAP.md](SUBMISSION_MAP.md). The final technical report has 14 pages and the video runs for 10 minutes. Author identity is Du Zhuotong; no student ID field is included. Public access, the approval-count distinction and optional explorer source verification are documented in the final submission checklist.

## Explicit source-format requirement

Submit Solidity (.sol), ABI (.abi JSON), Python Flask, HTML, CSS, JavaScript and the Render URL, with a software demonstration or recorded software video. The active implementation uses backend/*.py and app.py; source files are included directly in the final submission under Source-Code.
