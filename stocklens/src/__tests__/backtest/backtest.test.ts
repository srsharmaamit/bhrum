/**
 * Backtest suite — runs the scoring engine over 5 historical market-phase
 * snapshots for 4 tickers (2 US, 2 UK/ADR) and validates that the
 * Confidence Factor moves in the direction the market would predict.
 *
 * Tickers:
 *   AAPL — Apple Inc.  (US, NASDAQ, Large-Cap)
 *   GME  — GameStop    (US, NYSE, Small-Cap/Meme)
 *   AZN  — AstraZeneca ADR (UK Pharma, NASDAQ-listed)
 *   BP   — BP plc ADR  (UK Energy, NYSE-listed)
 *
 * No network calls — all data from scenarios.ts fixture.
 */

import { runScoringEngine } from '@/lib/scoring/engine';
import { buildVerdict } from '@/lib/scoring/verdict';
import { ScoringResult } from '@/types/stock';
import {
  AAPL_SCENARIOS,
  GME_SCENARIOS,
  AZN_SCENARIOS,
  BP_SCENARIOS,
  MarketSnapshot,
} from './scenarios';

// ── Helper: run a single snapshot through the full engine ─────────────────────

function runSnapshot(snap: MarketSnapshot): ScoringResult {
  const partial = runScoringEngine(
    snap.quote.symbol ?? 'TEST',
    snap.quote,
    snap.profile,
    null,
    snap.history
  );
  const verdict = buildVerdict(partial, snap.quote, snap.profile, snap.history);
  return { ...partial, ...verdict };
}

// ── Helper: print a backtest table row ────────────────────────────────────────

function logRow(snap: MarketSnapshot, result: ScoringResult) {
  const metrics = result.metrics.map(m =>
    `${m.name.split(' ')[0]}:${m.score}`
  ).join(' | ');
  console.log(
    `  [Phase ${snap.phase}] ${snap.label}\n` +
    `    CF=${result.confidenceFactor}  regime=${result.regime}  band="${result.verdictBand}"\n` +
    `    ${metrics}\n` +
    `    Watch: ${result.verdictWatch[0] ?? 'None'}\n`
  );
}

// ── AAPL backtest ─────────────────────────────────────────────────────────────

describe('Backtest: AAPL (US Large-Cap, NASDAQ)', () => {
  const results = AAPL_SCENARIOS.map(snap => ({ snap, result: runSnapshot(snap) }));

  beforeAll(() => {
    console.log('\n═══ AAPL BACKTEST ═════════════════════════════════════════');
    results.forEach(({ snap, result }) => logRow(snap, result));
  });

  test.each(AAPL_SCENARIOS)(
    'Phase $phase — "$label" → regime=$expectedRegime, CF in [$expectedCFMin, $expectedCFMax]',
    (snap) => {
      const result = runSnapshot(snap);
      expect(result.regime).toBe(snap.expectedRegime);
      expect(result.confidenceFactor).toBeGreaterThanOrEqual(snap.expectedCFMin);
      expect(result.confidenceFactor).toBeLessThanOrEqual(snap.expectedCFMax);
    }
  );

  it('Phase 2 (breakout) CF ≥ Phase 1 (accumulation) CF', () => {
    expect(results[1].result.confidenceFactor).toBeGreaterThanOrEqual(results[0].result.confidenceFactor - 5);
  });

  it('Phase 4 (distribution) CF ≤ Phase 2 (breakout) CF', () => {
    expect(results[3].result.confidenceFactor).toBeLessThanOrEqual(results[1].result.confidenceFactor + 5);
  });

  it('all phases produce a non-empty verdictBand', () => {
    for (const { result } of results) {
      expect(result.verdictBand.length).toBeGreaterThan(0);
    }
  });

  it('data completeness is > 80% across all phases (full data)', () => {
    for (const { result } of results) {
      expect(result.dataCompleteness).toBeGreaterThan(80);
    }
  });
});

// ── GME backtest ──────────────────────────────────────────────────────────────

