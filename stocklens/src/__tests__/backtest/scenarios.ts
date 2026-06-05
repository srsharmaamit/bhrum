/**
 * Historical market-phase snapshots for the StockLens backtest.
 *
 * Each ticker has 5 snapshots representing real market regimes:
 *  Phase 1 — Accumulation / base-building
 *  Phase 2 — Early breakout / uptrend
 *  Phase 3 — Momentum peak / overextension
 *  Phase 4 — Distribution / reversal
 *  Phase 5 — Downtrend / value zone
 *
 * Data is representative of actual market behaviour — not live FMP data —
 * so tests are deterministic and reproducible without an API key.
 */

import { FMPQuote, FMPProfile, FMPHistoricalPrice } from '@/types/stock';

export interface MarketSnapshot {
  phase: number;
  label: string;
  quote: Partial<FMPQuote>;
  profile: Partial<FMPProfile>;
  history: FMPHistoricalPrice[];
  expectedRegime: string;
  expectedCFMin: number; // CF should be >= this
  expectedCFMax: number; // CF should be <= this
}

// ── Shared profile builders ───────────────────────────────────────────────────

const nasdaqProfile = (overrides: Partial<FMPProfile> = {}): Partial<FMPProfile> => ({
  symbol: 'TEST', companyName: 'Test Corp', exchange: 'NASDAQ',
  exchangeShortName: 'NASDAQ', isEtf: false, isFund: false, isAdr: false,
  isActivelyTrading: true, sector: 'Technology', country: 'US', ...overrides,
});

const nyseProfile = (overrides: Partial<FMPProfile> = {}): Partial<FMPProfile> => ({
  ...nasdaqProfile(), exchange: 'NYSE', exchangeShortName: 'NYSE', ...overrides,
});

// Synthetic price history for MA calculation
function makeHistory(finalPrice: number, days: number, trend: 'up' | 'down' | 'flat' = 'up'): FMPHistoricalPrice[] {
  return Array.from({ length: days }, (_, i) => {
    const progress = i / (days - 1);
    let close: number;
    if (trend === 'up')   close = finalPrice * (0.6 + progress * 0.4);
    else if (trend === 'down') close = finalPrice * (1.4 - progress * 0.4);
    else close = finalPrice * (0.95 + Math.sin(progress * Math.PI * 2) * 0.05);
    return { date: `2024-${String(i % 12 + 1).padStart(2, '0')}-01`, close };
  }).reverse();
}

// ── AAPL — Apple Inc. (US, Large-Cap, NASDAQ) ─────────────────────────────────

