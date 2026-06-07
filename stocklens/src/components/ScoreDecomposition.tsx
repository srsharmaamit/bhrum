'use client';

import { MetricFlag, MetricScore } from '@/types/stock';

interface Props {
  metrics: MetricScore[];
  total: number;
}

const FLAG_BAR: Record<MetricFlag, string> = {
  good:    'bg-emerald-500',
  neutral: 'bg-blue-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
};

const FLAG_TEXT: Record<MetricFlag, string> = {
  good:    'text-emerald-400',
  neutral: 'text-blue-300',
  warning: 'text-amber-400',
  danger:  'text-red-400',
};

export default function ScoreDecomposition({ metrics, total }: Props) {
  const safeTotal = total || 1;

  return (
    <div className="mt-3 mb-1">
      {/* Segmented contribution bar — each segment width = contribution pts out of 100 */}
      <div className="relative h-2.5 bg-navy-700 rounded-full overflow-hidden flex">
        {metrics
          .filter(m => m.contribution > 0)
          .map(m => (
            <div
              key={m.name}
              className={`h-full ${FLAG_BAR[m.flag]} transition-all duration-700`}
              style={{ width: `${m.contribution}%` }}
              title={`${m.name}: ${m.contribution.toFixed(1)} pts — ${m.detail}`}
            />
          ))}
      </div>

      {/* Legend grid */}
      <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5">
        {metrics.map(m => (
          <div
            key={m.name}
            className="flex items-center gap-1.5 min-w-0 text-xs cursor-default"
            title={m.detail}
          >
            <span className={`inline-block w-2 h-2 rounded-sm shrink-0 ${FLAG_BAR[m.flag]}`} />
            <span className="text-slate-400 truncate">{m.name}</span>
            <span className={`ml-auto shrink-0 font-semibold tabular-nums ${FLAG_TEXT[m.flag]}`}>
              {m.contribution.toFixed(1)}
            </span>
            <span className="text-slate-600 shrink-0">
              /{Math.round(m.weight * 100)}%
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-700 mt-2 text-center">
        Segments show each metric&apos;s weighted contribution · {Math.round(safeTotal)}/100 total
      </p>
    </div>
  );
}
