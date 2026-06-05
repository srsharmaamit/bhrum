// FMP API client — all calls are server-side only.
// API key is read from process.env.FMP_API_KEY and never sent to the browser.

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

    if (!res.ok) return null;

    const data = await res.json() as T;

    // FMP returns [] or {"Error Message": "..."} on bad ticker / quota exceeded
    if (Array.isArray(data) && data.length === 0) return null;
    if (data && typeof data === 'object' && 'Error Message' in (data as object)) return null;

    cacheSet<T>(cacheKey, data, CACHE_TTL);
    return data;
  } catch {
    return null;
  }
}

export async function getQuote(ticker: string): Promise<FMPQuote | null> {
  const data = await fetchFMP<FMPQuote[]>(`/quote/${ticker.toUpperCase()}`);
  return data?.[0] ?? null;
}

export async function getProfile(ticker: string): Promise<FMPProfile | null> {
  const data = await fetchFMP<FMPProfile[]>(`/profile/${ticker.toUpperCase()}`);
  return data?.[0] ?? null;
}

export async function getRatiosTTM(ticker: string): Promise<FMPRatiosTTM | null> {
  const data = await fetchFMP<FMPRatiosTTM[]>(`/ratios-ttm/${ticker.toUpperCase()}`);
  return data?.[0] ?? null;
}

export async function getHistoricalPrices(
  ticker: string,
  days = 200
): Promise<FMPHistoricalPrice[]> {
  const data = await fetchFMP<{ historical: FMPHistoricalPrice[] }>(
    `/historical-price-full/${ticker.toUpperCase()}`,
    { serietype: 'line', timeseries: String(days) }
  );
  return data?.historical ?? [];
}

export async function getGainers(): Promise<FMPMoverItem[]> {
  const data = await fetchFMP<FMPMoverItem[]>('/stock_market/gainers');
  return data ?? [];
}

export async function getActives(): Promise<FMPMoverItem[]> {
  const data = await fetchFMP<FMPMoverItem[]>('/stock_market/actives');
  return data ?? [];
}
