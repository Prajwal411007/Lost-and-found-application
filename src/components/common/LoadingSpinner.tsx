import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className,
  message,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center p-6 text-slate-500', className)}>
      <Loader2 className={cn('animate-spin text-blue-600', sizeClasses[size])} />
      {message && <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400">{message}</p>}
    </div>
  );
};

