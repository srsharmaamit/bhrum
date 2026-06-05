'use client';

import { useState, FormEvent, KeyboardEvent } from 'react';

interface Props {
  onSearch: (ticker: string) => void;
  loading: boolean;
  initialValue?: string;
}

const SUGGESTIONS = ['AAPL', 'TSLA', 'NVDA', 'AMC', 'GME', 'SNDL', 'PLTR', 'SPY'];

export default function SearchBar({ onSearch, loading, initialValue = '' }: Props) {
  const [value, setValue] = useState(initialValue);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim().toUpperCase();
    if (trimmed) onSearch(trimmed);
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = value.trim().toUpperCase();
      if (trimmed) onSearch(trimmed);
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
          <input type="text" value={value}
            onChange={e => setValue(e.target.value.toUpperCase())}
            onKeyDown={handleKey}
            placeholder="Enter ticker symbol (e.g. AAPL, GME, TSLA)"
            maxLength={10} autoComplete="off" spellCheck={false}
            className="w-full pl-12 pr-32 py-3.5 bg-navy-800 border border-navy-600 rounded-2xl
                       text-slate-100 placeholder-slate-600 font-mono text-sm
                       focus:outline-none focus:ring-2 focus:ring-accent/60 focus:border-accent/50
                       transition-all duration-200 shadow-card" />
          <button type="submit" disabled={loading || !value.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2
                       px-4 py-2 bg-accent hover:bg-accent-dim disabled:bg-navy-700 disabled:text-slate-600
                       text-white text-sm font-semibold rounded-xl
                       transition-colors duration-200 disabled:cursor-not-allowed flex items-center gap-2">
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Analyzing…
              </>
            ) : 'Analyze'}
          </button>
        </div>
      </form>
      <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => { setValue(s); onSearch(s); }}
            className="px-2.5 py-1 text-xs font-mono text-slate-500 bg-navy-800/60 border border-navy-700
                       rounded-lg hover:border-accent/50 hover:text-accent transition-colors duration-150">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
