import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Category } from '@/types';

async function fetchCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase client is not configured');
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*');

  if (error) {
    console.error('Error fetching categories from Supabase:', error);
    throw new Error(error.message || 'Failed to fetch categories');
  }

  return (data as Category[]) || [];
}

async function fetchCategoryCounts(): Promise<Record<string, number>> {
  if (!isSupabaseConfigured || !supabase) {
    return {};
  }

  try {
    const { data, error } = await supabase
      .from('items')
      .select('category_id');

    if (error || !data) return {};

    const counts: Record<string, number> = {};
    for (const item of data) {
      if (item.category_id) {
        counts[item.category_id] = (counts[item.category_id] || 0) + 1;
      }
    }
    return counts;
  } catch (err) {
    console.warn('Error fetching category counts:', err);
    return {};
  }
}

export function useCategories() {
  const {
    data = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<Category[], Error>({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
  });

  // Ordered with "Other" last and the rest alphabetically
  const categories = useMemo(() => {
    if (!data || data.length === 0) return [];
    const list = [...data];
    return list.sort((a, b) => {
      const aName = a.name.trim().toLowerCase();
      const bName = b.name.trim().toLowerCase();
      if (aName === 'other') return 1;
      if (bName === 'other') return -1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [data]);

  const getCategoryById = (id?: string | null): Category | undefined => {
    if (!id) return undefined;
    return categories.find((c) => c.id === id);
  };

  const getCategoryBySlug = (slug?: string | null): Category | undefined => {
    if (!slug) return undefined;
    return categories.find((c) => c.slug === slug);
  };

  return {
    categories,
    rawCategories: data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    getCategoryById,
    getCategoryBySlug,
    isEmpty: !isLoading && !isError && categories.length === 0,
  };
}

export function useCategoryItemCounts() {
  return useQuery<Record<string, number>>({
    queryKey: ['category-item-counts'],
    queryFn: fetchCategoryCounts,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
