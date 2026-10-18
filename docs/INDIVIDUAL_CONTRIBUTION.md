# AlphaVault individual contribution report

Project owner: Du zhuotong | SC6113 | Individual project

This report maps the individual project’s scope to delivered artifacts and verifiable checkpoints. AlphaVault was developed as a separate project from the earlier escrow assignment. The work covers requirements, contract integration, API and persistence, dashboard workflows, quantitative evaluation, testing, public deployment and submission materials.

## Responsibilities and deliverables

| Responsibility | Delivered work | Review evidence |
| --- | --- | --- |
| Problem and system design | Portfolio management with independent strategy and risk authority; five system diagrams | Technical report pp. 2–9; docs/diagrams |
| Smart contracts | Vault, strategy and risk contracts; mock exchange and tokens; bounded execution and exits | contracts/; contract tests; Sepolia manifest |
| Backend and storage | REST reads, unsigned transaction builder, indexing, receipt validation and SQLite/PostgreSQL persistence | server/; API.md; persistence evidence |
| User interface | Portfolio, strategies, risk controls and event/evidence screens with wallet/local modes | public/; recorded demonstration; user manual |
| Quantitative methods | Equal Weight, Momentum and Volatility Target; lagged synthetic fixture and costs | server/quant.mjs; evidence/backtests.json |
| Verification and deployment | Local tests, separate Sepolia roles, public HTTPS service and database restart checks | submission-tests.tap; SEPOLIA_RESULTS.md; hosted evidence |
| Submission package | Technical report, diagrams, slides, ten-minute video, manual and contribution record | submission/; SUBMISSION_MAP.md |

## Engineering decisions

Custody was separated from rule selection and risk policy so that a manager can change strategy without obtaining unrestricted withdrawal rights. Redemption returns the asset basket and remains available during pause/stale markets. Public backend signing was disabled; connected wallets sign transactions. External PostgreSQL was used because the free hosting filesystem is not a durable database. These decisions are observable in the implementation and associated tests.

The strategy study retains negative outcomes and explicitly identifies synthetic inputs. It compares Volatility Target with Equal Weight on the same fixture, reports fees and drawdown, and limits conclusions to that experiment. Keeping these boundaries makes the result reproducible without overstating financial performance.

# Contribution history and validation

The Git history below records meaningful saved checkpoints. The initial implementation is a bundled commit; these timestamps are not a complete timesheet or proof of when each line was written. Subsequent commits document hosting fixes, acceptance evidence and submission revisions. The repository’s full git log remains the authoritative history.

| Commit | Recorded change |
| --- | --- |
| 7775fdc | AlphaVault MVP, Sepolia evidence and Render deployment configuration |
| aab760c | Free Render hosting with persistent Supabase PostgreSQL |
| 9a913b2 | Optional macOS file watcher for Linux installation |
| 52aca85 | Official Supabase CA while preserving TLS verification |
| ac0fff6 | Live hosting and PostgreSQL restart acceptance |
| e6c7a24 | Report draft, editable presentation and recorded demonstration |
| e57a928 | English narration and author identity |
| 32efd3e and subsequent revision | Fourteen-page report, diagrams, ten-minute demo, manual and contribution report; current revision aligns public repository and deployment status |

## Verification performed

The latest full automated run passed 64 tests with zero failures. Contract scenarios cover role enforcement, risk caps, execution rollback, stale prices, paused exit and share accounting. API/storage scenarios cover indexing, receipt validation, unsigned preparation, persistence and public signing isolation. The public acceptance check passed wallet mode, PostgreSQL, Sepolia deployment binding and ten verified transaction types. The earlier non-chain sentinel retained across a service restart remains the evidence for durable database storage.

Three separate wallets were used for the investor/admin/Keeper, manager and risk officer roles. Saved Sepolia receipts show deposit, strategy/policy updates, rebalance, pause, in-kind redemption and resume. The public Keeper transaction was manually signed; an unattended Keeper was demonstrated locally. The new submission work does not claim additional public signatures.

## Limits and follow-up priorities

The system remains a course prototype: the oracle and exchange are simulated, the administrator can reassign roles, and no security audit or field usability study has been completed. Explorer source verification is separate from receipt/wiring verification and remains pending. If the assessor excludes ERC20 approval from public transaction types, a further core-method demonstration is required. Future engineering work should prioritize independent prices, real-data research with net trading and realistic costs, stronger administration, and external review.

The source archive excludes credentials, runtime databases and node_modules. The repository is public, and the source ZIP provides an additional review copy. Final presentation and operating readiness should be checked before the assessment; the ten-minute recording provides a reproducible fallback when a live service is sleeping.

