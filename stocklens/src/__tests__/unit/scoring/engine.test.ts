/**
 * Unit tests for the scoring engine.
 * All FMP API calls are mocked — no network traffic.
 */

import { detectRegime, runScoringEngine } from '@/lib/scoring/engine';
import { FMPQuote, FMPProfile, FMPHistoricalPrice, StockRegime } from '@/types/stock';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const baseQuote = (overrides: Partial<FMPQuote> = {}): Partial<FMPQuote> => ({
  symbol: 'TEST',
  name: 'Test Corp',
  price: 150,
  change: 1.5,
  changesPercentage: 1.0,
  dayHigh: 152,
  dayLow: 148,
  yearHigh: 180,
  yearLow: 100,
  marketCap: 2_500_000_000_000, // $2.5T
  volume: 80_000_000,
  avgVolume: 70_000_000,
  priceAvg50: 145,
  priceAvg200: 130,
  eps: 6.5,
  pe: 28,
  sharesOutstanding: 15_500_000_000,
  exchange: 'NASDAQ',
  ...overrides,
});

const baseProfile = (overrides: Partial<FMPProfile> = {}): Partial<FMPProfile> => ({
  symbol: 'TEST',
  companyName: 'Test Corp',
  beta: 1.2,
  mktCap: 2_500_000_000_000,
  sector: 'Technology',
  exchange: 'NASDAQ',
  exchangeShortName: 'NASDAQ',
  isEtf: false,
  isFund: false,
  isAdr: false,
  isActivelyTrading: true,
  ...overrides,
});

// Synthetic 200-day history trending up
const bullHistory = (): FMPHistoricalPrice[] =>
  Array.from({ length: 200 }, (_, i) => ({
    date: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-01`,
    close: 100 + i * 0.25,
  })).reverse();

// Synthetic 200-day history trending down
const bearHistory = (): FMPHistoricalPrice[] =>
  Array.from({ length: 200 }, (_, i) => ({
    date: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-01`,
    close: 200 - i * 0.3,
  })).reverse();

// ── detectRegime ──────────────────────────────────────────────────────────────

describe('detectRegime', () => {
  it('classifies sub-$5 price as penny regardless of market cap', () => {
    expect(detectRegime(0.05, 500_000_000)).toBe<StockRegime>('penny');
    expect(detectRegime(4.99, null)).toBe<StockRegime>('penny');
  });

  it('classifies >$10B market cap as large-cap', () => {
    expect(detectRegime(150, 2_500_000_000_000)).toBe<StockRegime>('large-cap');
    expect(detectRegime(50, 50_000_000_000)).toBe<StockRegime>('large-cap');
  });

  it('classifies $2B–$10B as mid-cap', () => {
    expect(detectRegime(80, 5_000_000_000)).toBe<StockRegime>('mid-cap');
  });

  it('classifies <$2B as small-cap', () => {
    expect(detectRegime(20, 500_000_000)).toBe<StockRegime>('small-cap');
  });

  it('defaults to small-cap when no market cap provided', () => {
    expect(detectRegime(25, null)).toBe<StockRegime>('small-cap');
  });

  it('classifies null price as small-cap', () => {
    expect(detectRegime(null, 100_000_000)).toBe<StockRegime>('small-cap');
  });
});

// ── runScoringEngine — confidence factor range ────────────────────────────────

describe('runScoringEngine — confidence factor', () => {
  it('always returns a CF between 0 and 100', () => {
    const result = runScoringEngine('AAPL', baseQuote(), baseProfile(), null, bullHistory());
    expect(result.confidenceFactor).toBeGreaterThanOrEqual(0);
    expect(result.confidenceFactor).toBeLessThanOrEqual(100);
  });

  it('high-quality large-cap scores well above 55', () => {
    const result = runScoringEngine('AAPL', baseQuote(), baseProfile(), null, bullHistory());
    expect(result.confidenceFactor).toBeGreaterThan(55);
  });

  it('penny stock with no earnings scores below 55', () => {
    const q = baseQuote({ price: 0.50, marketCap: 5_000_000, eps: null, pe: null, avgVolume: 50_000, volume: 20_000, yearHigh: 2.0, yearLow: 0.10 });
    const p = baseProfile({ mktCap: 5_000_000, beta: 4.0 });
    const result = runScoringEngine('SCAM', q, p, null, []);
    expect(result.confidenceFactor).toBeLessThan(55);
    expect(result.regime).toBe('penny');
  });

  it('missing all data still produces a valid result (no crash)', () => {
    const result = runScoringEngine('GHOST', {}, {}, null, []);
    expect(result.confidenceFactor).toBeGreaterThanOrEqual(0);
    expect(result.confidenceFactor).toBeLessThanOrEqual(100);
    expect(result.regime).toBeDefined();
    expect(result.metrics).toHaveLength(6);
  });
});

