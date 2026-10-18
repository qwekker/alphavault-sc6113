# AlphaVault Individual Contribution Report

Du Zhuotong

This report maps the individual project’s scope to delivered artifacts and verifiable checkpoints. AlphaVault was developed as a separate project from the earlier escrow assignment. The work covers requirements, contract integration, API and persistence, dashboard workflows, quantitative evaluation, testing, public deployment and submission materials.

## Responsibilities and deliverables

| Responsibility | Delivered work | Review evidence |
| --- | --- | --- |
| Problem and system design | Portfolio management with independent strategy and risk authority; five system diagrams | Technical report pp. 2–9; docs/diagrams |
| Smart contracts | Vault, strategy and risk contracts; mock exchange and tokens; bounded execution and exits | contracts/; test/contracts.test.mjs; config/sepolia-deployment.json |
| Backend and storage | REST reads, unsigned transaction builder, indexing, receipt validation and SQLite/PostgreSQL persistence | backend/; docs/API.md; evidence/flask-hosted-acceptance.json |
| User interface | Portfolio, strategies, risk controls and event/evidence screens with wallet/local modes | public/; recorded demonstration; user manual |
| Quantitative methods | Equal Weight, Momentum and Volatility Target; lagged synthetic fixture and costs | backend/quant.py; evidence/backtests.json |
| Verification and deployment | Local tests, separate Sepolia roles, public HTTPS service and database restart checks | evidence/current-tests.tap; docs/SEPOLIA_RESULTS.md; hosted acceptance |
| Submission package | Technical report, diagrams, slides, ten-minute video, manual and contribution record | submission/; docs/SUBMISSION_MAP.md; compact submission ZIP |

## Engineering decisions

Custody was separated from rule selection and risk policy so that a manager can change strategy without obtaining unrestricted withdrawal rights. Redemption returns the asset basket and remains available during pause/stale markets. Public backend signing was disabled; connected wallets sign transactions. External PostgreSQL was used because the free hosting filesystem is not a durable database. These decisions are observable in the implementation and associated tests.

The strategy study retains negative outcomes and explicitly identifies synthetic inputs. It compares Volatility Target with Equal Weight on the same fixture, reports fees and drawdown, and limits conclusions to that experiment. Keeping these boundaries makes the result reproducible without overstating financial performance.

# Contribution history and validation

Git records the saved implementation, hosting and submission checkpoints below. The initial implementation is a bundled commit; commit timestamps are not a development timesheet. The repository retains the full history.

| Commit | Recorded change |
| --- | --- |
| 7775fdc | AlphaVault MVP, Sepolia evidence and Render deployment configuration |
| aab760c | Free Render hosting with persistent Supabase PostgreSQL |
| 9a913b2 | Optional macOS file watcher for Linux installation |
| 52aca85 | Official Supabase CA while preserving TLS verification |
| ac0fff6 | Live hosting and PostgreSQL restart acceptance |
| e6c7a24 | Report draft, editable presentation and recorded demonstration |
| e57a928 | English narration and author identity |
| 32efd3e | Fourteen-page report, diagrams, ten-minute demo, manual and contribution report |
| 9439d16 | Python Flask API, standalone ABI and 36 integration tests |

## Verification performed

Validation passes 36 Flask tests and 64 Solidity/legacy regression tests. The Python suite covers all 13 business methods, role and request guards, indexing, canonical receipts, rollback, SQLite persistence and quantitative parity. Logs are evidence/flask-tests.txt and evidence/flask-migration-node-regression.tap. Public acceptance verifies the Flask service, PostgreSQL and the unchanged Sepolia deployment. Existing public evidence contains 12 successful receipts across 10 method types, including ERC20 approve. No new public transaction is needed for the backend migration.

Three separate wallets were used for the investor/admin/Keeper, manager and risk officer roles. Saved Sepolia receipts show deposit, strategy/policy updates, rebalance, pause, in-kind redemption and resume. The public Keeper transaction was manually signed; the local Keeper tick was tested for execution and cooldown skipping. No unattended cloud Keeper is claimed.

## Limits and follow-up priorities

The system remains a course prototype: the oracle and exchange are simulated, the administrator can reassign roles, and no security audit or field usability study has been completed. Explorer source verification is separate from receipt/wiring verification and remains pending. If the assessor excludes ERC20 approval from public transaction types, a further core-method demonstration is required. Future engineering work should prioritize independent prices, real-data research with net trading and realistic costs, stronger administration, and external review.

The submission includes the report, five diagrams, slides, ten-minute software video, user manual and contribution report. Its Source-Code folder directly contains Solidity, standalone ABI, Python Flask, HTML, CSS and JavaScript files, dependencies, tests and setup instructions. The Render URL and GitHub link are included. Credentials, runtime databases and node_modules are excluded.

