import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.FMP_API_KEY) {
    return NextResponse.json({
      ok: false,
      stage: 'config',
      message: 'FMP_API_KEY environment variable is not set.',
      fix: 'Vercel → Project Settings → Environment Variables → add FMP_API_KEY',
    }, { status: 503 });
  }

  try {
    // v3 API — available on the free tier (250 calls/day)
    const url = new URL('https://financialmodelingprep.com/api/v3/quote/AAPL');
    url.searchParams.set('apikey', process.env.FMP_API_KEY);

    const res = await fetch(url.toString(), { cache: 'no-store' });

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        stage: 'fmp_http',
        message: `FMP API returned HTTP ${res.status} ${res.statusText}`,
        fix: 'Check that your FMP_API_KEY is valid and your account is active at financialmodelingprep.com.',
      });
    }

    const data = await res.json();

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const obj = data as Record<string, string>;
      const errMsg = obj['Error Message'] ?? obj['message'] ?? '';
      if (errMsg) {
        return NextResponse.json({
          ok: false,
          stage: 'fmp_auth',
          message: 'FMP rejected the API key.',
          fmpMessage: errMsg,
          fix: 'Go to financialmodelingprep.com → Dashboard, copy your API key exactly (no spaces), and update FMP_API_KEY in Vercel → Project Settings → Environment Variables.',
        });
      }
    }

    if (Array.isArray(data) && data.length > 0 && data[0]?.symbol) {
      return NextResponse.json({
        ok: true,
        stage: 'fmp_ok',
        message: `FMP v3 API key is valid. AAPL price: $${data[0].price}`,
      });
    }

    return NextResponse.json({
      ok: false,
      stage: 'fmp_unexpected',
      message: 'FMP returned an unexpected response format.',
      received: JSON.stringify(data).slice(0, 300),
    });

  } catch (e) {
    return NextResponse.json({
      ok: false,
      stage: 'network',
      message: `Network error reaching FMP: ${String(e)}`,
    });
  }
}
