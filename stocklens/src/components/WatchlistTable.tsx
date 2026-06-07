'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MetricFlag, StockRegime, WatchlistItem, WatchlistResponse } from '@/types/stock';

interface Props {
  onSelectTicker: (ticker: string) => void;
}

const DEFAULT_TICKERS = 'AAPL,MSFT,GOOGL,AMZN,TSLA';
const LS_KEY = 'stocklens_watchlist';
const REFRESH_MS = 5 * 60 * 1000;

type SortKey = 'symbol' | 'price' | 'changesPercentage' | 'score' | 'regime';
type SortDir = 'asc' | 'desc';

const REGIME_RANK: Record<StockRegime, number> = {
  penny: 0, 'small-cap': 1, 'mid-cap': 2, 'large-cap': 3,
};

const FLAG_DOT: Record<MetricFlag, string> = {
  good: 'bg-emerald-500', neutral: 'bg-blue-500',
  warning: 'bg-amber-500', danger: 'bg-red-500',
};

function scoreColor(s: number): string {
  if (s >= 65) return 'text-emerald-700 bg-emerald-50';
  if (s >= 45) return 'text-amber-700 bg-amber-50';
  return 'text-red-700 bg-red-50';
}

function sortItems(items: WatchlistItem[], key: SortKey, dir: SortDir): WatchlistItem[] {
  return [...items].sort((a, b) => {
    let diff: number;
    switch (key) {
      case 'symbol':            diff = a.symbol.localeCompare(b.symbol); break;
      case 'price':             diff = a.price - b.price; break;
      case 'changesPercentage': diff = a.changesPercentage - b.changesPercentage; break;
      case 'score':             diff = a.score - b.score; break;
      case 'regime':            diff = REGIME_RANK[a.regime] - REGIME_RANK[b.regime]; break;
      default:                  diff = 0;
    }
    return dir === 'asc' ? diff : -diff;
  });
}

