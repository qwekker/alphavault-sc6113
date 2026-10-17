# Demonstration script and capture checklist

Start from a fresh named directory if a clean session is needed:

```sh
DATA_DIR=./data/presentation npm run dev
```

Initial state: 10,000 mUSD invested, Equal Weight selected, automation enabled, all assets in cash. Local data is persisted; restarting the same directory does not reset balances. Refresh mock market reports if more than an hour old.

| Step | Role / screen | Action | Expected observation |
|---|---|---|---|
| 1 | Overview | Describe test environment and addresses | Actual EVM holdings, cash-only initial allocation |
| 2 | Investor / Strategies | Attempt Momentum selection | Role rejection; no receipt claimed |
| 3 | Manager / Strategies | Select Momentum | Confirmed transaction; target 20/60/20 |
| 4 | Keeper / Strategies | Execute rebalance | Actual cash/mETH/mBTC holdings; NAV about 9,984 after buy fees |
| 5 | Investor / Overview | Approve then deposit 1,000 | Two receipts; shares increase at current NAV |
| 6 | Risk officer / Risk controls | Set max weight to 5,000 bps | Target policy rejects the 60% mETH target |
| 7 | Keeper / Strategies | Attempt rebalance after cooldown | Position-cap revert; balances unchanged |
| 8 | Risk officer / Risk controls | Restore 7,000 bps cap, pause | Paused status; deposit/trading blocked |
| 9 | Investor / Overview | Redeem 25% | Redemption succeeds while paused; basket transfers |
| 10 | Risk officer / Risk controls | Resume | Trading/deposit eligibility restored |
| 11 | Manager / Strategies | Select Volatility Target | Risk exposure shrinks and cash increases |
| 12 | Ledger | Inspect and export JSON | Indexed receipt events and block numbers |
| 13 | Strategies research | Evaluate selected strategy | Synthetic label, costs and measured metrics |

Wait 60 seconds between successful rebalances or leave the Keeper process running with `AUTO_KEEPER=1`. A disabled flag, expired report, bad weight or insufficient drift may cause a skip; that is expected. Public Sepolia demonstrations need independently funded wallets and user-confirmed signatures rather than the local role selector.

## Capture checklist

- Overview before/after first rebalance, same chain and vault address.
- Three strategy targets with their parameters.
- Unauthorized action and risk-policy rejection (distinguish preflight from mined failure).
- Pause state plus successful redemption receipt.
- Ledger export and actual receipt status/gas.
- Deployment overview: https://alphavault-sepolia.onrender.com (open in advance to wake the free service). Connect MetaMask to this HTTPS origin separately. If prices are stale, show the risk warning or have the risk officer refresh both mock reports before live trading.
- Database persistence after stopping and restarting the API.
- Narration identifying mock assets, mock prices, mock venue and synthetic research.

## Transaction inventory extension

For the full 13 distinct method types, also demonstrate configure, strategy enable/disable, asset enable/disable, market report, and grant/revoke of a spare test Keeper. `npm run evidence` executes these on an isolated local chain and produces an auditable inventory. Repeat on the final public deployment if required by the official rubric.
