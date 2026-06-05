'use client';

import { MetricFlag, MetricScore } from '@/types/stock';

interface Props {
  metrics: MetricScore[];
}

const FLAG_STYLES: Record<MetricFlag, { bar: string; badge: string; text: string }> = {
  good:    { bar: 'bg-emerald-500',  badge: 'bg-emerald-500/15 text-emerald-400',  text: 'text-emerald-400' },
  neutral: { bar: 'bg-blue-500',     badge: 'bg-blue-500/15 text-blue-300',        text: 'text-blue-300'    },
  warning: { bar: 'bg-amber-500',    badge: 'bg-amber-500/15 text-amber-400',      text: 'text-amber-400'   },
  danger:  { bar: 'bg-red-500',      badge: 'bg-red-500/15 text-red-400',          text: 'text-red-400'     },
};

function MetricRow({ metric }: { metric: MetricScore }) {
  const styles = FLAG_STYLES[metric.flag];
  const barWidth = `${metric.score}%`;
  const weightPct = Math.round(metric.weight * 100);
  const contribution = metric.contribution.toFixed(1);

  return (
    <div className="group py-3 border-b border-navy-700/50 last:border-b-0 animate-fade-in">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200">{metric.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${styles.badge}`}>
            {metric.label}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Wt: <span className="text-slate-400">{weightPct}%</span></span>
          <span className={`font-semibold ${styles.text}`}>{Math.round(metric.score)}</span>
        </div>
      </div>
      <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden mb-1.5">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${styles.bar}`}
          style={{ width: barWidth }} />
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{metric.detail}</p>
      <p className="text-xs text-slate-600 mt-0.5">
        Contributes <span className={`font-medium ${styles.text}`}>{contribution} pts</span> to final score
      </p>
    </div>
  );
}

export default function MetricBreakdown({ metrics }: Props) {
  return (
    <div className="bg-navy-800 rounded-2xl p-4 shadow-card">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Score Breakdown</h2>
      <p className="text-xs text-slate-600 mb-3">Each factor&apos;s weighted contribution to the Confidence Factor</p>
      <div className="divide-y divide-navy-700/40">
        {metrics.map(m => <MetricRow key={m.name} metric={m} />)}
      </div>
    </div>
  );
}