export const AAPL_SCENARIOS: MarketSnapshot[] = [
  {
    phase: 1, label: 'AAPL — Accumulation (Jan 2023)',
    quote: {
      symbol: 'AAPL', name: 'Apple Inc.', price: 130.73,
      changesPercentage: 0.22, change: 0.29,
      dayHigh: 131.80, dayLow: 128.52,
      yearHigh: 182.94, yearLow: 124.17,
      marketCap: 2_060_000_000_000,
      volume: 70_390_000, avgVolume: 82_000_000,
      priceAvg50: 128.00, priceAvg200: 155.00,
      eps: 5.89, pe: 22.2,
      sharesOutstanding: 15_800_000_000, exchange: 'NASDAQ',
    },
    profile: nasdaqProfile({ symbol: 'AAPL', companyName: 'Apple Inc.', beta: 1.28, mktCap: 2_060_000_000_000, sector: 'Technology' }),
    history: makeHistory(130.73, 200, 'down'),
    expectedRegime: 'large-cap',
    // Below 200-day MA drags Valuation score, but huge Liquidity + Float keep CF high
    expectedCFMin: 75, expectedCFMax: 95,
  },
  {
    phase: 2, label: 'AAPL — Breakout (May 2023)',
    quote: {
      symbol: 'AAPL', name: 'Apple Inc.', price: 173.57,
      changesPercentage: 1.12, change: 1.92,
      dayHigh: 174.35, dayLow: 172.02,
      yearHigh: 182.94, yearLow: 124.17,
      marketCap: 2_740_000_000_000,
      volume: 52_830_000, avgVolume: 65_000_000,
      priceAvg50: 160.00, priceAvg200: 152.00,
      eps: 5.89, pe: 29.5,
      sharesOutstanding: 15_800_000_000, exchange: 'NASDAQ',
    },
    profile: nasdaqProfile({ symbol: 'AAPL', companyName: 'Apple Inc.', beta: 1.28, mktCap: 2_740_000_000_000, sector: 'Technology' }),
    history: makeHistory(173.57, 200, 'up'),
    expectedRegime: 'large-cap',
    // Above both MAs, positive EPS, high volume → strong CF
    expectedCFMin: 82, expectedCFMax: 96,
  },
  {
    phase: 3, label: 'AAPL — Momentum Peak (Dec 2023)',
    quote: {
      symbol: 'AAPL', name: 'Apple Inc.', price: 193.58,
      changesPercentage: 0.45, change: 0.87,
      dayHigh: 194.40, dayLow: 192.30,
      yearHigh: 199.62, yearLow: 124.17,
      marketCap: 3_000_000_000_000,
      volume: 47_150_000, avgVolume: 56_000_000,
      priceAvg50: 181.20, priceAvg200: 165.80,
      eps: 6.43, pe: 30.1,
      sharesOutstanding: 15_550_000_000, exchange: 'NASDAQ',
    },
    profile: nasdaqProfile({ symbol: 'AAPL', companyName: 'Apple Inc.', beta: 1.28, mktCap: 3_000_000_000_000, sector: 'Technology' }),
    history: makeHistory(193.58, 200, 'up'),
    expectedRegime: 'large-cap',
    // Near 52-week high adds watch condition; fundamentals still solid
    expectedCFMin: 82, expectedCFMax: 96,
  },
  {
    phase: 4, label: 'AAPL — Distribution / Pullback (Apr 2024)',
    quote: {
      symbol: 'AAPL', name: 'Apple Inc.', price: 170.89,
      changesPercentage: -1.8, change: -3.14,
      dayHigh: 175.00, dayLow: 169.94,
      yearHigh: 199.62, yearLow: 164.08,
      marketCap: 2_620_000_000_000,
      volume: 68_900_000, avgVolume: 58_000_000,
      priceAvg50: 176.50, priceAvg200: 179.00,
      eps: 6.43, pe: 26.6,
      sharesOutstanding: 15_400_000_000, exchange: 'NASDAQ',
    },
    profile: nasdaqProfile({ symbol: 'AAPL', companyName: 'Apple Inc.', beta: 1.28, mktCap: 2_620_000_000_000, sector: 'Technology' }),
    history: makeHistory(170.89, 200, 'down'),
    expectedRegime: 'large-cap',
    // Below 50/200-day MA pulls Valuation down; EPS/Liquidity still solid
    expectedCFMin: 78, expectedCFMax: 95,
  },
  {
    phase: 5, label: 'AAPL — Recovery Base (Jun 2024)',
    quote: {
      symbol: 'AAPL', name: 'Apple Inc.', price: 185.55,
      changesPercentage: 0.73, change: 1.34,
      dayHigh: 186.02, dayLow: 184.10,
      yearHigh: 199.62, yearLow: 164.08,
      marketCap: 2_860_000_000_000,
      volume: 60_100_000, avgVolume: 57_000_000,
      priceAvg50: 178.00, priceAvg200: 181.00,
      eps: 6.43, pe: 28.9,
      sharesOutstanding: 15_350_000_000, exchange: 'NASDAQ',
    },
    profile: nasdaqProfile({ symbol: 'AAPL', companyName: 'Apple Inc.', beta: 1.28, mktCap: 2_860_000_000_000, sector: 'Technology' }),
    history: makeHistory(185.55, 200, 'up'),
    expectedRegime: 'large-cap',
    // Recovery above MAs, strong EPS → high stable CF
    expectedCFMin: 84, expectedCFMax: 97,
  },
];

// ── GME — GameStop Corp. (US, Meme Stock, NYSE) ───────────────────────────────

