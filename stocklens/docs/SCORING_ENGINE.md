# Scoring Engine Deep Dive

The scoring engine is the intellectual core of StockLens. It lives entirely in `src/lib/scoring/` and is a pure-function pipeline — same inputs always produce the same output, with no side effects.

---

## Entry Point

```typescript
// src/lib/scoring/engine.ts
runScoringEngine(ticker, quote, profile, ratios, history)
  → Omit<ScoringResult, 'verdictBand' | 'verdictWhy' | 'verdictWatch'>

// src/lib/scoring/verdict.ts
buildVerdict(partialResult, quote, profile, history)
  → Pick<ScoringResult, 'verdictBand' | 'verdictWhy' | 'verdictWatch'>
```

The route handler combines both:
```typescript
const partial = runScoringEngine(...)
const verdict = buildVerdict(partial, ...)
const scoringResult = { ...partial, ...verdict }
```

---

## Step 1: Regime Detection

```typescript
function detectRegime(price: number | null, marketCap: number | null): StockRegime
```

| Condition | Regime | Effect |
|-----------|--------|--------|
| price ≤ $5 | `penny` | Stricter ATR thresholds, stronger EPS penalty, dilution checks |
| mktCap < $2B | `small-cap` | Normal thresholds |
| mktCap < $10B | `mid-cap` | Normal thresholds |
| mktCap ≥ $10B | `large-cap` | Normal thresholds |
| price > $5, mktCap null | `small-cap` | Default fallback |

The penny regime check runs BEFORE market cap — a $500M company trading at $2 is `penny`, not `small-cap`.

---

## Step 2: The Six Metric Scorers

### Liquidity (weight: 22%)

**Why 22%:** Liquidity is the most immediately impactful risk factor for an active trader. An illiquid stock can gap massively on exit regardless of fundamentals.

**Inputs:** `quote.price`, `quote.volume`, `quote.avgVolume`

**Algorithm:**
```
dollarVol = price × avgVolume
dollarVolScore = bracket lookup against regime thresholds (penny vs normal)
relVol = volume / avgVolume
relVolModifier = +15 if relVol ≥ 3×, 0 if normal, -15 if relVol < 0.3×
score = clamp(dollarVolScore + relVolModifier)
```

**Key thresholds (configurable in `config.ts`):**

| Dollar Volume | Penny Score | Normal Score |
|--------------|-------------|---------------|
| ≥ $2M / ≥ $100M | 100 | 100 |
| ≥ $500K / ≥ $20M | 75 | 75 |
| ≥ $100K / ≥ $5M | 50 | 50 |
| ≥ $10K / ≥ $1M | 25 | 25 |
| Below | 5 | 10 |

---

### Volatility (weight: 20%)

**Inputs:** `quote.dayHigh`, `quote.dayLow`, `quote.price`, `quote.yearHigh`, `quote.yearLow`, `profile.beta`

**Algorithm:**
```
atrPct = (dayHigh - dayLow) / price × 100
atrScore = bracket lookup against regime ATR thresholds
betaScore = 100 if |beta| ≤ 0.8, 75 if ≤ 1.5, 45 if ≤ 2.5, else 20
posScore = 80 if 52wk position in [35%, 75%], 40 if > 90% (near high), 30 if < 15% (near low)
score = round(atrScore × 0.5 + betaScore × 0.3 + posScore × 0.2)
```

**Why ATR gets 50% of this score:** It reflects actual intraday risk right now. Beta is backward-looking; position in range is contextual.

---

### Float & Size (weight: 15%)

**Inputs:** `quote.marketCap`, `profile.mktCap`, `quote.sharesOutstanding`

**Algorithm:**
```
mktCapScore = bracket lookup (see FLOAT_SIZE.marketCap thresholds)
floatPenalty = 25 if sharesOutstanding < 20M (low float → extreme volatility)
            + 20 if penny regime AND sharesOutstanding > 500M (dilution risk)
score = clamp(mktCapScore - floatPenalty)
```

**Low float flag:** Stocks with < 20M shares are flagged with a 25-point penalty AND a watch condition warning about limit orders. This is intentional — low float stocks are legitimate but carry structural volatility that the score must reflect.

---

### Quality / Earnings (weight: 20%)

**Inputs:** `quote.eps`, `quote.pe`, `ratios.netProfitMarginTTM`

**Algorithm:**
```
base = 55
if eps === null:  base -= 15 (normal) or 25 (penny)
if eps > 0:       base += 20
if eps < 0:       base -= 20
if not penny:
  if 5 ≤ pe ≤ 60: base += 10
  if pe > 60:     base -= 10
  if pe < 5:      base -= 8
  if pe < 0:      base -= 15
if penny AND price < 0.50 AND eps null: base -= 10
if margin > 10%:  base += 5
if margin < 0:    base -= 5
score = clamp(base)
```

