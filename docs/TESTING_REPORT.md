# Flask migration validation

The current Python Flask suite passes 36 tests, and the Solidity/legacy regression suite passes 64 tests, with zero failures. Commands: python -m pytest -v; npm test. These suites overlap and should not be interpreted as 100 distinct security guarantees.

Evidence: evidence/flask-tests.txt, evidence/flask-tests-final.txt, evidence/flask-tests.xml and evidence/flask-migration-node-regression.tap. The isolated EVM fixture executes all 13 business methods. It checks blocked inputs and signing requests, paused exit, Keeper cooldown, canonical receipt coverage, rollback, database reopen, atomic SQL failure and bounded telemetry. Python quantitative results match the original deterministic fixture.

Public verification: evidence/flask-hosted-acceptance.json confirms Python Flask, wallet mode, PostgreSQL, the expected Sepolia manifest, portfolio/history/price/strategy APIs, backtest persistence, unsigned calldata, rejected demo signing and the retained non-chain jobs record. Existing public evidence contains 12 successful receipts across 10 types. No new public transaction was sent.

## Earlier implementation checkpoints

The following records document earlier contract and Express checkpoints. The active HTTP backend is now Flask.

# AlphaVault testing report

Author: Du Zhuotong. Verification checkpoint: 18 October 2026.

## Latest automated result

The complete suite passed **64 tests, 0 failed, 0 skipped, 0 cancelled** in 22.68 seconds. Source: [current-tests.tap](../evidence/current-tests.tap). Environment: Node.js 22.23.2, Solidity 0.8.30 with optimizer 200 and Shanghai target, isolated local EVM. This total already includes the current test files; older partial runs must not be added to it.

```sh
npm ci
npm test
```

| Area | Scenarios and expected behavior | Evidence |
|---|---|---|
| Permissions and policy | Unauthorized privileged calls reject; only valid roles update strategy/policy; revoked Keeper cannot execute | test/contracts.test.mjs; latest TAP |
| Share and exit accounting | Deposits mint against pre-deposit NAV; proportional in-kind redemption; virtual balances and rounding; paused/stale-price exit remains available | Contract tests; paused redemption public record |
| Bounded rebalance | Valid weights and timing; stale reports/caps reject; failed post-trade bounds roll back balances and timestamp atomically | Contract tests |
| REST and wallet isolation | Validated unsigned calldata; hosted server has no signing path; invalid inputs and receipts reject | test/ and latest TAP |
| Indexing and persistence | Atomic event/cursor progress, rollback detection, SQLite reopen, PostgreSQL SQL and engine reopen | Storage tests, restart-check.json |
| Deployment recovery | Manifest and receipt verification; resume/checkpoint handling; account and wrapped-deployment rejection | Deployment tests in latest TAP |
| Quantitative methods | Deterministic lagged signals, costs, target bounds and metrics | Quant tests; backtests.json |

PGlite exercises PostgreSQL SQL locally. It does not by itself test Supabase credentials or network TLS. Those are covered by the separately recorded cloud acceptance. Tests cover selected scenarios and do not constitute an external security audit or exhaustive proof.

## Public acceptance

Run:

```sh
EXPECTED_DATABASE=postgres node scripts/check-hosted.mjs https://alphavault-sepolia.onrender.com evidence/current-hosted-check.json
```

The saved check at **2026-10-18 09:12:06 UTC** passed: health ok, PostgreSQL, wallet mode, Sepolia chain 11155111, the expected PortfolioVault, 10 distinct verified types across 12 receipt hashes. Observed block: 11940098; NAV: 748.80 mUSD; paused: false. These are historical observations, not guaranteed current prices. [Latest public check](../evidence/current-hosted-check.json).

The latest read-only run did not restart the service, so its `databaseRestartVerified: false` correctly means that this run alone has no restart proof. The earlier [hosted acceptance](../evidence/hosted-acceptance.json) and identical [before](../evidence/hosted-jobs-before-restart.json)/[after](../evidence/hosted-jobs-after-restart.json) jobs sentinel record establish persistence across the observed Render restart. This non-chain row cannot be reconstructed by replaying blockchain events.

## Transaction and impact evidence

The Sepolia deployment has seven deployed contracts (three core, exchange, three tokens) and 17 verified deployment/initialization steps. See [deployment results](SEPOLIA_RESULTS.md). Business receipts cover deposit, strategy/policy changes, rebalance, pause, paused in-kind redemption and resume, with separate role wallets. Public execution was manually signed; unattended Keeper execution was tested locally.

- Public inventory: 12 successful receipts, 10 distinct types including ERC20 approve; 9 core methods.
- Local inventory: 32 successful receipts, 13 types including approve; 12 core methods.
- Selected permission experiment: six unauthorized privileged calls rejected across three contract tests (four investor calls, one manager policy call, one revoked Keeper call).
- Paused exit: successful public redemption of 250 shares, leaving 750 shares and NAV approximately 748.80 mUSD.
- Public rebalance: 563,260 gas; 1.60 mUSD simulated exchange fees on 1,000 mUSD; gas is separately paid in Sepolia test ETH.
- Deterministic fixture: Volatility Target drawdown 5.82% versus Equal Weight 9.04%, a 3.22 percentage-point reduction; returns are negative for both. Full assumptions and baseline measures are in technical report pp. 10–12.

Failed estimates are excluded from successful receipt totals. These functional and synthetic measures support prototype acceptance, not real-world savings, profitability, security certification or uptime claims.

## Submission artifact validation

The report renders to 14 pages, manual to 4 and contribution report to 2. Five diagrams are present. The 12-slide PPTX contains native tables and a native quantitative chart and passes package/layout checks. The ten-minute H.264/AAC video has English captions/narration and is fully decoded for corruption checks; representative frames cover each chapter and the recorded workflow. The final checksums and measured duration are recorded in [artifact metadata](../evidence/submission-artifacts.json).