export const GME_SCENARIOS: MarketSnapshot[] = [
  {
    phase: 1, label: 'GME — Pre-Squeeze Base (Dec 2020)',
    quote: {
      symbol: 'GME', name: 'GameStop Corp.', price: 18.84,
      changesPercentage: 0.85, change: 0.16,
      dayHigh: 19.50, dayLow: 18.10,
      yearHigh: 20.92, yearLow: 2.57,
      marketCap: 1_320_000_000,
      volume: 8_500_000, avgVolume: 5_000_000,
      priceAvg50: 12.00, priceAvg200: 6.00,
      eps: -2.80, pe: null,
      sharesOutstanding: 70_000_000, exchange: 'NYSE',
    },
    profile: nyseProfile({ symbol: 'GME', companyName: 'GameStop Corp.', beta: 2.1, mktCap: 1_320_000_000, sector: 'Consumer Cyclical' }),
    history: makeHistory(18.84, 200, 'up'),
    expectedRegime: 'small-cap',
    // No earnings, moderate volume, high ATR: speculative
    expectedCFMin: 45, expectedCFMax: 72,
  },
  {
    phase: 2, label: 'GME — Short Squeeze Peak (Jan 2021)',
    quote: {
      symbol: 'GME', name: 'GameStop Corp.', price: 347.51,
      changesPercentage: 134.84, change: 196.60,
      dayHigh: 483.00, dayLow: 112.25,
      yearHigh: 483.00, yearLow: 2.57,
      marketCap: 24_000_000_000,
      volume: 197_000_000, avgVolume: 30_000_000,
      priceAvg50: 42.00, priceAvg200: 12.00,
      eps: -2.80, pe: null,
      sharesOutstanding: 70_000_000, exchange: 'NYSE',
    },
    profile: nyseProfile({ symbol: 'GME', companyName: 'GameStop Corp.', beta: 2.1, mktCap: 24_000_000_000, sector: 'Consumer Cyclical' }),
    history: makeHistory(347.51, 200, 'up'),
    expectedRegime: 'mid-cap',
    // IMPORTANT: CF is moderate (not extreme-low) because Liquidity=100 ($197M vol × $347)
    // The engine CORRECTLY flags the risk via verdictWatch (ATR=107%), not by suppressing CF alone.
    expectedCFMin: 55, expectedCFMax: 80,
  },
  {
    phase: 3, label: 'GME — Post-Squeeze Crash (Feb 2021)',
    quote: {
      symbol: 'GME', name: 'GameStop Corp.', price: 40.59,
      changesPercentage: -60.0, change: -60.85,
      dayHigh: 55.20, dayLow: 38.50,
      yearHigh: 483.00, yearLow: 38.50,
      marketCap: 2_840_000_000,
      volume: 45_000_000, avgVolume: 80_000_000,
      priceAvg50: 150.00, priceAvg200: 30.00,
      eps: -2.80, pe: null,
      sharesOutstanding: 70_000_000, exchange: 'NYSE',
    },
    profile: nyseProfile({ symbol: 'GME', companyName: 'GameStop Corp.', beta: 2.1, mktCap: 2_840_000_000, sector: 'Consumer Cyclical' }),
    history: makeHistory(40.59, 200, 'down'),
    expectedRegime: 'mid-cap',
    // Still high volume post-crash; extreme ATR (41%) tanks Volatility score
    expectedCFMin: 52, expectedCFMax: 75,
  },
  {
    phase: 4, label: 'GME — Second Squeeze Attempt (Jun 2021)',
    quote: {
      symbol: 'GME', name: 'GameStop Corp.', price: 220.39,
      changesPercentage: 25.3, change: 44.45,
      dayHigh: 344.66, dayLow: 145.00,
      yearHigh: 483.00, yearLow: 38.50,
      marketCap: 15_000_000_000,
      volume: 14_000_000, avgVolume: 5_000_000,
      priceAvg50: 160.00, priceAvg200: 85.00,
      eps: -1.10, pe: null,
      sharesOutstanding: 70_000_000, exchange: 'NYSE',
    },
    profile: nyseProfile({ symbol: 'GME', companyName: 'GameStop Corp.', beta: 2.1, mktCap: 15_000_000_000, sector: 'Consumer Cyclical' }),
    history: makeHistory(220.39, 200, 'up'),
    expectedRegime: 'large-cap',
    // Volume spike + large temp mktcap boosts CF; ATR=91% is flagged in Watch conditions
    expectedCFMin: 58, expectedCFMax: 80,
  },
  {
    phase: 5, label: 'GME — Dormant / Sideways (Dec 2023)',
    quote: {
      symbol: 'GME', name: 'GameStop Corp.', price: 14.45,
      changesPercentage: -1.1, change: -0.16,
      dayHigh: 14.98, dayLow: 14.22,
      yearHigh: 27.65, yearLow: 9.95,
      marketCap: 4_200_000_000,
      volume: 2_100_000, avgVolume: 4_000_000,
      priceAvg50: 14.20, priceAvg200: 16.80,
      eps: -0.18, pe: null,
      sharesOutstanding: 290_000_000, exchange: 'NYSE',
    },
    profile: nyseProfile({ symbol: 'GME', companyName: 'GameStop Corp.', beta: 1.8, mktCap: 4_200_000_000, sector: 'Consumer Cyclical' }),
    history: makeHistory(14.45, 200, 'flat'),
    expectedRegime: 'mid-cap',
    // Below-average volume, no earnings → moderate CF
    expectedCFMin: 52, expectedCFMax: 75,
  },
];

