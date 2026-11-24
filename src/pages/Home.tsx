import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  PlusCircle,
  ShieldCheck,
  Zap,
  MapPin,
  Clock,
  Compass,
  ArrowRight,
  Sparkles,
  Smartphone,
  Wallet,
  Key,
  Briefcase,
  Watch,
  CreditCard,
  Shirt,
  Dog,
  BookOpen,
  Trophy,
  Package,
  Navigation,
  RotateCcw,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useGeolocation } from '@/contexts/LocationContext';
import { useCategories, useCategoryItemCounts } from '@/hooks/useCategories';
import { CategoryIcon } from '@/lib/categoryIcons';
import { Item, Category } from '@/types';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { coords, requestLocation, openPrompt } = useGeolocation();
  const {
    categories,
    isLoading: isLoadingCats,
    isError: isErrorCats,
    refetch: refetchCats,
  } = useCategories();
  const { data: categoryCounts = {} } = useCategoryItemCounts();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [locationQuery, setLocationQuery] = useState('');

  const [recentItems, setRecentItems] = useState<Item[]>([]);
  const [stats, setStats] = useState({
    totalReported: 0,
    itemsReturned: 0,
    activeMatches: 0,
    returnRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadHomeData = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch recent items
        const { data: items } = await supabase
          .from('items')
          .select('*, category:categories(*)')
          .order('created_at', { ascending: false })
          .limit(6);
        if (items) setRecentItems(items as Item[]);

        // Fetch real database counts (not hardcoded)
        const { count: totalCount } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true });

        const { count: returnedCount } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'returned');

        const { count: matchesCount } = await supabase
          .from('matches')
          .select('*', { count: 'exact', head: true });

        const total = totalCount || 0;
        const returned = returnedCount || 0;
        const rate = total > 0 ? Math.round((returned / total) * 100) : 0;

        setStats({
          totalReported: total,
          itemsReturned: returned,
          activeMatches: matchesCount || 0,
          returnRate: rate,
        });
      } catch (err) {
        console.error('Error loading home data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadHomeData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (selectedCategory) params.set('category', selectedCategory);
    if (locationQuery.trim()) params.set('location', locationQuery.trim());
    navigate(`/browse?${params.toString()}`);
  };

  const handleNearMeSearch = async () => {
    if (coords) {
      navigate('/browse?nearMe=true&sort=nearest');
    } else {
      const loc = await requestLocation();
      if (loc) {
        navigate('/browse?nearMe=true&sort=nearest');
      } else {
        openPrompt();
      }
    }
  };

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 bg-gradient-to-b from-blue-50/50 via-white to-slate-50 dark:from-slate-900/60 dark:via-slate-900 dark:to-slate-900/80 border-b border-slate-200/60 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-100/80 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-xs font-semibold uppercase tracking-wider mb-6 border border-blue-200 dark:border-blue-800/60">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Global & Campus Lost and Found Network</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 dark:text-white tracking-tight max-w-4xl mx-auto leading-tight">
            Lost Something? <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-500 bg-clip-text text-transparent">
              Let's Find It.
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            The trusted global network reconnecting people with their lost belongings across cities, public transits, and university campuses worldwide.
          </p>

          {/* Quick Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/report/lost"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-lg shadow-rose-500/25 transition transform hover:-translate-y-0.5"
            >
              Report Lost Item
            </Link>
            <Link
              to="/report/found"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-lg shadow-teal-500/25 transition transform hover:-translate-y-0.5"
            >
              Report Found Item
            </Link>
          </div>

          {/* Hero Search Box */}
          <div className="mt-10 max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700 p-2 sm:p-3">
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-5 relative">
                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="What did you lose or find? (e.g. iPhone, Keys)"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm border-0 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  aria-label="Filter by category"
                  className="w-full py-2.5 px-3 rounded-xl text-sm border-0 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3 relative">
                <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="City or Campus"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm border-0 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-1">
                <button
                  type="submit"
                  aria-label="Search listings"
                  className="w-full h-full min-h-[42px] bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center transition shadow-sm"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Quick Search Chips including Near Me */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
            <span>Quick search:</span>
            <button
              type="button"
              onClick={handleNearMeSearch}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold hover:bg-blue-100 dark:hover:bg-blue-900 transition shadow-2xs"
            >
              <Navigation className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span>Items Near Me</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/browse?type=lost')}
              className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition"
            >
              Recent Lost
            </button>
            <button
              type="button"
              onClick={() => navigate('/browse?type=found')}
              className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition"
            >
              Recent Found
            </button>
          </div>
        </div>
      </section>

      {/* Live Platform Stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[
            { label: 'Total Items Reported', value: stats.totalReported, suffix: '+', icon: Package, color: 'text-blue-600' },
            { label: 'Belongings Reunited', value: stats.itemsReturned, suffix: '', icon: ShieldCheck, color: 'text-emerald-600' },
            { label: 'Active Match Suggestions', value: stats.activeMatches, suffix: '', icon: Zap, color: 'text-amber-500' },
            { label: 'Community Return Rate', value: `${stats.returnRate}%`, suffix: '', icon: Sparkles, color: 'text-purple-600' },
          ].map((s, idx) => (
            <div
              key={idx}
              className="p-5 sm:p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center space-x-4"
            >
              <div className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 ${s.color}`}>
                <s.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {s.value}
                  {s.suffix}
                </p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Campus Mode Highlight Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-600 via-teal-700 to-blue-700 p-8 sm:p-10 text-white shadow-xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-bold tracking-wide uppercase">
              <Compass className="w-3.5 h-3.5" />
              <span>Campus Navigation Mode</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Looking for an item on your university campus?
            </h2>
            <p className="text-teal-100 text-sm leading-relaxed">
              Explore buildings, dining halls, and student centers with interactive map markers, search by hall or building code, and get walking directions straight to where the item was found.
            </p>
            <div className="pt-2">
              <Link
                to="/campus"
                className="inline-flex items-center px-5 py-2.5 bg-white text-teal-800 font-semibold text-sm rounded-xl hover:bg-teal-50 transition shadow-sm"
              >
                Launch Campus Navigator
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
          <div className="absolute right-0 bottom-0 opacity-15 translate-x-10 translate-y-10 pointer-events-none">
            <Compass className="w-96 h-96" />
          </div>
        </div>
      </section>

      {/* Browse by Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Popular Categories
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Browse lost and found belongings by specific category
            </p>
          </div>
          <Link
            to="/browse"
            className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center"
          >
            View all listings
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        {isErrorCats ? (
          <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-center space-y-3">
            <p className="text-sm text-rose-700 dark:text-rose-300 font-medium">
              Failed to load categories from database.
            </p>
            <button
              type="button"
              onClick={() => refetchCats()}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Loading Categories</span>
            </button>
          </div>
        ) : isLoadingCats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 animate-pulse text-center flex flex-col items-center"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 mb-3" />
                <div className="w-20 h-3 bg-slate-200 dark:bg-slate-700 rounded mb-1.5" />
                <div className="w-10 h-2 bg-slate-100 dark:bg-slate-700/60 rounded" />
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center text-sm text-slate-500">
            No categories available yet. Please run migration 003_more_categories.sql in Supabase.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {categories.map((cat) => {
              const count = categoryCounts[cat.id] || 0;
              return (
                <Link
                  key={cat.id}
                  to={`/browse?category=${cat.slug}`}
                  className="group p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-500 dark:hover:border-blue-500 shadow-sm hover:shadow-md transition text-center flex flex-col items-center"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-slate-900 group-hover:bg-blue-600 text-blue-600 dark:text-blue-400 group-hover:text-white flex items-center justify-center transition mb-3">
                    <CategoryIcon icon={cat.icon} slug={cat.slug} className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-1">
                    {cat.name}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    {count} {count === 1 ? 'item' : 'items'}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Items Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Recent Activity
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Latest items reported missing or discovered by the community
            </p>
          </div>
          <Link
            to="/browse"
            className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center"
          >
            Explore all
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        {isLoading ? (
          <LoadingSpinner message="Loading recent listings..." />
        ) : recentItems.length === 0 ? (
          <EmptyState
            title="No recent listings"
            description="Be the first to report a lost or found item in your area!"
            action={{
              label: 'Report an Item',
              onClick: () => navigate('/report/lost'),
            }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentItems.map((item) => (
              <Link
                key={item.id}
                to={`/items/${item.id}`}
                className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col"
              >
                <div className="relative aspect-video bg-slate-100 dark:bg-slate-900 overflow-hidden">
                  {item.primary_image_url ? (
                    <img
                      src={item.primary_image_url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Package className="w-12 h-12 stroke-1" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span
                      className={`px-2.5 py-1 text-xs font-bold uppercase rounded-lg shadow-sm ${
                        item.type === 'lost'
                          ? 'bg-rose-600 text-white'
                          : 'bg-teal-600 text-white'
                      }`}
                    >
                      {item.type}
                    </span>
                    <span className="px-2 py-1 text-xs font-semibold bg-black/60 backdrop-blur-md text-white rounded-lg">
                      {item.category?.name || 'Item'}
                    </span>
                  </div>
                  {item.status === 'returned' && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-emerald-600 text-white text-[11px] font-bold uppercase rounded-lg shadow-sm">
                      Reunited
                    </div>
                  )}
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-1 mb-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
                      {item.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center">
                      <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      {item.location_city || item.location_country || 'Global'}
                    </span>
                    <span className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* How It Works Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            How FindIt Works
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            A transparent 3-step process designed to protect your privacy and guarantee safe recovery
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: 'Report Your Item',
              desc: 'Submit a detailed report with photos, distinguishing marks, and an approximate location pin. Sensitive IDs are shielded from public view.',
              color: 'text-rose-600 dark:text-rose-400',
              bg: 'bg-rose-50 dark:bg-rose-950/40',
            },
            {
              step: '02',
              title: 'Automated Matching',
              desc: 'Our transparent rule-based matching engine scores matches by category, text description, geo-distance, and date, alerting both parties.',
              color: 'text-blue-600 dark:text-blue-400',
              bg: 'bg-blue-50 dark:bg-blue-950/40',
            },
            {
              step: '03',
              title: 'Verify & Safely Reunited',
              desc: 'The claimant answers private verification questions. Once verified, coordinate a safe return in a well-lit public space using our return checklist.',
              color: 'text-teal-600 dark:text-teal-400',
              bg: 'bg-teal-50 dark:bg-teal-950/40',
            },
          ].map((card, i) => (
            <div
              key={i}
              className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm relative"
            >
              <div className={`w-12 h-12 rounded-2xl ${card.bg} ${card.color} font-black text-lg flex items-center justify-center mb-4`}>
                {card.step}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{card.title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

