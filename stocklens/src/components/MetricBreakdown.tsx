'use client';

import { MetricFlag, MetricScore } from '@/types/stock';

interface Props {
  metrics: MetricScore[];
}

const FLAG_STYLES: Record<MetricFlag, { bar: string; badge: string; text: string }> = {
  good:    { bar: 'bg-emerald-500',  badge: 'bg-emerald-50 text-emerald-700',  text: 'text-emerald-700' },
  neutral: { bar: 'bg-blue-500',     badge: 'bg-blue-50 text-blue-700',        text: 'text-blue-700'    },
  warning: { bar: 'bg-amber-500',    badge: 'bg-amber-50 text-amber-700',      text: 'text-amber-700'   },
  danger:  { bar: 'bg-red-500',      badge: 'bg-red-50 text-red-700',          text: 'text-red-700'     },
};

function MetricRow({ metric }: { metric: MetricScore }) {
  const styles = FLAG_STYLES[metric.flag];
  const barWidth = `${metric.score}%`;
  const weightPct = Math.round(metric.weight * 100);
  const contribution = metric.contribution.toFixed(1);

  return (
    <div className="group py-3 border-b border-gray-200 last:border-b-0 animate-fade-in">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{metric.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${styles.badge}`}>
            {metric.label}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>Wt: <span className="text-gray-600">{weightPct}%</span></span>
          <span className={`font-semibold ${styles.text}`}>{Math.round(metric.score)}</span>
        </div>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1.5">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${styles.bar}`}
          style={{ width: barWidth }} />
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{metric.detail}</p>
      <p className="text-xs text-gray-400 mt-0.5">
        Contributes <span className={`font-medium ${styles.text}`}>{contribution} pts</span> to final score
      </p>
    </div>
  );
}

export default function MetricBreakdown({ metrics }: Props) {
  return (
    <div className="bg-navy-800 rounded-2xl p-4 shadow-card">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Score Breakdown</h2>
      <p className="text-xs text-gray-400 mb-3">Each factor&apos;s weighted contribution to the Confidence Factor</p>
      <div className="divide-y divide-gray-200">
        {metrics.map(m => <MetricRow key={m.name} metric={m} />)}
      </div>
    </div>
  );
}
