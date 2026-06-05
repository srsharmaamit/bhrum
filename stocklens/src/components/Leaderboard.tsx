'use client';

import { useState } from 'react';
import { LeaderboardItem, LeaderboardResponse } from '@/types/stock';

interface Props {
  data: LeaderboardResponse | null;
  loading: boolean;
  onSelectTicker: (ticker: string) => void;
}

function confidenceColor(score: number): string {
  if (score >= 65) return 'text-emerald-400 bg-emerald-500/10';
  if (score >= 45) return 'text-amber-400 bg-amber-500/10';
  return 'text-red-400 bg-red-500/10';
}

function formatVolume(vol: number | null): string {
  if (!vol) return '—';
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`;
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(0)}K`;
  return vol.toString();
}

function Row({ item, onClick }: { item: LeaderboardItem; onClick: () => void }) {
  const isPositive = item.changesPercentage >= 0;
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-navy-700/60 transition-colors text-left group">
      <div className="w-14 shrink-0">
        <div className="text-sm font-bold text-slate-100 group-hover:text-accent transition-colors">{item.symbol}</div>
        <div className="text-xs text-slate-600 truncate max-w-[56px]">{item.name}</div>
      </div>
      <div className="flex-1 text-right">
        <div className="text-sm font-semibold text-slate-200">
          ${item.price < 10 ? item.price.toFixed(4) : item.price.toFixed(2)}
        </div>
        <div className={`text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{item.changesPercentage.toFixed(2)}%
        </div>
      </div>
      <div className="w-14 text-right">
        <div className="text-xs text-slate-500">{formatVolume(item.volume)}</div>
      </div>
      <div className="w-10 shrink-0 text-right">
        {item.miniConfidence !== null ? (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${confidenceColor(item.miniConfidence)}`}>
            {item.miniConfidence}
          </span>
        ) : <span className="text-xs text-slate-700">—</span>}
      </div>
    </button>
  );
}

function LoadingRows() {
  return (
    <>{[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-3 animate-pulse">
        <div className="w-14 space-y-1.5">
          <div className="h-3 bg-navy-700 rounded w-10" />
          <div className="h-2.5 bg-navy-700 rounded w-12" />
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-navy-700 rounded w-16 ml-auto" />
          <div className="h-2.5 bg-navy-700 rounded w-10 ml-auto" />
        </div>
        <div className="w-14 h-3 bg-navy-700 rounded ml-auto" />
        <div className="w-10 h-5 bg-navy-700 rounded" />
      </div>
    ))}</>
  );
}

export default function Leaderboard({ data, loading, onSelectTicker }: Props) {
  const [tab, setTab] = useState<'gainers' | 'actives'>('gainers');
  const [pennyOnly, setPennyOnly] = useState(false);

  const rawItems = data ? (tab === 'gainers' ? data.gainers : data.actives) : [];
  const items = pennyOnly ? rawItems.filter(i => i.price < 5) : rawItems;
  const displayed = items.slice(0, 5);
  const lastUpdated = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="bg-navy-800 rounded-2xl shadow-card overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-navy-700/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Top Movers</h2>
          {lastUpdated && <span className="text-xs text-slate-600">Updated {lastUpdated}</span>}
        </div>
        <div className="flex gap-1 mb-2">
          {(['gainers', 'actives'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                tab === t ? 'bg-accent text-white' : 'bg-navy-700 text-slate-400 hover:text-slate-200'
              }`}>
              {t === 'gainers' ? 'Top Gainers' : 'Most Active'}
            </button>
          ))}
        </div>
        <button onClick={() => setPennyOnly(v => !v)}
          className={`w-full py-1 text-xs font-medium rounded-lg transition-colors ${
            pennyOnly
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-navy-700/50 text-slate-500 hover:text-slate-300 border border-transparent'
          }`}>
          {pennyOnly ? '✓ Penny stocks only (< $5)' : 'All stocks'}
        </button>
      </div>
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-navy-700/30">
        <div className="w-14 text-xs text-slate-600">Symbol</div>
        <div className="flex-1 text-right text-xs text-slate-600">Price / Chg%</div>
        <div className="w-14 text-right text-xs text-slate-600">Vol</div>
        <div className="w-10 text-right text-xs text-slate-600">CF</div>
      </div>
      <div className="py-1">
        {loading ? <LoadingRows /> : displayed.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-600">
            {pennyOnly ? 'No penny stocks in this list.' : 'No data available.'}
          </div>
        ) : displayed.map(item => (
          <Row key={item.symbol} item={item} onClick={() => onSelectTicker(item.symbol)} />
        ))}
      </div>
      <div className="px-4 pb-3 pt-1 text-xs text-slate-700 border-t border-navy-700/30">
        CF = mini Confidence Factor proxy. Click a row to analyze.
      </div>
    </div>
  );
}
