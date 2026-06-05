# ADR 003 — Scoring Engine as a Pure Function Pipeline

**Status:** Accepted  
**Date:** 2024-06  
**Deciders:** srsharmaamit

---

## Context

StockLens needs a transparent scoring engine that users can understand ("not a black box"), developers can tune via a config file, and QA can validate through automated tests across realistic market scenarios.

## Decision

Implement the engine as a **pure function pipeline** with all configuration externalised to a single file.

```
config.ts (constants only)
    ↓
engine.ts (pure functions — no side effects, no I/O)
    detectRegime(price, mktCap) → StockRegime
    scoreLiquidity(quote, regime) → MetricScore
    scoreVolatility(quote, profile, regime) → MetricScore
    scoreFloatSize(quote, profile, regime) → MetricScore
    scoreQuality(quote, profile, ratios, regime) → MetricScore
    scoreValuation(quote, history, regime) → MetricScore
    scoreCompleteness(quote, profile) → MetricScore
    runScoringEngine(...) → Omit<ScoringResult, verdicts>
    ↓
verdict.ts (pure functions — no side effects, no I/O)
    buildVerdict(partial, quote, profile, history) → verdict fields
```

All weights and thresholds live in `config.ts`. Changing a threshold never requires reading `engine.ts`.

## Alternatives Considered

| Design | Why rejected |
|--------|-------------|
| ML model | Requires training data, opaque, not tunable by user |
| Class-based `ScoringEngine` | Adds complexity; no stateful behaviour needed |
| Single monolithic `score()` function | Hard to test individual metrics, hard to display per-metric breakdown |
| Weights hardcoded in engine.ts | Makes tuning require understanding the engine logic |

## Consequences

**Positive:**
- Each metric scorer is independently testable with no mocking
- `config.ts` is the single file a non-engineer needs to tune
- Pure functions trivially compose into the backtest harness
- Adding a new metric requires adding one function + one config entry only
- The 6-metric breakdown is a direct output of the pipeline — no extra work to expose it in the UI

**Negative:**
- Regime-aware logic creates branching (penny vs normal thresholds) in each scorer
- The pipeline is synchronous — any async metric (e.g., calling a second API) would require refactoring

**Constraint this creates:**
- `engine.ts` functions must never import from React, `next`, or any I/O module
- `engine.ts` and `verdict.ts` are tested with 0 mocks — any I/O dependency would break this
- New metrics must follow the `(quote, profile, regime) → MetricScore` signature

## Regime-Awareness Rationale

A penny stock ($0.50 price, no earnings) operating at 15% ATR is normal and expected. The same ATR for AAPL would be alarming. Without regime detection, the engine would either over-penalise penny stocks for normal behaviour or under-penalise large-caps for alarming behaviour.

The regime is auto-detected (never manually set) because FMP provides price and market cap in every quote response.
