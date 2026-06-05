# ADR 001 — Financial Modeling Prep as the Data Source

**Status:** Accepted  
**Date:** 2024-06  
**Deciders:** srsharmaamit

---

## Context

StockLens needs real-time and fundamental stock data for any US-listed ticker including penny stocks and OTC names. It must work on Vercel's free tier with a budget of zero.

## Decision

Use **Financial Modeling Prep (FMP) free tier** as the sole data source.

Endpoints used:
- `/api/v3/quote/{ticker}` — price, volume, EPS, P/E, 52-week range
- `/api/v3/profile/{ticker}` — beta, sector, market cap, float
- `/api/v3/ratios-ttm/{ticker}` — TTM margins, ROE, debt ratios
- `/api/v3/historical-price-full/{ticker}?serietype=line&timeseries=200` — 200-day price history
- `/api/v3/stock_market/gainers` — leaderboard
- `/api/v3/stock_market/actives` — leaderboard

## Alternatives Considered

| Provider | Why rejected |
|----------|-------------|
| Alpha Vantage | 25 calls/day on free tier — far too low |
| Polygon.io | Free tier requires personal info; no free historical data |
| Yahoo Finance (unofficial) | No official API; scraping violates TOS; unreliable |
| IEX Cloud | Discontinued public free tier |
| Twelve Data | Free tier has no fundamental data |

## Consequences

**Positive:**
- 250 calls/day is sufficient with 5-minute caching
- Covers both large-caps and penny/OTC stocks
- Single API key simplifies auth
- Good coverage of UK ADRs (AZN, BP) listed on US exchanges

**Negative:**
- Penny/OTC stocks often return `null` for most fields
- No real-time bid/ask spread — ATR% used as proxy
- Rate limits require disciplined caching
- Free tier has no SLA

**Constraints this creates:**
- All FMP calls must go through `src/lib/fmp.ts` — never inline in routes
- Every `fmp.ts` function must check the cache before calling FMP
- The engine must handle `null` gracefully for every field
