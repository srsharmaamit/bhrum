import {
  FMPQuote,
  FMPProfile,
  FMPRatiosTTM,
  FMPHistoricalPrice,
  MetricFlag,
  MetricScore,
  ScoringResult,
  StockRegime,
} from '@/types/stock';
import {
  WEIGHTS,
  REGIME,
  LIQUIDITY,
  VOLATILITY,
  FLOAT_SIZE,
  QUALITY,
  VALUATION,
  COMPLETENESS_FIELDS,
} from './config';

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function flag(score: number): MetricFlag {
  if (score >= 70) return 'good';
  if (score >= 45) return 'neutral';
  if (score >= 25) return 'warning';
  return 'danger';
}

function movingAverage(history: FMPHistoricalPrice[], days: number): number | null {
  if (history.length < days) return null;
  const slice = history.slice(0, days);
  return slice.reduce((s, p) => s + p.close, 0) / days;
}

// ── Regime detection ─────────────────────────────────────────────────────────

export function detectRegime(
  price: number | null,
  marketCap: number | null
): StockRegime {
  if (!price) return 'small-cap';
  if (price <= REGIME.pennyMaxPrice) return 'penny';
  if (!marketCap) return 'small-cap';
  if (marketCap >= REGIME.midCapMaxMktCap) return 'large-cap';
  if (marketCap >= REGIME.smallCapMaxMktCap) return 'mid-cap';
  return 'small-cap';
}

// ── Individual metric scorers ─────────────────────────────────────────────────

function scoreLiquidity(
  quote: Partial<FMPQuote>,
  regime: StockRegime
): MetricScore {
  const price = quote.price ?? 0;
  const vol = quote.volume ?? 0;
  const avgVol = quote.avgVolume ?? 0;

  const dollarVol = price * avgVol;
  const relVol = avgVol > 0 ? vol / avgVol : 0;

  const thresholds = regime === 'penny' ? LIQUIDITY.penny : LIQUIDITY.normal;

  let dollarVolScore: number;
  if (dollarVol >= thresholds.dollarVolExcellent) dollarVolScore = 100;
  else if (dollarVol >= thresholds.dollarVolGood)  dollarVolScore = 75;
  else if (dollarVol >= thresholds.dollarVolFair)  dollarVolScore = 50;
  else if (dollarVol >= thresholds.dollarVolPoor)  dollarVolScore = 25;
  else dollarVolScore = regime === 'penny' ? 5 : 10;

  // Relative volume modifier (±15 pts)
  let relVolMod = 0;
  if (relVol >= LIQUIDITY.relVol.high) relVolMod = 15;
  else if (relVol >= LIQUIDITY.relVol.normal) relVolMod = 0;
  else if (relVol < LIQUIDITY.relVol.low) relVolMod = -15;

  const score = clamp(dollarVolScore + relVolMod);

  const dollarVolFmt = dollarVol >= 1e9
    ? `$${(dollarVol / 1e9).toFixed(1)}B`
    : dollarVol >= 1e6
    ? `$${(dollarVol / 1e6).toFixed(1)}M`
    : `$${(dollarVol / 1e3).toFixed(0)}K`;

  const relVolFmt = relVol > 0 ? `${relVol.toFixed(2)}×` : 'N/A';

  let detail: string;
  if (avgVol === 0) detail = 'No volume data available.';
  else detail = `Avg daily volume ${dollarVolFmt}, relative vol ${relVolFmt}.`;

  return {
    name: 'Liquidity',
    score,
    weight: WEIGHTS.liquidity,
    contribution: score * WEIGHTS.liquidity,
    label: score >= 70 ? 'Good' : score >= 45 ? 'Fair' : score >= 25 ? 'Thin' : 'Very Thin',
    detail,
    flag: flag(score),
  };
}

