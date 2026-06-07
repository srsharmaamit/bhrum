// FMP API client — all calls are server-side only.
// API key is read from process.env.FMP_API_KEY and never sent to the browser.
// Uses the FMP stable API (https://financialmodelingprep.com/stable).
// The stable API returns a single object for single-ticker requests and an
// array for multi-ticker (batch) requests — both cases are handled here.

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

    // FMP returns [] on unknown ticker
    if (Array.isArray(data) && data.length === 0) return null;

    // Detect FMP error objects: { "Error Message": "..." } or { "message": "..." }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;
      const errMsg = ((obj['Error Message'] ?? obj['message']) as string | undefined) ?? '';
      if (errMsg && !('historical' in obj)) {
        const lower = errMsg.toLowerCase();
        if (lower.includes('limit') || lower.includes('quota') || lower.includes('exceeded')) {
          _lastFmpError = 'quota';
        } else {
          _lastFmpError = 'invalid_key';
        }
        return null;
      }
    }

    cacheSet<T>(cacheKey, data, CACHE_TTL);
    return data;
  } catch {
    _lastFmpError = 'network';
    return null;
  }
}

// ── Stable API raw shapes ─────────────────────────────────────────────────────
// The stable API may return a single object OR an array depending on whether
// one or multiple symbols are requested.

interface StableQuoteRaw {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number | null;
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
  marketCap: number | null;
  beta: number | null;
  lastDividend: number | null;
  range: string | null;
  change: number | null;
  changePercentage: number | null;
  averageVolume: number | null;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

// Normalise a stable quote object into the internal FMPQuote shape.
function normalizeQuote(raw: StableQuoteRaw): FMPQuote {
  return {
    symbol: raw.symbol,
    name: raw.name,
    price: raw.price,
    changesPercentage: raw.changesPercentage ?? 0,
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

// Unwrap single-object or array response — stable API returns an object for a
// single symbol and an array for multiple symbols.
function firstOf<T>(data: T | T[]): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

// ── Public getters ────────────────────────────────────────────────────────────

export async function getQuote(ticker: string): Promise<FMPQuote | null> {
  const data = await fetchFMP<StableQuoteRaw | StableQuoteRaw[]>('/quote', { symbol: ticker.toUpperCase() });
  if (!data) return null;
  const raw = firstOf(data);
  if (!raw?.symbol) return null;
  return normalizeQuote(raw);
}

/**
 * Fetches quotes for multiple tickers in ONE FMP call (comma-separated symbol param).
 * Falls back to individual getQuote calls (capped at 10) if the batch call fails.
 */
export async function getQuotesBatch(tickers: string[]): Promise<FMPQuote[]> {
  if (tickers.length === 0) return [];

  const symbols = tickers.map(t => t.toUpperCase()).join(',');
  const data = await fetchFMP<StableQuoteRaw | StableQuoteRaw[]>('/quote', { symbol: symbols });

  if (data === null) {
    console.warn('[fmp] Batch quote unavailable; falling back to individual getQuote calls');
    const capped = tickers.slice(0, 10);
    const results = await Promise.all(capped.map(t => getQuote(t)));
    return results.filter((q): q is FMPQuote => q !== null);
  }

  const arr = Array.isArray(data) ? data : [data];
  return arr.filter(r => r?.symbol).map(normalizeQuote);
}

export async function getProfile(ticker: string): Promise<FMPProfile | null> {
  const data = await fetchFMP<StableProfileRaw | StableProfileRaw[]>('/profile', { symbol: ticker.toUpperCase() });
  if (!data) return null;
  const raw = firstOf(data);
  if (!raw?.symbol) return null;
  return {
    symbol: raw.symbol,
    price: raw.price,
    beta: raw.beta,
    volAvg: raw.averageVolume,
    mktCap: raw.marketCap,
    lastDiv: raw.lastDividend,
    range: raw.range,
    changes: raw.change,
    companyName: raw.companyName,
    currency: raw.currency,
    cik: raw.cik,
    exchange: raw.exchange,
    exchangeShortName: raw.exchange,
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
  const data = await fetchFMP<FMPRatiosTTM | FMPRatiosTTM[]>('/ratios-ttm', { symbol: ticker.toUpperCase() });
  if (!data) return null;
  return firstOf(data);
}

export async function getHistoricalPrices(
  ticker: string,
  days = 200
): Promise<FMPHistoricalPrice[]> {
  const data = await fetchFMP<{ historical: FMPHistoricalPrice[] } | FMPHistoricalPrice[]>(
    '/historical-price-full',
    { symbol: ticker.toUpperCase(), timeseries: String(days) }
  );
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.historical ?? [];
}

export async function getGainers(): Promise<FMPMoverItem[]> {
  const data = await fetchFMP<FMPMoverItem[]>('/biggest-gainers');
  return data ?? [];
}

export async function getActives(): Promise<FMPMoverItem[]> {
  const data = await fetchFMP<FMPMoverItem[]>('/most-active');
  return data ?? [];
}