// ── AZN — AstraZeneca ADR (UK Pharma, NASDAQ-listed) ─────────────────────────

export const AZN_SCENARIOS: MarketSnapshot[] = [
  {
    phase: 1, label: 'AZN — COVID Dip & Recovery (Apr 2020)',
    quote: {
      symbol: 'AZN', name: 'AstraZeneca PLC ADR', price: 50.38,
      changesPercentage: 1.02, change: 0.51,
      dayHigh: 51.10, dayLow: 49.62,
      yearHigh: 56.70, yearLow: 36.90,
      marketCap: 78_000_000_000,
      volume: 2_300_000, avgVolume: 1_800_000,
      priceAvg50: 48.00, priceAvg200: 47.00,
      eps: 2.20, pe: 22.9,
      sharesOutstanding: 1_550_000_000, exchange: 'NASDAQ',
    },
    profile: nasdaqProfile({ symbol: 'AZN', companyName: 'AstraZeneca PLC', beta: 0.55, mktCap: 78_000_000_000, sector: 'Healthcare', isAdr: true }),
    history: makeHistory(50.38, 200, 'flat'),
    expectedRegime: 'large-cap',
    // Low beta + positive EPS + large-cap → solid base CF
    expectedCFMin: 78, expectedCFMax: 95,
  },
  {
    phase: 2, label: 'AZN — Vaccine Catalyst Run (Nov 2020)',
    quote: {
      symbol: 'AZN', name: 'AstraZeneca PLC ADR', price: 60.14,
      changesPercentage: 3.2, change: 1.86,
      dayHigh: 61.00, dayLow: 58.80,
      yearHigh: 64.50, yearLow: 36.90,
      marketCap: 94_000_000_000,
      volume: 4_100_000, avgVolume: 2_100_000,
      priceAvg50: 55.00, priceAvg200: 50.00,
      eps: 2.50, pe: 24.1,
      sharesOutstanding: 1_560_000_000, exchange: 'NASDAQ',
    },
    profile: nasdaqProfile({ symbol: 'AZN', companyName: 'AstraZeneca PLC', beta: 0.55, mktCap: 94_000_000_000, sector: 'Healthcare', isAdr: true }),
    history: makeHistory(60.14, 200, 'up'),
    expectedRegime: 'large-cap',
    // Catalyst run above all MAs; volume spike positive
    expectedCFMin: 82, expectedCFMax: 96,
  },
  {
    phase: 3, label: 'AZN — All-Time High (Oct 2021)',
    quote: {
      symbol: 'AZN', name: 'AstraZeneca PLC ADR', price: 71.20,
      changesPercentage: 0.78, change: 0.55,
      dayHigh: 71.90, dayLow: 70.40,
      yearHigh: 72.50, yearLow: 55.00,
      marketCap: 111_000_000_000,
      volume: 1_600_000, avgVolume: 2_000_000,
      priceAvg50: 67.00, priceAvg200: 62.00,
      eps: 3.10, pe: 23.0,
      sharesOutstanding: 1_560_000_000, exchange: 'NASDAQ',
    },
    profile: nasdaqProfile({ symbol: 'AZN', companyName: 'AstraZeneca PLC', beta: 0.55, mktCap: 111_000_000_000, sector: 'Healthcare', isAdr: true }),
    history: makeHistory(71.20, 200, 'up'),
    expectedRegime: 'large-cap',
    // Near ATH + positive EPS → strong CF; Watch flags near 52-week high
    expectedCFMin: 82, expectedCFMax: 96,
  },
  {
    phase: 4, label: 'AZN — Post-ATH Consolidation (Mar 2022)',
    quote: {
      symbol: 'AZN', name: 'AstraZeneca PLC ADR', price: 65.88,
      changesPercentage: -0.45, change: -0.30,
      dayHigh: 67.00, dayLow: 65.50,
      yearHigh: 72.50, yearLow: 55.00,
      marketCap: 103_000_000_000,
      volume: 1_400_000, avgVolume: 1_900_000,
      priceAvg50: 68.50, priceAvg200: 66.00,
      eps: 3.10, pe: 21.2,
      sharesOutstanding: 1_560_000_000, exchange: 'NASDAQ',
    },
    profile: nasdaqProfile({ symbol: 'AZN', companyName: 'AstraZeneca PLC', beta: 0.55, mktCap: 103_000_000_000, sector: 'Healthcare', isAdr: true }),
    history: makeHistory(65.88, 200, 'flat'),
    expectedRegime: 'large-cap',
    // Slightly below 50-day MA; still strong fundamentals
    expectedCFMin: 80, expectedCFMax: 95,
  },
  {
    phase: 5, label: 'AZN — Stable Uptrend (Dec 2023)',
    quote: {
      symbol: 'AZN', name: 'AstraZeneca PLC ADR', price: 73.50,
      changesPercentage: 0.52, change: 0.38,
      dayHigh: 74.10, dayLow: 73.10,
      yearHigh: 78.00, yearLow: 57.00,
      marketCap: 114_000_000_000,
      volume: 1_800_000, avgVolume: 1_700_000,
      priceAvg50: 70.00, priceAvg200: 66.00,
      eps: 3.65, pe: 20.1,
      sharesOutstanding: 1_550_000_000, exchange: 'NASDAQ',
    },
    profile: nasdaqProfile({ symbol: 'AZN', companyName: 'AstraZeneca PLC', beta: 0.52, mktCap: 114_000_000_000, sector: 'Healthcare', isAdr: true }),
    history: makeHistory(73.50, 200, 'up'),
    expectedRegime: 'large-cap',
    // Steady uptrend, positive EPS, low beta → top-tier CF
    expectedCFMin: 85, expectedCFMax: 97,
  },
];

