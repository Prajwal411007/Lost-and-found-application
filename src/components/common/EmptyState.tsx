import React from 'react';
import { PackageOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-800/40',
        className
      )}
    >
      <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full mb-3">
        {icon || <PackageOpen className="w-8 h-8" />}
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-sm mb-4">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

