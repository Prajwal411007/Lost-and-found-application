import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  TrendingUp,
  MapPin,
  Clock,
  CheckCircle2,
  Package,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { LeafletMap, MapMarker } from '@/components/common/LeafletMap';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface InsightsSummary {
  totalReported: number;
  totalLost: number;
  totalFound: number;
  itemsReturned: number;
  returnRatePct: number;
  avgTimeToReturnHours: number;
}

interface HotspotCluster {
  lat_rounded: number;
  lng_rounded: number;
  total_items: number;
  lost_count: number;
  found_count: number;
  returned_count: number;
  city?: string | null;
  state?: string | null;
}

interface CategoryMetric {
  category_id: string;
  category_name: string;
  category_slug?: string;
  category_icon?: string;
  total_items: number;
  lost_count: number;
  found_count: number;
  returned_count: number;
  return_rate_pct: number;
  avg_return_time_hours?: number;
}

interface WeeklyTrend {
  week_start: string;
  total_items: number;
  lost_count: number;
  found_count: number;
  returned_count: number;
}

export const InsightsPage: React.FC = () => {
  const { t } = useTranslation(['common']);
  const [summary, setSummary] = useState<InsightsSummary | null>(null);
  const [hotspots, setHotspots] = useState<HotspotCluster[]>([]);
  const [categories, setCategories] = useState<CategoryMetric[]>([]);
  const [weeklyTrends, setWeeklyTrends] = useState<WeeklyTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<HotspotCluster | null>(null);

  useEffect(() => {
    const fetchInsightsData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [insightsRes, hotspotsRes] = await Promise.all([
          fetch('/api/stats/insights'),
          fetch('/api/stats/hotspots'),
        ]);

        if (insightsRes.ok) {
          const insightsData = await insightsRes.json();
          setSummary(insightsData.summary);
          setCategories(insightsData.categories || []);
          setWeeklyTrends(insightsData.weeklyTrends || []);
        }

        if (hotspotsRes.ok) {
          const hotspotsData = await hotspotsRes.json();
          setHotspots(hotspotsData.hotspots || []);
          if (hotspotsData.hotspots && hotspotsData.hotspots.length > 0) {
            setSelectedCluster(hotspotsData.hotspots[0]);
          }
        }
      } catch (err: any) {
        console.error('Failed to load insights:', err);
        setError('Unable to load latest analytics. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsightsData();
  }, []);

  const formatHours = (hours: number) => {
    if (hours < 24) {
      return `${hours} ${t('common:insights.hours')}`;
    }
    const days = (hours / 24).toFixed(1);
    return `${days} ${t('common:insights.days')}`;
  };

  // Convert clusters into Leaflet Map Markers
  const mapMarkers: MapMarker[] = hotspots.map((h, idx) => ({
    id: `cluster-${idx}`,
    lat: h.lat_rounded,
    lng: h.lng_rounded,
    title: `${h.city || 'Area Cluster'}: ${h.total_items} items`,
    type: h.returned_count > 0 ? 'found' : 'lost',
    popupHtml: `
      <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
        <strong style="font-size: 13px; color: #0F172A;">${h.city || 'Hotspot Cluster'}</strong>
        ${h.state ? `<span style="color: #64748B;">, ${h.state}</span>` : ''}
        <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #E2E8F0;">
          <div>📦 Total Items: <strong>${h.total_items}</strong></div>
          <div style="color: #DC2626;">🔴 Lost: ${h.lost_count}</div>
          <div style="color: #0D9488;">🟢 Found: ${h.found_count}</div>
          <div style="color: #059669;">✨ Reunited: ${h.returned_count}</div>
        </div>
      </div>
    `,
    onClick: () => setSelectedCluster(h),
  }));

  const mapCenter: [number, number] =
    hotspots.length > 0
      ? [hotspots[0].lat_rounded, hotspots[0].lng_rounded]
      : [12.9716, 77.5946];

  const maxCategoryItems = Math.max(...categories.map((c) => c.total_items), 1);
  const maxWeeklyItems = Math.max(...weeklyTrends.map((w) => w.total_items), 1);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading platform analytics..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Page Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Live Community Metrics</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {t('common:insights.title')}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl">
          {t('common:insights.subtitle')}
        </p>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Logged */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('common:insights.kpi_total_reported')}
            </span>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
              {summary?.totalReported ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-rose-600 font-bold">{summary?.totalLost ?? 0} lost</span> •{' '}
              <span className="text-teal-600 font-bold">{summary?.totalFound ?? 0} found</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Package className="w-6 h-6 stroke-[2]" />
          </div>
        </div>

        {/* Successfully Reunited */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('common:insights.kpi_items_returned')}
            </span>
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {summary?.itemsReturned ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Safely handed back to owners</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 stroke-[2]" />
          </div>
        </div>

        {/* Overall Return Rate */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('common:insights.kpi_return_rate')}
            </span>
            <div className="text-3xl font-black text-teal-600 dark:text-teal-400 mt-1">
              {summary?.returnRatePct ?? 0}%
            </div>
            <div className="text-[11px] text-teal-600 font-medium mt-1 flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> High reunion reliability
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 stroke-[2]" />
          </div>
        </div>

        {/* Average Time to Reunion */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('common:insights.kpi_avg_time')}
            </span>
            <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              {summary?.avgTimeToReturnHours ? formatHours(summary.avgTimeToReturnHours) : 'Fast'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Average incident to resolution</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Clock className="w-6 h-6 stroke-[2]" />
          </div>
        </div>
      </div>

      {/* Hotspots Section */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-500" />
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {t('common:insights.hotspots_title')}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('common:insights.hotspots_subtitle')}
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{t('common:insights.hotspots_notice')}</span>
          </div>
        </div>

        {/* Leaflet Cluster Map */}
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 relative">
          <LeafletMap
            center={mapCenter}
            zoom={12}
            height="420px"
            markers={mapMarkers}
            showLocateButton={true}
          />
        </div>

        {/* Cluster Quick List */}
        {hotspots.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {hotspots.slice(0, 6).map((h, i) => (
              <div
                key={i}
                className="p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 text-center"
              >
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {h.city || 'Regional Area'}
                </div>
                <div className="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
                  {h.total_items}
                </div>
                <div className="text-[10px] text-slate-400">Total Items</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analytics Grid: Category Performance & Weekly Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Category Breakdown */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 space-y-6 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {t('common:insights.categories_title')}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('common:insights.categories_subtitle')}
            </p>
          </div>

          <div className="space-y-4">
            {categories.slice(0, 8).map((cat) => {
              const barPercent = Math.min(100, Math.round((cat.total_items / maxCategoryItems) * 100));
              return (
                <div key={cat.category_id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {cat.category_name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        {cat.total_items} items
                      </span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                        {cat.return_rate_pct}% returned
                      </span>
                    </div>
                  </div>

                  {/* Accessible Multi-segment Bar */}
                  <div className="h-3.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${barPercent}%` }}
                      className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-teal-400 rounded-full transition-all duration-500"
                      role="progressbar"
                      aria-valuenow={barPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Weekly Trends */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 space-y-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {t('common:insights.weekly_trends_title')}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('common:insights.weekly_trends_subtitle')}
            </p>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {weeklyTrends.map((w, idx) => {
              const widthPct = Math.max(8, Math.round((w.total_items / maxWeeklyItems) * 100));
              return (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  <span className="w-16 text-slate-400 font-mono text-[11px] shrink-0">
                    {w.week_start.slice(0, 10)}
                  </span>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-700 h-6 rounded-lg overflow-hidden flex">
                    <div
                      style={{ width: `${widthPct}%` }}
                      className="bg-blue-600 dark:bg-blue-500 text-white text-[10px] font-bold flex items-center justify-end px-2"
                    >
                      {w.total_items > 0 ? w.total_items : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                    <span className="text-rose-500 font-bold">{w.lost_count}L</span>
                    <span className="text-teal-500 font-bold">{w.found_count}F</span>
                    <span className="text-emerald-600 font-bold">{w.returned_count}R</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-around text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> {t('common:insights.legend_lost')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500" /> {t('common:insights.legend_found')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> {t('common:insights.legend_reunited')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
