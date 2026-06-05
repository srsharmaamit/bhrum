'use client';

import { ScoringResult } from '@/types/stock';

interface Props {
  scoring: ScoringResult;
}

const BAND_STYLES: Record<string, string> = {
  'Relatively Stable':               'border-emerald-500/40 bg-emerald-500/5 text-emerald-400',
  'Reasonable Risk / Reward':        'border-blue-500/40 bg-blue-500/5 text-blue-300',
  'Elevated Caution':                'border-amber-500/40 bg-amber-500/5 text-amber-400',
  'Speculative — Manageable Risk':   'border-amber-500/40 bg-amber-500/5 text-amber-400',
  'Speculative — High Risk':         'border-orange-500/40 bg-orange-500/5 text-orange-400',
  'Speculative — Very High Risk':    'border-red-500/40 bg-red-500/5 text-red-400',
  'High Risk — Tread Carefully':     'border-red-500/40 bg-red-500/5 text-red-400',
  'Extreme Caution — Avoid':         'border-red-600/60 bg-red-600/10 text-red-400',
};

function getBandStyle(band: string): string {
  return BAND_STYLES[band] ?? 'border-slate-500/40 bg-slate-500/5 text-slate-300';
}

export default function VerdictPanel({ scoring }: Props) {
  const bandStyle = getBandStyle(scoring.verdictBand);

  return (
    <div className="bg-navy-800 rounded-2xl p-4 shadow-card space-y-4 animate-slide-up">
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Verdict</h2>
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold ${bandStyle}`}>
          {scoring.verdictBand}
        </div>
        <p className="text-xs text-slate-600 mt-1.5">
          Regime detected: <span className="text-slate-400 capitalize">{scoring.regime}</span>
          {' '}· Confidence Factor: <span className="text-slate-300 font-medium">{scoring.confidenceFactor}/100</span>
          {' '}· Data completeness: <span className="text-slate-300 font-medium">{scoring.dataCompleteness}%</span>
        </p>
      </div>
      {scoring.verdictWhy.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="inline-block w-1 h-3 bg-accent rounded-full" />
            Key Drivers
          </h3>
          <ul className="space-y-1.5">
            {scoring.verdictWhy.map((why, i) => (
              <li key={i} className="text-sm text-slate-300 leading-relaxed pl-3 border-l border-accent/30">{why}</li>
            ))}
          </ul>
        </div>
      )}
      {scoring.verdictWatch.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="inline-block w-1 h-3 bg-amber-500 rounded-full" />
            What to Watch Before Entering
          </h3>
          <ul className="space-y-2">
            {scoring.verdictWatch.map((cond, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-400 leading-relaxed">
                <span className="text-amber-500 mt-0.5 shrink-0">›</span>
                <span>{cond}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-slate-600 pt-2 border-t border-navy-700/50">
        This score measures risk/quality characteristics only. High confidence ≠ guaranteed profit. Not financial advice.
      </p>
    </div>
  );
}
