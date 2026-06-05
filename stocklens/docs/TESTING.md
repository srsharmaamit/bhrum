# Testing Guide

## Philosophy

StockLens has three test layers. Each one validates something the others can't:

| Layer | What it validates | Speed | Mocks |
|-------|------------------|-------|-------|
| Unit | Scoring logic is mathematically correct | ~0.5s | None |
| Integration | API routes handle requests and errors correctly | ~1s | `fetch` |
| Backtest | Engine produces sensible scores for realistic market conditions | ~1s | None |

**The key insight:** Unit tests verify individual functions. Backtest tests verify that the COMBINATION of weights and thresholds produces scores that align with real-world market intuition across 5 market phases for 4 different stock profiles.

---

## Running Tests

```bash
npm test                  # all 103 tests
npm run test:unit         # 46 tests — run after every scoring change
npm run test:integration  # 14 tests — run after every API route change
npm run test:backtest     # 43 tests — run after any config.ts change
npm run test:coverage     # all tests + lcov report in coverage/
```

---

## Unit Tests (`src/__tests__/unit/`)

### `scoring/engine.test.ts` — 32 tests

Tests the scoring engine as pure functions. No mocks, no network.

Key test groups:
- `detectRegime()` — 6 tests covering all regime transitions and edge cases
- `runScoringEngine — confidence factor range` — 4 tests (always 0–100, quality vs penny)
- `runScoringEngine — metrics structure` — 4 tests (6 metrics, weights sum to 1.0)
- `Liquidity sensitivity` — 2 tests (high vs low volume comparison)
- `Volatility sensitivity` — 1 test (tight range vs wide range)
- `Quality sensitivity` — 2 tests (positive EPS vs negative, penny with/without EPS)
- `Float & Size sensitivity` — 2 tests (large vs nano cap, float penalty)
- `Data Completeness` — 2 tests (full data vs empty data)
- `Valuation & Trend` — 2 tests (near MA vs far above MA, above vs below 200-day)

### `scoring/verdict.test.ts` — 11 tests

Tests the verdict generator. Validates that prose output is contextually correct without exact string matching (the sentences are dynamic).

Key assertions:
- High-quality large-caps get "Stable" or "Reasonable" bands
- Low-scoring penny stocks get "Risk" or "Caution" bands
- Watch conditions mention `50-day MA` when overextended
- Watch conditions mention `float` or `limit order` when float < 20M
- ATR > 50% triggers `range` / `spread` / `tighten` language
- Penny stock with null EPS triggers `speculative` / `earnings` / `lose` language
- Maximum 5 watch conditions even for the worst-case scenario

### `cache.test.ts` — 8 tests

Tests the TTL cache module with real timers.

Key assertions:
- Returns null before TTL expires (`setTimeout(80ms)` with 50ms TTL)
- Does NOT expire before TTL (`setTimeout(50ms)` with 500ms TTL)
- Overwrites on re-set
- All primitive and object types stored correctly

**Note:** Cache tests use real `setTimeout` — they are the only test that involves real waiting. The 80ms wait is intentional and acceptable.

---

## Integration Tests (`src/__tests__/integration/api.test.ts`) — 14 tests

Tests the full API route handlers with `fetch` mocked at the global level.

### Mock Setup

```typescript
const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;
process.env.FMP_API_KEY = 'test-key-integration';

// Import AFTER setting up mocks
import { GET as analyzeGET } from '@/app/api/analyze/route';
import { GET as leaderboardGET } from '@/app/api/leaderboard/route';
import { cacheClear } from '@/lib/cache';
```

**Critical:** The cache is a module-level singleton. Without `cacheClear()` in `beforeEach`, one test's cached FMP response leaks into the next test. This was a real bug found during development.

### `/api/analyze` tests (9)

- 400 for missing ticker param
- 400 for invalid ticker (`!!!BAD!!!`)
- 404 when FMP returns empty arrays
- 200 with correct payload shape for AAPL
- `scoring` has all required fields and correct types
- `confidenceFactor > 55` for a well-formed large-cap
- Graceful handling when profile call returns 500 (still 200 with partial data)
- Ticker normalisation (`aapl` → `AAPL`)
- `penny` regime detection for sub-$5 ticker

### `/api/leaderboard` tests (5)

- 200 with `gainers` and `actives` arrays
- Each item has required fields
- `miniConfidence` is between 10 and 85
- Empty arrays returned gracefully when FMP fails
- Results capped at 10 items per list

---

## Backtest Tests (`src/__tests__/backtest/`)

### Design

The backtest validates the scoring engine against **representative historical market data** (not live data). Scenarios are defined in `scenarios.ts` with realistic numbers for real market events.

```
AAPL × 5 phases: Accumulation → Breakout → Momentum Peak → Distribution → Recovery
GME  × 5 phases: Base → Short Squeeze → Post-Crash → Second Attempt → Dormant
AZN  × 5 phases: COVID dip → Vaccine run → ATH → Consolidation → Stable uptrend
BP   × 5 phases: COVID collapse → Recovery → Energy boom → Reversal → Steady income
```

### What Each Ticker Tests

| Ticker | What it validates |
|--------|------------------|
| AAPL | Large-cap stable CF behaviour, MA calculations, phase transitions |
| GME | Meme stock ATR handling, regime flip during squeeze, quality penalty |
| AZN | UK ADR, low beta bonus, consistent positive EPS across phases |
| BP | ADR, negative EPS during crisis, regime stays large-cap throughout |

### Cross-Ticker Tests (5)

- AAPL peak CF > GME peak CF (fundamentals matter over pure hype)
- AZN CF variance < GME CF variance (low-beta pharma is more stable)
- All 20 snapshots produce CF in [0, 100]
- All 20 snapshots produce non-empty verdictBand
- No snapshot throws an exception (crash-safety)

### Updating Expected Ranges

When you change scoring weights or thresholds, the backtest expected CF ranges in `scenarios.ts` may need updating. Process:

1. Run `npm run test:backtest 2>&1` — see which scenarios fail and by how much
2. Look at the console.log table output to see the actual CF values
3. Update `expectedCFMin` and `expectedCFMax` in `scenarios.ts`
4. Add a comment explaining WHY the range is what it is (e.g., "high Liquidity score offsets negative EPS")

### The scenarios.ts File

`scenarios.ts` is a **data fixture, not a test file**. It is excluded from Jest's test runner via `testPathIgnorePatterns`. Do not add `describe()` or `it()` blocks to it.

---

## Coverage

Current coverage (from `npm run test:coverage`):

| File | Statements | Branches | Functions |
|------|-----------|----------|-----------|
| `lib/cache.ts` | 100% | 100% | 100% |
| `lib/fmp.ts` | 91% | 93% | 100% |
| `lib/scoring/config.ts` | 100% | 100% | 100% |
| `lib/scoring/engine.ts` | 95% | 94% | 94% |
| `lib/scoring/verdict.ts` | 92% | 91% | 89% |
| `app/api/analyze/route.ts` | 100% | 95% | 100% |
| `app/api/leaderboard/route.ts` | 96% | 79% | 100% |
| **Overall** | **94.4%** | **92.5%** | **95.3%** |

Uncovered branches are mostly defensive `null` coalescing in `verdict.ts` for conditions that can't occur with valid FMP data.
