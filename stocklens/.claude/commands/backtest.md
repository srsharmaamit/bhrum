Run the StockLens backtest suite and display a formatted results table.

The backtest runs the scoring engine over 5 historical market-phase snapshots
for 4 tickers (AAPL, GME, AZN, BP) — no network calls, all synthetic data.

Steps:
1. Run `cd /home/user/bhrum/stocklens && npm run test:backtest -- --verbose 2>&1`
2. Extract the console.log output (the phase tables) from the test run.
3. Format and display a clean summary table:

```
Ticker | Phase | Label                  | CF  | Regime    | Band                | Top Watch Condition
-------|-------|------------------------|-----|-----------|---------------------|--------------------
AAPL   |   1   | Accumulation Jan 2023  | 84  | large-cap | Relatively Stable   | Below 200-day MA
...
```

4. Highlight any phases where:
   - CF is below 50 (elevated risk)
   - verdictWatch contains ATR > 10%
   - regime changed between phases (e.g. GME switching large-cap during squeeze)

5. If $ARGUMENTS contains a specific ticker (e.g. "GME"), filter the table to that ticker only.
6. End with a one-paragraph interpretation of what the backtest tells us about the scoring engine's behaviour.

Arguments (optional): $ARGUMENTS — ticker to filter (AAPL | GME | AZN | BP) or empty for all.
