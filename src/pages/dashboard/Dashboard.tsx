import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  Package,
  Sparkles,
  Shield,
  MessageSquare,
  Bell,
  Heart,
  Settings,
  PlusCircle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Trash2,
  Check,
  ChevronRight,
  AlertCircle,
  Eye,
  SlidersHorizontal,
  Edit,
  Printer,
  X,
  Lock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { generateLostItemPosterPdf } from '@/lib/posterGenerator';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Item, Match, Claim, AppNotification, NotificationPreferences } from '@/types';
import { formatDate, formatRelativeTime, getScoreTier } from '@/lib/utils';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfigurationRequired } from '@/components/common/ConfigurationRequired';

export const DashboardPage: React.FC = () => {
  const { user, profile, isConfigured } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeTab = searchParams.get('tab') || 'lost';

  // Data states
  const [lostItems, setLostItems] = useState<Item[]>([]);
  const [foundItems, setFoundItems] = useState<Item[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [receivedClaims, setReceivedClaims] = useState<Claim[]>([]);
  const [submittedClaims, setSubmittedClaims] = useState<Claim[]>([]);
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [selectedClaimForReview, setSelectedClaimForReview] = useState<Claim | null>(null);
  const [privateDetailsForSelectedClaim, setPrivateDetailsForSelectedClaim] = useState<any[]>([]);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected' | null>(null);
  const [finderNotes, setFinderNotes] = useState('');
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const [generatingPosterId, setGeneratingPosterId] = useState<string | null>(null);
  const { t } = useTranslation(['item', 'claims', 'dashboard', 'common']);

  const handleDownloadPoster = async (item: Item) => {
    setGeneratingPosterId(item.id);
    try {
      await generateLostItemPosterPdf(item, {
        origin: window.location.origin,
        labels: {
          lost_header: t('item:poster.lost_header'),
          sub_header: t('item:poster.sub_header'),
          reward_badge: t('item:poster.reward_badge'),
          scan_qr_prompt: t('item:poster.scan_qr_prompt'),
          safe_contact_note: t('item:poster.safe_contact_note'),
          date_lost: t('item:poster.date_lost'),
          general_area: t('item:poster.general_area'),
          category: t('item:poster.category'),
          description: t('item:poster.description'),
          footer_tagline: t('item:poster.footer_tagline'),
        },
      });
    } catch (err) {
      console.error('Failed to generate poster:', err);
      alert('Failed to generate poster. Please try again.');
    } finally {
      setGeneratingPosterId(null);
    }
  };

  const setTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user) {
      setIsLoading(false);
      return;
    }

    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch user's lost and found items
        const { data: userItems } = await supabase
          .from('items')
          .select('*, category:categories(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (userItems) {
          setLostItems(userItems.filter((i) => i.type === 'lost') as Item[]);
          setFoundItems(userItems.filter((i) => i.type === 'found') as Item[]);
        }

        // 2. Fetch matches
        const { data: userMatches } = await supabase
          .from('matches')
          .select(`
            *,
            lost_item:items!matches_lost_item_id_fkey(*, category:categories(*)),
            found_item:items!matches_found_item_id_fkey(*, category:categories(*))
          `)
          .neq('status', 'dismissed')
          .order('score', { ascending: false });

        if (userMatches) {
          const filtered = userMatches.filter(
            (m: any) => m.lost_item?.user_id === user.id || m.found_item?.user_id === user.id
          );
          setMatches(filtered as Match[]);
        }

        // 3. Fetch claims via secured backend API
        const session = (await supabase.auth.getSession()).data.session;
        if (session) {
          try {
            const claimsRes = await fetch('/api/claims', {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (claimsRes.ok) {
              const claimsData = await claimsRes.json();
              setSubmittedClaims(claimsData.submittedClaims || []);
              setReceivedClaims(claimsData.receivedClaims || []);
            }
          } catch (cErr) {
            console.warn('Backend claims fetch notice:', cErr);
          }
        }

        // 4. Fetch saved listings
        const { data: saved } = await supabase
          .from('saved_items')
          .select('*, item:items(*, category:categories(*))')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (saved) setSavedItems(saved);

        // 5. Fetch notifications
        const { data: notifs } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (notifs) setNotifications(notifs as AppNotification[]);

        // 6. Fetch notification preferences
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (prefs) setNotificationPrefs(prefs as NotificationPreferences);
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  if (!isConfigured) {
    return <ConfigurationRequired />;
  }

  const handleMarkItemReturned = async (itemId: string) => {
    if (!confirm('Mark this item as returned/resolved?')) return;
    const { error } = await supabase
      .from('items')
      .update({ status: 'returned' })
      .eq('id', itemId);

    if (!error) {
      setLostItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, status: 'returned' } : i))
      );
      setFoundItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, status: 'returned' } : i))
      );
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Permanently delete this report? This cannot be undone.')) return;
    const { error } = await supabase.from('items').delete().eq('id', itemId);
    if (!error) {
      setLostItems((prev) => prev.filter((i) => i.id !== itemId));
      setFoundItems((prev) => prev.filter((i) => i.id !== itemId));
    }
  };

  const handleDismissMatch = async (matchId: string) => {
    await supabase.from('matches').update({ status: 'dismissed' }).eq('id', matchId);
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
  };

  const handleOpenClaimReview = async (claim: Claim) => {
    setSelectedClaimForReview(claim);
    setFinderNotes('');
    setPrivateDetailsForSelectedClaim([]);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`/api/items/${claim.item_id}/private-details`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPrivateDetailsForSelectedClaim(data.privateDetails || []);
      }
    } catch (err) {
      console.warn('Notice loading private details:', err);
    }
  };

  const handleProcessClaim = async (overrideAction?: 'approved' | 'rejected') => {
    const actionToTake = overrideAction || reviewAction;
    if (!selectedClaimForReview || !actionToTake) return;
    setIsProcessingClaim(true);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch(`/api/claims/${selectedClaimForReview.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          status: actionToTake,
          finder_notes: finderNotes,
        }),
      });

      if (response.ok) {
        // Reload claims to get fresh statuses (including other claims moved to on_hold)
        const claimsRes = await fetch('/api/claims', {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (claimsRes.ok) {
          const cd = await claimsRes.json();
          setReceivedClaims(cd.receivedClaims || []);
          setSubmittedClaims(cd.submittedClaims || []);
        }
        setSelectedClaimForReview(null);
        setReviewAction(null);
        setFinderNotes('');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update claim');
      }
    } catch (err) {
      console.error('Error updating claim:', err);
    } finally {
      setIsProcessingClaim(false);
    }
  };

  const handleReportSuspicious = async () => {
    if (!selectedClaimForReview) return;
    const reason = prompt(t('claims:suspicious.prompt', 'Describe why this claim appears suspicious:'));
    if (!reason || !reason.trim()) return;

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`/api/claims/${selectedClaimForReview.id}/report-suspicious`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to report claim');
      alert(t('claims:suspicious.success_toast', 'Claim reported as suspicious and flagged for moderation review.'));
      setSelectedClaimForReview(null);
      // Reload claims
      const claimsRes = await fetch('/api/claims', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (claimsRes.ok) {
        const cd = await claimsRes.json();
        setReceivedClaims(cd.receivedClaims || []);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to report claim');
    }
  };

  const handleDashboardHandoverConfirm = async (claimId: string) => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`/api/claims/${claimId}/handover-confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ location_type: 'public_place' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to confirm handover');
      alert(data.message || 'Handover confirmed!');
      // Reload claims
      const claimsRes = await fetch('/api/claims', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (claimsRes.ok) {
        const cd = await claimsRes.json();
        setReceivedClaims(cd.receivedClaims || []);
        setSubmittedClaims(cd.submittedClaims || []);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to confirm handover');
    }
  };

  const handleTogglePref = async (key: keyof NotificationPreferences) => {
    if (!notificationPrefs || !user) return;
    const updated = { ...notificationPrefs, [key]: !notificationPrefs[key] };
    setNotificationPrefs(updated);

    await supabase
      .from('notification_preferences')
      .update({ [key]: updated[key] })
      .eq('user_id', user.id);
  };

  const handleMarkNotificationRead = async (notifId: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', notifId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            User Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Welcome back, {profile?.full_name || user?.email}. Manage your reports, claims, and matches.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to="/report/lost"
            className="px-4 py-2 text-xs font-bold rounded-xl text-rose-700 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 hover:bg-rose-100 transition shadow-sm"
          >
            Report Lost
          </Link>
          <Link
            to="/report/found"
            className="px-4 py-2 text-xs font-bold rounded-xl text-teal-700 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 hover:bg-teal-100 transition shadow-sm"
          >
            Report Found
          </Link>
        </div>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Lost Items', count: lostItems.length, tab: 'lost', color: 'text-rose-600' },
          { label: 'Found Items', count: foundItems.length, tab: 'found', color: 'text-teal-600' },
          { label: 'Matches', count: matches.length, tab: 'matches', color: 'text-amber-500' },
          { label: 'Claims', count: receivedClaims.length + submittedClaims.length, tab: 'claims', color: 'text-blue-600' },
          { label: 'Saved', count: savedItems.length, tab: 'saved', color: 'text-purple-600' },
        ].map((s) => (
          <button
            key={s.tab}
            onClick={() => setTab(s.tab)}
            className={`p-3.5 rounded-2xl border text-left transition ${
              activeTab === s.tab
                ? 'bg-white dark:bg-slate-800 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:bg-white'
            }`}
          >
            <span className={`text-xl font-black ${s.color}`}>{s.count}</span>
            <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
              {s.label}
            </span>
          </button>
        ))}
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex overflow-x-auto gap-2 text-sm font-semibold">
        {[
          { id: 'lost', label: `My Lost Reports (${lostItems.length})`, icon: Package },
          { id: 'found', label: `My Found Reports (${foundItems.length})`, icon: Package },
          { id: 'matches', label: `Potential Matches (${matches.length})`, icon: Sparkles },
          { id: 'claims', label: `Claims (${receivedClaims.length + submittedClaims.length})`, icon: Shield },
          { id: 'saved', label: `Saved (${savedItems.length})`, icon: Heart },
          { id: 'notifications', label: `Notifications (${notifications.length})`, icon: Bell },
          { id: 'settings', label: 'Preferences', icon: Settings },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 whitespace-nowrap transition ${
              activeTab === t.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <t.icon className="w-4 h-4" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      {isLoading ? (
        <LoadingSpinner size="lg" message="Loading your dashboard data..." />
      ) : (
        <div className="space-y-6">
          {/* TAB: MY LOST REPORTS */}
          {activeTab === 'lost' && (
            <div>
              {lostItems.length === 0 ? (
                <EmptyState
                  title="No lost reports submitted yet"
                  description="If you've misplaced an item, submit a lost report to let finders and our matching engine find it."
                  action={{
                    label: 'Report Lost Item',
                    onClick: () => navigate('/report/lost'),
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {lostItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm flex flex-col justify-between"
                    >
                      <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-md ${
                              item.status === 'returned'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.status.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatDate(item.date_occurred)}
                          </span>
                        </div>

                        <div>
                          <Link
                            to={`/items/${item.id}`}
                            className="font-bold text-slate-900 dark:text-white hover:text-blue-600 line-clamp-1"
                          >
                            {item.title}
                          </Link>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                            {item.description}
                          </p>
                        </div>

                        <div className="text-xs text-slate-400 flex items-center">
                          <MapPin className="w-3.5 h-3.5 mr-1" />
                          {item.location_city || 'Global'}
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                        <Link
                          to={`/items/${item.id}`}
                          className="text-xs font-semibold text-blue-600 hover:underline flex items-center"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View Listing
                        </Link>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleDownloadPoster(item)}
                            disabled={generatingPosterId === item.id}
                            className="p-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700/50 rounded-lg disabled:opacity-50"
                            title={t('item:poster.download_poster')}
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <Link
                            to={`/items/${item.id}/edit`}
                            className="p-1.5 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700/50 rounded-lg"
                            title="Edit Listing"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          {item.status !== 'returned' && (
                            <button
                              onClick={() => handleMarkItemReturned(item.id)}
                              className="p-1.5 text-xs text-emerald-600 hover:bg-emerald-50 rounded-lg"
                              title="Mark Reunited"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: MY FOUND REPORTS */}
          {activeTab === 'found' && (
            <div>
              {foundItems.length === 0 ? (
                <EmptyState
                  title="No found reports submitted"
                  description="Found something on public transit or around campus? Report it to help return it to its owner."
                  action={{
                    label: 'Report Found Item',
                    onClick: () => navigate('/report/found'),
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {foundItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm flex flex-col justify-between"
                    >
                      <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-md ${
                              item.status === 'returned'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-teal-100 text-teal-800'
                            }`}
                          >
                            {item.status.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatDate(item.date_occurred)}
                          </span>
                        </div>

                        <div>
                          <Link
                            to={`/items/${item.id}`}
                            className="font-bold text-slate-900 dark:text-white hover:text-teal-600 line-clamp-1"
                          >
                            {item.title}
                          </Link>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                            {item.description}
                          </p>
                        </div>

                        <div className="text-xs text-slate-400 flex items-center">
                          <MapPin className="w-3.5 h-3.5 mr-1" />
                          {item.location_city || 'Global'}
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                        <Link
                          to={`/items/${item.id}`}
                          className="text-xs font-semibold text-teal-600 hover:underline flex items-center"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View Listing
                        </Link>
                        <div className="flex items-center space-x-1">
                          <Link
                            to={`/items/${item.id}/edit`}
                            className="p-1.5 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700/50 rounded-lg"
                            title="Edit Listing"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          {item.status !== 'returned' && (
                            <button
                              onClick={() => handleMarkItemReturned(item.id)}
                              className="p-1.5 text-xs text-emerald-600 hover:bg-emerald-50 rounded-lg"
                              title="Mark Returned"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: POTENTIAL MATCHES */}
          {activeTab === 'matches' && (
            <div className="space-y-4">
              {matches.length === 0 ? (
                <EmptyState
                  title="No active match suggestions"
                  description="When items matching your reports are posted, our rule-based scoring engine will notify you here."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {matches.map((m) => {
                    const tier = getScoreTier(m.score);
                    const lost = m.lost_item;
                    const found = m.found_item;

                    return (
                      <div
                        key={m.id}
                        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${tier.badgeClass}`}>
                            {tier.tier} Match ({m.score}%)
                          </span>
                          <button
                            onClick={() => handleDismissMatch(m.id)}
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >
                            Dismiss
                          </button>
                        </div>

                        {/* Lost vs Found Summary */}
                        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-xs">
                          <div>
                            <span className="font-bold text-rose-600 block uppercase text-[10px]">Lost Item</span>
                            <span className="font-semibold text-slate-900 dark:text-white line-clamp-1">{lost?.title}</span>
                            <span className="text-slate-400 block">{lost?.location_city}</span>
                          </div>
                          <div className="border-l pl-3 border-slate-200 dark:border-slate-700">
                            <span className="font-bold text-teal-600 block uppercase text-[10px]">Found Item</span>
                            <span className="font-semibold text-slate-900 dark:text-white line-clamp-1">{found?.title}</span>
                            <span className="text-slate-400 block">{found?.location_city}</span>
                          </div>
                        </div>

                        {/* Breakdown Accordion */}
                        <div className="space-y-1.5 text-xs">
                          <p className="font-bold text-slate-700 dark:text-slate-300">Score Breakdown Factors:</p>
                          {m.score_breakdown &&
                            Object.keys(m.score_breakdown).map((k) => {
                              const dim = m.score_breakdown[k];
                              return (
                                <div key={k} className="flex justify-between text-slate-500">
                                  <span>{dim.name} ({dim.weight}%):</span>
                                  <span className="font-medium text-slate-700 dark:text-slate-300">{dim.explanation}</span>
                                </div>
                              );
                            })}
                        </div>

                        <div className="pt-2 flex gap-2">
                          {found && (
                            <Link
                              to={`/items/${found.id}`}
                              className="flex-1 py-2 text-center text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl"
                            >
                              Inspect Found Item
                            </Link>
                          )}
                          {lost && (
                            <Link
                              to={`/items/${lost.id}`}
                              className="flex-1 py-2 text-center text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                            >
                              Inspect Lost Item
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: CLAIMS */}
          {activeTab === 'claims' && (
            <div className="space-y-8">
              {/* Claims Received on My Found Items */}
              <div className="space-y-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('claims:dashboard.received_title', 'Claims Received (For Items You Found)')}
                </h3>
                {receivedClaims.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    {t('claims:dashboard.no_received', 'No claims currently pending review on your found items.')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {receivedClaims.map((claim) => (
                      <div
                        key={claim.id}
                        className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                                  claim.status === 'approved' || claim.status === 'handover_pending'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                                    : claim.status === 'rejected'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                                    : claim.status === 'on_hold'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                                    : claim.status === 'disputed'
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                                }`}
                              >
                                {claim.status}
                              </span>
                              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                                {claim.item?.title}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 flex items-center gap-2">
                              <span>Claimant: <strong>{claim.claimant?.full_name || 'Anonymous User'}</strong></span>
                              {claim.claimant_aggregate && (
                                <span className="text-[11px] text-slate-400">
                                  ({claim.claimant_aggregate.account_age_days}d account • {claim.claimant_aggregate.successful_returns} returns)
                                </span>
                              )}
                              <span>• Submitted {formatRelativeTime(claim.created_at)}</span>
                            </p>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleOpenClaimReview(claim)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-2xs"
                            >
                              {t('claims:dashboard.review_answers_btn', 'Review Verification Answers')}
                            </button>
                          </div>
                        </div>

                        {/* Handover Status Box for Approved Claims */}
                        {(claim.status === 'approved' || claim.status === 'handover_pending') && (
                          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                            <div className="space-y-0.5">
                              <span className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                {t('claims:handover.title', 'Safe Handover in Progress')}
                              </span>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                Finder: {claim.finder_confirmed_handover ? 'Confirmed' : 'Awaiting confirmation'} • Claimant: {claim.claimant_confirmed_handover ? 'Confirmed' : 'Awaiting confirmation'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {!claim.finder_confirmed_handover && (
                                <button
                                  onClick={() => handleDashboardHandoverConfirm(claim.id)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                                >
                                  {t('claims:handover.confirm_button', 'Confirm Handover')}
                                </button>
                              )}
                              <Link
                                to={`/items/${claim.item_id}`}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-white"
                              >
                                View Item
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Claims Submitted by Me */}
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('claims:dashboard.submitted_title', 'Claims Submitted by You')}
                </h3>
                {submittedClaims.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    {t('claims:dashboard.no_submitted', "You haven't submitted any ownership claims yet.")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {submittedClaims.map((claim) => (
                      <div
                        key={claim.id}
                        className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                                claim.status === 'approved' || claim.status === 'handover_pending'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : claim.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : claim.status === 'on_hold'
                                  ? 'bg-blue-100 text-blue-800'
                                  : claim.status === 'disputed'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {claim.status}
                            </span>
                            <h4 className="font-semibold text-sm text-slate-900 dark:text-white mt-1">
                              {claim.item?.title}
                            </h4>
                            <p className="text-xs text-slate-400">Submitted {formatDate(claim.created_at)}</p>
                          </div>

                          {(claim.status === 'approved' || claim.status === 'handover_pending') && (
                            <div className="text-right">
                              <span className="text-xs font-bold text-emerald-600 block">Claim Approved!</span>
                              <Link
                                to="/messages"
                                className="text-xs text-blue-600 underline font-semibold"
                              >
                                Open Safe Chat
                              </Link>
                            </div>
                          )}
                        </div>

                        {/* Handover Status Box for Claimant */}
                        {(claim.status === 'approved' || claim.status === 'handover_pending') && (
                          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                            <div className="space-y-0.5">
                              <span className="font-bold text-emerald-900 dark:text-emerald-200">
                                {t('claims:handover.title', 'Safe Handover Coordination')}
                              </span>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                You: {claim.claimant_confirmed_handover ? 'Confirmed' : 'Awaiting confirmation'} • Finder: {claim.finder_confirmed_handover ? 'Confirmed' : 'Awaiting confirmation'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {!claim.claimant_confirmed_handover && (
                                <button
                                  onClick={() => handleDashboardHandoverConfirm(claim.id)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                                >
                                  {t('claims:handover.confirm_button', 'Confirm Handover')}
                                </button>
                              )}
                              <Link
                                to={`/items/${claim.item_id}`}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-white"
                              >
                                View Item
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <EmptyState
                  title="No notifications"
                  description="You are completely caught up!"
                />
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 rounded-2xl border transition flex items-start justify-between ${
                      n.read
                        ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/60'
                        : 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{n.title}</span>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{n.message}</p>
                      <span className="text-[11px] text-slate-400 block">{formatRelativeTime(n.created_at)}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {n.link_url && (
                        <Link
                          to={n.link_url}
                          className="px-3 py-1 bg-white dark:bg-slate-700 border text-xs font-semibold rounded-lg hover:bg-slate-50"
                        >
                          View
                        </Link>
                      )}
                      {!n.read && (
                        <button
                          onClick={() => handleMarkNotificationRead(n.id)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: SAVED LISTINGS */}
          {activeTab === 'saved' && (
            <div>
              {savedItems.length === 0 ? (
                <EmptyState
                  title="No saved listings"
                  description="Bookmark items while browsing to track them here."
                  action={{
                    label: 'Browse Listings',
                    onClick: () => navigate('/browse'),
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedItems.map((s) => (
                    <Link
                      key={s.id}
                      to={`/items/${s.item.id}`}
                      className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-blue-500 transition block"
                    >
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 text-slate-800">
                        {s.item.type}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-2 line-clamp-1">
                        {s.item.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">{s.item.location_city || 'Global'}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: PREFERENCES */}
          {activeTab === 'settings' && notificationPrefs && (
            <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm max-w-2xl space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Notification Preferences
                </h3>
                <p className="text-xs text-slate-500">
                  Control which events trigger in-app alerts and optional email summaries.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'notify_matches', title: 'Automated Match Alerts', desc: 'Notify me when matching lost or found items are posted' },
                  { key: 'notify_messages', title: 'Secure Messages', desc: 'Notify me when someone sends me a message' },
                  { key: 'notify_claims', title: 'Claim Updates', desc: 'Notify me when ownership claims are received or decided' },
                  { key: 'email_notifications', title: 'Email Notifications (Resend)', desc: 'Deliver critical updates to my registered email address' },
                ].map((pref) => (
                  <div key={pref.key} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{pref.title}</h4>
                      <p className="text-[11px] text-slate-500">{pref.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean((notificationPrefs as any)[pref.key])}
                      onChange={() => handleTogglePref(pref.key as any)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Side-by-Side Claim Review Modal */}
      {selectedClaimForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  {t('claims:review_modal.title', 'Review Ownership Claim & Verification')}
                </h3>
                <p className="text-xs text-slate-500">
                  Item: <strong>{selectedClaimForReview.item?.title}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedClaimForReview(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Claimant Identity & Reputation Badge */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-blue-600 text-white font-bold flex items-center justify-center text-sm uppercase">
                  {selectedClaimForReview.claimant?.full_name ? selectedClaimForReview.claimant.full_name[0] : 'C'}
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    {selectedClaimForReview.claimant?.full_name || 'Community Member'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Submitted {formatRelativeTime(selectedClaimForReview.created_at)}
                  </span>
                </div>
              </div>

              {selectedClaimForReview.claimant_aggregate && (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                    Account: <strong>{selectedClaimForReview.claimant_aggregate.account_age_days}d old</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-medium">
                    Returns: <strong>{selectedClaimForReview.claimant_aggregate.successful_returns}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Verification Match Engine Indicator */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t('claims:match.indicator_title', 'Verification Match Engine')}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    selectedClaimForReview.match_score === 'high' || (typeof selectedClaimForReview.match_score === 'number' && selectedClaimForReview.match_score >= 70)
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : selectedClaimForReview.match_score === 'medium' || (typeof selectedClaimForReview.match_score === 'number' && selectedClaimForReview.match_score >= 40)
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {selectedClaimForReview.match_score === 'high' || (typeof selectedClaimForReview.match_score === 'number' && selectedClaimForReview.match_score >= 70)
                    ? t('claims:match.high', 'High Match')
                    : selectedClaimForReview.match_score === 'medium' || (typeof selectedClaimForReview.match_score === 'number' && selectedClaimForReview.match_score >= 40)
                    ? t('claims:match.medium', 'Medium Match')
                    : t('claims:match.low', 'Low Match')}
                  {typeof selectedClaimForReview.match_score === 'number' ? ` (${selectedClaimForReview.match_score}%)` : ''}
                </span>
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                {selectedClaimForReview.match_explanation || 'No deterministic overlap found.'}
              </p>

              <p className="text-[10px] text-slate-400 italic">
                {t('claims:match.guidance_note', 'Guidance only; please review manually. Scoring evaluates detail overlap with hidden secrets and discounts public description mirroring.')}
              </p>
            </div>

            {/* Side-by-Side Comparison Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Claimant's Answers */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="font-bold text-slate-900 dark:text-white block text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  Claimant's Submitted Details
                </span>

                {selectedClaimForReview.verification_answers?.answers &&
                  Object.entries(selectedClaimForReview.verification_answers.answers).map(([key, val]) => (
                    <div key={key}>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">{key.replace('_', ' ')}</span>
                      <p className="text-slate-800 dark:text-slate-200 font-medium">{String(val) || '—'}</p>
                    </div>
                  ))}

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Comprehensive Proof</span>
                  <p className="text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap">
                    {selectedClaimForReview.verification_answers?.proof_description || 'No description provided'}
                  </p>
                </div>

                {/* Proof Files Preview */}
                {selectedClaimForReview.proof_files && selectedClaimForReview.proof_files.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Proof Files</span>
                    {selectedClaimForReview.proof_files.map((file, fIdx) => (
                      <a
                        key={fIdx}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:underline text-[11px] block truncate"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        {file.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Finder's Hidden Proof Details */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                <span className="font-bold text-indigo-950 dark:text-indigo-200 block text-xs uppercase tracking-wider border-b border-indigo-200 dark:border-indigo-800 pb-1.5 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-indigo-500" />
                  Your Hidden Proof Details
                </span>

                {privateDetailsForSelectedClaim.length === 0 ? (
                  <p className="text-slate-400 text-xs italic">
                    No secret proof details were registered on this item.
                  </p>
                ) : (
                  privateDetailsForSelectedClaim.map((pd, pIdx) => (
                    <div key={pIdx} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-800">
                      <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block">
                        {pd.detail_label || pd.detail_type}
                      </span>
                      <p className="text-slate-900 dark:text-white font-semibold mt-0.5">
                        {pd.detail_value}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Decision Notes & Action Buttons */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Decision Notes (Optional message to claimant)
              </label>
              <textarea
                rows={2}
                value={finderNotes}
                onChange={(e) => setFinderNotes(e.target.value)}
                placeholder="e.g. Please meet at the Campus Union lobby tomorrow at 2 PM..."
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  disabled={isProcessingClaim}
                  onClick={() => handleProcessClaim('rejected')}
                  className="flex-1 py-2.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                >
                  {t('claims:actions.decline_claim', 'Decline Claim (Neutral)')}
                </button>
                <button
                  type="button"
                  onClick={handleReportSuspicious}
                  className="py-2.5 px-3 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 rounded-xl border border-amber-200 dark:border-amber-800 transition cursor-pointer"
                >
                  {t('claims:actions.report_suspicious', 'Report Suspicious')}
                </button>
                <button
                  type="button"
                  disabled={isProcessingClaim}
                  onClick={() => handleProcessClaim('approved')}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition cursor-pointer"
                >
                  {t('claims:actions.approve_ownership', 'Approve Ownership')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
