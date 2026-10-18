# AlphaVault ten-minute demonstration script

Author: Du Zhuotong. English narration and subtitles. The first video page has no date.

| Time | Slide / segment |
|---|---|
| 00:00–00:20 | 1. AlphaVault |
| 00:20–01:05 | 2. Problem and stakeholders |
| 01:05–01:45 | 3. System architecture |
| 01:45–02:20 | 4. Contract interaction |
| 02:20–02:55 | 5. Persistent data model |
| 02:55–03:25 | 6. Process flow |
| 03:25–03:50 | 7. Dashboard guide |
| 03:50–07:13 | 8. Recorded application workflow |
| 07:13–07:58 | 9. Measured impact |
| 07:58–08:48 | 10. Tests and persistent hosting |
| 08:48–09:33 | 11. Limits and contribution record |
| 09:33–10:00 | 12. Submission and conclusion |

## Recorded workflow

The actual application capture runs at its original speed from 03:50 to 07:13. Local-chain actions occupy 03:50–06:18; public historical-state review occupies 06:18–07:13. Mock assets and network labels remain visible. No new public transaction is sent.

## 00:00 — AlphaVault

Welcome to AlphaVault, a quantitative portfolio management and risk controlled rebalancing application by Du Zhuotong. This ten minute demonstration explains the problem, system design, actual application workflow, and measured results. The project uses mock assets on a local chain and the Sepolia test network.

## 00:20 — Problem and stakeholders

Consider a small token treasury that delegates allocation decisions to a manager. Contributors want to see where assets are held, understand who can change the rules, and retain an exit when trading is paused. A spreadsheet can describe an allocation, but it cannot enforce that allocation during a transfer. AlphaVault separates the investor, strategy manager, risk officer, and Keeper. Their incentives can conflict: the manager may seek exposure while the risk officer limits it. The design makes those permissions inspectable. This is a prototype scenario, not a completed user study. Reduced operating effort remains a future research question rather than a measured benefit.

## 01:05 — System architecture

The dashboard reads portfolio data through a same origin Python Flask REST API. For public transactions, the API prepares unsigned calldata and MetaMask signs with the user's account. The hosted server does not hold a signing key. PortfolioVault holds tokens, StrategyEngine calculates target weights, and RiskManager enforces policy. MockExchange performs test token swaps. An off chain Keeper can submit an eligible rebalance, but all contract checks still apply. The backend indexes blockchain events into PostgreSQL in the public deployment, or SQLite locally. The database provides observations and evidence; the chain remains authoritative for custody.

## 01:45 — Contract interaction

A rebalance starts with an authorized Keeper request. The vault checks roles, pause state, fresh prices, timing and bounds. It then asks StrategyEngine for validated weights. The strategy calls RiskManager before returning those weights. The vault sells risky holdings to mock cash, buys the target assets, and checks the final loss in net asset value. These operations share one atomic transaction. If a bound fails, the swaps and timestamp roll back together. A failed gas estimate is not a successful on chain transaction and is not included in the evidence count.

## 02:20 — Persistent data model

Eight tables support the application. Events are identified by deployment scope, transaction hash and log index. Snapshots store observed portfolio values, while prices and strategies retain per block observations. Cursors store index progress and block hashes so the service can detect a chain rollback. Receipts hold verified evidence, and jobs track execution outcomes. Backtests are keyed by strategy and identify their synthetic source. Deployment scope combines chain ID and vault address. These are logical relationships, not SQL foreign key constraints. Large on chain amounts are stored as strings to avoid numeric precision loss.

## 02:55 — Process flow

The user chooses an action, the API prepares calldata, and the wallet asks for confirmation. Smart contracts then enforce the account's authority and the relevant state checks. After success, the service indexes events and refreshes the dashboard. Approval and deposit are separate transactions. Selecting a strategy does not execute a trade. Rebalancing needs a separate Keeper request. A pause blocks deposits and trading, but investors can still redeem their proportional asset basket. That exit does not depend on fresh market prices.

## 03:25 — Dashboard guide

Overview shows portfolio value and investor actions. Strategies separates allocation choice from execution. Risk controls contains policy and emergency pause. Activity ledger links actions to evidence. The local role selector chooses test accounts. In public mode, the connected wallet determines authority. We now move to the recorded workflow.

## 03:50 — Recorded application workflow

We begin on an independent local chain, with chain ID 31337.

The vault starts with 10,000 mUSD.

