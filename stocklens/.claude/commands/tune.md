Guide me through tuning the StockLens scoring engine weights and thresholds.

Context:
- All tunable values live in `src/lib/scoring/config.ts`
- Weights must always sum to exactly 1.0 (WEIGHTS object)
- After any change, the backtest must still pass (`npm run test:backtest`)
- Changes to thresholds may require updating expected CF ranges in `src/__tests__/backtest/scenarios.ts`

Steps:
1. Read `src/lib/scoring/config.ts` and display the current state of all weights and thresholds in a formatted table.
2. Read `src/__tests__/backtest/backtest.test.ts` to show current expected CF ranges for all 20 backtest scenarios.
3. Ask: "Which aspect do you want to tune?" with options:
   a. Increase/decrease weight of a specific metric
   b. Adjust a liquidity/volatility/quality threshold
   c. Change penny vs normal regime boundaries
   d. Add a new metric entirely
4. Based on the user's answer ($ARGUMENTS if provided), propose the specific line change in `config.ts`.
5. Show a prediction of how the change would affect CF for each of the 20 backtest scenarios (estimate based on the metric's current contribution).
6. After confirmation, apply the change, run `npm run test:backtest`, and report whether the expected ranges need updating.

Arguments (optional): $ARGUMENTS — describe what you want to tune, e.g. "make volatility weight higher" or "lower the ATR threshold for penny stocks"
