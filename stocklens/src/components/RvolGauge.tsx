'use client';

interface Props {
  volume: number;
  avgVolume: number;
}

const W = 400;
const H = 52;
const BAR_X1 = 6;
const BAR_X2 = 394;
const BAR_Y  = 14;
const BAR_H  = 12;
const MAX_DISPLAY = 3.5; // x-axis cap (ratios above this are clamped visually)

// Thresholds
const STRONG   = 3.0;
const ELEVATED = 1.5;
const NORMAL   = 1.0;

function rvolColor(ratio: number): string {
  if (ratio >= STRONG)   return '#10B981'; // emerald — very strong
  if (ratio >= ELEVATED) return '#F59E0B'; // amber — elevated
  if (ratio >= NORMAL)   return '#3B82F6'; // accent blue — normal
  return '#64748B';                         // slate — below average
}

function rvolLabel(ratio: number): string {
  if (ratio >= STRONG)   return 'Strong';
  if (ratio >= ELEVATED) return 'Elevated';
  if (ratio >= NORMAL)   return 'Normal';
  return 'Quiet';
}

function toBarX(ratio: number): number {
  const pct = Math.min(ratio, MAX_DISPLAY) / MAX_DISPLAY;
  return BAR_X1 + pct * (BAR_X2 - BAR_X1);
}

function thresholdX(ratio: number): number {
  return BAR_X1 + (Math.min(ratio, MAX_DISPLAY) / MAX_DISPLAY) * (BAR_X2 - BAR_X1);
}

function fmtVol(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return `${v}`;
}

export default function RvolGauge({ volume, avgVolume }: Props) {
  if (avgVolume <= 0) {
    return <p className="text-xs text-gray-400 text-center py-2">Volume data unavailable.</p>;
  }

  const ratio = volume / avgVolume;
  const color = rvolColor(ratio);
  const label = rvolLabel(ratio);
  const barX = toBarX(ratio);
  const ratioFmt = ratio.toFixed(2);

  // Positions for threshold tick marks
  const t1X  = thresholdX(NORMAL);     // 1×
  const t15X = thresholdX(ELEVATED);   // 1.5×
  const t3X  = thresholdX(STRONG);     // 3×
  const tickTop    = BAR_Y - 3;
  const tickBottom = BAR_Y + BAR_H + 3;

  // Value label x (clamp inside viewBox)
  const valLabelX = Math.max(20, Math.min(W - 20, barX));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      aria-label={`Relative volume: ${ratioFmt}× average — ${label}`}
    >
      {/* Track background */}
      <rect
        x={BAR_X1} y={BAR_Y} width={BAR_X2 - BAR_X1} height={BAR_H}
        rx="6" fill="#E5E7EB"
      />

      {/* Filled bar up to current ratio (clamped) */}
      <rect
        x={BAR_X1} y={BAR_Y}
        width={Math.max(0, barX - BAR_X1)}
        height={BAR_H}
        rx="6" fill={color} opacity="0.85"
      />

      {/* Threshold tick marks */}
      {[{ x: t1X, label: '1×' }, { x: t15X, label: '1.5×' }, { x: t3X, label: '3×' }].map(tk => (
        <g key={tk.label}>
          <line
            x1={tk.x} y1={tickTop} x2={tk.x} y2={tickBottom}
            stroke="#9CA3AF" strokeWidth="1.5"
          />
          <text
            x={tk.x} y={BAR_Y + BAR_H + 13}
            textAnchor="middle" dominantBaseline="middle"
            fill="#9CA3AF" fontSize="8.5"
            fontFamily="Inter, system-ui, sans-serif"
          >
            {tk.label}
          </text>
        </g>
      ))}

      {/* RVOL value + label above bar */}
      <text
        x={valLabelX} y={BAR_Y - 5}
        textAnchor="middle" dominantBaseline="auto"
        fill={color} fontSize="10" fontWeight="700"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {ratioFmt}× — {label}
      </text>

      {/* Today's volume footnote — right-aligned */}
      <text
        x={BAR_X2} y={BAR_Y + BAR_H + 13}
        textAnchor="end" dominantBaseline="middle"
        fill="#9CA3AF" fontSize="8.5"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {fmtVol(volume)} / {fmtVol(avgVolume)} avg
      </text>
    </svg>
  );
}