function SortHeader({
  label, col, current, dir, onClick, className = '',
}: {
  label: string; col: SortKey; current: SortKey; dir: SortDir;
  onClick: (k: SortKey) => void; className?: string;
}) {
  const active = col === current;
  return (
    <th
      className={`text-xs font-medium uppercase tracking-wider pb-2 cursor-pointer select-none
        hover:text-gray-800 transition-colors whitespace-nowrap ${
          active ? 'text-accent' : 'text-gray-500'
        } ${className}`}
      onClick={() => onClick(col)}
    >
      {label}
      <span className={`ml-1 ${active ? 'text-accent' : 'text-gray-300'}`}>
        {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </th>
  );
}

function TableRow({ item, onClick }: { item: WatchlistItem; onClick: () => void }) {
  const isPos = item.changesPercentage >= 0;
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer hover:bg-gray-50 transition-colors group border-t border-gray-100"
    >
      <td className="py-2.5 pl-3 pr-2 w-6">
        <span className={`inline-block w-2 h-2 rounded-full ${FLAG_DOT[item.flag]}`} />
      </td>
      <td className="py-2.5 pr-3">
        <div className="text-sm font-bold text-gray-900 group-hover:text-accent transition-colors font-mono leading-tight">
          {item.symbol}
        </div>
        <div className="text-xs text-gray-400 truncate max-w-[90px] leading-tight">{item.name}</div>
      </td>
      <td className="py-2.5 pr-3 text-right">
        <span className="text-sm font-semibold text-gray-800 tabular-nums">
          {item.price < 10 ? `$${item.price.toFixed(4)}` : `$${item.price.toFixed(2)}`}
        </span>
      </td>
      <td className={`py-2.5 pr-3 text-right text-sm font-medium tabular-nums ${isPos ? 'text-emerald-600' : 'text-red-600'}`}>
        {isPos ? '+' : ''}{item.changesPercentage.toFixed(2)}%
      </td>
      <td className="py-2.5 pr-3 text-right">
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md tabular-nums ${scoreColor(item.score)}`}>
          {item.score}
        </span>
      </td>
      <td className="py-2.5 pr-3 text-right">
        <span className="text-xs text-gray-500 capitalize">{item.regime}</span>
      </td>
    </tr>
  );
}

function TableSkeleton() {
  return (
    <tbody>
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="border-t border-gray-100 animate-pulse">
          <td className="py-2.5 pl-3 pr-2"><div className="w-2 h-2 rounded-full bg-gray-200" /></td>
          <td className="py-2.5 pr-3">
            <div className="h-3 w-12 bg-gray-200 rounded mb-1" />
            <div className="h-2.5 w-20 bg-gray-200 rounded" />
          </td>
          <td className="py-2.5 pr-3"><div className="h-3 w-16 bg-gray-200 rounded ml-auto" /></td>
          <td className="py-2.5 pr-3"><div className="h-3 w-12 bg-gray-200 rounded ml-auto" /></td>
          <td className="py-2.5 pr-3"><div className="h-5 w-8 bg-gray-200 rounded ml-auto" /></td>
          <td className="py-2.5 pr-3"><div className="h-3 w-14 bg-gray-200 rounded ml-auto" /></td>
        </tr>
      ))}
    </tbody>
  );
}

export default function WatchlistTable({ onSelectTicker }: Props) {
  const [inputVal, setInputVal] = useState(DEFAULT_TICKERS);
  const [appliedTickers, setAppliedTickers] = useState('');
  const [data, setData] = useState<WatchlistResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [editing, setEditing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read persisted tickers from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      const tickers = saved ?? DEFAULT_TICKERS;
      setInputVal(tickers);
      setAppliedTickers(tickers);
    } catch {
      setAppliedTickers(DEFAULT_TICKERS);
    }
  }, []);

  const fetchWatchlist = useCallback(async (tickers: string) => {
    if (!tickers.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/watchlist?tickers=${encodeURIComponent(tickers)}`);
      const json: WatchlistResponse = await res.json();
      if (res.ok) setData(json);
    } catch {
      // silent fail — watchlist is supplementary
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch + start refresh timer whenever the applied ticker list changes
  useEffect(() => {
    if (!appliedTickers) return;
    fetchWatchlist(appliedTickers);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => fetchWatchlist(appliedTickers), REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [appliedTickers, fetchWatchlist]);

  function applyTickers() {
    const normalized = inputVal
      .split(',')
      .map(t => t.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 15)
      .join(',');
    if (!normalized) return;
    try { localStorage.setItem(LS_KEY, normalized); } catch {}
    setInputVal(normalized);
    setAppliedTickers(normalized);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') applyTickers();
    if (e.key === 'Escape') setEditing(false);
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sortedItems = data ? sortItems(data.items, sortKey, sortDir) : [];
  const lastUpdated = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="bg-navy-800 rounded-2xl shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-200 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Watchlist
            {lastUpdated && (
              <span className="ml-2 text-xs font-normal text-gray-400 normal-case tracking-normal">
                · Updated {lastUpdated}
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Compare tickers side-by-side · click a row to analyze</p>
        </div>

        {/* Ticker input */}
        <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
          {editing ? (
            <>
              <input
                autoFocus
                type="text"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={applyTickers}
                placeholder="AAPL,MSFT,TSLA (max 15)"
                className="flex-1 sm:w-64 text-xs bg-gray-50 border border-accent/40 rounded-lg px-3 py-1.5
                           text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-accent/60 font-mono"
              />
              <button
                onClick={applyTickers}
                className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors shrink-0"
              >
                Apply
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600
                         bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-transparent
                         hover:border-gray-200 font-mono"
              title="Edit watchlist tickers"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {appliedTickers || DEFAULT_TICKERS}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="px-3">
              <th className="pl-3 pr-2 pb-2 w-6" />
              <SortHeader label="Ticker" col="symbol" current={sortKey} dir={sortDir} onClick={handleSort} className="text-left" />
              <SortHeader label="Price" col="price" current={sortKey} dir={sortDir} onClick={handleSort} className="text-right pr-3" />
              <SortHeader label="Chg%" col="changesPercentage" current={sortKey} dir={sortDir} onClick={handleSort} className="text-right pr-3" />
              <SortHeader label="Score" col="score" current={sortKey} dir={sortDir} onClick={handleSort} className="text-right pr-3" />
              <SortHeader label="Regime" col="regime" current={sortKey} dir={sortDir} onClick={handleSort} className="text-right pr-3" />
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton />
          ) : sortedItems.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                  {appliedTickers ? 'No data returned — check your ticker symbols.' : 'Loading…'}
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {sortedItems.map(item => (
                <TableRow
                  key={item.symbol}
                  item={item}
                  onClick={() => onSelectTicker(item.symbol)}
                />
              ))}
            </tbody>
          )}
        </table>
      </div>

      <div className="px-4 py-2.5 text-xs text-gray-400 border-t border-gray-100">
        Score = lightweight quote-only signal (liquidity + volatility + earnings + momentum). Not financial advice.
      </div>
    </div>
  );
}
