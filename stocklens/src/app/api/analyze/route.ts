import { NextRequest, NextResponse } from 'next/server';
import { getQuote, getProfile, getRatiosTTM, getHistoricalPrices, clearLastFmpError, getLastFmpError } from '@/lib/fmp';
import { runScoringEngine } from '@/lib/scoring/engine';
import { buildVerdict } from '@/lib/scoring/verdict';
import { AnalyzeResponse } from '@/types/stock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!process.env.FMP_API_KEY) {
    return NextResponse.json(
      { error: 'FMP_API_KEY is not configured. Go to Vercel → Project Settings → Environment Variables and add FMP_API_KEY.' },
      { status: 503 }
    );
  }

  const ticker = req.nextUrl.searchParams.get('ticker')?.trim().toUpperCase();

  if (!ticker || !/^[A-Z0-9.^-]{1,10}$/.test(ticker)) {
    return NextResponse.json({ error: 'Invalid ticker symbol.' }, { status: 400 });
  }

  clearLastFmpError();

  // Fan out all four FMP calls in parallel to save latency
  const [quote, profile, ratios, history] = await Promise.all([
    getQuote(ticker),
    getProfile(ticker),
    getRatiosTTM(ticker),
    getHistoricalPrices(ticker, 200),
  ]);

  // A ticker is only valid if we get at least a quote back
  if (!quote && !profile) {
    const fmpErr = getLastFmpError();
    if (fmpErr === 'invalid_key') {
      return NextResponse.json(
        { error: 'FMP API key is invalid or not yet activated. Visit /api/health for diagnostics, then verify FMP_API_KEY in Vercel → Project Settings → Environment Variables.' },
        { status: 503 }
      );
    }
    if (fmpErr === 'quota') {
      return NextResponse.json(
        { error: 'FMP API daily quota exceeded. The free tier allows ~250 calls/day. Try again tomorrow.' },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: `No data found for ticker "${ticker}". Check the symbol and try again.` },
      { status: 404 }
    );
  }

  const q = quote ?? {};
  const p = profile ?? {};

  const partialResult = runScoringEngine(ticker, q, p, ratios, history);
  const verdict = buildVerdict(partialResult, q, p, history);
  const scoringResult = { ...partialResult, ...verdict };

  const response: AnalyzeResponse = {
    quote: q,
    profile: p,
    scoring: scoringResult,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
