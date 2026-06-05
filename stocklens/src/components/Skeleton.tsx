'use client';

export function GaugeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="w-48 h-48 rounded-full bg-navy-700/60 animate-pulse" />
      <div className="h-5 w-32 bg-navy-700/60 rounded-lg animate-pulse" />
    </div>
  );
}

export function QuickStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-navy-800 rounded-xl p-3 animate-pulse">
          <div className="h-3 w-16 bg-navy-700 rounded mb-2" />
          <div className="h-5 w-20 bg-navy-700 rounded" />
        </div>
      ))}
    </div>
  );
}

export function MetricSkeleton() {
  return (
    <div className="bg-navy-800 rounded-2xl p-4 space-y-4 animate-pulse">
      <div className="h-4 w-32 bg-navy-700 rounded" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="space-y-2 py-2">
          <div className="flex justify-between">
            <div className="h-3 w-28 bg-navy-700 rounded" />
            <div className="h-3 w-10 bg-navy-700 rounded" />
          </div>
          <div className="h-1.5 bg-navy-700 rounded-full" />
          <div className="h-3 w-48 bg-navy-700/70 rounded" />
        </div>
      ))}
    </div>
  );
}

export function VerdictSkeleton() {
  return (
    <div className="bg-navy-800 rounded-2xl p-4 space-y-4 animate-pulse">
      <div className="h-4 w-16 bg-navy-700 rounded" />
      <div className="h-8 w-48 bg-navy-700 rounded-xl" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-navy-700 rounded" />
        <div className="h-3 w-5/6 bg-navy-700 rounded" />
        <div className="h-3 w-4/5 bg-navy-700 rounded" />
      </div>
      <div className="space-y-2 pt-2">
        <div className="h-3 w-full bg-navy-700 rounded" />
        <div className="h-3 w-3/4 bg-navy-700 rounded" />
      </div>
    </div>
  );
}