function scoreVolatility(
  quote: Partial<FMPQuote>,
  profile: Partial<FMPProfile>,
  regime: StockRegime
): MetricScore {
  const price = quote.price ?? 0;
  const dayHigh = quote.dayHigh ?? price;
  const dayLow = quote.dayLow ?? price;
  const yearHigh = quote.yearHigh ?? price;
  const yearLow = quote.yearLow ?? price;
  const beta = profile.beta ?? quote.pe ?? null; // fallback

  const atrPct = price > 0 ? ((dayHigh - dayLow) / price) * 100 : 0;
  const thresholds = regime === 'penny' ? VOLATILITY.penny : VOLATILITY.normal;

  let atrScore: number;
  if (atrPct <= thresholds.atrGood)  atrScore = 100;
  else if (atrPct <= thresholds.atrFair)  atrScore = 65;
  else if (atrPct <= thresholds.atrHigh)  atrScore = 35;
  else atrScore = 10;

  // Beta component
  let betaScore = 60; // neutral when missing
  if (beta !== null && beta !== undefined) {
    if (Math.abs(beta) <= VOLATILITY.beta.low)   betaScore = 100;
    else if (Math.abs(beta) <= VOLATILITY.beta.medium) betaScore = 75;
    else if (Math.abs(beta) <= VOLATILITY.beta.high)   betaScore = 45;
    else betaScore = 20;
  }

  // 52-week position: penalise stocks near their 52-week high (overbought risk)
  // or at their absolute low (distressed risk). Mid-range is safest.
  let posScore = 60;
  if (yearHigh > yearLow && price > 0) {
    const pos = (price - yearLow) / (yearHigh - yearLow); // 0–1
    if (pos >= 0.35 && pos <= 0.75) posScore = 80;        // healthy middle
    else if (pos > 0.9) posScore = 40;                     // near 52-wk high
    else if (pos < 0.15) posScore = 30;                    // near 52-wk low
    else posScore = 60;
  }

  const score = clamp(Math.round(atrScore * 0.5 + betaScore * 0.3 + posScore * 0.2));

  const betaFmt = profile.beta != null ? profile.beta.toFixed(2) : 'N/A';
  const atrFmt = atrPct.toFixed(1);
  const yrPos = yearHigh > yearLow
    ? Math.round(((price - yearLow) / (yearHigh - yearLow)) * 100)
    : null;

  const detail = `ATR ${atrFmt}%, beta ${betaFmt}` + (yrPos != null ? `, at ${yrPos}% of 52-wk range.` : '.');

  return {
    name: 'Volatility',
    score,
    weight: WEIGHTS.volatility,
    contribution: score * WEIGHTS.volatility,
    label: score >= 70 ? 'Controlled' : score >= 45 ? 'Moderate' : score >= 25 ? 'Elevated' : 'Extreme',
    detail,
    flag: flag(score),
  };
}

function scoreFloatSize(
  quote: Partial<FMPQuote>,
  profile: Partial<FMPProfile>,
  regime: StockRegime
): MetricScore {
  const marketCap = quote.marketCap ?? profile.mktCap ?? null;
  const sharesOut = quote.sharesOutstanding ?? null;

  // Market cap score
  let mktCapScore: number;
  if (!marketCap) {
    mktCapScore = 30; // unknown = penalise
  } else if (marketCap >= FLOAT_SIZE.marketCap.largeCap)  mktCapScore = 100;
  else if (marketCap >= FLOAT_SIZE.marketCap.midCap)  mktCapScore = 85;
  else if (marketCap >= FLOAT_SIZE.marketCap.smallCap)  mktCapScore = 65;
  else if (marketCap >= FLOAT_SIZE.marketCap.microCap)  mktCapScore = 40;
  else if (marketCap >= FLOAT_SIZE.marketCap.nanoCap)  mktCapScore = 25;
  else mktCapScore = 10;

  // Float / dilution penalty
  let floatPenalty = 0;
  if (sharesOut !== null && sharesOut < FLOAT_SIZE.floatDangerShares) {
    // Very low float → extreme volatility risk
    floatPenalty = 25;
  }
  // Penny regime: penalty for ballooning share count
  if (regime === 'penny' && sharesOut !== null && sharesOut > FLOAT_SIZE.dilutionWarningShares) {
    floatPenalty = Math.max(floatPenalty, 20);
  }

  const score = clamp(mktCapScore - floatPenalty);

  const mktCapFmt = !marketCap ? 'N/A'
    : marketCap >= 1e9 ? `$${(marketCap / 1e9).toFixed(1)}B`
    : `$${(marketCap / 1e6).toFixed(0)}M`;

  const sharesFmt = sharesOut
    ? sharesOut >= 1e9
      ? `${(sharesOut / 1e9).toFixed(2)}B shares`
      : `${(sharesOut / 1e6).toFixed(0)}M shares`
    : 'shares N/A';

  const lowFloatNote = sharesOut !== null && sharesOut < FLOAT_SIZE.floatDangerShares
    ? ' Low float (<20M) — extreme volatility risk.'
    : '';

  return {
    name: 'Float & Size',
    score,
    weight: WEIGHTS.floatSize,
    contribution: score * WEIGHTS.floatSize,
    label: score >= 70 ? 'Solid' : score >= 45 ? 'Small' : score >= 25 ? 'Micro' : 'Nano/Unknown',
    detail: `Market cap ${mktCapFmt}, ${sharesFmt}.${lowFloatNote}`,
    flag: flag(score),
  };
}

