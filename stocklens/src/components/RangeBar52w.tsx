'use client';

interface Props {
  yearLow: number;
  yearHigh: number;
  price: number;
}

const W = 400;
const H = 64;
const BAR_X1 = 6;
const BAR_X2 = 394;
const BAR_Y  = 30;
const BAR_H  = 10;

function fmt(p: number): string {
  if (p >= 1000) return `$${p.toFixed(0)}`;
  if (p >= 10)   return `$${p.toFixed(2)}`;
  return `$${p.toFixed(3)}`;
}

// Map a price to SVG x coordinate within the bar
function toX(price: number, low: number, high: number): number {
  const pct = Math.max(0, Math.min(1, (price - low) / (high - low)));
  return BAR_X1 + pct * (BAR_X2 - BAR_X1);
}

// Color for the position in the range: danger at extremes, good in middle
function positionColor(pct: number): string {
  // Comfortable zone: 20%–80% of range
  if (pct >= 0.20 && pct <= 0.80) return '#10B981';  // emerald — healthy middle
  if (pct >= 0.10 && pct <= 0.90) return '#F59E0B';  // amber — approaching extreme
  return '#EF4444';                                    // red — near year extreme
}

export default function RangeBar52w({ yearLow, yearHigh, price }: Props) {
  if (yearHigh <= yearLow || yearHigh === 0) {
    return <p className="text-xs text-gray-400 text-center py-2">52-week range unavailable.</p>;
  }

  const pct = Math.max(0, Math.min(1, (price - yearLow) / (yearHigh - yearLow)));
  const markerX = toX(price, yearLow, yearHigh);
  const color = positionColor(pct);
  const pctLabel = `${Math.round(pct * 100)}% of range`;

  // Marker: small downward-pointing triangle above the bar
  const triTop = BAR_Y - 10;
  const triMid = BAR_Y - 2;
  const triPoints = `${markerX - 5},${triTop} ${markerX + 5},${triTop} ${markerX},${triMid}`;

  // Price label — keep inside viewBox (nudge at edges)
  const labelX = Math.max(28, Math.min(W - 28, markerX));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      aria-label={`52-week range: ${fmt(yearLow)} to ${fmt(yearHigh)}, current ${fmt(price)}`}
    >
      {/* Track background */}
      <rect
        x={BAR_X1} y={BAR_Y} width={BAR_X2 - BAR_X1} height={BAR_H}
        rx="5" fill="#E5E7EB"
      />

      {/* Filled portion from low to current price */}
      <rect
        x={BAR_X1} y={BAR_Y}
        width={Math.max(0, markerX - BAR_X1)}
        height={BAR_H}
        rx="5" fill={color} opacity="0.7"
      />

      {/* Marker triangle */}
      <polygon points={triPoints} fill={color} />

      {/* Price label above marker */}
      <text
        x={labelX} y={triTop - 2}
        textAnchor="middle" dominantBaseline="auto"
        fill={color} fontSize="10" fontWeight="600"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {fmt(price)}
      </text>

      {/* % of range label below triangle (between triangle and bar) */}
      <text
        x={labelX} y={BAR_Y + BAR_H + 13}
        textAnchor="middle" dominantBaseline="middle"
        fill="#9CA3AF" fontSize="8.5"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {pctLabel}
      </text>

      {/* yearLow label */}
      <text
        x={BAR_X1} y={BAR_Y + BAR_H + 13}
        textAnchor="start" dominantBaseline="middle"
        fill="#9CA3AF" fontSize="9"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {fmt(yearLow)}
      </text>

      {/* yearHigh label */}
      <text
        x={BAR_X2} y={BAR_Y + BAR_H + 13}
        textAnchor="end" dominantBaseline="middle"
        fill="#9CA3AF" fontSize="9"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {fmt(yearHigh)}
      </text>
    </svg>
  );
}
