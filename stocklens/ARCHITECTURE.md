# StockLens Architecture

## System Overview

StockLens is a server-rendered Next.js 14 application. All external data fetching happens server-side via API routes. The browser never speaks directly to FMP.

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Client)                                                  │
│                                                                  │
│  page.tsx (React client component)                               │
│    │  fetch('/api/analyze?ticker=X')   every 5 min + on demand  │
│    │  fetch('/api/leaderboard')        every 5 min on mount      │
│    └──────────────────┐                                         │
└───────────────────────────┤                                         ┘
                        │ HTTP (internal, same origin)
┌───────────────────────▼──────────────────────────────────┐
│  Next.js Server (Vercel Serverless / Node.js runtime)            │
│                                                                  │
│  /api/analyze                    /api/leaderboard               │
│    │                               │                            │
│    ├── cache.ts (TTL Map)          ├── cache.ts (TTL Map)       │
│    │                               │                            │
│    ├── fmp.ts ────────────────── fmp.ts                       │
│    │    ├─ getQuote()              ├─ getGainers()              │
│    │    ├─ getProfile()            └─ getActives()              │
│    │    ├─ getRatiosTTM()                                       │
│    │    └─ getHistoricalPrices()                                │
│    │                                                            │
│    ├── scoring/engine.ts                                        │
│    └── scoring/verdict.ts                                       │
└────────────────────────────────────────────────────────────────┘
                        │ HTTPS (outbound — blocked in browser)
┌───────────────────────▼──────────────────────────────────┐
│  Financial Modeling Prep API  (financialmodelingprep.com)        │
│  Free tier: ~250 calls/day                                       │
│  Auth: ?apikey=FMP_API_KEY (server env var only)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
stocklens/
├── src/
│   ├── app/                        ← Next.js App Router
│   │   ├── layout.tsx              ← Root HTML, metadata, global CSS
│   │   ├── page.tsx                ← Main SPA page (client component)
│   │   ├── globals.css             ← Tailwind base + custom animations
│   │   └── api/
│   │       ├── analyze/route.ts    ← GET /api/analyze?ticker=X
│   │       └── leaderboard/route.ts← GET /api/leaderboard
│   │
│   ├── components/                 ← Reusable React components (all 'use client')
│   │   ├── ConfidenceGauge.tsx     ← Animated SVG arc meter
│   │   ├── MetricBreakdown.tsx     ← 6-row metric table
│   │   ├── VerdictPanel.tsx        ← Band + Why + Watch UI
│   │   ├── Leaderboard.tsx         ← Top movers table
│   │   ├── SearchBar.tsx           ← Ticker input + suggestions
│   │   └── Skeleton.tsx            ← Loading state components
│   │
│   ├── lib/                        ← Pure business logic (server-safe, no React)
│   │   ├── fmp.ts                  ← FMP API client
│   │   ├── cache.ts                ← In-memory TTL cache
│   │   └── scoring/
│   │       ├── config.ts           ← All weights & thresholds
│   │       ├── engine.ts           ← Scoring computation
│   │       └── verdict.ts          ← Verdict text generation
│   │
│   └── types/
│       └── stock.ts                ← All TypeScript interfaces
│
├── src/__tests__/
│   ├── unit/scoring/               ← Pure function unit tests
│   ├── integration/                ← API route tests (mocked fetch)
│   └── backtest/                   ← 4-ticker historical scenario tests
│
├── .claude/
│   ├── settings.json               ← Claude Code permissions + hooks
│   └── commands/                   ← Custom slash commands
│       ├── test.md
│       ├── backtest.md
│       ├── tune.md
│       ├── score.md
│       ├── deploy.md
│       ├── add-metric.md
│       └── explain.md
│
└── docs/
    ├── SCORING_ENGINE.md
    ├── API.md
    ├── TESTING.md
    ├── DEPLOYMENT.md
    └── ADR/
        ├── 001-fmp-as-data-source.md
        ├── 002-server-side-cache.md
        └── 003-scoring-engine-design.md
```

---

## Data Flow — Ticker Analysis

```
User types "AAPL" → clicks Analyze
  │
  ▼
