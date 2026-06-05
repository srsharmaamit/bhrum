# CLAUDE.md — StockLens

StockLens is a **live stock-risk intelligence dashboard** built with Next.js 14 (App Router) + TypeScript + Tailwind CSS. It analyzes any US-listed ticker and produces a transparent **Confidence Factor (0–100)** with a plain-English risk verdict. Deployed to Vercel; data from Financial Modeling Prep (FMP) free tier.

---

## Essential Commands

```bash
npm run dev           # start dev server on http://localhost:3000
npm run build         # production build (must pass before any PR)
npm test              # run full test suite (103 tests)
npm run test:unit     # unit tests only (46 tests — fast, no mocks)
npm run test:integration  # API route integration tests (14 tests)
npm run test:backtest # backtest suite — AAPL, GME, AZN, BP (43 tests)
npm run test:coverage # full suite + lcov coverage report
npm run lint          # Next.js ESLint
```

**Required env var (never commit):**
```bash
cp .env.example .env.local
# Set FMP_API_KEY=your_key_here
```

---

## Architecture in One Diagram

```
Browser
  │
  ├─ GET /api/analyze?ticker=AAPL   (Next.js API route — server only)
  │     │
  │     ├─ fmp.ts: fan-out 4 FMP calls in parallel
  │     │   ├─ /quote/{ticker}         price, volume, PE, EPS, 52-week range
  │     │   ├─ /profile/{ticker}       beta, sector, float, exchange
  │     │   ├─ /ratios-ttm/{ticker}    TTM P/E, margins, ROE
  │     │   └─ /historical-price-full  200 daily closes (for MA computation)
  │     │
  │     ├─ cache.ts: 5-min TTL in-memory Map — check before every FMP call
  │     │
  │     ├─ scoring/engine.ts: compute 6 weighted metric scores
  │     ├─ scoring/verdict.ts: generate plain-English band + why + watch
  │     └─ → JSON response: { quote, profile, scoring }
  │
  └─ GET /api/leaderboard             (2 FMP calls, heavily cached)
        ├─ /stock_market/gainers
        └─ /stock_market/actives
```

**FMP rate-limit budget:** ~250 calls/day (free tier). Server cache prevents duplicate calls. Auto-refresh is 5 min. Never add client-side FMP calls — all data flows through API routes.

---

## Key Files & Their Roles

| File | Role | Edit when |
|------|------|-----------|
| `src/lib/scoring/config.ts` | **All weights and thresholds** | Tuning score behaviour |
| `src/lib/scoring/engine.ts` | Computes the 6 sub-scores | Adding/changing a metric |
| `src/lib/scoring/verdict.ts` | Generates verdict band, why, watch | Changing verdict language |
| `src/lib/fmp.ts` | FMP API client (server-side only) | Adding a new FMP endpoint |
| `src/lib/cache.ts` | In-memory TTL cache | Changing cache behaviour |
| `src/app/api/analyze/route.ts` | `/api/analyze` handler | API contract changes |
| `src/app/api/leaderboard/route.ts` | `/api/leaderboard` handler | Leaderboard changes |
| `src/app/page.tsx` | Main client page (state, layout) | UI layout, refresh logic |
| `src/components/ConfidenceGauge.tsx` | Animated SVG radial meter | Gauge visual changes |
| `src/components/MetricBreakdown.tsx` | Per-metric score rows | Score display format |
| `src/components/VerdictPanel.tsx` | Verdict + watch conditions | Verdict UI |
| `src/components/Leaderboard.tsx` | Top movers + toggle + filter | Leaderboard UI |
| `src/types/stock.ts` | All TypeScript interfaces | Adding new data shapes |

---

## Scoring Engine — How It Works

The engine is in `src/lib/scoring/` and runs **entirely server-side**. Never refactor it to run client-side.

### 6 Metric Groups (weights in `config.ts`)

| Metric | Weight | Key inputs |
|--------|--------|----------|
| Liquidity | 22% | `avgVolume × price` (dollar vol), `volume/avgVolume` (rel vol) |
| Volatility | 20% | ATR% `(dayHigh-dayLow)/price`, beta, 52-week position |
| Float & Size | 15% | `marketCap`, `sharesOutstanding` |
| Quality / Earnings | 20% | `eps` sign, `pe` sanity, TTM margins |
| Valuation & Trend | 13% | `priceAvg50`, `priceAvg200`, `changesPercentage` |
| Data Completeness | 10% | Count of null/missing critical fields |

### Regime Detection

`detectRegime(price, marketCap)` in `engine.ts`:
- `price ≤ $5` → **penny** (stricter thresholds on volatility/float/quality)
- `marketCap < $2B` → **small-cap**
- `marketCap < $10B` → **mid-cap**
- `marketCap ≥ $10B` → **large-cap**

**Critical:** Regime is auto-detected from live data — never hardcode it.

### Tuning the Engine

Edit only `config.ts` — do not touch `engine.ts` weights directly. After any config change, run `npm run test:backtest` to validate that the 4-ticker backtest still passes expected CF ranges.

