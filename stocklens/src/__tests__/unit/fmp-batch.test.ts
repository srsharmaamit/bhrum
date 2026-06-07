/**
 * Unit tests for getQuotesBatch — verifies normalization and the single-call / fallback behavior.
 */

import { cacheClear } from '@/lib/cache';

const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;
process.env.FMP_API_KEY = 'test-key-batch';

// Import after env + fetch mock are in place
import { getQuotesBatch } from '@/lib/fmp';

function ok(body: unknown): Promise<Response> {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
}

function fail(status = 503): Promise<Response> {
  return Promise.resolve({ ok: false, status, json: () => Promise.resolve({}) } as Response);
}

const rawAapl = {
  symbol: 'AAPL', name: 'Apple Inc.', price: 185,
  changePercentage: 0.85,             // stable API field name
  change: 1.56, dayLow: 183, dayHigh: 187,
  yearHigh: 199.62, yearLow: 124.17,
  marketCap: 2_870_000_000_000, priceAvg50: 181, priceAvg200: 165,
  exchange: 'NASDAQ', volume: 54_000_000, avgVolume: 57_000_000,
  open: 184, previousClose: 183.94, eps: 6.43, pe: 28.8,
  sharesOutstanding: 15_500_000_000, timestamp: 1_700_000_000,
  earningsAnnouncement: null,
};

const rawMsft = {
  symbol: 'MSFT', name: 'Microsoft Corp.', price: 400,
  changePercentage: -0.3,
  change: -1.2, dayLow: 398, dayHigh: 403,
  yearHigh: 430, yearLow: 310,
  marketCap: 3_000_000_000_000, priceAvg50: 390, priceAvg200: 380,
  exchange: 'NASDAQ', volume: 20_000_000, avgVolume: 22_000_000,
  open: 401, previousClose: 401.2, eps: 12.0, pe: 33.3,
  sharesOutstanding: 7_500_000_000, timestamp: 1_700_000_000,
  earningsAnnouncement: null,
};

describe('getQuotesBatch', () => {
  beforeEach(() => { mockFetch.mockReset(); cacheClear(); });

  it('returns empty array immediately without calling fetch when given no tickers', async () => {
    const results = await getQuotesBatch([]);
    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('makes exactly ONE fetch call for multiple tickers', async () => {
    mockFetch.mockImplementation(() => ok([rawAapl, rawMsft]));
    await getQuotesBatch(['AAPL', 'MSFT']);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('includes all symbols in the single batch URL', async () => {
    mockFetch.mockImplementation(() => ok([rawAapl, rawMsft]));
    await getQuotesBatch(['AAPL', 'MSFT']);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('AAPL');
    expect(calledUrl).toContain('MSFT');
  });

  it('normalizes changePercentage → changesPercentage for all items', async () => {
    mockFetch.mockImplementation(() => ok([rawAapl, rawMsft]));
    const results = await getQuotesBatch(['AAPL', 'MSFT']);
    expect(results[0].changesPercentage).toBe(0.85);
    expect(results[1].changesPercentage).toBe(-0.3);
  });

  it('prefers changesPercentage over changePercentage when both present', async () => {
    const withBoth = [{ ...rawAapl, changesPercentage: 1.5 }]; // explicit field takes priority
    mockFetch.mockImplementation(() => ok(withBoth));
    const results = await getQuotesBatch(['AAPL']);
    expect(results[0].changesPercentage).toBe(1.5);
  });

  it('maps all FMPQuote fields correctly', async () => {
    mockFetch.mockImplementation(() => ok([rawAapl]));
    const [q] = await getQuotesBatch(['AAPL']);
    expect(q.symbol).toBe('AAPL');
    expect(q.price).toBe(185);
    expect(q.eps).toBe(6.43);
    expect(q.marketCap).toBe(2_870_000_000_000);
    expect(q.avgVolume).toBe(57_000_000);
  });

  it('uppercases ticker symbols before batching', async () => {
    mockFetch.mockImplementation(() => ok([rawAapl]));
    await getQuotesBatch(['aapl']);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('AAPL');
    expect(calledUrl).not.toContain('aapl');
  });

  it('falls back to individual getQuote calls when batch returns a non-ok response', async () => {
    mockFetch.mockImplementation((url: string) => {
      // Batch call (both symbols in URL) → fail
      if (url.includes('AAPL') && url.includes('MSFT')) return fail(403);
      // Individual calls → succeed
      if (url.includes('symbol=AAPL')) return ok([rawAapl]);
      if (url.includes('symbol=MSFT')) return ok([rawMsft]);
      return ok([]);
    });
    const results = await getQuotesBatch(['AAPL', 'MSFT']);
    expect(mockFetch).toHaveBeenCalledTimes(3); // 1 batch attempt + 2 individual
    expect(results).toHaveLength(2);
    expect(results.map(r => r.symbol).sort()).toEqual(['AAPL', 'MSFT']);
  });

  it('caps fallback sequential calls at 10 tickers', async () => {
    const tickers = Array.from({ length: 15 }, (_, i) => `STK${i}`);
    mockFetch.mockImplementation(() => fail(403));
    await getQuotesBatch(tickers);
    // 1 batch attempt + up to 10 individual (all fail → return null → filtered out)
    expect(mockFetch).toHaveBeenCalledTimes(11);
  });

  it('returns only successfully fetched quotes from fallback', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('AAPL') && url.includes('MSFT')) return fail(403);
      if (url.includes('symbol=AAPL')) return ok([rawAapl]);
      if (url.includes('symbol=MSFT')) return ok([]); // MSFT returns empty → null
      return ok([]);
    });
    const results = await getQuotesBatch(['AAPL', 'MSFT']);
    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe('AAPL');
  });
});
