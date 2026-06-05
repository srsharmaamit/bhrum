Explain any part of the StockLens codebase clearly and accurately.

This is your go-to command when you want to understand HOW something works before changing it.

If $ARGUMENTS is provided, focus the explanation on that specific topic.
If $ARGUMENTS is empty, ask: "What would you like me to explain?"

Topics I can explain deeply:

**Scoring engine flow:**
Read `src/lib/scoring/engine.ts` and `src/lib/scoring/config.ts` and explain
step-by-step how a ticker's Confidence Factor is computed from raw FMP data.
Include a concrete worked example with real numbers.

**Regime detection:**
Explain how `detectRegime()` works, what thresholds it uses, and why penny-stock
regime has stricter thresholds than large-cap.

**Cache and rate limiting:**
Explain `src/lib/cache.ts`, how it fits into `src/lib/fmp.ts`, and how it protects
FMP's 250-call/day free-tier limit.

**Verdict generation:**
Explain how `verdict.ts` turns a `ScoringResult` into the three-part verdict
(band + why + watch conditions), with examples of each.

**API route request lifecycle:**
Trace a full request from browser `fetch('/api/analyze?ticker=GME')` through
the cache, FMP calls, scoring engine, and back to the browser.

**Test architecture:**
Explain the three test suites, why integration tests need `cacheClear()` in
`beforeEach`, and how the backtest scenarios simulate real market phases.

**UI data flow:**
Explain how `page.tsx` fetches, stores, refreshes, and passes data to components,
and why the 5-minute auto-refresh interval is set up the way it is.

Arguments: $ARGUMENTS — topic to explain, e.g. "cache", "scoring", "verdict", "regime", "request lifecycle"