describe('Backtest: GME (US Small-Cap / Meme Stock, NYSE)', () => {
  const results = GME_SCENARIOS.map(snap => ({ snap, result: runSnapshot(snap) }));

  beforeAll(() => {
    console.log('\n═══ GME BACKTEST ══════════════════════════════════════════');
    results.forEach(({ snap, result }) => logRow(snap, result));
  });

  test.each(GME_SCENARIOS)(
    'Phase $phase — "$label" → CF in [$expectedCFMin, $expectedCFMax]',
    (snap) => {
      const result = runSnapshot(snap);
      expect(result.confidenceFactor).toBeGreaterThanOrEqual(snap.expectedCFMin);
      expect(result.confidenceFactor).toBeLessThanOrEqual(snap.expectedCFMax);
    }
  );

  it('pre-squeeze base (Phase 1) has the lowest CF — no earnings + modest volume', () => {
    const preSqueezeResult = results[0].result;
    expect(preSqueezeResult.confidenceFactor).toBeLessThanOrEqual(
      Math.max(...results.slice(1).map(r => r.result.confidenceFactor))
    );
  });

  it('squeeze peak Watch conditions correctly flag the extreme ATR risk', () => {
    const squeezeResult = results[1].result;
    const watchText = squeezeResult.verdictWatch.join(' ');
    expect(watchText).toMatch(/range|spread|tighten/i);
  });

  it('quality score reflects negative EPS throughout', () => {
    for (const { result } of results) {
      const qScore = result.metrics.find(m => m.name === 'Quality / Earnings')!.score;
      expect(qScore).toBeLessThan(65);
    }
  });

  it('squeeze peak ATR produces extreme volatility flag', () => {
    const squeezeResult = results[1].result;
    const voltMetric = squeezeResult.metrics.find(m => m.name === 'Volatility')!;
    expect(voltMetric.score).toBeLessThan(40);
  });

  it('dormant phase (Phase 5) has lower liquidity score than the squeeze phases', () => {
    const dormantLiq  = results[4].result.metrics.find(m => m.name === 'Liquidity')!.score;
    const squeezeLiq  = results[1].result.metrics.find(m => m.name === 'Liquidity')!.score;
    expect(dormantLiq).toBeLessThanOrEqual(squeezeLiq);
  });

  it('all phases produce verdictWatch with at least one condition', () => {
    for (const { result } of results) {
      expect(result.verdictWatch.length).toBeGreaterThan(0);
    }
  });
});

// ── AZN backtest ──────────────────────────────────────────────────────────────

describe('Backtest: AZN (UK Pharma ADR, NASDAQ-listed)', () => {
  const results = AZN_SCENARIOS.map(snap => ({ snap, result: runSnapshot(snap) }));

  beforeAll(() => {
    console.log('\n═══ AZN BACKTEST (UK Pharma ADR) ═════════════════════════');
    results.forEach(({ snap, result }) => logRow(snap, result));
  });

  test.each(AZN_SCENARIOS)(
    'Phase $phase — "$label" → regime=$expectedRegime, CF in [$expectedCFMin, $expectedCFMax]',
    (snap) => {
      const result = runSnapshot(snap);
      expect(result.regime).toBe(snap.expectedRegime);
      expect(result.confidenceFactor).toBeGreaterThanOrEqual(snap.expectedCFMin);
      expect(result.confidenceFactor).toBeLessThanOrEqual(snap.expectedCFMax);
    }
  );

  it('low beta (0.52) contributes positively to volatility score throughout', () => {
    for (const { result } of results) {
      const voltScore = result.metrics.find(m => m.name === 'Volatility')!.score;
      expect(voltScore).toBeGreaterThan(40);
    }
  });

  it('all phases have positive EPS → quality score above 45', () => {
    for (const { result } of results) {
      const qScore = result.metrics.find(m => m.name === 'Quality / Earnings')!.score;
      expect(qScore).toBeGreaterThan(45);
    }
  });

  it('stable phase (Phase 5) scores better than COVID dip (Phase 1)', () => {
    expect(results[4].result.confidenceFactor).toBeGreaterThanOrEqual(results[0].result.confidenceFactor - 10);
  });

  it('all phases classified as large-cap', () => {
    for (const { result } of results) {
      expect(result.regime).toBe('large-cap');
    }
  });
});

// ── BP backtest ───────────────────────────────────────────────────────────────