function scoreQuality(
  quote: Partial<FMPQuote>,
  profile: Partial<FMPProfile>,
  ratios: Partial<FMPRatiosTTM> | null,
  regime: StockRegime
): MetricScore {
  let score = 55; // neutral baseline
  const notes: string[] = [];

  const eps = quote.eps ?? null;
  const pe  = quote.pe ?? ratios?.peRatioTTM ?? null;
  const price = quote.price ?? 0;

  // EPS contribution
  if (eps === null) {
    const penalty = regime === 'penny' ? QUALITY.noEpsPenaltyPenny : 15;
    score -= penalty;
    notes.push('No earnings data.');
  } else if (eps > 0) {
    score += QUALITY.epsPositiveBonus;
    notes.push(`EPS +$${eps.toFixed(2)} (profitable).`);
  } else {
    score -= QUALITY.epsNegativePenalty;
    notes.push(`EPS -$${Math.abs(eps).toFixed(2)} (loss-making).`);
  }

  // P/E sanity check (only meaningful for non-penny regime)
  if (regime !== 'penny' && pe !== null && pe > 0) {
    if (pe >= QUALITY.peSaneLow && pe <= QUALITY.peSaneHigh) {
      score += 10;
      notes.push(`P/E ${pe.toFixed(1)} — reasonable.`);
    } else if (pe > QUALITY.peSaneHigh) {
      score -= 10;
      notes.push(`P/E ${pe.toFixed(1)} — elevated premium.`);
    } else {
      score -= 8;
      notes.push(`P/E ${pe.toFixed(1)} — possibly distressed.`);
    }
  } else if (pe !== null && pe < 0) {
    score -= 15;
    notes.push('Negative P/E — company not yet profitable.');
  }

  // Penny regime: missing fundamentals are a risk signal
  if (regime === 'penny') {
    const hasFundamentals = eps !== null || pe !== null;
    if (!hasFundamentals) {
      notes.push('No fundamental data — treat as speculative.');
    }
    // Extremely low price without earnings = typical pump-and-dump risk
    if (price < 0.5 && eps === null) {
      score -= 10;
      notes.push('Sub-$0.50 with no earnings — extreme caution.');
    }
  }

  // TTM ratios bonus/penalty
  if (ratios?.netProfitMarginTTM != null) {
    if (ratios.netProfitMarginTTM > 0.1) score += 5;
    else if (ratios.netProfitMarginTTM < 0) score -= 5;
  }

  const finalScore = clamp(score);

  return {
    name: 'Quality / Earnings',
    score: finalScore,
    weight: WEIGHTS.quality,
    contribution: finalScore * WEIGHTS.quality,
    label: finalScore >= 70 ? 'Strong' : finalScore >= 45 ? 'Mixed' : finalScore >= 25 ? 'Weak' : 'Speculative',
    detail: notes.join(' ') || 'No earnings signals detected.',
    flag: flag(finalScore),
  };
}

