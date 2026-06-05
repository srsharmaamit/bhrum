'use client';

import { useEffect, useState } from 'react';

interface Props {
  score: number;
  size?: number;
}

function scoreToColor(score: number): string {
  if (score >= 70) return '#10B981';
  if (score >= 50) return '#84CC16';
  if (score >= 35) return '#F59E0B';
  if (score >= 20) return '#F97316';
  return '#EF4444';
}

function scoreToLabel(score: number): string {
  if (score >= 78) return 'Stable';
  if (score >= 60) return 'Fair';
  if (score >= 42) return 'Caution';
  if (score >= 25) return 'High Risk';
  return 'Avoid';
}

export default function ConfidenceGauge({ score, size = 200 }: Props) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const duration = 800;
    const start = performance.now();
    const from = displayed;

    function step(now: number) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(from + (score - from) * eased));
      if (t < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const radius = (size / 2) * 0.78;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75;
  const arcLength = circumference * arcFraction;
  const dashOffset = arcLength - arcLength * (displayed / 100);
  const color = scoreToColor(displayed);
  const label = scoreToLabel(displayed);
  const startAngle = 135;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Confidence Factor: ${score} — ${label}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <filter id="gauge-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#1E3560"
          strokeWidth={size * 0.065} strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={0}
          transform={`rotate(${startAngle} ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke={color}
          strokeWidth={size * 0.065} strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(${startAngle} ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease' }}
          filter="url(#gauge-glow)" />
        <text x={cx} y={cy - size * 0.04} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={size * 0.22} fontWeight="700"
          fontFamily="Inter, system-ui, sans-serif"
          style={{ transition: 'fill 0.5s ease' }}>
          {displayed}
        </text>
        <text x={cx} y={cy + size * 0.14} textAnchor="middle" dominantBaseline="middle"
          fill="#64748B" fontSize={size * 0.08} fontFamily="Inter, system-ui, sans-serif">
          / 100
        </text>
      </svg>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 pb-1 text-sm font-semibold tracking-wide"
        style={{ color, transition: 'color 0.5s ease' }}>
        {label}
      </div>
    </div>
  );
}
