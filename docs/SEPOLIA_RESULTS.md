# Sepolia business demonstration results

Verified on 2026-10-17 using three separate MetaMask accounts. The RPC exporter revalidated all 12 successful receipts against the canonical chain at 2026-10-17T15:26:00.894Z, covering **10 distinct business methods** with zero exclusions. Confirmation counts are recorded per receipt and are not a finality guarantee.

## Roles

- Investor / Keeper / Admin: `0x0258E85f725F2d17f87f0f25984A7FD503448169`
- Manager: `0xF72d3B36594dA7b06E3994112C8B1516e57cB3aA`
- Risk officer: `0xF540005bC24b6E39A6abD22923BC9a7550C94252`

## Measured workflow

1. Investor approved and deposited 1,000 mUSD, receiving 1,000 displayed shares.
2. Manager selected Momentum, configured a 120-second cooldown and enabled automation. Cash buffer stayed 20% and volatility target 12% (the latter applies to Volatility Target).
3. Risk officer refreshed both mock markets and set a 65% single risky-asset cap, 15% minimum cash, 35% weighted-volatility cap, 1% execution-loss cap and 3,600-second maximum price age.
4. Keeper executed the first rebalance toward 20/60/20 cash/mETH/mBTC. Vault received 0.1996 mETH and 0.003326666666666666 mBTC, retaining 200 mUSD. NAV became approximately 998.40 mUSD. The 1.60 mUSD reduction is mock exchange fees plus negligible integer rounding; network gas is separately paid in Sepolia ETH (0.000844894192907440 for this rebalance).
5. Risk officer paused the vault. While paused, the investor redeemed 250 shares and received 50 mUSD, 0.049899999999999999 mETH and 0.000831666666666666 mBTC. This demonstrated a successful in-kind exit while deposits/trading were blocked by policy. No failed on-chain deposit was sent in this public run; rejection paths were tested locally.
6. Risk officer resumed the vault. Final read at block 11934984 confirmed `paused=false`, automation enabled, Momentum, cooldown 120, valid price reports and the configured limits. Investor retains 750 shares and vault NAV is approximately 748.80 mUSD; share-value index remains 99.84.

The public rebalance was signed manually by the Keeper account. An unattended Keeper worker was exercised locally, not demonstrated running continuously on Sepolia. Inputs are controlled mock prices/signals and tokens, not live-market performance.

## Public receipts

| Method | Block | Transaction |
|---|---:|---|
| `MockERC20.approve` | 11934770 | [0x4e516869…94c724](https://sepolia.etherscan.io/tx/0x4e51686988b15d5df43b67da1ea45ed744e9780e1e84d013c617d86e8094c724) |
| `PortfolioVault.deposit` | 11934777 | [0xc3ff0f67…055d08](https://sepolia.etherscan.io/tx/0xc3ff0f671034674c4184d751b4b25c407d36548f26f6460aa7f1e01da8055d08) |
| `StrategyEngine.selectStrategy` | 11934857 | [0x273564f0…24d2c5](https://sepolia.etherscan.io/tx/0x273564f0f93610c101fa3cae0e603a662379c5504ad4a775fbdb0733d124d2c5) |
| `StrategyEngine.configure` | 11934863 | [0x1c8ab370…9fc44d](https://sepolia.etherscan.io/tx/0x1c8ab3704bba1195ee4b0046cb882c9c6aed15086e097a3d2fd8e10cf39fc44d) |
| `PortfolioVault.setAutomation` | 11934875 | [0x7b993604…cb4191](https://sepolia.etherscan.io/tx/0x7b9936045218e7cbf9e6883a5b50f0653b24ec1601a7b28bc296e34717cb4191) |
| `RiskManager.updateMarket` | 11934907 | [0x6b8577f8…5d6b8d](https://sepolia.etherscan.io/tx/0x6b8577f83135a3b5ce0ca85698b2cbbf1eaec855ac484538382e5c97a35d6b8d) |
| `RiskManager.updateMarket` | 11934920 | [0x99caada9…0359de](https://sepolia.etherscan.io/tx/0x99caada99791dd848cc5863a18e658b4677db979cf417ea016229b9f650359de) |
| `RiskManager.setLimits` | 11934929 | [0xfeb54100…a65773](https://sepolia.etherscan.io/tx/0xfeb54100d3a13c341bcae352eb054c48a0e2b958bb301d8821c942789da65773) |
| `PortfolioVault.rebalance` | 11934945 | [0x9cf7a414…4da9b6](https://sepolia.etherscan.io/tx/0x9cf7a414a7583650ede3eb9e14db51789d4ffa932ec85912509cb574b64da9b6) |
| `RiskManager.setPaused` | 11934962 | [0x3d3c75ee…db1e2b](https://sepolia.etherscan.io/tx/0x3d3c75ee05ccf9faa701354a14c53d0cefdd72f3781717eb09cf16702ddb1e2b) |
| `PortfolioVault.redeem` | 11934972 | [0x343f7f33…5daa0d](https://sepolia.etherscan.io/tx/0x343f7f332495175893071f5fce0e490950fd17ac66b7a23dc75d20f9e45daa0d) |
| `RiskManager.setPaused` | 11934980 | [0x3b893b77…d44215](https://sepolia.etherscan.io/tx/0x3b893b77f8f6c94a0f449c6b646ea435e35f6edacccea43feb32b4642ed44215) |

The ten types include ERC20 approval and nine distinct core-contract methods. Repeated market reports and pause/resume do not increase the type count. Deployments, minting and failed transactions are excluded. If the official rubric requires ten core-contract methods, additionally demonstrate `StrategyEngine.setEnabled` or another missing core method.

## Evidence files

- `../evidence/sepolia-business-evidence.json`: authoritative RPC-revalidated export with coverage, gas, fees and confirmations.
- `../evidence/sepolia-final-portfolio.json`: final read-only API snapshot after resuming.
- `../evidence/sepolia-rebalance-check.json`: persisted events, token amounts and cost calculation.
- `../evidence/sepolia-paused-redemption-check.json`: pause event preceding successful redemption, amounts and remaining shares.
- `../evidence/sepolia-persisted-receipts.json`: cached SQLite receipt export; the revalidated export above is preferred.

Public HTTPS frontend/API hosting, hosted database restart acceptance, explorer source verification and final report/slides/video remain outstanding. Local URL `http://127.0.0.1:3102` is not public hosting. Prices expire one hour after reporting; refresh them before another trading demonstration.
