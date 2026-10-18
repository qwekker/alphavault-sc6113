# Verification record

**Current checkpoint (18 October 2026):** the final full suite passes 64/64; public API acceptance is recorded in `evidence/submission-hosted-check.json`. The 14-page report, five diagrams, 12-slide deck, ten-minute video, user manual and contribution report are supplied. See [TESTING_REPORT.md](TESTING_REPORT.md) and [SUBMISSION_MAP.md](SUBMISSION_MAP.md). Sections below preserve earlier checkpoints; earlier statements about pending artifacts are historical.

Date: 2026-10-17. Node.js 22.23.2; Solidity 0.8.30; optimizer 200 runs; Shanghai EVM; Ganache chain ID 31337.

## Automated checks

- 54/54 tests passed: 20 contract tests, 13 API/database/Keeper tests, 12 deployment/recovery tests, 5 receipt-validation tests, 4 quantitative-method tests. See `evidence/tests.tap`.
- Clean `npm ci` in a separate empty directory succeeded (443 packages); no old project path is required by source or package metadata.
- Compiler produced all contracts without errors; browser app and deployment script passed JavaScript syntax checks.
- Evidence generation produced 32 successful receipts and 13 distinct business-method types; two expected unauthorized/paused preflight rejections have no transaction hash.
- The full demo was stopped and restarted; saved NAV, share supply and block hash were retained. See `evidence/restart-check.json`.
- The optional automatic Keeper ran on a new local deployment and executed the first allocation without a UI transaction.

## Browser checks

The in-app browser exercised the actual local UI and EVM, not an injected fake wallet. It verified:

1. Deployment/config and live 10,000 mUSD initial holdings.
2. Investor rejection when attempting a strategy-manager action.
3. Manager selection of Momentum and 20/60/20 target display.
4. Keeper rebalance and actual mETH/mBTC balances; NAV approximately 9,984 after fees.
5. Investor approve and deposit; correct shares and updated holdings.
6. Risk-officer pause and resume.
7. Investor redemption while paused, rechecked against the final consistent-virtual-share implementation.
8. Indexed events for the demonstrated actions in the ledger.
9. Synthetic research output with explicit source/cost disclosures.
10. 390px mobile and 1440px desktop layouts had document width equal to viewport width (no page-level horizontal overflow).
11. No browser console errors were observed in the tested workflow.

Browser-wallet extension signing and Sepolia transactions are not covered by this local UI check. No screenshot files, final PDF report, PPTX or video are claimed as completed.

## Measured local gas

Gas ranges below come from this particular isolated evidence run, including differing storage-write costs. They are not chain-latency benchmarks.

| Method | Minimum gas | Maximum gas |
|---|---:|---:|
| `updateMarket` | 53,810 | 124,360 |
| `setAssetEnabled` | 52,429 | 54,567 |
| `approve` | 46,175 | 46,175 |
| `deposit` | 137,079 | 137,079 |
| `configure` | 36,523 | 36,523 |
| `selectStrategy` | 33,266 | 53,228 |
| `setAutomation` | 51,034 | 51,034 |
| `setLimits` | 37,819 | 37,819 |
| `rebalance` | 274,006 | 295,547 |
| `setEnabled` | 34,670 | 34,682 |
| `setRole` | 24,906 | 46,818 |
| `setPaused` | 25,021 | 46,933 |
| `redeem` | 140,119 | 140,119 |


## Not yet verified / not yet completed

- Public host and HTTPS deployment, public API persistence and uptime.
- Sepolia contract source verification. Deployment and separate role-wallet business signatures are complete; see the final business acceptance update below.
- Container build on a Docker daemon; Dockerfile/Compose are supplied as deployment scaffolding.
- Live independent price ingestion or empirical financial backtesting.
- Production security audit, malicious nonstandard token compatibility, fuzz/formal verification.
- Final course-rubric reconciliation and finished report/deck/video.

## Source integrity

`evidence/transactions.json` records SHA-256 hashes of the contract sources used for that run. Re-run evidence after any contract change. Local evidence hashes do not exist on Etherscan. The UI data directory is a separate persistent demonstration; do not merge its transaction hashes with the ephemeral evidence run.

## Sepolia preparation update

The same deployment engine used by the MetaMask wizard and CLI completed all 17 steps on an isolated Ganache instance with chain ID 11155111. JSON checkpoint restoration did not redeploy completed steps. Wrong network, changed artifacts, mismatched receipts, uncertain submission and bad manifest wiring were rejected. Explicit wallet rejection cleared only the unbroadcast step; failed checkpoint persistence caused no send. A matching mined revert could be retried with its failed receipt preserved. Smart-contract/delegated deployers were refused before signing.

The exported manifest was checked against seven deployed contracts, including role bootstrap revocation and token initialization. Receipt tests covered exact vault approvals, exclusion of mint/deploy/foreign approvals, missing receipts, deduplicated method coverage and reverted transactions. The deployment page loaded in the in-app browser and correctly explained that MetaMask must be used in an extension-enabled browser. That preparation rehearsal did not send public Sepolia transactions; the later public deployment is recorded below.