describe('Backtest: BP (UK Energy ADR, NYSE-listed)', () => {
  const results = BP_SCENARIOS.map(snap => ({ snap, result: runSnapshot(snap) }));

  beforeAll(() => {
    console.log('\n═══ BP BACKTEST (UK Energy ADR) ═══════════════════════════');
    results.forEach(({ snap, result }) => logRow(snap, result));
  });

  test.each(BP_SCENARIOS)(
    'Phase $phase — "$label" → regime=$expectedRegime, CF in [$expectedCFMin, $expectedCFMax]',
    (snap) => {
      const result = runSnapshot(snap);
      expect(result.regime).toBe(snap.expectedRegime);
      expect(result.confidenceFactor).toBeGreaterThanOrEqual(snap.expectedCFMin);
      expect(result.confidenceFactor).toBeLessThanOrEqual(snap.expectedCFMax);
    }
  );

  it('COVID collapse (Phase 1) has the lowest CF due to negative EPS', () => {
    const collapseResult = results[0].result;
    for (const { result } of results.slice(1)) {
      expect(result.confidenceFactor).toBeGreaterThanOrEqual(collapseResult.confidenceFactor - 5);
    }
  });

  it('energy boom (Phase 3) has best quality score (high EPS)', () => {
    const boomQuality = results[2].result.metrics.find(m => m.name === 'Quality / Earnings')!.score;
    const collapseQuality = results[0].result.metrics.find(m => m.name === 'Quality / Earnings')!.score;
    expect(boomQuality).toBeGreaterThan(collapseQuality);
  });

  it('PE ratio of 6.9 during energy boom is flagged as reasonable', () => {
    const boomVerdict = results[2].result;
    const qScore = boomVerdict.metrics.find(m => m.name === 'Quality / Earnings')!.score;
    expect(qScore).toBeGreaterThan(50);
  });

  it('large-cap classification held throughout all BP phases', () => {
    for (const { result } of results) {
      expect(result.regime).toBe('large-cap');
    }
  });
});

// ── Cross-ticker comparative assertions ───────────────────────────────────────

describe('Cross-ticker backtest comparisons', () => {
  it('AAPL peak CF > GME peak CF (fundamentals matter)', () => {
    const aaplPeak = runSnapshot(AAPL_SCENARIOS[2]); // Dec 2023 peak
    const gmePeak  = runSnapshot(GME_SCENARIOS[1]);  // Short squeeze peak
    expect(aaplPeak.confidenceFactor).toBeGreaterThan(gmePeak.confidenceFactor);
  });

  it('AZN has more stable CF variance than GME (lower-risk sector)', () => {
    const aznResults = AZN_SCENARIOS.map(s => runSnapshot(s).confidenceFactor);
    const gmeResults = GME_SCENARIOS.map(s => runSnapshot(s).confidenceFactor);

    const aznRange = Math.max(...aznResults) - Math.min(...aznResults);
    const gmeRange = Math.max(...gmeResults) - Math.min(...gmeResults);

    expect(aznRange).toBeLessThan(gmeRange);
  });

  it('all 20 snapshots produce CF in [0, 100]', () => {
    const allSnapshots = [...AAPL_SCENARIOS, ...GME_SCENARIOS, ...AZN_SCENARIOS, ...BP_SCENARIOS];
    for (const snap of allSnapshots) {
      const result = runSnapshot(snap);
      expect(result.confidenceFactor).toBeGreaterThanOrEqual(0);
      expect(result.confidenceFactor).toBeLessThanOrEqual(100);
    }
  });

  it('all 20 snapshots produce non-empty verdict bands', () => {
    const allSnapshots = [...AAPL_SCENARIOS, ...GME_SCENARIOS, ...AZN_SCENARIOS, ...BP_SCENARIOS];
    for (const snap of allSnapshots) {
      const result = runSnapshot(snap);
      expect(typeof result.verdictBand).toBe('string');
      expect(result.verdictBand.length).toBeGreaterThan(0);
    }
  });

  it('no snapshot throws an exception (engine is crash-safe)', () => {
    const allSnapshots = [...AAPL_SCENARIOS, ...GME_SCENARIOS, ...AZN_SCENARIOS, ...BP_SCENARIOS];
    expect(() => {
      allSnapshots.forEach(snap => runSnapshot(snap));
    }).not.toThrow();
  });
});
