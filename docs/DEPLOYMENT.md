# Deployment runbook

Current status: local MVP verified; all 17 AlphaVault Sepolia deployment/initialization steps completed and verified. Local wallet-mode dashboard is configured on port 3102 with separate SQLite storage. Twelve successful multi-role business receipts cover ten methods. Public HTTPS hosting is live at https://alphavault-sepolia.onrender.com on Render Free, backed by Supabase PostgreSQL; API and restart persistence were verified on 2026-10-18 (see `evidence/hosted-acceptance.json`). See `evidence/sepolia-verification.json`.

## 1. Local preparation

```sh
node --version # >=22.13
npm ci
npm run compile
npm test
npm run evidence
```

`npm ci` installs the exact lockfile. Ganache may report that its native µWS binary is unavailable on Node 22 and fall back to JavaScript; this is expected and tests cover the fallback. Node 22 may also label `node:sqlite` experimental.

## 2. Deploy test assets and contracts on Sepolia

**Recommended:** run `npm run setup` and use the MetaMask wizard. See [Chinese walkthrough](SEPOLIA_WALKTHROUGH.zh-CN.md). Its independent loopback server uses port 3101 and never signs on behalf of the user. Download a progress backup after transactions. Wallet confirmations remain user actions.

The command-line alternative below is for users who explicitly prefer locally managed testnet keys.

Use dedicated testnet wallets. Provide values through the terminal environment or a secret manager, not in committed source or chat:

```sh
# Set these privately in your own shell. Values below are placeholders, not executable credentials.
export RPC_URL='https://YOUR_SEPOLIA_RPC'
export DEPLOYER_PRIVATE_KEY='YOUR_TESTNET_KEY'
export INVESTOR_ADDRESS='0xYOUR_INVESTOR'
export MANAGER_ADDRESS='0xYOUR_MANAGER'
export RISK_ADDRESS='0xYOUR_RISK_OFFICER'
export KEEPER_ADDRESS='0xYOUR_KEEPER'
npm run deploy:sepolia
```

The script refuses non-Sepolia networks, deploys the three mock assets and four other contracts, initializes prices and liquidity, mints test mUSD to the investor, and hands the oracle role to the designated officer. The bootstrap risk role is revoked when distinct from the deployer. Files are written to `data/sepolia/deployment.json` and `receipts.json`. Each role that sends transactions needs test ETH. Deployment transactions alone do not satisfy the business-transaction checklist.

The admin remains capable of setting roles; replace it with a multisig in future work. The deployment script's key is used only by that local command, never by the HTTP server. The CLI now persists `data/sepolia/progress.json` before wallet submission and after obtaining each hash, resumes confirmed matching transactions, and uses an exclusive lock to prevent concurrent deployers. Pending/unknown submissions fail closed. Inspect a leftover lock and wallet transactions before removing it. Existing roles and compiler fingerprints must match. The shared engine was tested on an isolated local EVM; the browser workflow also recovered two canonically reverted wallet-wrapped calls on public Sepolia, preserving both failed receipts.

## 3. Run the wallet-only HTTP server

```sh
RPC_URL='https://YOUR_SEPOLIA_RPC' \
DEPLOYMENT_FILE='./data/sepolia/deployment.json' \
DB_PATH='./data/sepolia/alphavault.sqlite' \
HOST=127.0.0.1 PORT=3100 npm start
```

Connect a browser wallet on Sepolia, refresh both mock price reports as risk officer, configure/enable automation as manager, approve/deposit as investor, and rebalance as Keeper. The frontend sends wallet-signed transactions directly to the wallet provider. The server has no signing credentials.

## 4. Container deployment with persistent storage

The default `render.yaml` now uses **Free Render + external Supabase PostgreSQL**. Follow `HOSTING.zh-CN.md`: supply secret `DATABASE_URL` from the Session pooler and require `DATABASE_REQUIRED=postgres`. No Render disk is provisioned. PostgreSQL tables are created in the private `alphavault` schema. Free compute may sleep; Supabase may pause inactive projects. The following SQLite volume instructions apply only to the optional VPS/Compose deployment.

Build the included `Dockerfile`. It runs `npm ci` and compilation, and starts only the wallet-mode server as the unprivileged `node` user. Build dependencies are installed for compilation and then pruned. The hosted server and standalone Keeper no longer load Ganache or the Solidity compiler at runtime.

Mount:

- The packaged public deployment manifest at `/app/config/sepolia-deployment.json` (or an explicit read-only override).
- A durable writable directory at `/app/data` for SQLite WAL files. It must be writable by container UID 1000.

Set `RECEIPT_SEED_FILE=/app/config/sepolia-receipts.json` to import the historical public receipts into an empty database after RPC verification. Set `RPC_URL`, `DEPLOYMENT_FILE=/app/config/sepolia-deployment.json`, `DB_PATH=/app/data/alphavault.sqlite`, `HOST=0.0.0.0`, `PORT=3100`.

Use `compose.yaml` on a VPS or configure an equivalent Node/container service with a persistent disk. Put HTTPS at the hosting provider or reverse proxy. Never route the unlocked local demo RPC or `/api/demo/action` from a demo process to the public Internet. Do not use ephemeral serverless storage for SQLite. One instance with a persistent volume is the MVP deployment model; horizontal scaling needs a shared database/indexer design.

## 5. Automatic Keeper

A dedicated worker process (separate secret boundary from the public API) uses:

```sh
RPC_URL='https://YOUR_SEPOLIA_RPC' \
DEPLOYMENT_FILE='./data/sepolia/deployment.json' \
DB_PATH='./data/sepolia/keeper.sqlite' \
KEEPER_PRIVATE_KEY='YOUR_DEDICATED_TESTNET_KEEPER_KEY' npm run keeper
```

Run exactly one Keeper for this vault. It checks every ten seconds, trades only if max absolute allocation drift is at least 300 bps (`DRIFT_BPS` override), and observes on-chain cooldown. A strategy switch does not guarantee immediate trade if drift is below threshold. Risk reports are still manually supplied, so the Keeper stops trading when they expire. Continuous independent market ingestion is future work.

## 6. Acceptance evidence

Record the final HTTPS frontend/API URLs, deployment addresses, chain ID, verification links and availability date. Run the demonstration with separate wallet accounts. Collect successful receipts for the 13 methods in README; attach screenshots of strategy selection, before/after allocations, a policy rejection, paused redemption and the ledger. Restart the hosted service and verify the same database records remain, including a non-chain persistence sentinel. An unsuccessful gas estimate has no transaction hash; do not list it as a failed mined transaction.

The MetaMask wizard, manifest validation and receipt exporter have also been exercised on public Sepolia; see `SEPOLIA_RESULTS.md`. Public hosting and its persistence/restart acceptance are still pending. The CLI deployment path was rehearsed locally.


## Prepared hosting configuration

See `HOSTING.zh-CN.md` and `../render.yaml` for the current single-instance persistent-disk deployment. The Blueprint describes paid resources and has not been applied. The Docker image now includes public configuration files; runtime data and private environment files remain excluded. `scripts/check-hosted.mjs` checks a deployed URL and can compare historical evidence after restart; the script explicitly does not treat reindexable chain history as proof of disk persistence.