A separate production-dependency installation was pruned of Ganache and solc, then booted the wallet-only server against the existing local RPC on port 3104 with a separate scratch SQLite file. The server validated all contract wiring, served the dashboard without a demo signer, showed “No wallet connected”, and verified a deposit receipt from the UI (gas 137079). This was a read-only-chain rehearsal plus writes only to the scratch database, not a public deployment.


## Public Sepolia deployment and wallet recovery update

Seven deployment receipts were verified against original calldata and canonical block hashes. Public addresses, hashes and compiler fingerprint are recorded in `evidence/sepolia-deployment-progress.json`; these are separate from local evidence.

The eighth transaction (`0x9ee74038cfd43bb1af6c014c9153f5dca588631c6761666d0fecea976ee6b52a`) reverted with status 0, gas used 543,779 and fee 0.000815668510875580 Sepolia ETH. It was a type-4 wallet-wrapped `redeemDelegations` call, not the direct transaction requested by the wizard. Its inner call exactly matched the intended RiskManager initialization. Afterward the deployer had EIP-7702 delegation code; its RISK role remained true and a direct static call with the intended parameters succeeded. A public RPC did not expose debug tracing, so the wrapper's internal revert reason is not established.

Recovery now accepts only a canonically reverted attempt from the original sender, on Sepolia, with zero outer value and either exact direct calldata or this known wrapper's one zero-mode execution containing the exact target, zero value and calldata. Pending/successful receipts, extra calls, modified targets/modes/payloads and unknown wrappers remain blocked. Failed receipt metadata is retained. Read-only verification against the actual receipt recovered seven completed steps without sending any transaction. Unit tests additionally exercise these rejection boundaries. Both wrapped failures were recovered; all 17 steps subsequently completed with direct wallet transactions.


## Completed Sepolia deployment

All 17 successful transactions were independently checked through a public Sepolia RPC against original sender, chain, expected calldata, canonical receipts and deployed code. Verification at block 11934725 checked all seven contract addresses, core contract wiring, asset order, symbols/decimals/ownership, manager/risk/Keeper grants, and revocation of the deployer’s bootstrap risk permission. See `evidence/sepolia-verification.json` and `evidence/sepolia-deployment-progress.json`.

Investor holds 100,000 mUSD; exchange holds 100,000,000 mUSD and 1,000,000 each mETH/mBTC. Both risky assets are enabled. Vault share supply is zero and automation is disabled, as expected before the business demonstration. Deployment fees total 0.063297268220609263 Sepolia ETH; the two recorded failed attempts cost 0.001137595524611132 Sepolia ETH, excluding separate wallet account-mode changes.

The local wallet-only API/dashboard uses port 3102 and a separate persistent `data/sepolia/alphavault.sqlite`. At that deployment checkpoint, public hosting, source verification and business evidence were outstanding. The subsequent business acceptance below satisfies ten method types including approval; deployment count is not business-method coverage.


## Business-test preparation

Read-only preflight confirmed that the investor has 100,000 mUSD, zero allowance and zero vault shares. The manager has test ETH; the risk officer had zero Sepolia ETH at this check and needs funding before risk operations. See `evidence/sepolia-business-preflight.json` for timestamped values. No deposit or rebalance is claimed at this stage.

During initial wallet connection, automatic polling could access the provider before its signer was ready. The UI now publishes the provider and signer together after connection completes, prevents duplicate connection clicks, and explains a pending MetaMask request. JavaScript syntax validation passed. The subsequent three-wallet workflow completed successfully, including switching accounts, authorizations and persisted business receipts.


## Completed public business acceptance

The three-wallet Sepolia workflow completed 12 successful receipts across 10 business methods, including ERC20 approval. All 12 were revalidated by RPC at export, with zero exclusions. Rebalance reduced NAV from 1,000 to approximately 998.40 mUSD through mock trading fees; a 25% redemption succeeded while paused; the final state is resumed, with 750 shares and 748.80 mUSD NAV. See `SEPOLIA_RESULTS.md`, `evidence/sepolia-business-evidence.json` and `evidence/sepolia-final-portfolio.json`. Automatic Keeper execution remains locally verified only.

A display correction hydrates strategy and risk parameter forms from chain state after reload instead of showing initial defaults; in-progress edits are retained across polling. JavaScript syntax and browser hydration are checked separately from the prior 54-test suite. No Solidity changes were made.


## Hosting preparation and isolated restart rehearsal

The updated full suite passes **57/57** tests (`evidence/hosting-preparation-tests.tap`), including three new receipt-bootstrap cases. The production startup can import a bounded list of public transaction hashes after checking its chain and vault binding; receipt contents are fetched and validated through RPC, never accepted from cached claims. Duplicate/reopened imports do not increase coverage.

An isolated local wallet-mode process on port 3104 used the actual Sepolia RPC and a new scratch SQLite database. First startup imported all 12 receipts; after shutdown and restart it imported zero and skipped 12. A deliberately stored non-chain job sentinel was retained, so the local persistence check does not rely solely on reindexed blockchain events. The public acceptance script checks wallet-only mode, the configured chain/vault, signing endpoint rejection, events, evidence and restart consistency. See `evidence/hosting-preparation-check.json` and `evidence/hosting-rehearsal-*.json`.

