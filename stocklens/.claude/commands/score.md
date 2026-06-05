Explain what the scoring engine would produce for a given ticker or scenario.

This command does NOT make live API calls. It simulates the scoring engine with
hypothetical or example data to explain how it works.

If $ARGUMENTS contains a ticker name (e.g. "AAPL", "GME", "SNDL"):
1. Read `src/__tests__/backtest/scenarios.ts` — check if this ticker has a snapshot.
2. If yes: run the engine against the most recent snapshot and display a full breakdown.
3. If no: construct a representative example for the ticker type (large-cap / penny / etc.)
   using realistic illustrative numbers and note it is NOT live data.

For any scenario, output:
```
Ticker: ___  |  Regime: ___  |  Confidence Factor: ___/100
────────────────────────────────────────────────────
Metric              Score  Weight  Contribution  Flag
Liquidity           ___    22%     ___           [good/warning/danger]
Volatility          ___    20%     ___
Float & Size        ___    15%     ___
Quality / Earnings  ___    20%     ___
Valuation & Trend   ___    13%     ___
Data Completeness   ___    10%     ___
────────────────────────────────────────────────────
Verdict Band: ___
Why:
  1. ___
  2. ___
Watch Conditions:
  › ___
  › ___
```

Then explain in 2–3 sentences why the score is what it is and what would need to change to improve it by 10+ points.

Arguments: $ARGUMENTS — ticker symbol or description of scenario, e.g. "AAPL" or "a profitable mid-cap with thin volume"
