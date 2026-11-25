import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Clock,
  Package,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  Navigation,
  AlertTriangle,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Item, Category } from '@/types';
import { formatRelativeTime, haversineDistance } from '@/lib/utils';
import { getCategoryDisplayName, formatLocalizedDistance, formatLocalizedNumber } from '@/lib/i18nHelpers';
import { useGeolocation } from '@/contexts/LocationContext';
import { useCategories } from '@/hooks/useCategories';
import { CategoryIcon } from '@/lib/categoryIcons';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';

export const BrowsePage: React.FC = () => {
  const { t, i18n } = useTranslation(['browse', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state
  const queryParam = searchParams.get('q') || '';
  const typeParam = (searchParams.get('type') as 'all' | 'lost' | 'found') || 'all';
  const categoryParam = searchParams.get('category') || '';
  const locationParam = searchParams.get('location') || '';
  const dateRangeParam = searchParams.get('dateRange') || 'all';
  const nearMeParam = searchParams.get('nearMe') === 'true';
  const radiusParam = parseInt(searchParams.get('radius') || '25', 10);
  const sortByParam = searchParams.get('sort') || (nearMeParam ? 'nearest' : 'newest');
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  // Geolocation
  const {
    coords: userCoords,
    status: geoStatus,
    generalArea,
    requestLocation,
    clearLocation,
    openPrompt,
  } = useGeolocation();

  // Categories from shared TanStack Query hook
  const {
    categories,
    isLoading: isLoadingCategories,
    isError: isErrorCategories,
    refetch: refetchCategories,
  } = useCategories();

  // Local state
  const [searchInput, setSearchInput] = useState(queryParam);
  const [items, setItems] = useState<Item[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [showDeniedAlert, setShowDeniedAlert] = useState(false);
  const [isActivatingNearMe, setIsActivatingNearMe] = useState(false);

  const pageSize = 12;

  // Sync search input with URL
  useEffect(() => {
    setSearchInput(queryParam);
  }, [queryParam]);

  // Debounced search query update
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== queryParam) {
        updateFilter('q', searchInput.trim() || undefined);
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const updateFilter = (key: string, value: string | undefined) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value === undefined || value === '' || value === 'all') {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }
    nextParams.set('page', '1'); // Reset to page 1 on filter change
    setSearchParams(nextParams);
  };

  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('page', newPage.toString());
    setSearchParams(nextParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toggle "Near Me" filter
  const handleToggleNearMe = async () => {
    if (nearMeParam) {
      updateFilter('nearMe', undefined);
      updateFilter('sort', 'newest');
      return;
    }

    if (userCoords) {
      updateFilter('nearMe', 'true');
      updateFilter('sort', 'nearest');
      return;
    }

    if (geoStatus === 'denied') {
      setShowDeniedAlert(true);
      return;
    }

    setIsActivatingNearMe(true);
    const loc = await requestLocation();
    setIsActivatingNearMe(false);

    if (loc) {
      updateFilter('nearMe', 'true');
      updateFilter('sort', 'nearest');
    } else if ((geoStatus as string) === 'denied') {
      setShowDeniedAlert(true);
    } else {
      openPrompt();
    }
  };

  // Main data fetcher
  useEffect(() => {
    const fetchItems = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        let query = supabase
          .from('items')
          .select('*, category:categories(*)', { count: 'exact' });

        // Filter by item type (lost or found)
        if (typeParam !== 'all') {
          query = query.eq('type', typeParam);
        }

        // Filter by category slug
        if (categoryParam) {
          const matchedCategory = categories.find((c) => c.slug === categoryParam);
          if (matchedCategory) {
            query = query.eq('category_id', matchedCategory.id);
          }
        }

        // Filter by text search query
        if (queryParam) {
          query = query.or(
            `title.ilike.%${queryParam}%,description.ilike.%${queryParam}%,location_city.ilike.%${queryParam}%`
          );
        }

        // Filter by location string
        if (locationParam) {
          query = query.or(
            `location_city.ilike.%${locationParam}%,location_state.ilike.%${locationParam}%,location_country.ilike.%${locationParam}%,location_landmark.ilike.%${locationParam}%`
          );
        }

        // Filter by date range
        if (dateRangeParam !== 'all') {
          const now = new Date();
          let startDate: Date;
          if (dateRangeParam === 'today') {
            startDate = new Date(now.setHours(0, 0, 0, 0));
          } else if (dateRangeParam === '7d') {
            startDate = new Date(now.setDate(now.getDate() - 7));
          } else if (dateRangeParam === '30d') {
            startDate = new Date(now.setDate(now.getDate() - 30));
          }
          if (startDate!) {
            query = query.gte('date_occurred', startDate.toISOString().split('T')[0]);
          }
        }

        // Near Me items fetch
        if (nearMeParam) {
          query = query.not('latitude', 'is', null).not('longitude', 'is', null).limit(150);
        } else {
          // Sort order for general browse
          if (sortByParam === 'oldest') {
            query = query.order('created_at', { ascending: true });
          } else {
            query = query.order('created_at', { ascending: false });
          }

          // Pagination range
          const from = (pageParam - 1) * pageSize;
          const to = from + pageSize - 1;
          query = query.range(from, to);
        }

        const { data, count, error } = await query;

        if (error) {
          console.error('Error querying items:', error);
        } else {
          setItems((data as Item[]) || []);
          setTotalCount(count || 0);
        }
      } catch (err) {
        console.error('Unexpected error fetching items:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [typeParam, categoryParam, queryParam, locationParam, dateRangeParam, sortByParam, pageParam, categories, nearMeParam]);

  // Client-side Haversine filtering & distance sorting
  const displayItems = useMemo(() => {
    let list = [...items];

    if (nearMeParam && userCoords) {
      list = list.filter((item) => {
        if (item.latitude == null || item.longitude == null) return false;
        const d = haversineDistance(userCoords.latitude, userCoords.longitude, item.latitude, item.longitude);
        return d <= radiusParam;
      });
    }

    if (sortByParam === 'nearest' && userCoords) {
      list.sort((a, b) => {
        const distA =
          a.latitude != null && a.longitude != null
            ? haversineDistance(userCoords.latitude, userCoords.longitude, a.latitude, a.longitude)
            : Infinity;
        const distB =
          b.latitude != null && b.longitude != null
            ? haversineDistance(userCoords.latitude, userCoords.longitude, b.latitude, b.longitude)
            : Infinity;
        return distA - distB;
      });
    } else if (sortByParam === 'oldest') {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortByParam === 'newest') {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return list;
  }, [items, nearMeParam, radiusParam, userCoords, sortByParam]);

  const totalPages = nearMeParam ? 1 : Math.ceil(totalCount / pageSize);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (typeParam !== 'all') count++;
    if (categoryParam) count++;
    if (locationParam) count++;
    if (dateRangeParam !== 'all') count++;
    if (nearMeParam) count++;
    return count;
  }, [typeParam, categoryParam, locationParam, dateRangeParam, nearMeParam]);

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
    setSearchInput('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Main Search Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {t('browse:title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('browse:results.count', { count: totalCount, defaultValue: `${totalCount} items found` })}
          </p>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center space-x-2">
          <Link
            to="/report/lost"
            className="px-4 py-2 text-xs font-bold rounded-xl text-rose-700 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 hover:bg-rose-100 transition shadow-sm whitespace-nowrap"
          >
            {t('common:nav.report_lost')}
          </Link>
          <Link
            to="/report/found"
            className="px-4 py-2 text-xs font-bold rounded-xl text-teal-700 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 hover:bg-teal-100 transition shadow-sm whitespace-nowrap"
          >
            {t('common:nav.report_found')}
          </Link>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Free text search input */}
          <div className="sm:col-span-6 relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('browse:filters.search_placeholder')}
              className="w-full pl-10 pr-8 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Location input */}
          <div className="sm:col-span-4 relative">
            <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={locationParam}
              onChange={(e) => updateFilter('location', e.target.value)}
              placeholder={t('common:nav.campus', 'City or Campus')}
              className="w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Mobile Filter Toggle Button */}
          <div className="sm:col-span-2">
            <button
              onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
              className="w-full h-full min-h-[38px] flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
              <span>{t('common:actions.filter')} {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}</span>
            </button>
          </div>
        </div>

        {/* Filter Pills row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
          {/* Near Me Toggle Button */}
          <button
            type="button"
            onClick={handleToggleNearMe}
            disabled={isActivatingNearMe}
            className={`px-3 py-1 rounded-lg font-semibold flex items-center space-x-1.5 transition text-xs cursor-pointer ${
              nearMeParam
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
            }`}
          >
            {isActivatingNearMe || geoStatus === 'requesting' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
            ) : (
              <Navigation className={`w-3.5 h-3.5 ${nearMeParam ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
            )}
            <span>{t('browse:filters.use_location')}</span>
          </button>

          {/* Type Toggles */}
          <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-900/80 p-0.5 rounded-lg">
            {(['all', 'lost', 'found'] as const).map((tp) => (
              <button
                key={tp}
                onClick={() => updateFilter('type', tp)}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  typeParam === tp
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {tp === 'all'
                  ? t('browse:filters.type_all')
                  : tp === 'lost'
                  ? t('common:status.lost')
                  : t('common:status.found')}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center space-x-1">
            <select
              value={categoryParam}
              onChange={(e) => updateFilter('category', e.target.value)}
              aria-label={t('browse:filters.category_all')}
              className="py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="">{t('browse:filters.category_all')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {getCategoryDisplayName(c, i18n.language)}
                </option>
              ))}
            </select>
            {isErrorCategories && (
              <button
                type="button"
                onClick={() => refetchCategories()}
                title={t('common:actions.retry')}
                className="p-1 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-600 hover:text-rose-700 text-xs"
                aria-label={t('common:actions.retry')}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Range Dropdown */}
          <select
            value={dateRangeParam}
            onChange={(e) => updateFilter('dateRange', e.target.value)}
            className="py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300"
          >
            <option value="all">{t('browse:filters.date_all')}</option>
            <option value="today">{t('browse:filters.date_today')}</option>
            <option value="7d">{t('browse:filters.date_week')}</option>
            <option value="30d">{t('browse:filters.date_month')}</option>
          </select>

          {/* Sort By Dropdown */}
          <select
            value={sortByParam}
            onChange={(e) => updateFilter('sort', e.target.value)}
            className="py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 ml-auto"
          >
            {userCoords && <option value="nearest">{t('browse:filters.sort_closest')}</option>}
            <option value="newest">{t('browse:filters.sort_newest')}</option>
            <option value="oldest">{t('browse:filters.sort_oldest')}</option>
          </select>

          {activeFiltersCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-rose-600 hover:underline font-semibold ml-2 cursor-pointer"
            >
              {t('common:actions.clear_filters')}
            </button>
          )}
        </div>
      </div>

      {/* Denied / Error guidance */}
      {showDeniedAlert && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 flex items-start space-x-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <p className="font-bold">{t('common:location_prompt.error_denied')}</p>
              <button
                type="button"
                onClick={() => setShowDeniedAlert(false)}
                className="text-amber-600 hover:text-amber-800"
                aria-label="Dismiss alert"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="leading-relaxed text-[11px]">
              {t('common:location_prompt.error_denied')}
            </p>
          </div>
        </div>
      )}

      {/* Active Near Me Proximity Banner */}
      {nearMeParam && userCoords && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-blue-950/30 p-4 rounded-2xl border border-blue-200/80 dark:border-blue-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-sm">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>{t('browse:results.near_location')}</span>
                <span className="text-slate-500 dark:text-slate-400 font-normal">({generalArea || 'Current Area'})</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t('browse:results.count', { count: displayItems.length, defaultValue: `${displayItems.length} items found` })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <span className="px-2 text-slate-400 text-[11px]">{t('campus:institutions.radius_label', { radius: '' })}:</span>
              {[1, 5, 10, 25, 50].map((rad) => (
                <button
                  key={rad}
                  type="button"
                  onClick={() => updateFilter('radius', rad.toString())}
                  className={`px-2.5 py-1 rounded-lg transition text-xs font-medium cursor-pointer ${
                    radiusParam === rad
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {rad} {t('common:units.km')}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                clearLocation();
                updateFilter('nearMe', undefined);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 transition cursor-pointer"
              title={t('browse:filters.clear_location')}
            >
              {t('browse:filters.clear_location')}
            </button>
          </div>
        </div>
      )}

      {/* Main Grid View */}
      {isLoading ? (
        <LoadingSpinner size="lg" message={t('common:actions.loading')} />
      ) : displayItems.length === 0 ? (
        <EmptyState
          title={t('browse:empty.title')}
          description={t('browse:empty.description')}
          action={{
            label: t('browse:empty.reset_button'),
            onClick: clearAllFilters,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {displayItems.map((item) => {
            const distance =
              userCoords && item.latitude != null && item.longitude != null
                ? haversineDistance(userCoords.latitude, userCoords.longitude, item.latitude, item.longitude)
                : null;

            return (
              <Link
                key={item.id}
                to={`/items/${item.id}`}
                className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* Image Cover */}
                  <div className="relative aspect-video bg-slate-100 dark:bg-slate-900 overflow-hidden">
                    {item.primary_image_url ? (
                      <img
                        src={item.primary_image_url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Package className="w-10 h-10 stroke-1" />
                      </div>
                    )}

                    {/* Badges */}
                    <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md shadow-sm ${
                          item.type === 'lost'
                            ? 'bg-rose-600 text-white'
                            : 'bg-teal-600 text-white'
                        }`}
                      >
                        {item.type === 'lost' ? t('common:status.lost') : t('common:status.found')}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-black/60 backdrop-blur-md text-white rounded-md flex items-center">
                        <CategoryIcon icon={item.category?.icon} slug={item.category?.slug} className="w-3 h-3 mr-1 shrink-0" />
                        <span className="truncate max-w-[120px]">{getCategoryDisplayName(item.category, i18n.language) || 'Item'}</span>
                      </span>
                      {distance !== null && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-600/90 backdrop-blur-md text-white rounded-md shadow-sm flex items-center">
                          <Navigation className="w-2.5 h-2.5 mr-1" />
                          {formatLocalizedDistance(distance * 1000, t, i18n.language)}
                        </span>
                      )}
                    </div>

                    {item.status === 'returned' && (
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold uppercase rounded-md shadow-sm">
                        {t('common:status.returned')}
                      </span>
                    )}
                    {item.status === 'pending_claim' && (
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-amber-600 text-white text-[10px] font-bold uppercase rounded-md shadow-sm">
                        {t('common:status.pending')}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-1.5">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center truncate max-w-[130px]">
                    <MapPin className="w-3 h-3 mr-1 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{item.location_city || item.location_country || 'Global'}</span>
                  </span>
                  <span className="flex items-center flex-shrink-0">
                    <Clock className="w-3 h-3 mr-1 text-slate-400" />
                    {formatRelativeTime(item.created_at)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500">
            {pageParam} / {totalPages} ({formatLocalizedNumber(totalCount, i18n.language)})
          </p>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(pageParam - 1)}
              disabled={pageParam <= 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 px-2">
              {pageParam} / {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(pageParam + 1)}
              disabled={pageParam >= totalPages}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
