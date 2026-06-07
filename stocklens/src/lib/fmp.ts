// FMP API client — all calls are server-side only.
// API key is read from process.env.FMP_API_KEY and never sent to the browser.
// Uses the FMP v3 API (https://financialmodelingprep.com/api/v3) which is
// available on the free tier (250 calls/day). Symbol goes in the URL path,
// not as a query param.

import {
  FMPQuote,
  FMPProfile,
  FMPRatiosTTM,
  FMPHistoricalPrice,
  FMPMoverItem,
} from '@/types/stock';
import { cacheGet, cacheSet } from './cache';

const BASE = 'https://financialmodelingprep.com/api/v3';
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

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;

      // FMP error formats: { "Error Message": "..." } or { "message": "..." }
      const errMsg = (obj['Error Message'] ?? obj['message'] ?? '') as string;
      if (errMsg) {
        const lower = errMsg.toLowerCase();
        if (lower.includes('limit') || lower.includes('quota') || lower.includes('exceeded')) {
          _lastFmpError = 'quota';
        } else if (lower.includes('subscription') || lower.includes('upgrade') || lower.includes('plan')) {
          // Subscription error — treat as invalid/insufficient key
          _lastFmpError = 'invalid_key';
        } else {
          _lastFmpError = 'invalid_key';
        }
        // Only return null if there's no useful data alongside the message
        if (!('historical' in obj)) return null;
      }
    }

    cacheSet<T>(cacheKey, data, CACHE_TTL);
    return data;
  } catch {
    _lastFmpError = 'network';
    return null;
  }
}

// ── v3 raw shapes ─────────────────────────────────────────────────────────────

interface V3QuoteRaw {
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

interface V3ProfileRaw {
  symbol: string;
  price: number;
  mktCap: number | null;
  beta: number | null;
  lastDiv: number | null;
  range: string | null;
  changes: number | null;
  volAvg: number | null;
  companyName: string;
  currency: string;
  cik: string | null;
  exchangeShortName: string | null;
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

// ── Public getters ────────────────────────────────────────────────────────────

function normalizeQuote(raw: V3QuoteRaw): FMPQuote {
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

export async function getQuote(ticker: string): Promise<FMPQuote | null> {
  const t = ticker.toUpperCase();
  const data = await fetchFMP<V3QuoteRaw[]>(`/quote/${t}`);
  if (!data?.[0]) return null;
  return normalizeQuote(data[0]);
}

/**
 * Fetches quotes for multiple tickers in ONE FMP call (comma-separated in URL path).
 * Falls back to individual getQuote calls (capped at 10) if the batch call fails.
 */
export async function getQuotesBatch(tickers: string[]): Promise<FMPQuote[]> {
  if (tickers.length === 0) return [];

  const symbols = tickers.map(t => t.toUpperCase()).join(',');
  const data = await fetchFMP<V3QuoteRaw[]>(`/quote/${symbols}`);

  if (data === null) {
    console.warn('[fmp] Batch quote unavailable; falling back to individual getQuote calls');
    const capped = tickers.slice(0, 10);
    const results = await Promise.all(capped.map(t => getQuote(t)));
    return results.filter((q): q is FMPQuote => q !== null);
  }

  return data.map(normalizeQuote);
}

export async function getProfile(ticker: string): Promise<FMPProfile | null> {
  const t = ticker.toUpperCase();
  const data = await fetchFMP<V3ProfileRaw[]>(`/profile/${t}`);
  if (!data?.[0]) return null;
  const raw = data[0];
  return {
    symbol: raw.symbol,
    price: raw.price,
    beta: raw.beta,
    volAvg: raw.volAvg,
    mktCap: raw.mktCap,
    lastDiv: raw.lastDiv,
    range: raw.range,
    changes: raw.changes,
    companyName: raw.companyName,
    currency: raw.currency,
    cik: raw.cik,
    exchange: raw.exchange,
    exchangeShortName: raw.exchangeShortName ?? raw.exchange,
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
  const t = ticker.toUpperCase();
  const data = await fetchFMP<FMPRatiosTTM[]>(`/ratios-ttm/${t}`);
  return data?.[0] ?? null;
}

export async function getHistoricalPrices(
  ticker: string,
  days = 200
): Promise<FMPHistoricalPrice[]> {
  const t = ticker.toUpperCase();
  const data = await fetchFMP<{ historical: FMPHistoricalPrice[] } | FMPHistoricalPrice[]>(
    `/historical-price-full/${t}`,
    { timeseries: String(days) }
  );
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.historical ?? [];
}

export async function getGainers(): Promise<FMPMoverItem[]> {
  const data = await fetchFMP<FMPMoverItem[]>('/stock_market/gainers');
  return data ?? [];
}

export async function getActives(): Promise<FMPMoverItem[]> {
  const data = await fetchFMP<FMPMoverItem[]>('/stock_market/actives');
  return data ?? [];
}
