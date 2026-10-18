# AlphaVault user manual

Author: Du zhuotong | SC6113 | Test-asset demonstration

This manual explains how to inspect the portfolio and operate the investor, strategy, risk and evidence screens. Use the public deployment to review Sepolia state, or use the local demonstration to perform disposable transactions. All assets and market reports are simulated. A stale displayed valuation is not a live executable price.

## Access and account preparation

Public application: https://alphavault-sepolia.onrender.com. Open it in a browser with MetaMask, select Sepolia (chain ID 11155111), and choose Connect wallet. A connection authorizes account visibility; each subsequent transaction still needs confirmation. The account must have Sepolia test ETH for gas and the required contract role. ETH gas funding does not provide mUSD deposit tokens. Free hosting may need time to wake before the dashboard loads.

For local use, install Node.js 22.13 or later, then run npm ci, npm run compile and npm run dev in the repository. Open http://127.0.0.1:3100. The local chain uses ID 31337, RPC port 18547, SQLite and a seeded investor with 10,000 mUSD already deposited. The local role selector chooses public test accounts. It does not grant permissions to a connected public wallet. Do not import the local test mnemonic into a wallet holding real funds.

## Screen guide

| Screen | Main task |
| --- | --- |
| Overview | Inspect NAV, share index, holdings and account shares; approve, deposit and redeem. |
| Strategies | Select/configure a rule, inspect target weights, enable automation and request rebalance. |
| Risk controls | Pause/resume, set limits, publish mock markets, enable assets and administer roles. |
| Activity ledger | Inspect events, open transaction links and export verified method evidence. |

NAV measures all held assets at reported prices. The share index measures value per share relative to its starting value, so a redemption may reduce NAV without reducing the index. The block label and network label identify the observation. “Synthetic” research is a deterministic method experiment rather than realized investment performance.

# Investor operations and confirmations

## Approve and deposit

1. Select the Investor role locally, or connect the Sepolia investor wallet publicly. Confirm the displayed account and chain.
2. Open Overview and enter the amount in mUSD. Check the account’s mUSD balance; test ETH is used separately for gas.
3. Click 1. Approve and confirm the token allowance request. Wait for confirmation before continuing.
4. Click 2. Deposit and review the target contract in the wallet. Confirm, then wait for the receipt and refreshed shares.
5. Check Activity ledger for Deposited and the transaction hash. Repeated clicking is not a substitute for checking a pending transaction.

Deposits require a permitted state and a valid NAV where invested assets must be priced. When paused or stale, refresh the relevant risk inputs or use the available exit operation rather than repeatedly retrying a deposit. Shares are minted against pre-deposit NAV, so the number is not always equal to the mUSD amount.

## Redeem held assets

1. Open Overview with the investor account that owns the shares.
2. Click Redeem 25% of my shares. The current interface submits one quarter of that account’s raw share balance.
3. Confirm the transaction and wait for its receipt. The wallet receives a proportional basket of mUSD, mETH and mBTC.
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

1. Use the Manager account and open Strategies. Choose Equal Weight, Momentum or Volatility Target, then confirm selection.
2. Review the cash buffer, volatility target and minimum rebalance interval. Change parameters with Update parameters if needed. Inputs expressed in basis points use 100 bps = 1%.
3. Enable automation if the vault’s flag is off, and ensure the selected strategy is enabled. This flag permits execution but does not start a cloud worker.
4. Switch to the authorized Keeper account. Check displayed target weights and execution status. Wait until cooldown ends and required reports are fresh.
5. Click Execute rebalance and confirm. Check actual holdings, NAV and Rebalanced in the ledger. A failed bound reverts all swaps.

In the standard local fixture, Equal Weight targets 20/40/40 and Momentum targets 20/60/20 for mUSD/mETH/mBTC. Market reports and configuration determine the actual target. The optional local Keeper runs with AUTO_KEEPER=1 npm run dev and checks eligibility every ten seconds. Public unattended signing is not part of the hosted demo.

## Adjust limits and market reports

Use the Risk officer account and open Risk controls. Save risk limits updates maximum risky-asset weight, minimum cash, weighted-volatility bound, execution-loss bound and price age. For a controlled test, a 5,000 bps cap rejects a 60% target; restore an appropriate policy before the next valid trade. Do not treat that rejection as a failed application.

In Mock market report, choose mETH or mBTC, enter the mock price, annual volatility and momentum, and publish. Refresh both risky assets when their reports expire. The original fixture uses mETH price 3,000 and mBTC price 60,000 mUSD; preserve the intended scenario when refreshing. These are controlled inputs, not independently sourced live prices. Re-reporting a disabled asset does not re-enable it.

## Pause and administration

Pause vault blocks deposits and rebalance while preserving redemption. Resume vault removes that pause, but stale prices or other limits can still prevent trading. Only Admin can grant/revoke MANAGER, RISK or KEEPER through Role administration. Verify the full recipient address and intended role before submitting. Manager cannot change risk policy and Keeper cannot select a strategy.

# Evidence export and troubleshooting

## Export a reviewable record

1. Open Activity ledger. Use a transaction link to inspect a public Sepolia receipt; local hashes are only meaningful on the local chain.
2. To add public evidence, enter a successful transaction hash from this deployment and choose Verify receipt. The API validates it through RPC.
3. Choose Export verified evidence for the method inventory, or Export JSON for indexed events. Record the chain, vault address and observation time with the export.
4. Count distinct successful methods, not repeated calls or failed estimates. Current Sepolia evidence contains ten types including ERC20 approve; the full local inventory covers thirteen.

| Symptom | Action |
| --- | --- |
| Cannot find µWS native binary | Ganache can fall back to JavaScript. If the server prints its URL, check the page; this warning alone is not a startup failure. |
| SQLite unavailable | Use Node 22.13 or later; Node 20 lacks the required built-in module. |
| Port already in use | Use independent PORT and RPC_PORT values; do not stop another project’s service. |
| Stale prices | Have the Risk officer refresh both risky mock markets; the last valuation can remain visible. |
| Wrong role / permission error | Connect the role’s authorized account. UI labels do not create on-chain rights. |
| Cooldown / policy blocked | Wait for chain time or have the authorized owner restore valid settings. |
| Public page unavailable | Allow the free service to wake; inspect Render/Supabase and /api/health. Preserve the database. |
| Uncertain transaction outcome | Inspect the hash/receipt before retrying to avoid duplicate actions. |

## Persistence and independent demonstration

Restarting the local server preserves data/local, including the chain and SQLite database. For an independent rehearsal, set a new DATA_DIR and unused ports, for example PORT=3200 RPC_PORT=18548 DATA_DIR=./data/rehearsal npm run dev. Do not delete existing data to make a demonstration look clean. Public deployment uses PostgreSQL; operational setup is documented in HOSTING.zh-CN.md and DEPLOYMENT.md.

For reproducible validation, run npm test. The current record is 64 passed and zero failed. The repository includes deployment manifests, test logs, a technical report and an individual contribution report. No private key, seed phrase or database password is required in a submitted screenshot or report.