// ── BP — BP plc ADR (UK Energy, NYSE-listed) ──────────────────────────────────

export const BP_SCENARIOS: MarketSnapshot[] = [
  {
    phase: 1, label: 'BP — COVID Collapse (Apr 2020)',
    quote: {
      symbol: 'BP', name: 'BP p.l.c. ADR', price: 20.38,
      changesPercentage: -3.5, change: -0.74,
      dayHigh: 21.45, dayLow: 19.92,
      yearHigh: 41.22, yearLow: 15.32,
      marketCap: 66_000_000_000,
      volume: 25_000_000, avgVolume: 18_000_000,
      priceAvg50: 25.00, priceAvg200: 36.00,
      eps: -5.86, pe: null,
      sharesOutstanding: 3_200_000_000, exchange: 'NYSE',
    },
    profile: nyseProfile({ symbol: 'BP', companyName: 'BP p.l.c.', beta: 0.88, mktCap: 66_000_000_000, sector: 'Energy', isAdr: true }),
    history: makeHistory(20.38, 200, 'down'),
    expectedRegime: 'large-cap',
    // Negative EPS tanks Quality; still large mktcap keeps Liquidity/Float strong
    expectedCFMin: 55, expectedCFMax: 80,
  },
  {
    phase: 2, label: 'BP — Recovery (Sep 2021)',
    quote: {
      symbol: 'BP', name: 'BP p.l.c. ADR', price: 28.45,
      changesPercentage: 1.22, change: 0.34,
      dayHigh: 28.80, dayLow: 27.90,
      yearHigh: 30.00, yearLow: 20.38,
      marketCap: 87_000_000_000,
      volume: 14_000_000, avgVolume: 15_000_000,
      priceAvg50: 27.00, priceAvg200: 25.00,
      eps: 1.05, pe: 27.1,
      sharesOutstanding: 3_100_000_000, exchange: 'NYSE',
    },
    profile: nyseProfile({ symbol: 'BP', companyName: 'BP p.l.c.', beta: 0.88, mktCap: 87_000_000_000, sector: 'Energy', isAdr: true }),
    history: makeHistory(28.45, 200, 'up'),
    expectedRegime: 'large-cap',
    // Resumed profitability + above MAs + high volume → solid recovery
    expectedCFMin: 80, expectedCFMax: 95,
  },
  {
    phase: 3, label: 'BP — Energy Boom Peak (Jun 2022)',
    quote: {
      symbol: 'BP', name: 'BP p.l.c. ADR', price: 36.22,
      changesPercentage: 2.1, change: 0.74,
      dayHigh: 36.90, dayLow: 35.50,
      yearHigh: 37.80, yearLow: 24.90,
      marketCap: 108_000_000_000,
      volume: 22_000_000, avgVolume: 16_000_000,
      priceAvg50: 33.00, priceAvg200: 29.00,
      eps: 5.23, pe: 6.9,
      sharesOutstanding: 2_980_000_000, exchange: 'NYSE',
    },
    profile: nyseProfile({ symbol: 'BP', companyName: 'BP p.l.c.', beta: 0.88, mktCap: 108_000_000_000, sector: 'Energy', isAdr: true }),
    history: makeHistory(36.22, 200, 'up'),
    expectedRegime: 'large-cap',
    // High EPS ($5.23), P/E=6.9 (value territory), strong volume → high CF
    expectedCFMin: 80, expectedCFMax: 95,
  },
  {
    phase: 4, label: 'BP — Post-Ukraine War Reversal (Dec 2022)',
    quote: {
      symbol: 'BP', name: 'BP p.l.c. ADR', price: 30.80,
      changesPercentage: -1.4, change: -0.44,
      dayHigh: 31.50, dayLow: 30.50,
      yearHigh: 37.80, yearLow: 24.90,
      marketCap: 93_000_000_000,
      volume: 12_000_000, avgVolume: 16_000_000,
      priceAvg50: 32.00, priceAvg200: 30.00,
      eps: 5.23, pe: 5.9,
      sharesOutstanding: 3_020_000_000, exchange: 'NYSE',
    },
    profile: nyseProfile({ symbol: 'BP', companyName: 'BP p.l.c.', beta: 0.88, mktCap: 93_000_000_000, sector: 'Energy', isAdr: true }),
    history: makeHistory(30.80, 200, 'down'),
    expectedRegime: 'large-cap',
    // Below 50-day MA but strong EPS; Watch flags downtrend signal
    expectedCFMin: 80, expectedCFMax: 95,
  },
  {
    phase: 5, label: 'BP — Steady Income Phase (Jun 2024)',
    quote: {
      symbol: 'BP', name: 'BP p.l.c. ADR', price: 34.60,
      changesPercentage: 0.29, change: 0.10,
      dayHigh: 34.88, dayLow: 34.20,
      yearHigh: 38.10, yearLow: 29.00,
      marketCap: 102_000_000_000,
      volume: 10_500_000, avgVolume: 14_000_000,
      priceAvg50: 33.50, priceAvg200: 33.00,
      eps: 3.80, pe: 9.1,
      sharesOutstanding: 2_950_000_000, exchange: 'NYSE',
    },
    profile: nyseProfile({ symbol: 'BP', companyName: 'BP p.l.c.', beta: 0.82, mktCap: 102_000_000_000, sector: 'Energy', isAdr: true }),
    history: makeHistory(34.60, 200, 'flat'),
    expectedRegime: 'large-cap',
    // Stable earnings, low ATR, above both MAs → strong CF
    expectedCFMin: 84, expectedCFMax: 97,
  },
];
