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
    const url = new URL('https://financialmodelingprep.com/api/v3/quote/AAPL');
    url.searchParams.set('apikey', process.env.FMP_API_KEY);

    const res = await fetch(url.toString(), { cache: 'no-store' });

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        stage: 'fmp_http',
        message: `FMP returned HTTP ${res.status} ${res.statusText}`,
        fix: 'Check Vercel function logs for network errors.',
      });
    }

    const data = await res.json();

    if (data && typeof data === 'object' && !Array.isArray(data) && 'Error Message' in data) {
      const msg: string = (data as Record<string, string>)['Error Message'] ?? '';
      return NextResponse.json({
        ok: false,
        stage: 'fmp_auth',
        message: 'FMP rejected the API key.',
        fmpMessage: msg,
        fix: 'Verify your FMP_API_KEY is correct. Go to financialmodelingprep.com → Dashboard to copy your key. Also check that your email is verified and the account is active.',
      });
    }

    if (Array.isArray(data) && data.length > 0 && data[0]?.symbol) {
      return NextResponse.json({
        ok: true,
        stage: 'fmp_ok',
        message: `FMP API key is valid. Test quote — ${data[0].symbol}: $${data[0].price}`,
      });
    }

    return NextResponse.json({
      ok: false,
      stage: 'fmp_unexpected',
      message: 'FMP returned an unexpected response format.',
      received: JSON.stringify(data).slice(0, 200),
    });

  } catch (e) {
    return NextResponse.json({
      ok: false,
      stage: 'network',
      message: `Network error reaching FMP: ${String(e)}`,
    });
  }
}
