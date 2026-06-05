// Generates plain-English verdict text from scoring results + raw data.
// Watch conditions are computed from live numbers — never hardcoded.

import {
  FMPQuote,
  FMPProfile,
  FMPHistoricalPrice,
  MetricScore,
  ScoringResult,
  StockRegime,
} from '@/types/stock';

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function fmtPrice(n: number): string {
  return n < 10 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

// ── Verdict band ──────────────────────────────────────────────────────────────

function getVerdictBand(score: number, regime: StockRegime): string {
  if (regime === 'penny') {
    if (score >= 65) return 'Speculative — Manageable Risk';
    if (score >= 45) return 'Speculative — High Risk';
    if (score >= 25) return 'Speculative — Very High Risk';
    return 'Extreme Caution — Avoid';
  }
  if (score >= 78) return 'Relatively Stable';
  if (score >= 60) return 'Reasonable Risk / Reward';
  if (score >= 42) return 'Elevated Caution';
  if (score >= 25) return 'High Risk — Tread Carefully';
  return 'Extreme Caution — Avoid';
}

// ── Top driver sentences ──────────────────────────────────────────────────────

function getTopDrivers(metrics: MetricScore[]): string[] {
  // Sort by contribution gap: how far is each metric from its max contribution?
  const sorted = [...metrics].sort(
    (a, b) => (b.weight * 100 - b.contribution) - (a.weight * 100 - a.contribution)
  );

  const drivers: string[] = [];

  for (const m of sorted.slice(0, 3)) {
    if (m.flag === 'danger' || m.flag === 'warning') {
      drivers.push(`${m.name}: ${m.detail}`);
    } else if (m.flag === 'good') {
      drivers.push(`${m.name}: ${m.detail}`);
    } else {
      drivers.push(`${m.name}: ${m.detail}`);
    }
    if (drivers.length >= 3) break;
  }

  return drivers.slice(0, 3);
}

// ── Watch conditions from live numbers ───────────────────────────────────────

function getWatchConditions(
  score: number,
  regime: StockRegime,
  quote: Partial<FMPQuote>,
  profile: Partial<FMPProfile>,
  history: FMPHistoricalPrice[]
): string[] {
  const conditions: string[] = [];
  const price = quote.price ?? 0;
  const ma50 = quote.priceAvg50 ?? computeMA(history, 50);
  const ma200 = quote.priceAvg200 ?? computeMA(history, 200);
  const yearHigh = quote.yearHigh;
  const yearLow = quote.yearLow;
  const volume = quote.volume ?? 0;
  const avgVol = quote.avgVolume ?? 0;
  const eps = quote.eps;
  const marketCap = quote.marketCap ?? profile.mktCap;
  const sharesOut = quote.sharesOutstanding;
  const beta = profile.beta;

  // ATR / spread proxy
  const atrPct = price > 0 ? (((quote.dayHigh ?? price) - (quote.dayLow ?? price)) / price) * 100 : 0;
  if (atrPct > 5) {
    conditions.push(
      `Intraday spread is ${fmt(atrPct, 1)}% — wait for daily range to tighten below ${regime === 'penny' ? '5' : '2'}% before sizing in.`
    );
  }

  // Low float warning
  if (sharesOut !== null && sharesOut !== undefined && sharesOut < 20_000_000) {
    const floatM = (sharesOut / 1e6).toFixed(1);
    conditions.push(
      `Float is only ${floatM}M shares — one large order can move price sharply; use limit orders and small position sizes.`
    );
  }

  // Price vs 50-day MA
  if (ma50 && price > 0) {
    const devPct = ((price - ma50) / ma50) * 100;
    if (devPct > 15) {
      conditions.push(
        `Trading ${fmt(devPct, 0)}% above 50-day MA (${fmtPrice(ma50)}) — consider waiting for a pullback toward ${fmtPrice(ma50 * 1.05)} before entering.`
      );
    } else if (devPct < -15) {
      conditions.push(
        `${fmt(Math.abs(devPct), 0)}% below 50-day MA (${fmtPrice(ma50)}) — confirm stabilisation and watch for a reclaim of ${fmtPrice(ma50)} as a bullish signal.`
      );
    }
  }

  // Price vs 200-day MA
  if (ma200 && price > 0) {
    const devPct = ((price - ma200) / ma200) * 100;
    if (devPct < -10) {
      conditions.push(
        `Below long-term 200-day MA (${fmtPrice(ma200)}) — a sustained reclaim of that level would signal a trend reversal.`
      );
    }
  }

  // 52-week extremes
  if (yearHigh && price > 0) {
    const offHigh = ((yearHigh - price) / yearHigh) * 100;
    if (offHigh < 5) {
      conditions.push(
        `Near 52-week high (${fmtPrice(yearHigh)}) — momentum is strong but risk of a pullback increases at this level.`
      );
    }
  }
  if (yearLow && price > 0) {
    const offLow = ((price - yearLow) / yearLow) * 100;
    if (offLow < 10) {
      conditions.push(
        `Near 52-week low (${fmtPrice(yearLow)}) — potential value trap; wait for a higher low before committing.`
      );
    }
  }

  // Volume / liquidity
  if (avgVol > 0) {
    const relVol = volume / avgVol;
    if (relVol < 0.4) {
      conditions.push(
        `Volume is only ${fmt(relVol * 100, 0)}% of the average — low participation makes large moves unreliable. Watch for volume to confirm any breakout.`
      );
    }
  }

  // Penny regime specific
  if (regime === 'penny') {
    if (eps === null) {
      conditions.push(
        'No earnings reported — treat as purely speculative. Only enter with an amount you are prepared to lose entirely.'
      );
    }
    if (price < 0.01) {
      conditions.push(
        `Sub-penny price ($${price.toFixed(5)}) — these tiers carry the highest manipulation and delisting risk.`
      );
    }
    if (sharesOut && sharesOut > 500_000_000) {
      const billions = (sharesOut / 1e9).toFixed(2);
      conditions.push(
        `${billions}B shares outstanding — high dilution potential. Watch for toxic financing agreements or shelf offerings in SEC filings.`
      );
    }
  }

  // Beta
  if (beta !== null && beta !== undefined && beta > 2.5) {
    conditions.push(
      `Beta ${fmt(beta, 1)} — this stock moves ${fmt(beta, 1)}× the market. Size positions accordingly to manage overnight risk.`
    );
  }

  // High score — positive conditions
  if (score >= 70 && conditions.length === 0) {
    conditions.push(
      'Fundamentals and technicals are broadly aligned. Maintain standard position sizing and monitor for any macro deterioration.'
    );
  }

  return conditions.slice(0, 5);
}

function computeMA(history: FMPHistoricalPrice[], days: number): number | null {
  if (history.length < days) return null;
  const slice = history.slice(0, days);
  return slice.reduce((s, p) => s + p.close, 0) / days;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildVerdict(
  partialResult: Omit<ScoringResult, 'verdictBand' | 'verdictWhy' | 'verdictWatch'>,
  quote: Partial<FMPQuote>,
  profile: Partial<FMPProfile>,
  history: FMPHistoricalPrice[]
): Pick<ScoringResult, 'verdictBand' | 'verdictWhy' | 'verdictWatch'> {
  const { confidenceFactor, regime, metrics } = partialResult;

  return {
    verdictBand: getVerdictBand(confidenceFactor, regime),
    verdictWhy: getTopDrivers(metrics),
    verdictWatch: getWatchConditions(confidenceFactor, regime, quote, profile, history),
  };
}
