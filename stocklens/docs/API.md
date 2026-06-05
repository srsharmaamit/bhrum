# API Reference

All endpoints are Next.js Route Handlers under `src/app/api/`. They run server-side only (Node.js runtime). No auth required — the app is public.

---

## GET /api/analyze

Fetches live data for a ticker, runs it through the scoring engine, and returns a full analysis.

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `ticker` | string | Yes | Stock ticker symbol. Regex: `/^[A-Z0-9.^-]{1,10}$/`. Case-insensitive (auto-uppercased). |

### Response — 200 OK

```typescript
{
  quote: Partial<FMPQuote>,       // raw quote data (may have null fields)
  profile: Partial<FMPProfile>,   // company profile (may have null fields)
  scoring: {
    ticker: string,               // uppercased ticker
    regime: 'penny' | 'small-cap' | 'mid-cap' | 'large-cap',
    confidenceFactor: number,     // 0–100 integer
    metrics: [                    // always exactly 6 items
      {
        name: string,             // e.g. "Liquidity"
        score: number,            // 0–100
        weight: number,           // 0–1 (all weights sum to 1.0)
        contribution: number,     // score × weight
        label: string,            // e.g. "Good" | "Fair" | "Thin" | "Very Thin"
        detail: string,           // one-line explanation
        flag: 'good' | 'neutral' | 'warning' | 'danger'
      }
    ],
    verdictBand: string,          // e.g. "Relatively Stable"
    verdictWhy: string[],         // 1–3 driver sentences
    verdictWatch: string[],       // 0–5 watch condition sentences
    fetchedAt: number,            // epoch ms
    dataCompleteness: number      // 0–100 (% of key fields present)
  }
}
```

### Error Responses

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "Invalid ticker symbol." }` | Ticker fails regex |
| 404 | `{ "error": "No data found for ticker \"XYZ\"..." }` | FMP returns empty arrays for both quote AND profile |
| 200 | `{ ..., scoring: { confidenceFactor: low } }` | Partial data — never 500 on nulls |

### FMP Calls Made (in parallel)

```
GET /api/v3/quote/{ticker}
GET /api/v3/profile/{ticker}
GET /api/v3/ratios-ttm/{ticker}
GET /api/v3/historical-price-full/{ticker}?serietype=line&timeseries=200
```

All four are cached with 5-minute TTL. A cold request uses 4 FMP quota calls; a warm request uses 0.

### Example

```bash
curl "https://your-app.vercel.app/api/analyze?ticker=AAPL"
```

---

## GET /api/leaderboard

Returns top gainers and most-active stocks for the leaderboard.

### Response — 200 OK

```typescript
{
  gainers: LeaderboardItem[],   // up to 10 items
  actives: LeaderboardItem[],   // up to 10 items
  fetchedAt: number             // epoch ms
}

// LeaderboardItem:
{
  symbol: string,
  name: string,
  price: number,
  change: number,
  changesPercentage: number,
  volume: number | null,
  miniConfidence: number | null,   // 10–85, heuristic proxy (not full scoring)
  regime: 'penny' | 'small-cap' | 'mid-cap' | 'large-cap' | null
}
```

**Note on `miniConfidence`:** This is a lightweight heuristic (price bracket + volume check), NOT the full 6-metric scoring engine. Running the full engine for 10+ tickers on every leaderboard request would exhaust the FMP quota. Use `/api/analyze` for a full score on any specific ticker.

### Error Handling

Returns `{ gainers: [], actives: [], fetchedAt: number }` on FMP failure. Never 500s.

### FMP Calls Made (in parallel)

```
GET /api/v3/stock_market/gainers
GET /api/v3/stock_market/actives
```

Both cached for 5 minutes. Total: 2 calls per refresh cycle.

---

## Cache Behaviour

Both endpoints share the same in-memory cache (`src/lib/cache.ts`). Cache key format:

```
"/quote/AAPL|"          ← path + "|" + params string
"/stock_market/gainers|"
```

TTL = 300,000 ms (5 minutes). The cache is module-level — it persists across requests within the same serverless instance but resets on cold starts.

---

## Adding a New Endpoint

1. Create `src/app/api/your-route/route.ts`
2. Always export `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`
3. Use `fmp.ts` wrapper functions — never call FMP URLs directly in route files
4. Return JSON with consistent error shape: `{ error: string }` for failures
5. Update this file with the new endpoint documentation
