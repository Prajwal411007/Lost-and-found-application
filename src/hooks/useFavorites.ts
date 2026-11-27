import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const LOCAL_STORAGE_FAVORITES_KEY = 'lostandfound_guest_favorites';

export function useFavorites() {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Load favorites from Supabase or localStorage
  useEffect(() => {
    let isMounted = true;

    const loadFavorites = async () => {
      setIsLoading(true);
      try {
        if (user && isSupabaseConfigured && supabase) {
          const { data, error } = await supabase
            .from('user_favorites')
            .select('item_id')
            .eq('user_id', user.id);

          if (!error && data && isMounted) {
            setFavoriteIds(new Set(data.map((row: { item_id: string }) => row.item_id)));
            return;
          }
        }

        // Fallback to localStorage
        const stored = localStorage.getItem(LOCAL_STORAGE_FAVORITES_KEY);
        if (stored && isMounted) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              setFavoriteIds(new Set(parsed));
            }
          } catch {
            // ignore parse errors
          }
        }
      } catch (err) {
        console.error('Failed to load favorites:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadFavorites();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const toggleFavorite = useCallback(
    async (itemId: string) => {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        const willBeFavorite = !next.has(itemId);
        if (willBeFavorite) {
          next.add(itemId);
        } else {
          next.delete(itemId);
        }

        // Sync with local storage
        localStorage.setItem(LOCAL_STORAGE_FAVORITES_KEY, JSON.stringify(Array.from(next)));

        // Sync with database if logged in
        if (user && isSupabaseConfigured && supabase) {
          if (willBeFavorite) {
            supabase
              .from('user_favorites')
              .insert({ user_id: user.id, item_id: itemId })
              .then(({ error }) => {
                if (error) console.error('Failed to save favorite:', error);
              });
          } else {
            supabase
              .from('user_favorites')
              .delete()
              .eq('user_id', user.id)
              .eq('item_id', itemId)
              .then(({ error }) => {
                if (error) console.error('Failed to remove favorite:', error);
              });
          }
        }

        return next;
      });
    },
    [user]
  );

  const isFavorite = useCallback(
    (itemId: string) => favoriteIds.has(itemId),
    [favoriteIds]
  );

  return {
    favoriteIds: Array.from(favoriteIds),
    isFavorite,
    toggleFavorite,
    isLoading,
  };
}
