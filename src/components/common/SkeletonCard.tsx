import React from 'react';

interface SkeletonCardProps {
  count?: number;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-xs animate-pulse flex flex-col justify-between"
          aria-hidden="true"
        >
          <div>
            {/* Image Placeholder */}
            <div className="aspect-video bg-slate-200 dark:bg-slate-700 relative overflow-hidden">
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
            </div>

            {/* Content Placeholder */}
            <div className="p-4 space-y-2.5">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-3/4" />
              <div className="space-y-1.5">
                <div className="h-3 bg-slate-100 dark:bg-slate-700/60 rounded-md w-full" />
                <div className="h-3 bg-slate-100 dark:bg-slate-700/60 rounded-md w-5/6" />
              </div>
            </div>
          </div>

          {/* Footer Placeholder */}
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-24" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-16" />
          </div>
        </div>
      ))}
    </>
  );
};
