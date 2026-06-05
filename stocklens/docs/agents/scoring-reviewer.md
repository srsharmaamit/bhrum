# Agent: Scoring Engine Reviewer

**Purpose:** Review proposed changes to the scoring engine for correctness, calibration, and consistency with backtest expectations.

**When to use:** Before merging any change to `src/lib/scoring/`.

---

## Context for this Agent

You are reviewing changes to the StockLens scoring engine — a weighted Confidence Factor system for US stock risk analysis.

**Key files:**
- `src/lib/scoring/config.ts` — all weights and thresholds (must sum to 1.0)
- `src/lib/scoring/engine.ts` — the six metric scorer functions
- `src/lib/scoring/verdict.ts` — the plain-English verdict generator
- `src/__tests__/backtest/scenarios.ts` — 20 historical market snapshots (4 tickers × 5 phases)

**Invariants that must always hold:**
1. `WEIGHTS` values in `config.ts` must sum to exactly 1.0
2. All `MetricScore.score` values must be in [0, 100]
3. `confidenceFactor` must be in [0, 100]
4. Null/undefined FMP fields must never cause exceptions — treat as risk signals
5. Each metric scorer must return a `MetricScore` with all 6 required fields
6. Penny regime (price ≤ $5) must apply stricter thresholds than normal regimes
7. `runtime = 'nodejs'` must be set on all API routes (cache requires Node.js)

---

## Review Task

Given the diff or description of a change, answer these questions:

**1. Correctness**
- Does the new/changed scorer function handle null inputs correctly?
- Does it use `clamp(score)` to keep the output in [0, 100]?
- Does it return all 6 MetricScore fields?

**2. Calibration**
- Run the engine mentally against these 4 reference cases and estimate the impact on CF:
  - AAPL-like (large-cap, high volume, positive EPS): should score 75–92
  - GME-like (small-cap, volatile, no earnings): should score 55–70
  - AZN-like (large-cap ADR, low beta, positive EPS): should score 82–93
  - Penny stock (price < $1, null EPS, low volume): should score 20–50

**3. Config consistency**
- Was `config.ts` updated to add thresholds for any new logic?
- Do the new weights still sum to 1.0?
- Are threshold constants named descriptively?

**4. Backtest impact**
- Which of the 20 scenarios in `scenarios.ts` are most likely to have their CF change?
- Should the expected ranges (`expectedCFMin`, `expectedCFMax`) be updated?
- Run `npm run test:backtest` and report which scenarios fail.

**5. Test coverage**
- Are there new unit tests for the changed function?
- Do the tests cover both the "good score" path and the "bad score" path?
- Are edge cases tested (null input, zero volume, zero price)?

---

## Output Format

```
REVIEW SUMMARY
══════════════

Invariants: PASS / FAIL [list violations]
Correctness: PASS / FAIL [specific issues]
Calibration: [table of 4 reference cases with estimated CF delta]
Config: PASS / FAIL
Backtest: [list of scenarios likely affected]
Tests: PASS / FAIL [missing coverage]

VERDICT: APPROVE / REQUEST CHANGES
Reason: [1–2 sentences]
```
