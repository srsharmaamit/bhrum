'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SearchBar from '@/components/SearchBar';
import ConfidenceGauge from '@/components/ConfidenceGauge';
import MetricBreakdown from '@/components/MetricBreakdown';
import VerdictPanel from '@/components/VerdictPanel';
import Leaderboard from '@/components/Leaderboard';
import {
  GaugeSkeleton,
  QuickStatsSkeleton,
  MetricSkeleton,
  VerdictSkeleton,
} from '@/components/Skeleton';
import { AnalyzeResponse, FMPQuote, FMPProfile, LeaderboardResponse } from '@/types/stock';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function timeSince(ms: number): string {
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatPrice(p: number | undefined): string {
  if (p === undefined || p === null) return '—';
  return p < 10 ? `$${p.toFixed(4)}` : `$${p.toFixed(2)}`;
}

function formatLargeNum(n: number | undefined | null): string {
  if (!n) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

interface QuickStat {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean | null;
}

function buildQuickStats(
  quote: Partial<FMPQuote>,
  profile: Partial<FMPProfile>
): QuickStat[] {
  const chg = quote.changesPercentage ?? 0;
  const vol = quote.volume;
  const avgVol = quote.avgVolume;

  return [
    {
      label: 'Change',
      value: chg >= 0 ? `+${chg.toFixed(2)}%` : `${chg.toFixed(2)}%`,
      sub: formatPrice(quote.change),
      positive: chg > 0 ? true : chg < 0 ? false : null,
    },
    {
      label: 'Market Cap',
      value: formatLargeNum(quote.marketCap ?? profile.mktCap),
    },
    {
      label: 'Volume',
      value: vol ? (vol >= 1e6 ? `${(vol / 1e6).toFixed(1)}M` : `${(vol / 1e3).toFixed(0)}K`) : '—',
      sub: avgVol ? `avg ${avgVol >= 1e6 ? `${(avgVol / 1e6).toFixed(1)}M` : `${(avgVol / 1e3).toFixed(0)}K`}` : undefined,
    },
    {
      label: '52W Range',
      value: quote.yearLow && quote.yearHigh
        ? `${formatPrice(quote.yearLow)} – ${formatPrice(quote.yearHigh)}`
        : '—',
    },
  ];
}

function RegimeBadge({ regime }: { regime: string }) {
  const styles: Record<string, string> = {
    penny:      'bg-red-500/15 text-red-400 border-red-500/30',
    'small-cap': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    'mid-cap':  'bg-blue-500/15 text-blue-400 border-blue-500/30',
    'large-cap': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  };
  const labels: Record<string, string> = {
    penny: 'Penny Stock',
    'small-cap': 'Small-Cap',
    'mid-cap': 'Mid-Cap',
    'large-cap': 'Large-Cap',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[regime] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/30'}`}>
      {labels[regime] ?? regime}
    </span>
  );
}

export default function StockLens() {
  const [currentTicker, setCurrentTicker] = useState('');
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lbLoading, setLbLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [tick, setTick] = useState(0); // force re-render for "time since"
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick every 30s to update "last updated" display
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const fetchAnalysis = useCallback(async (ticker: string, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analyze?ticker=${encodeURIComponent(ticker)}`);
      const data: AnalyzeResponse = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to fetch data. Please try again.');
        setAnalysis(null);
      } else {
        setAnalysis(data);
        setLastUpdated(Date.now());
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data: LeaderboardResponse = await res.json();
        setLeaderboard(data);
      }
    } catch {
      // silent fail on leaderboard
    } finally {
      setLbLoading(false);
    }
  }, []);

  // Load leaderboard on mount
  useEffect(() => {
    fetchLeaderboard();
    const t = setInterval(fetchLeaderboard, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [fetchLeaderboard]);

  // Auto-refresh analysis every 5 min when a ticker is active
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (!currentTicker) return;
    refreshTimerRef.current = setInterval(() => {
      fetchAnalysis(currentTicker, true);
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [currentTicker, fetchAnalysis]);

  function handleSearch(ticker: string) {
    setCurrentTicker(ticker);
    fetchAnalysis(ticker);
  }

  function handleRefresh() {
    if (currentTicker) fetchAnalysis(currentTicker);
  }

  const score = analysis?.scoring;
  const quote = analysis?.quote;
  const profile = analysis?.profile;
  const quickStats = quote && profile ? buildQuickStats(quote, profile) : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0A1628' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-navy-700/50 bg-navy-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <svg className="w-7 h-7 text-accent" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <circle cx="16" cy="16" r="8" stroke="currentColor" strokeWidth="2.5" />
                <path d="M10 20 L13 15 L16 17 L20 11 L23 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-lg font-bold text-slate-100 tracking-tight">
                Stock<span className="text-accent">Lens</span>
              </span>
            </div>
            <span className="hidden sm:inline-block text-xs text-slate-600 border border-navy-700 px-2 py-0.5 rounded-full">
              Risk Intelligence
            </span>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-accent live-pulse" />
            <span className="hidden sm:inline">Live</span>
            {lastUpdated && (
              <span className="text-slate-600">· Updated {timeSince(lastUpdated)}</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 sm:py-10">

        {/* Search */}
        <div className="mb-8">
          <h1 className="text-center text-2xl sm:text-3xl font-bold text-slate-100 mb-2 tracking-tight">
            Stock Risk Intelligence
          </h1>
          <p className="text-center text-sm text-slate-500 mb-6">
            Enter any ticker — penny stock or large-cap — for a transparent confidence score and plain-English risk verdict
          </p>
          <SearchBar
            onSearch={handleSearch}
            loading={loading}
            initialValue={currentTicker}
          />
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm text-center animate-fade-in">
            {error}
          </div>
        )}

        {/* Content grid */}
        {(loading || analysis) && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

            {/* ── Left column: main analysis ─────────────────────────────── */}
            <div className="space-y-4">

              {/* Ticker header */}
              {loading ? (
                <div className="bg-navy-800 rounded-2xl p-4 animate-pulse flex gap-3">
                  <div className="h-8 w-24 bg-navy-700 rounded-lg" />
                  <div className="h-8 w-32 bg-navy-700 rounded-lg" />
                </div>
              ) : analysis && (
                <div className="bg-navy-800 rounded-2xl px-5 py-4 shadow-card animate-fade-in flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-bold text-slate-100 font-mono">
                      {score?.ticker}
                    </h2>
                    {profile?.companyName && (
                      <span className="text-slate-400 text-sm">{profile.companyName}</span>
                    )}
                    {score?.regime && <RegimeBadge regime={score.regime} />}
                    {profile?.sector && (
                      <span className="text-xs text-slate-600 bg-navy-700 px-2 py-0.5 rounded-full">
                        {profile.sector}
                      </span>
                    )}
                    {profile?.exchange && (
                      <span className="text-xs text-slate-600">{profile.exchange}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {quote?.price !== undefined && (
                      <span className="text-2xl font-bold text-slate-100 font-mono">
                        {formatPrice(quote.price)}
                      </span>
                    )}
                    <button
                      onClick={handleRefresh}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400
                                 bg-navy-700 hover:bg-navy-600 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115.5-4.5M20 15a9 9 0 01-15.5 4.5" />
                      </svg>
                      Refresh
                    </button>
                  </div>
                </div>
              )}

              {/* Gauge + quick stats row */}
              <div className="bg-navy-800 rounded-2xl p-5 shadow-card">
                {loading ? (
                  <div className="space-y-4">
                    <GaugeSkeleton />
                    <QuickStatsSkeleton />
                  </div>
                ) : analysis && score && (
                  <div className="animate-fade-in">
                    {/* Gauge centered */}
                    <div className="flex flex-col items-center mb-5">
                      <div className="text-xs text-slate-600 uppercase tracking-widest mb-3">
                        Confidence Factor
                      </div>
                      <ConfidenceGauge score={score.confidenceFactor} size={200} />
                      <p className="text-xs text-slate-600 mt-2 text-center max-w-xs">
                        High score = lower-risk setup. This is <em>not</em> a buy/sell recommendation.
                      </p>
                    </div>

                    {/* Quick stats */}
                    {quickStats && (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {quickStats.map(stat => (
                          <div key={stat.label} className="bg-navy-700/50 rounded-xl p-3">
                            <div className="text-xs text-slate-600 mb-1">{stat.label}</div>
                            <div
                              className={`text-sm font-semibold ${
                                stat.positive === true
                                  ? 'text-emerald-400'
                                  : stat.positive === false
                                  ? 'text-red-400'
                                  : 'text-slate-200'
                              }`}
                            >
                              {stat.value}
                            </div>
                            {stat.sub && (
                              <div className="text-xs text-slate-600 mt-0.5">{stat.sub}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Verdict */}
              {loading ? (
                <VerdictSkeleton />
              ) : analysis?.scoring && (
                <VerdictPanel scoring={analysis.scoring} />
              )}

              {/* Metric breakdown */}
              {loading ? (
                <MetricSkeleton />
              ) : analysis?.scoring && (
                <MetricBreakdown metrics={analysis.scoring.metrics} />
              )}

              {/* Company description */}
              {!loading && profile?.description && (
                <div className="bg-navy-800 rounded-2xl p-4 shadow-card animate-fade-in">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">About</h3>
                  <p className="text-sm text-slate-500 leading-relaxed line-clamp-4">
                    {profile.description}
                  </p>
                </div>
              )}
            </div>

            {/* ── Right column: leaderboard ────────────────────────────────── */}
            <div className="lg:sticky lg:top-20 lg:self-start">
              <Leaderboard
                data={leaderboard}
                loading={lbLoading}
                onSelectTicker={handleSearch}
              />
            </div>
          </div>
        )}

        {/* Empty state — show leaderboard alone when no search yet */}
        {!loading && !analysis && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 mt-2">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-navy-800 flex items-center justify-center mb-4 shadow-glow">
                <svg className="w-9 h-9 text-accent/60" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm">Type any ticker above to see its confidence score</p>
              <p className="text-slate-700 text-xs mt-1">Works with any US-listed stock, penny stock, or ETF</p>
            </div>
            <Leaderboard
              data={leaderboard}
              loading={lbLoading}
              onSelectTicker={handleSearch}
            />
          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-navy-700/50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-5 text-center space-y-1">
          <p className="text-xs text-slate-600">
            <strong className="text-slate-500">Educational tool only.</strong>{' '}
            Not financial advice. Scores measure risk/quality characteristics, not future returns.
            Past performance is not indicative of future results.
          </p>
          <p className="text-xs text-slate-700">
            Data via Financial Modeling Prep · Refreshes every 5 minutes · Free tier rate-limit aware
          </p>
        </div>
      </footer>
    </div>
  );
}
