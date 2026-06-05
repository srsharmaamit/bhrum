// ── StockLens Scoring Configuration ───────────────────────────────────────────────────────────────────────
// Edit this file to tune weights and thresholds without touching engine logic.
// All weights must sum to 1.0 across the six metric groups.

export const WEIGHTS = {
  liquidity:    0.22,  // avg dollar volume + relative volume
  volatility:   0.20,  // ATR%, beta, 52-week position
  floatSize:    0.15,  // float shares, market cap category
  quality:      0.20,  // EPS sign, dilution risk, data quality
  valuation:    0.13,  // P/E sanity, price vs 50/200 MA, momentum
  completeness: 0.10,  // penalise heavily missing critical fields
} as const;

// ── Regime thresholds ───────────────────────────────────────────────────────────────────────────
// Regime is auto-detected from price + market cap + exchange.
export const REGIME = {
  pennyMaxPrice: 5,          // ≤ $5 → penny regime
  smallCapMaxMktCap: 2e9,    // ≤ $2B → small-cap
  midCapMaxMktCap: 10e9,     // ≤ $10B → mid-cap
  // > $10B → large-cap
} as const;

// ── Liquidity thresholds (average daily dollar volume) ──────────────────────────────────────────
export const LIQUIDITY = {
  penny: {
    dollarVolExcellent: 2_000_000,   // ≥ $2M/day → 100
    dollarVolGood:        500_000,   // ≥ $500K → 75
    dollarVolFair:        100_000,   // ≥ $100K → 50
    dollarVolPoor:         10_000,   // ≥ $10K  → 25; below → 5
  },
  normal: {
    dollarVolExcellent: 100_000_000, // ≥ $100M/day → 100
    dollarVolGood:       20_000_000, // ≥ $20M  → 75
    dollarVolFair:        5_000_000, // ≥ $5M   → 50
    dollarVolPoor:        1_000_000, // ≥ $1M   → 25; below → 10
  },
  // Relative volume scoring (today vol / avgVol)
  relVol: {
    high:   3.0,   // → score boost +15
    normal: 1.0,   // baseline 0
    low:    0.3,   // → score penalty -15
  },
} as const;

// ── Volatility thresholds (ATR% = daily range / price × 100) ───────────────────────────────────
export const VOLATILITY = {
  penny: {
    atrGood:     5,   // ≤ 5% → 100
    atrFair:    15,   // ≤ 15% → 65
    atrHigh:    30,   // ≤ 30% → 35
    // above 30% → 10
  },
  normal: {
    atrGood:     2,   // ≤ 2% → 100
    atrFair:     5,   // ≤ 5% → 70
    atrHigh:    10,   // ≤ 10% → 40
    // above 10% → 15
  },
  beta: {
    low:    0.8,   // ≤ 0.8  → 100
    medium: 1.5,   // ≤ 1.5  → 75
    high:   2.5,   // ≤ 2.5  → 45
    // above 2.5 → 20
  },
} as const;

// ── Float & size thresholds ─────────────────────────────────────────────────────────────────────────────
export const FLOAT_SIZE = {
  floatDangerShares: 20_000_000,     // < 20M float → high-volatility flag
  floatGoodShares:  100_000_000,     // ≥ 100M → fully liquid
  marketCap: {
    largeCap:    10e9,    // ≥ $10B   → 100
    midCap:       2e9,    // ≥ $2B    → 85
    smallCap:   300e6,    // ≥ $300M  → 65
    microCap:    50e6,    // ≥ $50M   → 40
    nanoCap:     10e6,    // ≥ $10M   → 25
    // < $10M                         → 10
  },
  // Penny-regime dilution: shares outstanding relative to float
  dilutionWarningShares: 500_000_000, // > 500M shares outstanding for sub-$1 → danger
} as const;

// ── Quality / earnings thresholds ──────────────────────────────────────────────────────────────────────
export const QUALITY = {
  epsPositiveBonus:  20,  // EPS > 0 → bonus points
  epsNegativePenalty: 20, // EPS < 0 → penalty
  noEpsPenaltyPenny: 25,  // null EPS for penny stock → higher penalty
  // PE sanity (normal regime only)
  peSaneLow:   5,    // PE < 5  → possibly distressed or value trap
  peSaneHigh: 60,    // PE > 60 → expensive growth premium
  peIdeal:    20,    // PE near 20 → most neutral score
} as const;

// ── Valuation / trend thresholds ──────────────────────────────────────────────────────────────────────
export const VALUATION = {
  ma50DevPct:  10,  // ±10% from 50-day MA → neutral zone
  ma200DevPct: 20,  // ±20% from 200-day MA → neutral zone
  // Momentum: 1-day % change
  momentumBullish:  3,   // > +3% → mild positive signal
  momentumBearish: -3,   // < -3% → mild negative signal
} as const;

// ── Completeness field weights ───────────────────────────────────────────────────────────────────────────
// Each field that is null/undefined subtracts its weight from completeness score.
export const COMPLETENESS_FIELDS: { field: string; weight: number }[] = [
  { field: 'price',           weight: 15 },
  { field: 'volume',          weight: 10 },
  { field: 'avgVolume',       weight: 10 },
  { field: 'marketCap',       weight: 10 },
  { field: 'yearHigh',        weight: 8  },
  { field: 'yearLow',         weight: 8  },
  { field: 'eps',             weight: 8  },
  { field: 'pe',              weight: 7  },
  { field: 'beta',            weight: 7  },
  { field: 'priceAvg50',      weight: 7  },
  { field: 'priceAvg200',     weight: 5  },
  { field: 'sharesOutstanding', weight: 5 },
];
