// FMP API client — all calls are server-side only.
// API key is read from process.env.FMP_API_KEY and never sent to the browser.
// Uses the FMP stable API (https://financialmodelingprep.com/stable) which
// has different field names from the legacy v3 API. Normalization is done
// in each getter so the rest of the app sees consistent FMPQuote/FMPProfile types.

import {
  FMPQuote,
  FMPProfile,
  FMPRatiosTTM,
  FMPHistoricalPrice,
  FMPMoverItem,
} from '@/types/stock';
import { cacheGet, cacheSet } from './cache';

const BASE = 'https://financialmodelingprep.com/stable';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Tracks why the last FMP call failed — read by route handlers for better error messages.
let _lastFmpError: 'invalid_key' | 'quota' | 'network' | null = null;

export function getLastFmpError(): typeof _lastFmpError {
  return _lastFmpError;
}

export function clearLastFmpError(): void {
  _lastFmpError = null;
}

function apiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error('FMP_API_KEY environment variable is not set');
  return key;
}

async function fetchFMP<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T | null> {
  const cacheKey = path + '|' + new URLSearchParams(params).toString();
  const cached = cacheGet<T>(cacheKey);
  if (cached !== null) return cached;

  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('apikey', apiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  try {
    const res = await fetch(url.toString(), {
      cache: 'no-store', // bypass Next.js fetch cache; we manage our own
    });

    if (!res.ok) {
      _lastFmpError = 'network';
      return null;
    }

    const data = await res.json() as T;

    // FMP returns [] or {"Error Message": "..."} on bad ticker / quota exceeded
    if (Array.isArray(data) && data.length === 0) return null;
    if (data && typeof data === 'object' && 'Error Message' in (data as object)) {
      const msg = ((data as Record<string, string>)['Error Message'] ?? '').toLowerCase();
      if (msg.includes('limit') || msg.includes('quota') || msg.includes('exceeded')) {
        _lastFmpError = 'quota';
      } else {
        _lastFmpError = 'invalid_key';
      }
      return null;
    }

    cacheSet<T>(cacheKey, data, CACHE_TTL);
    return data;
  } catch {
    _lastFmpError = 'network';
    return null;
  }
}

// ── Stable API raw shapes (field names differ from v3) ────────────────────────

interface StableQuoteRaw {
  symbol: string;
  name: string;
  price: number;
  // stable uses changePercentage; v3 used changesPercentage
  changePercentage: number | null;
  changesPercentage?: number | null;
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

interface StableProfileRaw {
  symbol: string;
  price: number;
  marketCap: number | null;      // v3: mktCap
  beta: number | null;
  lastDividend: number | null;   // v3: lastDiv
  range: string | null;
  change: number | null;         // v3: changes
  changePercentage: number | null;
  volume: number;
  averageVolume: number | null;  // v3: volAvg
  companyName: string;
  currency: string;
  cik: string | null;
  exchangeFullName: string | null;
  exchange: string;
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

// ── Public getters — each normalises stable→internal types ────────────────────

export async function getQuote(ticker: string): Promise<FMPQuote | null> {
  const data = await fetchFMP<StableQuoteRaw[]>('/quote', { symbol: ticker.toUpperCase() });
  if (!data?.[0]) return null;
  const raw = data[0];
  return {
    symbol: raw.symbol,
    name: raw.name,
    price: raw.price,
    // Normalise: stable uses changePercentage, v3 used changesPercentage
    changesPercentage: raw.changesPercentage ?? raw.changePercentage ?? 0,
    change: raw.change,
    dayLow: raw.dayLow,
    dayHigh: raw.dayHigh,
    yearHigh: raw.yearHigh,
    yearLow: raw.yearLow,
    marketCap: raw.marketCap,
    priceAvg50: raw.priceAvg50,
    priceAvg200: raw.priceAvg200,
    exchange: raw.exchange,
    volume: raw.volume,
    avgVolume: raw.avgVolume,
    open: raw.open,
    previousClose: raw.previousClose,
    eps: raw.eps,
    pe: raw.pe,
    earningsAnnouncement: raw.earningsAnnouncement,
    sharesOutstanding: raw.sharesOutstanding,
    timestamp: raw.timestamp,
  };
}

export async function getProfile(ticker: string): Promise<FMPProfile | null> {
  const data = await fetchFMP<StableProfileRaw[]>('/profile', { symbol: ticker.toUpperCase() });
  if (!data?.[0]) return null;
  const raw = data[0];
  return {
    symbol: raw.symbol,
    price: raw.price,
    beta: raw.beta,
    volAvg: raw.averageVolume,           // stable: averageVolume → v3: volAvg
    mktCap: raw.marketCap,               // stable: marketCap    → v3: mktCap
    lastDiv: raw.lastDividend,           // stable: lastDividend  → v3: lastDiv
    range: raw.range,
    changes: raw.change,                 // stable: change        → v3: changes
    companyName: raw.companyName,
    currency: raw.currency,
    cik: raw.cik,
    exchange: raw.exchange,
    exchangeShortName: raw.exchange,     // no exchangeShortName in stable; use exchange
    industry: raw.industry,
    website: raw.website,
    description: raw.description,
    ceo: raw.ceo,
    sector: raw.sector,
    country: raw.country,
    fullTimeEmployees: raw.fullTimeEmployees,
    image: raw.image,
    ipoDate: raw.ipoDate,
    isEtf: raw.isEtf ?? false,
    isActivelyTrading: raw.isActivelyTrading ?? true,
    isAdr: raw.isAdr ?? false,
    isFund: raw.isFund ?? false,
  };
}

export async function getRatiosTTM(ticker: string): Promise<FMPRatiosTTM | null> {
  const data = await fetchFMP<FMPRatiosTTM[]>('/ratios-ttm', { symbol: ticker.toUpperCase() });
  return data?.[0] ?? null;
}

export async function getHistoricalPrices(
  ticker: string,
  days = 200
): Promise<FMPHistoricalPrice[]> {
  // Stable API uses ?symbol= and may return { historical: [...] } or a flat array
  const data = await fetchFMP<{ historical: FMPHistoricalPrice[] } | FMPHistoricalPrice[]>(
    '/historical-price-full',
    { symbol: ticker.toUpperCase(), timeseries: String(days) }
  );
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.historical ?? [];
}

export async function getGainers(): Promise<FMPMoverItem[]> {
  // stable equivalent of v3 /stock_market/gainers
  const data = await fetchFMP<FMPMoverItem[]>('/biggest-gainers');
  return data ?? [];
}

export async function getActives(): Promise<FMPMoverItem[]> {
  // stable equivalent of v3 /stock_market/actives
  const data = await fetchFMP<FMPMoverItem[]>('/most-active');
  return data ?? [];
}
