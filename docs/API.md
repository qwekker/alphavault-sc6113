# REST API

Base URL is the same origin as the dashboard. JSON responses; on-chain integers are decimal strings to avoid precision loss. UI numbers are display-only. Transaction input encoding uses ethers integer arithmetic.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | RPC availability, database type and network mode |
| GET | `/api/config` | Deployment, addresses, roles and simulation disclosures |
| GET | `/api/portfolio` | Coherent block-tagged holdings, NAV, target, policy and timestamp |
| GET | `/api/prices` | Latest on-chain price/signal reports with freshness flags |
| GET | `/api/strategies` | Selection, enabled flags, config, target and policy result |
| GET | `/api/account/:address` | Shares, mUSD balance and vault allowance |
| GET | `/api/history?limit=50` | Latest events; limit is 1–200 |
| GET | `/api/snapshots` | Last 200 observed block snapshots, chronological |
| GET | `/api/jobs` | Last 50 Keeper/demo execution outcomes |
| GET | `/api/backtests/:id` | Reproducible synthetic test for strategy 0, 1 or 2; persisted |
| POST | `/api/receipts` | Verify and persist a business transaction by `{ "hash": "0x..." }` |
| GET | `/api/evidence` | Revalidate saved receipts and export 13-method coverage, gas, fees and confirmations |
| GET | `/api/setup/artifacts` | Compiler artifacts; only explicit local demo/setup mode |
| POST | `/api/transactions/build` | Validated unsigned transaction request; no signing |
| POST | `/api/demo/action` | Local-only signer dispatch; absent permission in hosted mode |

Example request:

```json
{"action":"selectStrategy","args":{"id":1}}
```

Unsigned response has `to`, `data`, `value`, `chainId`, and required `role`. The browser checks the network and asks the connected wallet to sign. The required role label is informational; Solidity is authoritative. Contract functions with a positive numeric amount reject missing/negative/NaN inputs. See `backend/actions.py` for the complete action schema.

Demo requests additionally contain `role` and the `X-AlphaVault-Demo: 1` header. The server requires loopback access and rejects a foreign Origin. Demo signers contain only public local test accounts and are never available in `npm start`. Do not publish `npm run dev` behind a reverse proxy or forward its unlocked RPC port.

Indexer scope is `(chainId, vault address)`. Events are unique by `(scope, txHash, logIndex)`; prices and portfolio/strategy snapshots by block. The stored cursor block hash is compared against the canonical chain. A mismatch clears and rebuilds that scope's derived records. This is a small-project indexer: one-block observations are not finality, history is bounded in the UI, and very large histories need pagination and a dedicated finalized indexer.

Snapshots are created on observation, not every historical block. After a first-time index or reorg rebuild, event history can be complete while earlier NAV observations are unavailable. SQLite persists those collected observations across restarts. Stale valuations are clearly flagged and must not be mistaken for currently executable oracle prices.

Evidence export is limited to 300 saved receipts and reports `totalSaved`, `exportLimit` and `truncated`. It validates contract calldata and target deployment, counts only status-1 supported business methods, and excludes reverted/pending/orphaned entries from successful coverage. Receipt observations are not a promise of finality.

The active implementation is Python Flask in `backend/app.py`. `/api/health` and `/api/config` report `backend: python-flask`. The production process is Gunicorn; public writes are wallet-signed.