**Why EPS sign matters more than P/E magnitude:** For the typical user, "is the company making money at all?" is a more actionable signal than the precise valuation multiple.

---

### Valuation & Trend (weight: 13%)

**Inputs:** `quote.priceAvg50`, `quote.priceAvg200`, `quote.changesPercentage`, `history`

**Algorithm:**
```
ma50  = quote.priceAvg50  ?? compute from first 50 items of history
ma200 = quote.priceAvg200 ?? compute from first 200 items of history

base = 55
if |dev50| ≤ 10%:    base += 10  (near MA = neutral = good)
if dev50 > 10%:      base -= round(min(20, dev50) / 2)  (overextended)
if dev50 < -10%:     base -= 8   (below MA)
if price > ma200:    base += 8   (uptrend)
if price < ma200:    base -= 8   (downtrend)
if changesPct > 3%:  base += 5   (positive momentum)
if changesPct < -3%: base -= 5   (negative momentum)
if penny: cap at 70  (valuation metrics less meaningful for sub-$5)
score = clamp(base)
```

**Why only 13% weight:** Trend and valuation are useful context, but they're inherently backward-looking and less reliable for risk assessment than liquidity or earnings quality.

---

### Data Completeness (weight: 10%)

**Inputs:** All fields listed in `COMPLETENESS_FIELDS` in `config.ts`

**Algorithm:**
```
completePct = (totalWeight - missingWeight) / totalWeight × 100
where each field has a weight (e.g. price=15, volume=10, ...)
score = round(completePct)
```

**Critical fields and their weights:**
| Field | Weight | Rationale |
|-------|--------|-----------|
| price | 15 | Without price, nothing works |
| volume | 10 | Core liquidity input |
| avgVolume | 10 | Core liquidity input |
| marketCap | 10 | Regime detection |
| yearHigh / yearLow | 8 each | Volatility calculation |
| eps | 8 | Quality assessment |
| pe | 7 | Valuation |
| beta | 7 | Volatility modifier |
| priceAvg50 / priceAvg200 | 7 / 5 | Trend |
| sharesOutstanding | 5 | Float detection |

---

## Step 3: Confidence Factor Aggregation

```typescript
confidenceFactor = clamp(round(metrics.reduce((sum, m) => sum + m.contribution, 0)))
// where contribution = score × weight for each metric
```

This is a simple weighted average across the 0–100 scale. The `clamp` ensures the final value is always in [0, 100].

---

## Step 4: Verdict Generation (`verdict.ts`)

### Band Selection

```
if penny:  ≥65→"Manageable Risk", ≥45→"High Risk", ≥25→"Very High Risk", else→"Avoid"
if normal: ≥78→"Stable", ≥60→"Reasonable", ≥42→"Caution", ≥25→"High Risk", else→"Avoid"
```

### Driver Sentences

Metrics are sorted by `(weight × 100) - contribution` — the biggest gap between potential contribution and actual contribution surfaces first. The top 3 become the `verdictWhy` sentences, using each metric's `detail` string.

### Watch Conditions

Computed from live numbers — never hardcoded. Each condition is a specific, actionable sentence:

| Trigger | Condition text |
|---------|---------------|
| ATR > 5% | "Intraday spread is X% — wait for range to tighten below Y% before sizing in." |
| Float < 20M shares | "Float is only XM shares — one large order can move price sharply; use limit orders." |
| Price > 15% above 50-day MA | "Trading X% above 50-day MA ($Y) — consider waiting for a pullback toward $Z." |
| Price < 10% above 52-wk low | "Near 52-week low ($Y) — potential value trap; wait for a higher low." |
| Price > 95% of 52-wk high | "Near 52-week high ($Y) — momentum strong but risk of pullback increases." |
| Below 200-day MA | "Below 200-day MA ($Y) — reclaim of that level would signal trend reversal." |
| Rel vol < 40% | "Volume is only X% of average — low participation makes moves unreliable." |
| Penny + null EPS | "No earnings reported — purely speculative. Only enter with amount you can lose entirely." |
| Beta > 2.5 | "Beta X.X — moves X.X× the market. Size positions accordingly." |

---

## Known Engine Characteristics

1. **Large-caps with bad news still score 60–70+** because Liquidity (22%) and Float/Size (15%) score 100 for any billion-dollar company with normal volume. The risk IS surfaced through verdictWatch and Quality score — just not in the final CF. This is intentional: a large-cap is still very tradeable even when earnings disappoint.

2. **GME during the 2021 squeeze scored ~68** despite being a bubble, because $197M daily volume × $347 = $68B daily dollar volume → Liquidity=100. The Watch conditions correctly flagged "ATR 106.7%". The engine is designed this way: CF reflects tradability + quality, not momentum/timing.

3. **AZN (low beta 0.52) consistently scores well on Volatility** even in flat/neutral market phases. This is correct — a low-beta pharmaceutical ADR genuinely IS lower volatility than average.
