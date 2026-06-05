import { NextResponse } from 'next/server';
import { getGainers, getActives } from '@/lib/fmp';
import { detectRegime } from '@/lib/scoring/engine';
import { FMPMoverItem, LeaderboardItem, LeaderboardResponse, StockRegime } from '@/types/stock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toLeaderboardItem(item: FMPMoverItem): LeaderboardItem {
  const price = item.price ?? 0;
  const regime = detectRegime(price, null) as StockRegime;

  // Mini confidence heuristic: just based on price + volume proxy
  // Full scoring would require 4× more API calls — not worth it for the leaderboard.
  let miniConfidence: number | null = null;
  if (price > 0) {
    let base = 55;
    if (price > 10)  base = 62;
    if (price > 50)  base = 68;
    if (price < 1)   base = 35;
    if (item.volume && item.volume > 1_000_000) base += 5;
    if (Math.abs(item.changesPercentage ?? 0) > 20) base -= 10;
    miniConfidence = Math.min(85, Math.max(10, base));
  }

  return {
    symbol: item.symbol,
    name: item.name ?? item.symbol,
    price,
    change: item.change ?? 0,
    changesPercentage: item.changesPercentage ?? 0,
    volume: item.volume ?? null,
    miniConfidence,
    regime,
  };
}

export async function GET() {
  const [gainers, actives] = await Promise.all([getGainers(), getActives()]);

  const response: LeaderboardResponse = {
    gainers: gainers.slice(0, 10).map(toLeaderboardItem),
    actives: actives.slice(0, 10).map(toLeaderboardItem),
    fetchedAt: Date.now(),
  };

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
