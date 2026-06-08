'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SearchBar from '@/components/SearchBar';
import ConfidenceGauge from '@/components/ConfidenceGauge';
import ScoreDecomposition from '@/components/ScoreDecomposition';
import MetricBreakdown from '@/components/MetricBreakdown';
import VerdictPanel from '@/components/VerdictPanel';
import Leaderboard from '@/components/Leaderboard';
import WatchlistTable from '@/components/WatchlistTable';
import PriceTrendChart from '@/components/PriceTrendChart';
import RangeBar52w from '@/components/RangeBar52w';
import RvolGauge from '@/components/RvolGauge';
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
    penny:      'bg-red-50 text-red-700 border-red-200',
    'small-cap': 'bg-orange-50 text-orange-700 border-orange-200',
    'mid-cap':  'bg-blue-50 text-blue-700 border-blue-200',
    'large-cap': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  const labels: Record<string, string> = {
    penny: 'Penny Stock',
    'small-cap': 'Small-Cap',
    'mid-cap': 'Mid-Cap',
    'large-cap': 'Large-Cap',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[regime] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
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

  // Suppress unused variable warning from tick
  void tick;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F9FAFB' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <svg className="w-7 h-7 text-accent" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <circle cx="16" cy="16" r="8" stroke="currentColor" strokeWidth="2.5" />
                <path d="M10 20 L13 15 L16 17 L20 11 L23 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-lg font-bold text-gray-900 tracking-tight">
                Stock<span className="text-accent">Lens</span>
              </span>
            </div>
            <span className="hidden sm:inline-block text-xs text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
              Risk Intelligence
            </span>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-accent live-pulse" />
            <span className="hidden sm:inline">Live</span>
            {lastUpdated && (
              <span className="text-gray-400">· Updated {timeSince(lastUpdated)}</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 sm:py-10">

        {/* Search */}
        <div className="mb-8">
          <h1 className="text-center text-2xl sm:text-3xl font-bold text-gray-900 mb-2 tracking-tight">
            Stock Risk Intelligence
          </h1>
          <p className="text-center text-sm text-gray-500 mb-6">
            Enter any ticker — penny stock or large-cap — for a transparent confidence score and plain-English risk verdict
          </p>
          <SearchBar
            onSearch={handleSearch}
            loading={loading}
            initialValue={currentTicker}
          />
        </div>

        {/* Watchlist comparison */}
        <div className="mb-6">
          <WatchlistTable onSelectTicker={handleSearch} />
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm text-center animate-fade-in">
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
                  <div className="h-8 w-24 bg-gray-200 rounded-lg" />
                  <div className="h-8 w-32 bg-gray-200 rounded-lg" />
                </div>
              ) : analysis && (
                <div className="bg-navy-800 rounded-2xl px-5 py-4 shadow-card animate-fade-in flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-bold text-gray-900 font-mono">
                      {score?.ticker}
                    </h2>
                    {profile?.companyName && (
                      <span className="text-gray-600 text-sm">{profile.companyName}</span>
                    )}
                    {score?.regime && <RegimeBadge regime={score.regime} />}
                    {profile?.sector && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {profile.sector}
                      </span>
                    )}
                    {profile?.exchange && (
                      <span className="text-xs text-gray-400">{profile.exchange}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {quote?.price !== undefined && (
                      <span className="text-2xl font-bold text-gray-900 font-mono">
                        {formatPrice(quote.price)}
                      </span>
                    )}
                    <button
                      onClick={handleRefresh}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600
                                 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
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
                      <div className="text-xs text-gray-400 uppercase tracking-widest mb-3">
                        Confidence Factor
                      </div>
                      <ConfidenceGauge score={score.confidenceFactor} size={200} />
                      <p className="text-xs text-gray-400 mt-2 text-center max-w-xs">
                        High score = lower-risk setup. This is <em>not</em> a buy/sell recommendation.
                      </p>
                    </div>

                    {/* Score decomposition bar */}
                    <ScoreDecomposition metrics={score.metrics} total={score.confidenceFactor} />

                    {/* Quick stats */}
                    {quickStats && (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {quickStats.map(stat => (
                          <div key={stat.label} className="bg-gray-50 rounded-xl p-3">
                            <div className="text-xs text-gray-400 mb-1">{stat.label}</div>
                            <div
                              className={`text-sm font-semibold ${
                                stat.positive === true
                                  ? 'text-emerald-700'
                                  : stat.positive === false
                                  ? 'text-red-700'
                                  : 'text-gray-800'
                              }`}
                            >
                              {stat.value}
                            </div>
                            {stat.sub && (
                              <div className="text-xs text-gray-400 mt-0.5">{stat.sub}</div>
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

              {/* Technical context — price trend, 52-week range, relative volume */}
              {!loading && analysis && (analysis.history?.length ?? 0) >= 3 && (
                <div className="bg-navy-800 rounded-2xl p-4 shadow-card animate-fade-in space-y-5">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                    Technical Context
                  </h2>
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Price vs Moving Averages</p>
                    <PriceTrendChart history={analysis.history} quote={analysis.quote} />
                  </div>
                  {quote?.yearLow !== undefined && quote.yearHigh !== undefined &&
                   quote.price !== undefined && quote.yearHigh > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">52-Week Range</p>
                      <RangeBar52w
                        yearLow={quote.yearLow}
                        yearHigh={quote.yearHigh}
                        price={quote.price}
                      />
                    </div>
                  )}
                  {quote?.volume !== undefined && quote.avgVolume !== undefined &&
                   quote.avgVolume > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Relative Volume</p>
                      <RvolGauge volume={quote.volume} avgVolume={quote.avgVolume} />
                    </div>
                  )}
                </div>
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
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">About</h3>
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">
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
              <p className="text-gray-500 text-sm">Type any ticker above to see its confidence score</p>
              <p className="text-gray-400 text-xs mt-1">Works with any US-listed stock, penny stock, or ETF</p>
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
      <footer className="border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-5 text-center space-y-1">
          <p className="text-xs text-gray-500">
            <strong className="text-gray-600">Educational tool only.</strong>{' '}
            Not financial advice. Scores measure risk/quality characteristics, not future returns.
            Past performance is not indicative of future results.
          </p>
          <p className="text-xs text-gray-400">
            Data via Financial Modeling Prep · Refreshes every 5 minutes · Free tier rate-limit aware
          </p>
          <p className="text-xs text-gray-300">
            {process.env.NEXT_PUBLIC_BUILD_TIME
              ? `Built ${new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleString('en-GB', {
                  timeZone: 'Europe/London',
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
                })}`
              : 'Development build'}
          </p>
        </div>
      </footer>
    </div>
  );
}
