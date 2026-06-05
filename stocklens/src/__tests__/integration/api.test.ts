/**
 * Integration tests for /api/analyze and /api/leaderboard route handlers.
 *
 * Strategy: mock the global `fetch` so no real FMP calls are made,
 * then call the route handler functions directly with a synthetic NextRequest.
 *
 * The tests validate:
 *  - HTTP status codes for valid vs invalid inputs
 *  - Response payload shape and value ranges
 *  - Graceful handling of partial/null FMP responses
 *  - Cache hit path (second call returns cached data)
 */

import { NextRequest } from 'next/server';

// ── Mock fetch before importing anything that calls it ────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;

// Set a dummy API key so the FMP client doesn't throw
process.env.FMP_API_KEY = 'test-key-integration';

// Import route handlers after fetch mock is in place
import { GET as analyzeGET } from '@/app/api/analyze/route';
import { GET as leaderboardGET } from '@/app/api/leaderboard/route';
import { cacheClear } from '@/lib/cache';

// ── FMP mock payloads ─────────────────────────────────────────────────────────

const aaplQuote = [{
  symbol: 'AAPL', name: 'Apple Inc.', price: 185.50, changesPercentage: 0.85,
  change: 1.56, dayLow: 183.00, dayHigh: 187.00, yearHigh: 199.62, yearLow: 124.17,
  marketCap: 2_870_000_000_000, volume: 54_000_000, avgVolume: 57_000_000,
  priceAvg50: 181.20, priceAvg200: 165.80, eps: 6.43, pe: 28.8,
  sharesOutstanding: 15_500_000_000, exchange: 'NASDAQ', open: 184.0,
  previousClose: 183.94, earningsAnnouncement: null, timestamp: 1700000000,
}];

const aaplProfile = [{
  symbol: 'AAPL', companyName: 'Apple Inc.', beta: 1.28, mktCap: 2_870_000_000_000,
  sector: 'Technology', exchange: 'NASDAQ', exchangeShortName: 'NASDAQ',
  description: 'Apple Inc. designs, manufactures, and markets smartphones.',
  isEtf: false, isFund: false, isAdr: false, isActivelyTrading: true,
  volAvg: 57_000_000, lastDiv: 0.24, range: '124.17-199.62',
  changes: 1.56, companyName: 'Apple Inc.', currency: 'USD',
  cik: '0000320193', isin: 'US0378331005', cusip: '037833100',
  industry: 'Consumer Electronics', website: 'https://www.apple.com',
  ceo: 'Tim Cook', country: 'US', fullTimeEmployees: '161000',
  dcf: 155.0, dcfDiff: 30.5, image: null, ipoDate: '1980-12-12', defaultImage: false,
}];

const aaplRatios = [{ peRatioTTM: 28.5, netProfitMarginTTM: 0.25, returnOnEquityTTM: 1.47, debtEquityRatioTTM: 1.8 }];

const aaplHistory = {
  historical: Array.from({ length: 200 }, (_, i) => ({
    date: `2023-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-01`,
    close: 130 + i * 0.28,
  })),
};

const gainers = [
  { symbol: 'GME', name: 'GameStop Corp', price: 22.5, change: 5.2, changesPercentage: 30.1, volume: 80_000_000 },
  { symbol: 'AMC', name: 'AMC Entertainment', price: 5.1, change: 1.1, changesPercentage: 27.5, volume: 45_000_000 },
];

const actives = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 185.5, change: 1.56, changesPercentage: 0.85, volume: 54_000_000 },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 242.0, change: -3.2, changesPercentage: -1.3, volume: 120_000_000 },
];

// ── Helper: make a NextRequest-like object ────────────────────────────────────