---

## Data Completeness & Null Handling

FMP free tier returns `null` for many fields on OTC/penny stocks. The engine **never crashes on nulls** — missing fields are treated as risk signals and penalise the Data Completeness score. Pattern for null-safety:

```typescript
// Always use nullish coalescing with sensible defaults
const price = quote.price ?? 0;
const beta = profile.beta ?? null;  // keep null, don't default to 0
```

Do not throw or return 500 when FMP data is partial — return the best score possible with available data and reflect completeness in `dataCompleteness` field.

---

## API Contracts

### `GET /api/analyze?ticker=AAPL`

**Response shape** (`AnalyzeResponse` in `types/stock.ts`):
```typescript
{
  quote: Partial<FMPQuote>,
  profile: Partial<FMPProfile>,
  scoring: {
    ticker: string,
    regime: 'penny' | 'small-cap' | 'mid-cap' | 'large-cap',
    confidenceFactor: number,   // 0–100
    metrics: MetricScore[],     // always 6 items
    verdictBand: string,
    verdictWhy: string[],       // 1–3 items
    verdictWatch: string[],     // 0–5 items
    fetchedAt: number,          // epoch ms
    dataCompleteness: number    // 0–100
  }
}
```

**Status codes:** 200 ok, 400 invalid ticker, 404 no FMP data.

### `GET /api/leaderboard`

```typescript
{
  gainers: LeaderboardItem[],   // max 10
  actives: LeaderboardItem[],   // max 10
  fetchedAt: number
}
```

---

## Testing Strategy

Tests are in `src/__tests__/`:

```
unit/scoring/engine.test.ts   ← 32 tests, no mocks, pure function assertions
unit/scoring/verdict.test.ts  ← 11 tests, validates prose is contextual
unit/cache.test.ts            ← 8 tests including TTL expiry
integration/api.test.ts       ← 14 tests, mocks global fetch, tests full route
backtest/backtest.test.ts     ← 43 tests, 4 tickers × 5 market-phase snapshots
backtest/scenarios.ts         ← fixture data (not a test file — ignored by Jest)
```

**Golden rule:** After every scoring engine change, run `npm run test:backtest`. The backtest catches regressions that unit tests miss because it validates the full weighted output across realistic market scenarios.

**Cache isolation:** Integration tests must call `cacheClear()` in `beforeEach`. This was a real bug found during test writing — the in-memory cache persisted across test cases.

---

## UI & Component Conventions

- **No client-side FMP calls.** All data fetched via `/api/*` routes.
- **`'use client'` components:** `page.tsx`, all components in `src/components/`.
- **Skeleton loaders** for every loading state — never show empty divs.
- **Colour scheme:** `#0A1628` bg, `#0F1F3D` card, `#3B82F6` accent. Defined in `tailwind.config.ts`. Don't inline these hex values in components — use Tailwind classes (`bg-navy-900`, `text-accent`, etc.).
- **Auto-refresh:** 5-minute interval, managed with `useEffect` + `clearInterval` cleanup. Never use `setInterval` without cleanup.
- **Last updated timestamp:** Always show. Update on every successful fetch.

---

## Critical Constraints (Never Violate)

1. **FMP_API_KEY must never appear in client-side code, browser network calls, or logs.** It lives only in `process.env.FMP_API_KEY` on the server.
2. **Do not poll FMP more than once per 5 minutes per endpoint.** The cache enforces this — do not bypass it.
3. **Never remove the disclaimer footer.** The app is an educational tool, not financial advice.
4. **Confidence Factor is a risk/quality score, not a buy signal.** Verdict copy must reflect this.
5. **All API responses must handle null FMP fields gracefully.** Never let missing data cause a 500.
6. **The scoring weights in `config.ts` must always sum to 1.0.** Validate this if you add a new metric.

---

## Environment Variables

| Variable | Required | Where used |
|----------|----------|----------|
| `FMP_API_KEY` | Yes (prod) | `src/lib/fmp.ts` — server only |

For local dev, copy `.env.example` → `.env.local`.
For Vercel, set via dashboard → Project Settings → Environment Variables.

---

## Deployment

Target: Vercel. See `docs/DEPLOYMENT.md` for full steps.

Key Vercel settings:
- **Root directory:** `stocklens`
- **Framework:** Next.js (auto-detected)
- **Build command:** `npm run build`
- **Env var:** `FMP_API_KEY`

---

## What NOT to Do

- Do not add `console.log` statements with market data or API responses (could leak keys via log aggregators).
- Do not call `getQuote()`, `getProfile()` etc. from component files — they are server-only.
- Do not change `runtime = 'edge'` on the API routes — the in-memory cache does not work in edge runtime.
- Do not add `export const revalidate = X` to API routes — they must be `force-dynamic`.
- Do not install heavy charting libraries (Chart.js, D3, Recharts) without discussion — the gauge is intentionally hand-rolled SVG for zero bundle cost.
