# Presentation skeleton

Draft structure for approximately 7 minutes; adjust after confirming the course's required duration. This file is an outline, not an exported slide deck.

| Slide | Time | Main message | Evidence / visual |
|---|---:|---|---|
| 1. AlphaVault | 20s | Quantitative portfolio management with explicit risk authority | Title and dashboard |
| 2. Problem and scope | 35s | Treasury allocation should be inspectable and constrained | Investor/manager/officer/Keeper workflow |
| 3. Architecture | 45s | Three core contracts are separate and interact in execution | README diagram |
| 4. Custody and shares | 40s | Deposits mint NAV-priced shares; exits return the basket | Accounting formula + deposit/redeem |
| 5. Strategy choices | 45s | Equal Weight, Momentum and Volatility Target | Target-weight comparison |
| 6. Risk and execution | 45s | Reject invalid allocation before swaps; check loss afterward | Bounds, freshness, deadline, cooldown |
| 7. Live demo | 120s | Real local/testnet receipts change actual token holdings | Follow DEMO_SCRIPT.md |
| 8. Tests and evaluation | 40s | Demonstrated behavior is reproducible | Current test count, gas, synthetic metrics |
| 9. Limitations | 25s | Simulation infrastructure and trust assumptions are explicit | Mock oracle/venue, Keeper dependency |
| 10. Deliverables and next step | 20s | Source, API, DB, evidence and deployment status | Final links once actually deployed |

Speaker cues:

- “Automatic” means a running off-chain Keeper submits a transaction when conditions hold.
- The risk contract checks the proposed target, not an unchanging guarantee against later price drift.
- Local demo role selection chooses known test accounts; hosted users sign with separate wallets.
- State “synthetic method test” before discussing any research return or Sharpe result.
- Explain why redemption remains available under pause and stale prices.
- Show a failed policy check as intended behavior, not as a failed demonstration.
- Do not substitute the earlier escrow deployment or its screenshots for AlphaVault.

Export a final PPTX/PDF and capture screenshots only after the content, deployment and official format are settled. Keep raw screenshots and receipts tied to the same demonstration session.