// ── Regime detection in engine ────────────────────────────────────────────────

describe('runScoringEngine — regime', () => {
  it('sets regime=penny for sub-$5 stocks', () => {
    const q = baseQuote({ price: 1.50, marketCap: 50_000_000 });
    const result = runScoringEngine('MEME', q, baseProfile({ mktCap: 50_000_000 }), null, []);
    expect(result.regime).toBe('penny');
  });

  it('sets regime=large-cap for $2.5T market cap', () => {
    const result = runScoringEngine('AAPL', baseQuote(), baseProfile(), null, bullHistory());
    expect(result.regime).toBe('large-cap');
  });
});

// ── Metrics structure ─────────────────────────────────────────────────────────

describe('runScoringEngine — metrics structure', () => {
  it('returns exactly 6 named metric groups', () => {
    const result = runScoringEngine('TEST', baseQuote(), baseProfile(), null, bullHistory());
    const names = result.metrics.map(m => m.name);
    expect(names).toContain('Liquidity');
    expect(names).toContain('Volatility');
    expect(names).toContain('Float & Size');
    expect(names).toContain('Quality / Earnings');
    expect(names).toContain('Valuation & Trend');
    expect(names).toContain('Data Completeness');
    expect(result.metrics).toHaveLength(6);
  });

  it('all metric scores are between 0 and 100', () => {
    const result = runScoringEngine('TEST', baseQuote(), baseProfile(), null, bullHistory());
    for (const m of result.metrics) {
      expect(m.score).toBeGreaterThanOrEqual(0);
      expect(m.score).toBeLessThanOrEqual(100);
    }
  });

  it('sum of (weight × 100) across all metrics ≈ 100', () => {
    const result = runScoringEngine('TEST', baseQuote(), baseProfile(), null, bullHistory());
    const totalWeight = result.metrics.reduce((s, m) => s + m.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });

  it('each metric has a non-empty detail string', () => {
    const result = runScoringEngine('TEST', baseQuote(), baseProfile(), null, bullHistory());
    for (const m of result.metrics) {
      expect(m.detail.length).toBeGreaterThan(0);
    }
  });
});

// ── Liquidity sensitivity ─────────────────────────────────────────────────────

describe('Liquidity metric sensitivity', () => {
  it('high dollar volume yields a higher liquidity score than low volume', () => {
    const highVol = runScoringEngine('HIGH', baseQuote({ avgVolume: 10_000_000, volume: 12_000_000 }), baseProfile(), null, bullHistory());
    const lowVol  = runScoringEngine('LOW',  baseQuote({ avgVolume: 500, volume: 200 }), baseProfile(), null, bullHistory());
    const liqHigh = highVol.metrics.find(m => m.name === 'Liquidity')!.score;
    const liqLow  = lowVol.metrics.find(m => m.name === 'Liquidity')!.score;
    expect(liqHigh).toBeGreaterThan(liqLow);
  });

  it('relative volume spike boosts liquidity score', () => {
    const normal = runScoringEngine('T', baseQuote({ volume: 70_000_000, avgVolume: 70_000_000 }), baseProfile(), null, []);
    const spike  = runScoringEngine('T', baseQuote({ volume: 250_000_000, avgVolume: 70_000_000 }), baseProfile(), null, []);
    const liqNormal = normal.metrics.find(m => m.name === 'Liquidity')!.score;
    const liqSpike  = spike.metrics.find(m => m.name === 'Liquidity')!.score;
    expect(liqSpike).toBeGreaterThanOrEqual(liqNormal);
  });
});

// ── Volatility sensitivity ────────────────────────────────────────────────────

describe('Volatility metric sensitivity', () => {
  it('tight daily range scores higher volatility than wide range', () => {
    const tight = runScoringEngine('T', baseQuote({ dayHigh: 150.5, dayLow: 149.5, price: 150 }), baseProfile({ beta: 0.7 }), null, []);
    const wide  = runScoringEngine('W', baseQuote({ dayHigh: 165, dayLow: 135, price: 150 }), baseProfile({ beta: 3.5 }), null, []);
    const voltTight = tight.metrics.find(m => m.name === 'Volatility')!.score;
    const voltWide  = wide.metrics.find(m => m.name === 'Volatility')!.score;
    expect(voltTight).toBeGreaterThan(voltWide);
  });
});

// ── Quality sensitivity ───────────────────────────────────────────────────────

describe('Quality metric sensitivity', () => {
  it('positive EPS scores higher quality than negative EPS', () => {
    const profitable = runScoringEngine('P', baseQuote({ eps: 5.0, pe: 25 }), baseProfile(), null, []);
    const unprofitable = runScoringEngine('U', baseQuote({ eps: -3.0, pe: -15 }), baseProfile(), null, []);
    const qP = profitable.metrics.find(m => m.name === 'Quality / Earnings')!.score;
    const qU = unprofitable.metrics.find(m => m.name === 'Quality / Earnings')!.score;
    expect(qP).toBeGreaterThan(qU);
  });

  it('penny stock with null EPS scores lower quality than with positive EPS', () => {
    const withEps = runScoringEngine('A', baseQuote({ price: 1.5, eps: 0.05, marketCap: 10_000_000 }), baseProfile({ mktCap: 10_000_000 }), null, []);
    const noEps   = runScoringEngine('B', baseQuote({ price: 1.5, eps: null, marketCap: 10_000_000 }), baseProfile({ mktCap: 10_000_000 }), null, []);
    const qWith = withEps.metrics.find(m => m.name === 'Quality / Earnings')!.score;
    const qNo   = noEps.metrics.find(m => m.name === 'Quality / Earnings')!.score;
    expect(qWith).toBeGreaterThan(qNo);
  });
});

// ── Float & Size sensitivity ──────────────────────────────────────────────────

describe('Float & Size metric sensitivity', () => {
  it('large-cap market cap scores higher than nano-cap', () => {
    const large = runScoringEngine('L', baseQuote({ marketCap: 500_000_000_000 }), baseProfile({ mktCap: 500_000_000_000 }), null, []);
    const nano  = runScoringEngine('N', baseQuote({ marketCap: 5_000_000 }), baseProfile({ mktCap: 5_000_000 }), null, []);
    const fsL = large.metrics.find(m => m.name === 'Float & Size')!.score;
    const fsN = nano.metrics.find(m => m.name === 'Float & Size')!.score;
    expect(fsL).toBeGreaterThan(fsN);
  });

  it('dangerously low float (<20M shares) penalises the score', () => {
    const lowFloat  = runScoringEngine('L', baseQuote({ sharesOutstanding: 5_000_000 }), baseProfile(), null, []);
    const highFloat = runScoringEngine('H', baseQuote({ sharesOutstanding: 200_000_000 }), baseProfile(), null, []);
    const fsLow  = lowFloat.metrics.find(m => m.name === 'Float & Size')!.score;
    const fsHigh = highFloat.metrics.find(m => m.name === 'Float & Size')!.score;
    expect(fsHigh).toBeGreaterThan(fsLow);
  });
});

// ── Data Completeness ─────────────────────────────────────────────────────────

describe('Data Completeness metric', () => {
  it('full data yields completeness > 85', () => {
    const result = runScoringEngine('FULL', baseQuote(), baseProfile(), null, bullHistory());
    const dc = result.metrics.find(m => m.name === 'Data Completeness')!.score;
    expect(dc).toBeGreaterThan(85);
  });

  it('empty data yields completeness < 30', () => {
    const result = runScoringEngine('EMPTY', {}, {}, null, []);
    const dc = result.metrics.find(m => m.name === 'Data Completeness')!.score;
    expect(dc).toBeLessThan(30);
  });
});

// ── Valuation & Trend ─────────────────────────────────────────────────────────

describe('Valuation & Trend metric', () => {
  it('stock trading near 50-day MA scores better than far above it', () => {
    // Near MA
    const near = runScoringEngine('N', baseQuote({ price: 145, priceAvg50: 143, priceAvg200: 130 }), baseProfile(), null, []);
    // Far above MA (overextended)
    const far  = runScoringEngine('F', baseQuote({ price: 200, priceAvg50: 143, priceAvg200: 130 }), baseProfile(), null, []);
    const vtNear = near.metrics.find(m => m.name === 'Valuation & Trend')!.score;
    const vtFar  = far.metrics.find(m => m.name === 'Valuation & Trend')!.score;
    expect(vtNear).toBeGreaterThan(vtFar);
  });

  it('stock above 200-day MA scores higher than below', () => {
    const above = runScoringEngine('A', baseQuote({ price: 150, priceAvg50: 140, priceAvg200: 120 }), baseProfile(), null, []);
    const below = runScoringEngine('B', baseQuote({ price: 100, priceAvg50: 140, priceAvg200: 130 }), baseProfile(), null, []);
    const vtAbove = above.metrics.find(m => m.name === 'Valuation & Trend')!.score;
    const vtBelow = below.metrics.find(m => m.name === 'Valuation & Trend')!.score;
    expect(vtAbove).toBeGreaterThan(vtBelow);
  });
});