These are simulated assets.

The investor first approves the token allowance, then deposits 1,000 mUSD.

These demo controls sign transactions using public local test accounts.

After confirmation, the investor's shares increase from 10,000 to 11,000.

These local balances are separate from the historical Sepolia balances shown later.

Next, the strategy manager selects Momentum.

The target allocation is 20% cash, 60% mETH, and 20% mBTC.

Strategy selection is recorded on chain.

The Keeper now executes the rebalance.

The contracts check permission, price freshness, position limits, and execution loss.

Successful execution transfers the mock tokens and records the resulting allocation on chain.

After the local rebalance, net asset value is 10,982.40 mUSD.

The share value index is 99.84.

The reduction reflects simulated trading fees.

The risk officer reviews the limits and pauses the vault.

The pause blocks deposits and rebalancing, while preserving the investor's exit path.

These restrictions are enforced by the smart contracts, independently of the dashboard.

While the vault is paused, the investor redeems 25% of the shares.

Eight thousand two hundred fifty shares remain.

Redemption returns a proportional basket of the underlying tokens.

The activity ledger records the rebalance, pause, and redemption, with block numbers and transaction hashes.

The API indexes these events, and the database retains the observations.

The research view uses synthetic prices.

Momentum returns negative 22.59% after simulated fees.

This does not establish real investment performance.

We now switch to the publicly hosted application on Sepolia.

This section shows existing blockchain state and historical evidence.

No new public transaction is sent during this recording.

The environment label changes at the top.

Public net asset value is approximately 748.80 mUSD.

The share value index is 99.84.

The stale prices warning means the manual reports need updating before trading.

Exporting evidence shows ten successful method types out of thirteen supported methods.

This includes the ERC20 approval, leaving nine core contract methods.

If approval is excluded by the rubric, one additional core method needs demonstration.

## 07:13 — Measured impact

The strategy experiment compares rules on the same deterministic price fixture and fee assumptions. Volatility Target has a maximum drawdown of five point eight two percent, compared with nine point zero four percent for Equal Weight. That is about three point two two percentage points lower. Annualized volatility is also lower, but both returns remain negative. These results do not establish real market profitability. Functional evidence is separate: six selected unauthorized privileged calls were rejected in the tests, and a public redemption succeeded while trading was paused. The public rebalance cost one point six zero mock dollars in exchange fees, with network gas paid separately.

## 07:58 — Tests and persistent hosting

The Python Flask suite passes thirty six tests, and the contract and legacy regression suite passes sixty four tests. Both runs have zero failures. Tests cover contract permissions, accounting, rollback, price freshness, pause behavior, API preparation and persistence. A new public acceptance check also passes: the Flask service is in wallet mode, uses PostgreSQL, points to the expected Sepolia vault, and exposes ten verified transaction types. The earlier restart experiment provides a stronger storage check than event replay alone. A non chain jobs record remained identical after the Render service restarted. Because that record is not reconstructed from blockchain events, its retention demonstrates persistence across that observed restart. This is a specific acceptance result, not an uptime guarantee. The free service can still sleep.

## 08:48 — Limits and contribution record

The project delivers contracts, a REST service, persistent storage, a wallet capable dashboard, tests, deployment evidence and submission materials. The individual contribution report maps those responsibilities to artifacts and meaningful Git checkpoints. Several engineering boundaries remain. Prices are manually reported, assets and the exchange are simulated, and the administrator can reassign roles. There is no external security audit or field usability study. Unattended Keeper execution was tested locally; the public rebalance was manually signed. Explorer source verification is separate from deployment receipt checks. These limits guide the next development priorities and the interpretation of the evidence.

## 09:33 — Submission and conclusion

The submission contains a fourteen page technical report with five diagrams, a user manual, an individual contribution report, slides, source code and this ten minute demonstration. The report connects the problem and stakeholder needs to measured prototype results. The repository and public deployment links are shown here. AlphaVault demonstrates constrained, traceable portfolio operations with an explicit investor exit path. Thank you for watching.

## Live demonstration alternative

Follow the same ten-minute structure and replace the recorded segment with the manual’s approve/deposit, manager selection, Keeper rebalance, risk pause and investor redemption workflow. Rehearse with an independent local data directory. Public wallet confirmations, price freshness and block times may exceed this slot; retain the recording as the exact-duration submission. Use USER_MANUAL.md for all role and confirmation details.
