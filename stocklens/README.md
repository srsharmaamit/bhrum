# StockLens — Live Stock Risk Intelligence Dashboard

A production-ready Next.js web app that analyzes any US-listed stock ticker and produces a transparent **Confidence Factor (0–100)** with a plain-English risk verdict and watch conditions.

## Features

- **Transparent scoring engine** — 6 weighted metric groups: Liquidity, Volatility, Float & Size, Quality/Earnings, Valuation & Trend, Data Completeness
- **Regime-aware** — auto-detects penny stock vs small/mid/large-cap and applies appropriate thresholds
- **Smart rate limiting** — server-side 5-minute cache keeps FMP free tier usage well under 250 calls/day
- **Live leaderboard** — top gainers and most active, with penny-only filter
- **Plain-English verdict** — "Why" and concrete "What to Watch" conditions computed from live data
- **Beautiful navy UI** — animated circular gauge, mobile-responsive, micro-animations

## Quick Start

```bash
cd stocklens
cp .env.example .env.local
# Add your FMP API key to .env.local
npm install
npm run dev
```

## Getting Your FMP API Key

1. Go to [financialmodelingprep.com/developer/docs](https://financialmodelingprep.com/developer/docs/)
2. Sign up for a free account (250 API calls/day)
3. Copy your API key from the dashboard
4. Paste it into `.env.local`:

```env
FMP_API_KEY=your_actual_key_here
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `FMP_API_KEY` | Yes | Financial Modeling Prep API key |

## Deploy to Vercel

Import `srsharmaamit/bhrum` at [vercel.com/new](https://vercel.com/new), set **Root Directory** to `stocklens`, and add `FMP_API_KEY` as an environment variable.

## Scoring Engine

Edit `src/lib/scoring/config.ts` to tune any weight or threshold without touching logic.

| Metric | Default Weight | What it measures |
|---|---|---|
| Liquidity | 22% | Avg daily dollar volume, relative volume |
| Volatility | 20% | ATR%, beta, 52-week position |
| Float & Size | 15% | Market cap, shares outstanding, dilution risk |
| Quality / Earnings | 20% | EPS sign, P/E sanity, TTM margins |
| Valuation & Trend | 13% | vs 50/200-day MA, momentum |
| Data Completeness | 10% | Penalises missing fields |

## Disclaimer

Educational tool. Not financial advice. Scores measure risk/quality characteristics, not future returns.
