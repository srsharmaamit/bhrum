// ── FMP API response shapes ────────────────────────────────────────────────────────────────────────────

export interface FMPQuote {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number;
  change: number;
  dayLow: number;
  dayHigh: number;
  yearHigh: number;
  yearLow: number;
  marketCap: number | null;
  priceAvg50: number | null;
  priceAvg200: number | null;
  exchange: string;
  volume: number;
  avgVolume: number;
  open: number;
  previousClose: number;
  eps: number | null;
  pe: number | null;
  earningsAnnouncement: string | null;
  sharesOutstanding: number | null;
  timestamp: number;
}

export interface FMPProfile {
  symbol: string;
  price: number;
  beta: number | null;
  volAvg: number | null;
  mktCap: number | null;
  lastDiv: number | null;
  range: string | null;
  changes: number | null;
  companyName: string;
  currency: string;
  cik: string | null;
  exchange: string;
  exchangeShortName: string;
  industry: string | null;
  website: string | null;
  description: string | null;
  ceo: string | null;
  sector: string | null;
  country: string | null;
  fullTimeEmployees: string | null;
  image: string | null;
  ipoDate: string | null;
  isEtf: boolean;
  isActivelyTrading: boolean;
  isAdr: boolean;
  isFund: boolean;
}

export interface FMPRatiosTTM {
  peRatioTTM: number | null;
  pegRatioTTM: number | null;
  currentRatioTTM: number | null;
  quickRatioTTM: number | null;
  debtRatioTTM: number | null;
  debtEquityRatioTTM: number | null;
  netProfitMarginTTM: number | null;
  returnOnEquityTTM: number | null;
  returnOnAssetsTTM: number | null;
  operatingCashFlowPerShareTTM: number | null;
  freeCashFlowPerShareTTM: number | null;
  grossProfitMarginTTM: number | null;
  priceEarningsRatioTTM: number | null;
  priceToBookRatioTTM: number | null;
  priceToSalesRatioTTM: number | null;
  dividendYieldTTM: number | null;
}

export interface FMPHistoricalPrice {
  date: string;
  close: number;
}

export interface FMPMoverItem {
  symbol: string;
  name: string;
  change: number;
  price: number;
  changesPercentage: number;
  exchange?: string;
  volume?: number;
}

// ── Internal scoring types ─────────────────────────────────────────────────────────────────────────

export type StockRegime = 'penny' | 'small-cap' | 'mid-cap' | 'large-cap';

export type MetricFlag = 'danger' | 'warning' | 'neutral' | 'good';

export interface MetricScore {
  name: string;
  score: number;      // 0–100
  weight: number;     // 0–1, all weights sum to 1
  contribution: number; // score * weight, for final tally
  label: string;      // short human label, e.g. "Poor" / "Good"
  detail: string;     // one-line explanation of the score
  flag: MetricFlag;
}

export interface ScoringResult {
  ticker: string;
  regime: StockRegime;
  confidenceFactor: number; // 0–100
  metrics: MetricScore[];
  verdictBand: string;     // e.g. "Speculative — High Risk"
  verdictWhy: string[];    // top 2–3 driver sentences
  verdictWatch: string[];  // concrete watch conditions
  fetchedAt: number;       // epoch ms
  dataCompleteness: number; // 0–100, pct of fields present
}

export interface AnalyzeResponse {
  quote: Partial<FMPQuote>;
  profile: Partial<FMPProfile>;
  scoring: ScoringResult;
  history: FMPHistoricalPrice[];  // last ~120 closes, newest-first
  error?: string;
}

export interface LeaderboardItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  volume: number | null;
  miniConfidence: number | null;
  regime: StockRegime | null;
}

export interface LeaderboardResponse {
  gainers: LeaderboardItem[];
  actives: LeaderboardItem[];
  fetchedAt: number;
  error?: string;
}

// ── Watchlist comparison types ──────────────────────────────────────────────────────────────────────

export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number;
  regime: StockRegime;
  score: number;       // 0–100 lightweight quote-only score
  flag: MetricFlag;
  marketCap: number | null;
  volume: number;
  noData?: boolean;    // true when FMP returned no quote for this ticker
}

export interface WatchlistResponse {
  items: WatchlistItem[];
  fetchedAt: number;
  error?: string;
}
