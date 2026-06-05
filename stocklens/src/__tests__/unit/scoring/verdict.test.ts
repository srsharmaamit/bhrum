/**
 * Unit tests for the verdict generator.
 * Validates that band labels, driver sentences, and watch conditions
 * are sensible given inputs — not exact string matches, since they're prose.
 */

import { buildVerdict } from '@/lib/scoring/verdict';
import { runScoringEngine } from '@/lib/scoring/engine';
import { FMPQuote, FMPProfile, FMPHistoricalPrice } from '@/types/stock';

const mkQuote = (p: Partial<FMPQuote> = {}): Partial<FMPQuote> => ({
  symbol: 'TEST', name: 'Test', price: 150, changesPercentage: 0.5,
  dayHigh: 152, dayLow: 148, yearHigh: 180, yearLow: 100,
  marketCap: 1_000_000_000_000, volume: 60_000_000, avgVolume: 55_000_000,
  priceAvg50: 145, priceAvg200: 130, eps: 5.0, pe: 30,
  sharesOutstanding: 10_000_000_000, exchange: 'NASDAQ', ...p,
});

const mkProfile = (p: Partial<FMPProfile> = {}): Partial<FMPProfile> => ({
  symbol: 'TEST', companyName: 'Test', beta: 1.1,
  mktCap: 1_000_000_000_000, sector: 'Technology',
  exchange: 'NASDAQ', exchangeShortName: 'NASDAQ',
  isEtf: false, isFund: false, isAdr: false, isActivelyTrading: true, ...p,
});

const history200 = (): FMPHistoricalPrice[] =>
  Array.from({ length: 200 }, (_, i) => ({
    date: `2024-01-${String(i % 28 + 1).padStart(2, '0')}`,
    close: 120 + i * 0.15,
  })).reverse();

// ── Verdict band ──────────────────────────────────────────────────────────────

describe('buildVerdict — verdictBand', () => {
  it('high-scoring large-cap returns a stable/reasonable band', () => {
    const partial = runScoringEngine('AAPL', mkQuote(), mkProfile(), null, history200());
    const verdict = buildVerdict(partial, mkQuote(), mkProfile(), history200());
    const band = verdict.verdictBand;
    expect(['Relatively Stable', 'Reasonable Risk / Reward', 'Elevated Caution']).toContain(band);
  });

  it('very low-scoring penny stock returns a high-risk band', () => {
    const q = mkQuote({ price: 0.05, marketCap: 1_000_000, eps: null, pe: null, volume: 10_000, avgVolume: 5_000, dayHigh: 0.07, dayLow: 0.03 });
    const p = mkProfile({ mktCap: 1_000_000, beta: 5.0 });
    const partial = runScoringEngine('SCAM', q, p, null, []);
    const verdict = buildVerdict(partial, q, p, []);
    expect(verdict.verdictBand).toMatch(/Risk|Caution|Speculative/);
  });

  it('verdict band is always a non-empty string', () => {
    const partial = runScoringEngine('X', {}, {}, null, []);
    const verdict = buildVerdict(partial, {}, {}, []);
    expect(typeof verdict.verdictBand).toBe('string');
    expect(verdict.verdictBand.length).toBeGreaterThan(0);
  });
});

// ── Verdict why (drivers) ─────────────────────────────────────────────────────

describe('buildVerdict — verdictWhy', () => {
  it('returns 1 to 3 driver sentences', () => {
    const partial = runScoringEngine('TEST', mkQuote(), mkProfile(), null, history200());
    const verdict = buildVerdict(partial, mkQuote(), mkProfile(), history200());
    expect(verdict.verdictWhy.length).toBeGreaterThanOrEqual(1);
    expect(verdict.verdictWhy.length).toBeLessThanOrEqual(3);
  });

  it('each driver sentence is a non-empty string', () => {
    const partial = runScoringEngine('TEST', mkQuote(), mkProfile(), null, history200());
    const verdict = buildVerdict(partial, mkQuote(), mkProfile(), history200());
    for (const why of verdict.verdictWhy) {
      expect(typeof why).toBe('string');
      expect(why.length).toBeGreaterThan(5);
    }
  });
});

// ── Watch conditions ──────────────────────────────────────────────────────────

describe('buildVerdict — verdictWatch', () => {
  it('returns an array (possibly empty) of string conditions', () => {
    const partial = runScoringEngine('TEST', mkQuote(), mkProfile(), null, history200());
    const verdict = buildVerdict(partial, mkQuote(), mkProfile(), history200());
    expect(Array.isArray(verdict.verdictWatch)).toBe(true);
    for (const c of verdict.verdictWatch) {
      expect(typeof c).toBe('string');
    }
  });

  it('warns about overextension when price is far above 50-day MA', () => {
    const q = mkQuote({ price: 200, priceAvg50: 140, priceAvg200: 120 }); // +43% above MA
    const partial = runScoringEngine('TEST', q, mkProfile(), null, []);
    const verdict = buildVerdict(partial, q, mkProfile(), []);
    const combined = verdict.verdictWatch.join(' ');
    // Should mention MA pullback or overextension
    expect(combined).toMatch(/50-day|MA|pullback|above/i);
  });

  it('warns about low float when shares outstanding < 20M', () => {
    const q = mkQuote({ sharesOutstanding: 8_000_000 });
    const partial = runScoringEngine('TEST', q, mkProfile(), null, []);
    const verdict = buildVerdict(partial, q, mkProfile(), []);
    const combined = verdict.verdictWatch.join(' ');
    expect(combined).toMatch(/float|limit order|shares/i);
  });

  it('warns about extreme ATR for volatile stocks', () => {
    const q = mkQuote({ price: 100, dayHigh: 130, dayLow: 75 }); // ATR% = 55%
    const partial = runScoringEngine('TEST', q, mkProfile(), null, []);
    const verdict = buildVerdict(partial, q, mkProfile(), []);
    const combined = verdict.verdictWatch.join(' ');
    expect(combined).toMatch(/range|spread|ATR|tighten/i);
  });

  it('penny stock with no earnings triggers speculative warning', () => {
    const q = mkQuote({ price: 0.80, eps: null, marketCap: 5_000_000 });
    const p = mkProfile({ mktCap: 5_000_000 });
    const partial = runScoringEngine('SPEC', q, p, null, []);
    const verdict = buildVerdict(partial, q, p, []);
    const combined = verdict.verdictWatch.join(' ');
    expect(combined).toMatch(/speculative|earnings|lose/i);
  });

  it('returns at most 5 conditions', () => {
    const q = mkQuote({ price: 0.04, eps: null, marketCap: 500_000, sharesOutstanding: 800_000_000, dayHigh: 0.07, dayLow: 0.02 });
    const partial = runScoringEngine('DOOM', q, mkProfile({ beta: 6.0 }), null, []);
    const verdict = buildVerdict(partial, q, mkProfile({ beta: 6.0 }), []);
    expect(verdict.verdictWatch.length).toBeLessThanOrEqual(5);
  });
});
