Guide me through adding a new scoring metric to the StockLens engine.

Adding a metric requires changes in exactly 5 places — this command walks through each.

Steps:

**1. Define the metric**
Ask: What is the metric called? What FMP field(s) does it use? What does a high score mean?

**2. Update types** (`src/types/stock.ts`)
- If the metric needs a new FMP field not already in `FMPQuote` or `FMPProfile`, add it.
- Show the specific line to add.

**3. Update config** (`src/lib/scoring/config.ts`)
- Add a new key to `WEIGHTS` — but WARN: total must remain 1.0.
- Suggest reducing one existing weight by the same amount (show current weights).
- Add a new threshold constant block for the new metric.

**4. Implement the scorer** (`src/lib/scoring/engine.ts`)
- Add a `scoreXxx(quote, profile, regime): MetricScore` function following the exact same pattern as existing scorers.
- Add it to the `metrics` array in `runScoringEngine()`.

**5. Update tests**
- Add at least 2 unit tests in `src/__tests__/unit/scoring/engine.test.ts`:
  one for the "high score" case, one for the "low score" case.
- Update the `COMPLETENESS_FIELDS` array in config.ts if the new metric uses a new FMP field.
- Run `npm test` to confirm all 103+ tests still pass.

**6. Update the backtest expected ranges** (`src/__tests__/backtest/scenarios.ts`)
- Run `npm run test:backtest` — the CF ranges will likely shift.
- Show which scenarios need their expected ranges updated and by how much.

Template for a new scorer function:
```typescript
function scoreXxx(
  quote: Partial<FMPQuote>,
  profile: Partial<FMPProfile>,
  regime: StockRegime
): MetricScore {
  // ... compute score 0-100
  const score = clamp(/* ... */);
  return {
    name: 'Your Metric Name',
    score,
    weight: WEIGHTS.yourMetric,
    contribution: score * WEIGHTS.yourMetric,
    label: score >= 70 ? 'Good' : score >= 45 ? 'Fair' : 'Poor',
    detail: `Computed from ${field}: value.`,
    flag: flag(score),
  };
}
```

Arguments: $ARGUMENTS — describe the metric, e.g. "short interest ratio — high short interest = higher risk" or "dividend yield — mature dividend payers are lower risk"
