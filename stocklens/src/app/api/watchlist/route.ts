import { NextRequest, NextResponse } from 'next/server';
import { getQuotesBatch } from '@/lib/fmp';
import { detectRegime } from '@/lib/scoring/engine';
import { FMPQuote, MetricFlag, StockRegime, WatchlistItem, WatchlistResponse } from '@/types/stock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Same permissive pattern as the analyze route
const TICKER_RE = /^[A-Z0-9.^-]{1,10}$/;

/**
 * Lightweight quote-only score (0–100). Uses only data from a single FMP quote call —
 * no profile, ratios, or history fetch — to stay within the 250-call/day free-tier budget.
 *
 * Weights: dollar-volume 40% · intraday-ATR 35% · earnings-quality 15% · momentum 10%
 */
function computeQuickScore(quote: FMPQuote): { score: number; flag: MetricFlag } {
  const price = quote.price ?? 0;

  // Dollar volume (price × avgVolume) — proxy for liquidity
  const dollarVol = price * (quote.avgVolume ?? 0);
  let dollarScore: number;
  if (dollarVol >= 100_000_000)      dollarScore = 100;
  else if (dollarVol >= 10_000_000)  dollarScore = 75;
  else if (dollarVol >= 1_000_000)   dollarScore = 50;
  else if (dollarVol >= 100_000)     dollarScore = 25;
  else                                dollarScore = 10;

  // Intraday ATR% — lower is safer
  const atrPct = price > 0 ? ((quote.dayHigh - quote.dayLow) / price) * 100 : 0;
  let atrScore: number;
  if (atrPct <= 1)       atrScore = 100;
  else if (atrPct <= 3)  atrScore = 75;
  else if (atrPct <= 7)  atrScore = 50;
  else if (atrPct <= 15) atrScore = 25;
  else                    atrScore = 10;

  // Earnings quality — EPS presence and sign
  let qualScore = 50;
  if (quote.eps !== null && quote.eps !== undefined) {
    qualScore = quote.eps > 0 ? 80 : 30;
  }

  // Momentum — 1-day change
  const chg = quote.changesPercentage ?? 0;
  let momScore = 50;
  if (chg > 2)       momScore = 65;
  else if (chg > 0)  momScore = 55;
  else if (chg < -2) momScore = 35;

  const raw = dollarScore * 0.40 + atrScore * 0.35 + qualScore * 0.15 + momScore * 0.10;
  const regime = detectRegime(price, quote.marketCap ?? null);

  // Penny stocks capped at 50 — low-float volatility inherently limits confidence
  let score = Math.round(raw);
  if (regime === 'penny' && score > 50) score = 50;
  score = Math.max(0, Math.min(100, score));

  let flag: MetricFlag;
  if (score >= 70)      flag = 'good';
  else if (score >= 45) flag = 'neutral';
  else if (score >= 25) flag = 'warning';
  else                  flag = 'danger';

  return { score, flag };
}

export async function GET(req: NextRequest) {
  if (!process.env.FMP_API_KEY) {
    return NextResponse.json(
      { error: 'FMP_API_KEY is not configured.' },
      { status: 503 }
    );
  }

  const tickerParam = req.nextUrl.searchParams.get('tickers') ?? '';
  const tickers = tickerParam
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json({ error: 'At least one ticker required.' }, { status: 400 });
  }
  if (tickers.length > 15) {
    return NextResponse.json({ error: 'Maximum 15 tickers per request.' }, { status: 400 });
  }
  if (!tickers.every(t => TICKER_RE.test(t))) {
    return NextResponse.json({ error: 'Invalid ticker symbol(s).' }, { status: 400 });
  }

  // ONE FMP call for all tickers (with per-ticker fallback for any the batch omits)
  const quotes = await getQuotesBatch(tickers);
  const returnedSymbols = new Set(quotes.map(q => q.symbol.toUpperCase()));

  const dataItems: WatchlistItem[] = quotes.map(q => {
    const { score, flag } = computeQuickScore(q);
    const regime = detectRegime(q.price ?? 0, q.marketCap ?? null) as StockRegime;
    return {
      symbol: q.symbol,
      name: q.name,
      price: q.price,
      changesPercentage: q.changesPercentage,
      regime,
      score,
      flag,
      marketCap: q.marketCap,
      volume: q.volume,
    };
  }).sort((a, b) => b.score - a.score);

  // Tickers truly not in FMP: include as placeholder rows at the bottom
  const noDataItems: WatchlistItem[] = tickers
    .filter(t => !returnedSymbols.has(t))
    .map(t => ({
      symbol: t, name: '—', price: 0, changesPercentage: 0,
      regime: 'small-cap' as StockRegime, score: 0, flag: 'danger' as MetricFlag,
      marketCap: null, volume: 0, noData: true,
    }));

  const items: WatchlistItem[] = [...dataItems, ...noDataItems];

  const response: WatchlistResponse = {
    items,
    fetchedAt: Date.now(),
  };

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