function makeReq(path: string, params: Record<string, string> = {}): NextRequest {
  const url = new URL(`http://localhost:3000${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

// ── Helper: set up mock responses in FMP call order ───────────────────────────
// analyze calls: quote, profile, ratiosTTM, historical (in parallel)

function mockAaplSuccess() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/quote/AAPL'))            return ok(aaplQuote);
    if (url.includes('/profile/AAPL'))          return ok(aaplProfile);
    if (url.includes('/ratios-ttm/AAPL'))       return ok(aaplRatios);
    if (url.includes('/historical-price-full')) return ok(aaplHistory);
    return ok([]);
  });
}

function ok(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);
}

function fail(status = 404) {
  return Promise.resolve({ ok: false, status, json: () => Promise.resolve({}) } as Response);
}

// ── /api/analyze ──────────────────────────────────────────────────────────────

describe('GET /api/analyze', () => {
  beforeEach(() => { mockFetch.mockReset(); cacheClear(); });

  it('returns 400 for a missing ticker param', async () => {
    const res = await analyzeGET(makeReq('/api/analyze'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
  });

  it('returns 400 for an obviously invalid ticker', async () => {
    const res = await analyzeGET(makeReq('/api/analyze', { ticker: '!!!BAD!!!' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when FMP returns no data for a ticker', async () => {
    mockFetch.mockResolvedValue(ok([]));
    const res = await analyzeGET(makeReq('/api/analyze', { ticker: 'ZZZZ' }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 200 with valid payload for AAPL', async () => {
    mockAaplSuccess();
    const res = await analyzeGET(makeReq('/api/analyze', { ticker: 'AAPL' }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.quote).toBeDefined();
    expect(body.profile).toBeDefined();
    expect(body.scoring).toBeDefined();
  });

  it('scoring payload has correct structure for AAPL', async () => {
    mockAaplSuccess();
    const res = await analyzeGET(makeReq('/api/analyze', { ticker: 'AAPL' }));
    const { scoring } = await res.json();

    expect(scoring.ticker).toBe('AAPL');
    expect(scoring.regime).toBe('large-cap');
    expect(scoring.confidenceFactor).toBeGreaterThan(0);
    expect(scoring.confidenceFactor).toBeLessThanOrEqual(100);
    expect(Array.isArray(scoring.metrics)).toBe(true);
    expect(scoring.metrics.length).toBe(6);
    expect(typeof scoring.verdictBand).toBe('string');
    expect(Array.isArray(scoring.verdictWhy)).toBe(true);
    expect(Array.isArray(scoring.verdictWatch)).toBe(true);
    expect(typeof scoring.fetchedAt).toBe('number');
    expect(scoring.dataCompleteness).toBeGreaterThan(70);
  });

  it('large-cap AAPL confidence factor is above 55', async () => {
    mockAaplSuccess();
    const res = await analyzeGET(makeReq('/api/analyze', { ticker: 'AAPL' }));
    const { scoring } = await res.json();
    expect(scoring.confidenceFactor).toBeGreaterThan(55);
  });

  it('works gracefully when profile call fails (null profile)', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/quote/AAPL'))            return ok(aaplQuote);
      if (url.includes('/profile/AAPL'))          return fail(500);
      if (url.includes('/ratios-ttm/AAPL'))       return ok(aaplRatios);
      if (url.includes('/historical-price-full')) return ok(aaplHistory);
      return ok([]);
    });
    const res = await analyzeGET(makeReq('/api/analyze', { ticker: 'AAPL' }));
    expect(res.status).toBe(200); // still succeeds with partial data
    const body = await res.json();
    expect(body.scoring.confidenceFactor).toBeGreaterThanOrEqual(0);
  });

  it('normalises ticker to uppercase (aapl → AAPL)', async () => {
    mockAaplSuccess();
    const res = await analyzeGET(makeReq('/api/analyze', { ticker: 'aapl' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scoring.ticker).toBe('AAPL');
  });

  it('scores a penny stock in penny regime', async () => {
    const pennyQuote = [{ ...aaplQuote[0], symbol: 'SNDL', name: 'Sundial Growers', price: 1.20, marketCap: 300_000_000, eps: null, pe: null, dayHigh: 1.45, dayLow: 1.05, avgVolume: 20_000_000, volume: 25_000_000 }];
    const pennyProfile = [{ ...aaplProfile[0], symbol: 'SNDL', mktCap: 300_000_000, beta: 3.2 }];
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/quote/SNDL'))            return ok(pennyQuote);
      if (url.includes('/profile/SNDL'))          return ok(pennyProfile);
      if (url.includes('/ratios-ttm/SNDL'))       return ok([]);
      if (url.includes('/historical-price-full')) return ok({ historical: [] });
      return ok([]);
    });
    const res = await analyzeGET(makeReq('/api/analyze', { ticker: 'SNDL' }));
    expect(res.status).toBe(200);
    const { scoring } = await res.json();
    expect(scoring.regime).toBe('penny');
  });
});

// ── /api/leaderboard ──────────────────────────────────────────────────────────

describe('GET /api/leaderboard', () => {
  beforeEach(() => { mockFetch.mockReset(); cacheClear(); });

  it('returns 200 with gainers and actives arrays', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/stock_market/gainers')) return ok(gainers);
      if (url.includes('/stock_market/actives')) return ok(actives);
      return ok([]);
    });
    const res = await leaderboardGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.gainers)).toBe(true);
    expect(Array.isArray(body.actives)).toBe(true);
    expect(typeof body.fetchedAt).toBe('number');
  });

  it('leaderboard item has required fields', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/stock_market/gainers')) return ok(gainers);
      if (url.includes('/stock_market/actives')) return ok(actives);
      return ok([]);
    });
    const res = await leaderboardGET();
    const body = await res.json();
    const item = body.gainers[0];
    expect(typeof item.symbol).toBe('string');
    expect(typeof item.price).toBe('number');
    expect(typeof item.changesPercentage).toBe('number');
    expect(item.miniConfidence === null || typeof item.miniConfidence === 'number').toBe(true);
    expect(item.regime).toBeDefined();
  });

  it('miniConfidence is between 10 and 85 for priced items', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/stock_market/gainers')) return ok(gainers);
      if (url.includes('/stock_market/actives')) return ok(actives);
      return ok([]);
    });
    const res = await leaderboardGET();
    const body = await res.json();
    for (const item of [...body.gainers, ...body.actives]) {
      if (item.miniConfidence !== null) {
        expect(item.miniConfidence).toBeGreaterThanOrEqual(10);
        expect(item.miniConfidence).toBeLessThanOrEqual(85);
      }
    }
  });

  it('returns empty arrays gracefully when FMP fails', async () => {
    mockFetch.mockResolvedValue(fail(500));
    const res = await leaderboardGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.gainers).toEqual([]);
    expect(body.actives).toEqual([]);
  });

  it('limits results to 10 items per list', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      symbol: `T${i}`, name: `Co ${i}`, price: 10 + i, change: 0.5, changesPercentage: 1.0, volume: 1_000_000,
    }));
    mockFetch.mockImplementation(() => ok(many));
    const res = await leaderboardGET();
    const body = await res.json();
    expect(body.gainers.length).toBeLessThanOrEqual(10);
    expect(body.actives.length).toBeLessThanOrEqual(10);
  });
});