function scoreValuation(
  quote: Partial<FMPQuote>,
  history: FMPHistoricalPrice[],
  regime: StockRegime
): MetricScore {
  const price = quote.price ?? 0;
  const changesPct = quote.changesPercentage ?? 0;

  // Prefer FMP-provided MAs; fall back to computing from history
  let ma50: number | null = quote.priceAvg50 ?? movingAverage(history, 50);
  let ma200: number | null = quote.priceAvg200 ?? movingAverage(history, 200);

  let score = 55;
  const notes: string[] = [];

  // Price vs 50-day MA
  if (ma50 !== null && price > 0) {
    const devPct = ((price - ma50) / ma50) * 100;
    if (Math.abs(devPct) <= VALUATION.ma50DevPct) {
      score += 10;
      notes.push(`Near 50-day MA ($${ma50.toFixed(2)}).`);
    } else if (devPct > VALUATION.ma50DevPct) {
      const overshoot = Math.min(20, Math.round(devPct));
      score -= Math.round(overshoot / 2);
      notes.push(`${devPct.toFixed(0)}% above 50-day MA ($${ma50.toFixed(2)}).`);
    } else {
      score -= 8;
      notes.push(`${Math.abs(devPct).toFixed(0)}% below 50-day MA ($${ma50.toFixed(2)}).`);
    }
  }

  // Price vs 200-day MA (trend direction)
  if (ma200 !== null && price > 0) {
    const devPct = ((price - ma200) / ma200) * 100;
    if (devPct > 0) {
      score += 8; // above long-term MA = uptrend
      notes.push(`Above 200-day MA ($${ma200.toFixed(2)}) — uptrend.`);
    } else {
      score -= 8;
      notes.push(`Below 200-day MA ($${ma200.toFixed(2)}) — downtrend.`);
    }
  }

  // Momentum: 1-day price change
  if (changesPct > VALUATION.momentumBullish) {
    score += 5;
    notes.push(`+${changesPct.toFixed(1)}% today — positive momentum.`);
  } else if (changesPct < VALUATION.momentumBearish) {
    score -= 5;
    notes.push(`${changesPct.toFixed(1)}% today — negative momentum.`);
  }

  // Penny regime: valuation metrics are less meaningful
  if (regime === 'penny' && score > 70) score = 70;

  const finalScore = clamp(score);

  return {
    name: 'Valuation & Trend',
    score: finalScore,
    weight: WEIGHTS.valuation,
    contribution: finalScore * WEIGHTS.valuation,
    label: finalScore >= 70 ? 'Favourable' : finalScore >= 45 ? 'Neutral' : finalScore >= 25 ? 'Stretched' : 'Overbought/Oversold',
    detail: notes.join(' ') || 'Insufficient price history.',
    flag: flag(finalScore),
  };
}

function scoreCompleteness(
  quote: Partial<FMPQuote>,
  profile: Partial<FMPProfile>
): MetricScore {
  const combined = { ...profile, ...quote };
  let totalWeight = 0;
  let missingWeight = 0;

  for (const { field, weight } of COMPLETENESS_FIELDS) {
    totalWeight += weight;
    const val = (combined as Record<string, unknown>)[field];
    if (val === null || val === undefined || val === 0) {
      missingWeight += weight;
    }
  }

  const completePct = totalWeight > 0 ? ((totalWeight - missingWeight) / totalWeight) * 100 : 0;
  const score = clamp(Math.round(completePct));

  const missingFields = COMPLETENESS_FIELDS
    .filter(({ field }) => {
      const val = (combined as Record<string, unknown>)[field];
      return val === null || val === undefined || val === 0;
    })
    .map(({ field }) => field);

  const detail = score >= 90
    ? 'All key data fields present.'
    : `Missing: ${missingFields.slice(0, 4).join(', ')}${missingFields.length > 4 ? '...' : ''}.`;

  return {
    name: 'Data Completeness',
    score,
    weight: WEIGHTS.completeness,
    contribution: score * WEIGHTS.completeness,
    label: score >= 85 ? 'Complete' : score >= 60 ? 'Partial' : score >= 35 ? 'Sparse' : 'Very Sparse',
    detail,
    flag: flag(score),
  };
}

// ── Master scorer ─────────────────────────────────────────────────────────────

export function runScoringEngine(
  ticker: string,
  quote: Partial<FMPQuote>,
  profile: Partial<FMPProfile>,
  ratios: Partial<FMPRatiosTTM> | null,
  history: FMPHistoricalPrice[]
): Omit<ScoringResult, 'verdictBand' | 'verdictWhy' | 'verdictWatch'> {
  const price = quote.price ?? profile.price ?? null;
  const marketCap = quote.marketCap ?? profile.mktCap ?? null;

  const regime = detectRegime(price, marketCap);

  const metrics: MetricScore[] = [
    scoreLiquidity(quote, regime),
    scoreVolatility(quote, profile, regime),
    scoreFloatSize(quote, profile, regime),
    scoreQuality(quote, profile, ratios, regime),
    scoreValuation(quote, history, regime),
    scoreCompleteness(quote, profile),
  ];

  const confidenceFactor = clamp(
    Math.round(metrics.reduce((sum, m) => sum + m.contribution, 0))
  );

  const completenessMetric = metrics.find(m => m.name === 'Data Completeness');
  const dataCompleteness = completenessMetric?.score ?? 0;

  return {
    ticker: ticker.toUpperCase(),
    regime,
    confidenceFactor,
    metrics,
    fetchedAt: Date.now(),
    dataCompleteness,
  };
}
