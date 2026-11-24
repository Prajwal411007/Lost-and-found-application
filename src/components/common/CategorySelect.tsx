import React from 'react';
import { AlertCircle, RotateCcw, Loader2, Tag } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { CategoryIcon } from '@/lib/categoryIcons';

export interface CategorySelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  errorMessage?: string;
  label?: string;
  required?: boolean;
  showIconPreview?: boolean;
}

export const CategorySelect = React.forwardRef<HTMLSelectElement, CategorySelectProps>(
  (
    {
      value,
      errorMessage,
      label = 'Category',
      required = true,
      disabled = false,
      showIconPreview = true,
      className = '',
      id = 'category-select',
      ...selectProps
    },
    ref
  ) => {
    const { categories, isLoading, isError, error, refetch, isFetching, isEmpty } = useCategories();

    const selectedCategory = categories.find((c) => c.id === value || c.slug === value);

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <div className="flex items-center justify-between">
            <label
              htmlFor={id}
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              {label} {required && <span className="text-rose-500">*</span>}
            </label>

            {isFetching && !isLoading && (
              <span className="flex items-center text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" /> Updating...
              </span>
            )}
          </div>
        )}

        <div className="relative flex items-center">
          {showIconPreview && (
            <div className="absolute left-3.5 pointer-events-none text-slate-400 dark:text-slate-500">
              {selectedCategory ? (
                <CategoryIcon
                  icon={selectedCategory.icon}
                  slug={selectedCategory.slug}
                  className="w-4 h-4 text-blue-600 dark:text-blue-400"
                />
              ) : (
                <Tag className="w-4 h-4" />
              )}
            </div>
          )}

          <select
            ref={ref}
            id={id}
            value={value}
            disabled={disabled || isLoading || isEmpty}
            aria-required={required}
            aria-invalid={Boolean(errorMessage || isError)}
            aria-describedby={
              errorMessage
                ? `${id}-error`
                : isError
                ? `${id}-fetch-error`
                : isEmpty
                ? `${id}-empty`
                : undefined
            }
            className={`w-full py-2.5 ${showIconPreview ? 'pl-10' : 'pl-3.5'} pr-8 rounded-xl border text-sm transition appearance-none bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed ${
              errorMessage || isError
                ? 'border-rose-300 dark:border-rose-700 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-slate-200 dark:border-slate-700 focus:border-blue-500'
            } ${className}`}
            {...selectProps}
          >
            {isLoading ? (
              <option value="" disabled>
                Loading categories...
              </option>
            ) : isError ? (
              <option value="" disabled>
                Error loading categories
              </option>
            ) : isEmpty ? (
              <option value="" disabled>
                Categories unavailable
              </option>
            ) : (
              <option value="">Select Category</option>
            )}

            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Custom chevron dropdown arrow */}
          <div className="absolute right-3.5 pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Inline Fetch Error State with Retry Button */}
        {isError && (
          <div
            id={`${id}-fetch-error`}
            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2 animate-in fade-in duration-200"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>
                {error?.message?.includes('permission denied')
                  ? 'Database permission denied for categories. Please run migration 003_more_categories.sql.'
                  : 'Failed to load categories.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/60 dark:hover:bg-rose-800 text-rose-800 dark:text-rose-200 font-bold transition text-[11px]"
              title="Retry loading categories"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Empty State warning */}
        {isEmpty && (
          <div
            id={`${id}-empty`}
            className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between"
          >
            <span>Categories unavailable. Please run migration 003_more_categories.sql in Supabase.</span>
            <button
              type="button"
              onClick={() => refetch()}
              className="ml-2 font-bold underline hover:text-amber-900"
            >
              Check again
            </button>
          </div>
        )}

        {/* Validation error message from form */}
        {errorMessage && !isError && (
          <p id={`${id}-error`} className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }
);

CategorySelect.displayName = 'CategorySelect';