The existing 3102 dashboard was not restarted or repointed. Render configuration is prepared but unapplied. No public HTTPS site, cloud persistent disk or hosted restart has been verified. Docker Compose configuration parses successfully; Docker daemon was not running, so image build execution remains unverified.

## Free hosting preparation (2026-10-18)

The default Blueprint now provisions a free Render instance without a disk. External PostgreSQL is required, with a private `alphavault` schema, certificate-verified TLS and a three-connection pool. SQLite remains the local/VPS option. Database operations are awaited; each index batch uses a single transaction/connection, and health checks now verify both chain and database. Periodic telemetry retains the newest 2,000 snapshot blocks per deployment; events and receipt evidence are retained.

The full suite passes 64 tests (`evidence/free-hosting-tests.tap`). Seven additional PostgreSQL tests exercise actual PostgreSQL SQL through PGlite/WASM: HTTP reads, duplicate sync, transaction failure rollback, engine reopen retaining a non-chain sentinel and receipts, chain rollback, unhealthy database responses, fail-closed configuration/TLS, and bounded snapshots. A native local PostgreSQL initialization was attempted but blocked by sandbox shared-memory permissions; it was not used as test evidence. The same suite supports `TEST_DATABASE_URL` for live pg-driver testing against a dedicated test database.

Supabase account setup, real pooler/TLS connectivity, Render build and public HTTPS/restart acceptance remain pending. No new paid hosting resources were created. Local SQLite/API regression tests pass; existing running local services were not restarted.

## Public Render / Supabase acceptance (2026-10-18)

The public application is live at https://alphavault-sepolia.onrender.com, running commit `52aca85` on Render Free with Supabase Free PostgreSQL in Singapore. The Linux Docker build and real pg/TLS connection succeeded. Two deployment issues were corrected: the Ganache-bundled macOS `fsevents` entry is optional in the lockfile, and Supabase hosts use the official root CA downloaded from the project's Database Settings page. Certificate verification remains enabled. The CA SHA-256 fingerprint is `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`. Targeted PostgreSQL tests passed 7/7 after the TLS change; the preceding full suite passed 64/64.

Both public acceptance runs passed: health reported PostgreSQL / wallet / Sepolia, local signing was rejected, rebalance and redemption events were present, and RPC revalidation found 12 receipts covering 10 successful methods without exclusions. The browser displayed NAV 748.80 mUSD, share index 99.84, Momentum and 20/60/20 allocations. Stale mock prices were correctly disclosed. This was a read-only public UI check; no new wallet transaction was signed on this origin.

A non-chain sentinel was inserted through the project's SQL Editor, observed through `/api/jobs`, and retained exactly after the Render Restart service action. New process `2qp2b` logged `imported:0, skipped:12` at 00:30:46 Singapore time, then began listening at 00:30:52. This supplements the event/receipt comparison (which alone could be reconstructed from chain data). Evidence: `hosted-before-restart.json`, `hosted-after-restart.json`, `hosted-jobs-before-restart.json`, `hosted-jobs-after-restart.json` and `hosted-acceptance.json`. The generic check script deliberately leaves its own `databaseRestartVerified` false; the combined sentinel/log evidence is recorded as true in `hosted-acceptance.json`.

Free compute can sleep, Supabase may pause an inactive project, and manual mock reports age out. Explorer source verification and final report/slides/video still require completion; public availability is a verified checkpoint, not an uptime guarantee.

## Submission artifacts and recording update (2026-10-18)

An editable 7-page report and 10-slide presentation were generated from the implementation and saved evidence, with rendered page/slide inspection. The slides include an editable synthetic NAV chart and speaker notes. The report remains a draft with missing student identity and no original rubric reconciliation.

A separate local chain on port 3110 / RPC 18550 was used for actual browser recording: approve, deposit, select Momentum, Keeper rebalance, risk pause and investor redemption while paused. Initial seeded NAV 10,000 became 11,000 after deposit, 10,982.40 after trading fees, and the investor retained 8,250 shares after redemption. Local and public states are distinct. The recording then showed the deployed public dashboard and RPC-revalidated method coverage. No new public transaction was signed. The edited MP4 includes Chinese captions and no audio narration. The later browser-blocked direct health navigation is outside the retained clip and is not claimed as an additional API check. See `evidence/video-recording.json` and `docs/SUBMISSION_CHECKLIST.zh-CN.md`.


## English narration and author revision (2026-10-18)

The report and presentation now identify Du zhuotong. The student ID field was removed. The previous silent Chinese-caption video was replaced with English captions and synthetic English narration (en-US-GuyNeural), using the same recorded actions. Sixteen audio slots are padded to exact sample counts to prevent cumulative timing drift. No application code or on-chain state changed. Updated artifacts, subtitle file and checks are recorded in `evidence/video-recording.json`.
