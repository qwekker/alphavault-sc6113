# AlphaVault User Manual

Du Zhuotong

This manual explains how to inspect the portfolio and operate the investor, strategy, risk and evidence screens. Use the public deployment to review Sepolia state, or use the local demonstration to perform disposable transactions. All assets and market reports are simulated. A stale displayed valuation is not a live executable price.

## Access and account preparation

Public application: https://alphavault-sepolia.onrender.com. Open it in a browser with MetaMask, select Sepolia (chain ID 11155111), and choose Connect wallet. A connection authorizes account visibility; each subsequent transaction still needs confirmation. Transactions need Sepolia test ETH for gas. Manager, risk and Keeper actions require their on-chain roles; deposits are open to any funded account and redemption uses only its own shares. Depositing also requires mUSD from the mock-token owner; the dashboard has no faucet. Free hosting may need time to wake before the dashboard loads.

Install Python 3.12 and Node.js 22.13+. In Source-Code, create a virtual environment with python3 -m venv .venv, activate it, and run pip install -r requirements-dev.txt, npm ci, npm run compile, then python scripts/demo.py. Open http://127.0.0.1:3100. Flask serves the dashboard; Ganache uses chain 31337 and RPC port 18547. The seeded investor has 10,000 mUSD deposited. Leave Connect wallet unused and select an Act as role for local test transactions without MetaMask confirmations. Displayed shares belong to the seeded investor. A connected wallet hides Act as and signs its own transactions.

## Screen guide

| Screen | Main task |
| --- | --- |
| Overview | Inspect NAV, share index, holdings and account shares; approve, deposit and redeem. |
| Strategies | Select/configure a rule, evaluate synthetic results, inspect targets and request rebalance. |
| Risk controls | Pause/resume, set limits, publish mock markets, enable assets and administer roles. |
| Activity ledger | Inspect events, open transaction links and export verified method evidence. |

In wallet mode, changing the MetaMask account or chain reloads the page; click Connect wallet again and verify the account and network. View deployment opens /api/config with the recorded role addresses; on-chain permissions remain authoritative. NAV measures all held assets at reported prices. The share index measures value per share relative to its starting value, so a redemption may reduce NAV without reducing the index. The block label and network label identify the observation. “Synthetic” research is a deterministic method experiment rather than realized investment performance.

# Investor operations and confirmations

## Approve and deposit

1. Select the Investor role locally, or connect the Sepolia investor wallet publicly. Confirm the displayed account and chain.
2. Open Overview and enter the mUSD amount. The dashboard shows shares, not wallet cash. Check cash through /api/account/<address>; cash and allowance use 18 decimals. Test ETH pays gas separately.
3. Click 1. Approve for the entered amount. In wallet mode, confirm the allowance request; locally, wait for the Confirmed message. If you increase the deposit amount later, approve again.
4. Click 2. Deposit. In wallet mode, review the vault address and confirm. In both modes, wait for the receipt and refreshed shares.
5. Check Activity ledger for Deposited and the transaction hash. Repeated clicking is not a substitute for checking a pending transaction.

Deposits require an unpaused vault and fresh prices for any held risky assets. If paused, the Risk officer must Resume vault; if held-asset prices are stale, refresh those reports. A cash-only vault does not need risky-asset prices to accept deposits. Shares are minted against pre-deposit NAV, so the number is not always equal to the mUSD amount.

## Redeem held assets

1. Open Overview with the investor account that owns the shares.
2. Click Redeem 25% of my shares. The current interface submits one quarter of that account’s raw share balance.
3. Confirm in wallet mode, or wait for local execution. The account receives its proportional share of the held mUSD, mETH and mBTC basket.
4. Inspect remaining shares, token transfers and the Redeemed event. Repeat only if an additional quarter-of-current-balance exit is intended.

Redemption remains available while trading is paused and does not require fresh price reports. It is an in-kind exit; it does not promise conversion of all holdings to cash. Display rounding and virtual balances can leave tiny residual holdings. The contract supports arbitrary valid share amounts through its interface; this dashboard button exposes the 25% shortcut.

## What a transaction status means

| Status | Required interpretation |
| --- | --- |
| Wallet rejected | No accepted signature from that request. Reopen only if the action is still intended. |
| Estimation failed | A policy or input rejected preparation; do not count a successful transaction. |
| Submitted / pending | Check the hash and receipt before retrying. |
| Confirmed | Receipt status succeeded; inspect emitted events and refreshed balances. |

# Strategy manager and risk officer operations

## Select a rule and execute

