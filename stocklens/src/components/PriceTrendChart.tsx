'use client';

import { FMPHistoricalPrice, FMPQuote } from '@/types/stock';

interface Props {
  history: FMPHistoricalPrice[];  // newest-first from FMP
  quote: Partial<FMPQuote>;
}

// Viewbox dimensions
const W = 500;
const H = 148;
const PAD_L = 4;
const PAD_R = 64;   // room for the current-price label on the right
const PAD_T = 10;
const PAD_B = 10;

function fmt(p: number): string {
  if (p >= 1000) return `$${p.toFixed(0)}`;
  if (p >= 10)   return `$${p.toFixed(2)}`;
  return `$${p.toFixed(3)}`;
}

function LegendLine({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <svg width="20" height="8" viewBox="0 0 20 8" aria-hidden>
      <line
        x1="0" y1="4" x2="20" y2="4"
        stroke={color} strokeWidth={dashed ? 1.2 : 1.8}
        strokeDasharray={dashed ? '4 3' : undefined}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function PriceTrendChart({ history, quote }: Props) {
  if (history.length < 3) {
    return (
      <p className="text-xs text-gray-400 text-center py-3">
        Insufficient price history for chart.
      </p>
    );
  }

  // Reverse to oldest-first for left→right plotting
  const closes = [...history].reverse().map(h => h.close);
  const n = closes.length;

  // 50-day MA: prefer FMP-provided quote value; fall back to computing from last 50 closes
  const ma50: number | null =
    quote.priceAvg50 ??
    (closes.length >= 50
      ? closes.slice(-50).reduce((s, v) => s + v, 0) / 50
      : null);

  // 200-day MA: only use FMP quote value — we don't have 200 days of history to compute it
  const ma200: number | null = quote.priceAvg200 ?? null;

  // Compute Y-axis range, including band bounds so they always fit
  const allValues = [...closes];
  if (ma50  !== null) { allValues.push(ma50  * 0.88, ma50  * 1.12); }
  if (ma200 !== null) { allValues.push(ma200); }
  const minP = Math.min(...allValues);
  const maxP = Math.max(...allValues);
  const priceRange = maxP - minP || 1;

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const sx = (i: number)    => PAD_L + (i / Math.max(n - 1, 1)) * innerW;
  const sy = (price: number) => PAD_T + innerH * (1 - (price - minP) / priceRange);

  const pricePoints = closes
    .map((p, i) => `${sx(i).toFixed(1)},${sy(p).toFixed(1)}`)
    .join(' ');

  const currentPrice = quote.price ?? closes[n - 1];
  const dotX = sx(n - 1);
  const dotY = sy(currentPrice);

  const ma50Y   = ma50  !== null ? sy(ma50)  : null;
  const ma200Y  = ma200 !== null ? sy(ma200) : null;
  const bandTop = ma50  !== null ? sy(ma50 * 1.10) : null;
  const bandBot = ma50  !== null ? sy(ma50 * 0.90) : null;

  const chartRight = W - PAD_R; // right edge of the chart area

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        aria-label="Price trend with moving averages"
      >
        {/* ±10% band around 50-day MA */}
        {bandTop !== null && bandBot !== null && (
          <rect
            x={PAD_L} y={Math.min(bandTop, bandBot)}
            width={innerW}
            height={Math.abs(bandBot - bandTop)}
            fill="rgba(59,130,246,0.08)"
          />
        )}

        {/* 200-day MA — horizontal dashed line */}
        {ma200Y !== null && (
          <line
            x1={PAD_L} y1={ma200Y} x2={chartRight} y2={ma200Y}
            stroke="#F59E0B" strokeWidth="1" strokeDasharray="5 3" opacity="0.85"
          />
        )}

        {/* 50-day MA — horizontal dashed line */}
        {ma50Y !== null && (
          <line
            x1={PAD_L} y1={ma50Y} x2={chartRight} y2={ma50Y}
            stroke="#3B82F6" strokeWidth="1.2" strokeDasharray="5 3" opacity="0.9"
          />
        )}

        {/* Price line */}
        <polyline
          points={pricePoints}
          fill="none"
          stroke="#6B7280"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Current-price endpoint dot */}
        <circle cx={dotX} cy={dotY} r="3" fill="#374151" stroke="#9CA3AF" strokeWidth="1" />

        {/* Current-price label (right padding area) */}
        <text
          x={chartRight + 5} y={dotY}
          dominantBaseline="middle"
          fill="#111827"
          fontSize="10"
          fontWeight="600"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {fmt(currentPrice)}
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 px-1 text-xs">
        <span className="flex items-center gap-1.5 text-gray-500">
          <LegendLine color="#6B7280" />
          Price
        </span>
        {ma50 !== null && (
          <span className="flex items-center gap-1.5 text-blue-600">
            <LegendLine color="#3B82F6" dashed />
            50-day MA
            <span className="text-gray-500">{fmt(ma50)}</span>
          </span>
        )}
        {ma200 !== null && (
          <span className="flex items-center gap-1.5 text-amber-600">
            <LegendLine color="#F59E0B" dashed />
            200-day MA
            <span className="text-gray-500">{fmt(ma200)}</span>
          </span>
        )}
        {ma50 !== null && (
          <span className="text-gray-400">
            ± 10% band shaded
          </span>
        )}
      </div>
    </div>
  );
}