page.tsx: setLoading(true), fetch('/api/analyze?ticker=AAPL')
  │
  ▼
route.ts (analyze):
  1. Validate ticker format (regex: /^[A-Z0-9.^-]{1,10}$/)
  2. Fan-out 4 parallel FMP calls via Promise.all([...])
     Each call: check cache → if hit return cached; if miss call FMP + cache result
  3. If quote AND profile both null → 404
  4. runScoringEngine(ticker, quote, profile, ratios, history)
     → detectRegime(price, marketCap) → 'penny'|'small-cap'|'mid-cap'|'large-cap'
     → scoreLiquidity()
     → scoreVolatility()
     → scoreFloatSize()
     → scoreQuality()
     → scoreValuation()
     → scoreCompleteness()
     → confidenceFactor = round(sum of metric.score × metric.weight)
  5. buildVerdict(partialResult, quote, profile, history)
     → getVerdictBand(score, regime)
     → getTopDrivers(metrics)         // worst-contributing metrics first
     → getWatchConditions(...)         // computed from live numbers
  6. Return { quote, profile, scoring }
  │
  ▼
page.tsx:
  setAnalysis(data), setLastUpdated(Date.now()), setLoading(false)
  → renders ConfidenceGauge, MetricBreakdown, VerdictPanel
```

---

## Scoring Engine Architecture

The engine is a **pure function pipeline** with no side effects:

```
Input:  ticker + Partial<FMPQuote> + Partial<FMPProfile> + Partial<FMPRatiosTTM> + FMPHistoricalPrice[]
Output: ScoringResult (deterministic — same inputs always give same output)

detectRegime()
    ↓
scoreLiquidity()    → MetricScore { score, weight, contribution, flag, detail }
scoreVolatility()   → MetricScore
scoreFloatSize()    → MetricScore
scoreQuality()      → MetricScore
scoreValuation()    → MetricScore
scoreCompleteness() → MetricScore
    ↓
confidenceFactor = clamp(round(Σ contribution))
    ↓
buildVerdict()
    ↓
ScoringResult
```

All six scorers follow the same contract:
```typescript
function scoreXxx(
  quote: Partial<FMPQuote>,
  profile: Partial<FMPProfile>,
  regime: StockRegime
): MetricScore
```

---

## Caching Architecture

The cache is a **module-level `Map<string, CacheEntry>`** in `cache.ts`. It persists for the lifetime of a serverless function instance.

```
Cache key = endpoint path + "│" + URLSearchParams string
TTL = 5 minutes (300,000 ms)

On every FMP call:
  cacheGet(key) → hit? return immediately (no FMP call)
               → miss? call FMP, store result, return
```

**Vercel edge case:** Each serverless invocation gets a fresh Node.js instance — cache is cold on the first request to a new instance. Cache warms quickly because all FMP responses for the same ticker are cached together.

**Test isolation:** The same cache module is used in tests. Tests must call `cacheClear()` in `beforeEach` to prevent cross-test contamination. This was a real bug discovered during test writing.

---

## Component Rendering Model

```
page.tsx (client component — manages all state)
  ├── SearchBar (controlled — calls onSearch callback)
  ├── [loading]  → Skeleton components
  ├── [analysis] → ConfidenceGauge     (score prop → internal animation)
  │              → MetricBreakdown     (metrics[] prop)
  │              → VerdictPanel        (scoring prop)
  │              → Company description (profile.description)
  └── Leaderboard                      (data + loading + onSelectTicker)
```

All state lives in `page.tsx`. Components are **presentational only** — no fetching, no state. This makes them trivially testable and easy to render in isolation.

---

## Key Design Decisions

See `docs/ADR/` for full records. Summary:

| Decision | Choice | Alternative considered |
|----------|--------|----------------------|
| Data source | FMP free tier | Alpha Vantage, Polygon.io |
| Cache layer | In-memory Map | Redis / Vercel KV |
| Scoring architecture | Pure function pipeline | Class-based with OOP |
| MA computation | From historical endpoint | From priceAvg50/200 fields |
| Gauge implementation | Hand-rolled SVG | Recharts / Victory |
| Runtime | Node.js (not Edge) | Vercel Edge runtime |
