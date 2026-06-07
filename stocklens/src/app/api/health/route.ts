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
    const url = new URL('https://financialmodelingprep.com/stable/quote');
    url.searchParams.set('symbol', 'AAPL');
    url.searchParams.set('apikey', process.env.FMP_API_KEY);

    const res = await fetch(url.toString(), { cache: 'no-store' });
    const rawText = await res.text();

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        stage: 'fmp_http',
        httpStatus: res.status,
        message: `FMP API returned HTTP ${res.status} ${res.statusText}`,
        rawResponse: rawText.slice(0, 500),
        fix: 'Check that your FMP_API_KEY is valid and your account is active at financialmodelingprep.com.',
      });
    }

    let data: unknown;
    try {
      data = JSON.parse(rawText);
    } catch {
      return NextResponse.json({
        ok: false,
        stage: 'fmp_parse',
        message: 'FMP returned non-JSON response.',
        rawResponse: rawText.slice(0, 500),
      });
    }

    // Error object formats
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const obj = data as Record<string, string>;
      const errMsg = obj['Error Message'] ?? obj['message'] ?? '';
      if (errMsg) {
        return NextResponse.json({
          ok: false,
          stage: 'fmp_auth',
          message: 'FMP rejected the request.',
          fmpMessage: errMsg,
          fix: 'Go to financialmodelingprep.com → Dashboard, copy your API key exactly (no spaces), and update FMP_API_KEY in Vercel → Project Settings → Environment Variables.',
        });
      }
    }

    // Single object response (stable API returns object for single ticker)
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;
      if (obj.symbol && obj.price) {
        return NextResponse.json({
          ok: true,
          stage: 'fmp_ok',
          responseFormat: 'single-object',
          message: `FMP stable API key is valid. AAPL price: $${obj.price}`,
        });
      }
    }

    // Array response
    if (Array.isArray(data) && data.length > 0 && data[0]?.symbol) {
      return NextResponse.json({
        ok: true,
        stage: 'fmp_ok',
        responseFormat: 'array',
        message: `FMP stable API key is valid. AAPL price: $${data[0].price}`,
      });
    }

    return NextResponse.json({
      ok: false,
      stage: 'fmp_unexpected',
      message: 'FMP returned an unexpected response format.',
      received: rawText.slice(0, 500),
    });

  } catch (e) {
    return NextResponse.json({
      ok: false,
      stage: 'network',
      message: `Network error reaching FMP: ${String(e)}`,
    });
  }
}