1. Select Strategy manager locally or connect the manager wallet. Open Strategies and choose Equal Weight, Momentum or Volatility Target; confirm in wallet mode.
2. Review the cash buffer, volatility target and minimum rebalance interval. Change parameters with Update parameters if needed. Inputs expressed in basis points use 100 bps = 1%.
3. Click Enable automation if needed and Enable selected strategy if the current strategy is disabled. This permits execution but does not start a cloud worker.
4. Switch to the authorized Keeper account. Check displayed target weights and execution status. Wait until cooldown ends and required reports are fresh.
5. Click Execute rebalance and confirm in wallet mode. Check holdings, NAV and Rebalanced in the ledger. A failed bound reverts all swaps.

In the standard local fixture, Equal Weight targets 20/40/40 and Momentum targets 20/60/20 for mUSD/mETH/mBTC. Market reports and configuration determine the actual target. Start the local server with AUTO_KEEPER=1 npm run dev for the Keeper loop (stop that same server before restarting). It checks eligibility and at least 300 bps allocation drift by default, with a ten-second delay between completed checks. Public unattended signing is not part of the hosted demo.

Evaluate selected strategy runs a synthetic backtest and displays return, drawdown, annualized volatility, Sharpe ratio, fees and period length. It uses generated historical inputs, not the current mock price reports, and sends no blockchain transaction.

## Adjust limits and market reports

Use the Risk officer account and open Risk controls. Save risk limits updates maximum risky-asset weight, minimum cash, weighted-volatility bound, execution-loss bound and price age. For a controlled test, a 5,000 bps cap rejects a 60% target; restore an appropriate policy before the next valid trade. Do not treat that rejection as a failed application.

In Mock market report, choosing an asset does not fill its fields. Enter all three values before Publish market report: the original fixture uses mETH 3000 / 4000 / 800 and mBTC 60000 / 3000 / 400 (price in mUSD / volatility bps / momentum bps). Refresh both expired reports using the intended scenario. Enable asset and Disable asset apply to the chosen asset; publishing alone does not re-enable it.

## Pause and administration

Pause vault blocks deposits and rebalance while preserving redemption. Resume vault removes that pause, but stale prices or other limits can still prevent trading. Only Admin can grant/revoke MANAGER, RISK or KEEPER through Role administration. Verify the full recipient address and intended role before submitting. Manager cannot change risk policy and Keeper cannot select a strategy.

# Evidence export and troubleshooting

## Export a reviewable record

1. Open Activity ledger. Use a transaction link to inspect a public Sepolia receipt; local hashes are only meaningful on the local chain.
2. To add public evidence, enter a successful transaction hash from this deployment and choose Verify receipt. The API validates it through RPC.
3. Choose Export verified evidence for the method inventory, or Export JSON for the latest 50 indexed events shown in the ledger. Record the chain, vault address and observation time with the export.
4. Count distinct successful methods, not repeated calls or failed estimates. The saved 18 October 2026 Sepolia checkpoint contains ten types including ERC20 approve; recorded local evidence covers thirteen. A fresh local database need not contain all thirteen.

| Symptom | Action |
| --- | --- |
| Cannot find µWS native binary | Ganache can fall back to JavaScript. If the server prints its URL, check the page; this warning alone is not a startup failure. |
| SQLite unavailable | Use Python 3.12 and activate .venv. Reinstall requirements-dev.txt; check DB_PATH permissions. |
| Port already in use | Use independent PORT and RPC_PORT values; do not stop another project’s service. |
| Stale prices | Have the Risk officer refresh both risky mock markets; the last valuation can remain visible. |
| Wrong role / permission error | Connect the role’s authorized account. UI labels do not create on-chain rights. |
| Cooldown / policy blocked | Wait for chain time or have the authorized owner restore valid settings. |
| Public page unavailable | Allow the free service to wake; inspect Render/Supabase and /api/health. Preserve the database. |
| Uncertain transaction outcome | Inspect the hash/receipt before retrying to avoid duplicate actions. |

## Persistence and independent demonstration

Restarting with the same DATA_DIR preserves the local chain and SQLite database (default data/flask-local). For an independent rehearsal, set a new DATA_DIR and unused ports, for example PORT=3200 RPC_PORT=18548 DATA_DIR=./data/rehearsal npm run dev. Do not delete existing data to make a demonstration look clean. Public deployment uses PostgreSQL; operational setup is documented in docs/HOSTING.zh-CN.md and docs/DEPLOYMENT.md.

Run python -m pytest -v for the 36 Flask tests and npm test for the 64 Solidity/legacy regression tests. Both suites pass. Logs are in evidence/flask-tests.txt and evidence/flask-migration-node-regression.tap. The source folder includes manifests, standalone ABI and setup instructions. Keep private keys, seed phrases and database passwords out of submitted screenshots.

