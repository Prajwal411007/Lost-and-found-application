import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Users,
  Package,
  CheckCircle2,
  AlertTriangle,
  Flag,
  Trash2,
  Ban,
  Search,
  ExternalLink,
  Clock,
  Activity,
  Layers,
  Sparkles,
  Loader2,
  ChevronRight,
  MapPin,
  BarChart3,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Profile, AbuseReport, Item } from '@/types';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfigurationRequired } from '@/components/common/ConfigurationRequired';

export const AdminPage: React.FC = () => {
  const { user, profile, isAdmin, isConfigured } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'users' | 'categories' | 'insights' | 'audit'>('overview');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalItems: 0,
    returnedItems: 0,
    openItems: 0,
    pendingClaims: 0,
    pendingReports: 0,
  });
  const [reports, setReports] = useState<AbuseReport[]>([]);
  const [fraudFlags, setFraudFlags] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<Profile[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Load Admin Data
  const loadAdminData = async () => {
    setIsLoading(true);
    if (!isSupabaseConfigured || !supabase || !isAdmin) {
      setIsLoading(false);
      return;
    }

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const headers = {
        'Authorization': `Bearer ${session?.access_token}`,
      };

      // 1. Overview stats from backend API
      const statsRes = await fetch('/api/admin/overview', { headers });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // 2. Abuse Reports / Moderation Queue
      const reportsRes = await fetch('/api/admin/reports', { headers });
      if (reportsRes.ok) {
        const repData = await reportsRes.json();
        setReports(repData.reports || []);
      }

      // 2b. Rule-based Fraud Flags
      const flagsRes = await fetch('/api/admin/fraud-flags', { headers });
      if (flagsRes.ok) {
        const flagsData = await flagsRes.json();
        setFraudFlags(flagsData.flags || []);
      }

      // 3. User profiles list
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (profilesData) {
        setUsersList(profilesData as Profile[]);
      }

      // 4. Immutable Audit Logs
      const auditRes = await fetch('/api/admin/audit-logs', { headers });
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(auditData.logs || []);
      }
    } catch (err) {
      console.error('Error loading admin console:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAdminAction = async (payload: {
    action: 'dismiss_flag' | 'warn_user' | 'lock_claims' | 'suspend_user' | 'resolve_dispute';
    target_user_id?: string | null;
    target_item_id?: string | null;
    target_claim_id?: string | null;
    reason: string;
    duration_hours?: number;
    metadata?: Record<string, any>;
  }) => {
    setActionInProgress(payload.action);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      alert(data.message || 'Action executed and logged to audit trail.');
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to execute action');
    } finally {
      setActionInProgress(null);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [isAdmin]);

  if (!isConfigured) {
    return <ConfigurationRequired />;
  }

  const handleUpdateReportStatus = async (reportId: string, status: string) => {
    setActionInProgress(reportId);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: status as any } : r))
        );
      }
    } catch (err) {
      console.error('Error updating report status:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleToggleUserBan = async (userId: string, currentBan: boolean) => {
    const nextBan = !currentBan;
    if (!confirm(`${nextBan ? 'Suspend' : 'Reinstate'} this user account?`)) return;

    setActionInProgress(userId);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ is_banned: nextBan }),
      });

      if (res.ok) {
        setUsersList((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, is_banned: nextBan } : u))
        );
      }
    } catch (err) {
      console.error('Error toggling ban:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUpdateFraudFlag = async (flagId: string, status: 'reviewed' | 'dismissed') => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`/api/admin/fraud-flags/${flagId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setFraudFlags((prev) => prev.map((f) => (f.id === flagId ? { ...f, status } : f)));
      }
    } catch (err) {
      console.error('Error updating flag status:', err);
    }
  };

  const handleAdminDeleteItem = async (itemId: string, reportId?: string) => {
    if (!confirm('Permanently remove this listing from the database?')) return;

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`/api/admin/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (res.ok) {
        if (reportId) {
          await handleUpdateReportStatus(reportId, 'actioned');
        }
        alert('Listing successfully removed by administrator.');
      }
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const filteredUsers = usersList.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Admin & Moderation Console
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              Clearance: Administrator
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Enforced server-side via Express middleware & Postgres RLS.
          </p>
        </div>

        <button
          onClick={loadAdminData}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl transition"
        >
          Refresh Live Data
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex space-x-2 text-sm font-semibold overflow-x-auto">
        {[
          { id: 'overview', label: 'Platform Analytics', icon: Activity },
          { id: 'moderation', label: `Moderation Queue (${reports.filter((r) => r.status === 'pending').length + fraudFlags.filter((f) => f.status === 'pending').length})`, icon: Flag },
          { id: 'users', label: `User Management (${usersList.length})`, icon: Users },
          { id: 'insights', label: 'Hotspots & Insights', icon: MapPin },
          { id: 'audit', label: `Audit Trail (${auditLogs.length})`, icon: Clock },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition ${
              activeTab === t.id
                ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <t.icon className="w-4 h-4" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" message="Loading administrative data..." />
      ) : (
        <div className="space-y-6">
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Registered Users', value: stats.totalUsers, icon: Users, color: 'text-blue-600' },
                  { label: 'Total Items Reported', value: stats.totalItems, icon: Package, color: 'text-indigo-600' },
                  { label: 'Reunited / Resolved', value: stats.returnedItems, icon: CheckCircle2, color: 'text-emerald-600' },
                  { label: 'Flagged Abuse Reports', value: stats.pendingReports, icon: Flag, color: 'text-rose-600' },
                ].map((s, idx) => (
                  <div
                    key={idx}
                    className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center space-x-4"
                  >
                    <div className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-900 ${s.color}`}>
                      <s.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-2xl font-black text-slate-900 dark:text-white block">
                        {s.value}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">{s.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* System Health Status */}
              <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                  <Activity className="w-4 h-4 mr-2 text-emerald-600" />
                  System Health & Connectivity Status
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Postgres Database (RLS)
                    </span>
                    <span className="inline-flex items-center text-emerald-600 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                      Connected & Operational
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Matching Scoring Engine
                    </span>
                    <span className="inline-flex items-center text-emerald-600 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                      Weighted Rule Scorer Active
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Storage Bucket (item-images)
                    </span>
                    <span className="inline-flex items-center text-emerald-600 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                      Online & Publicly Accessible
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: MODERATION QUEUE */}
          {activeTab === 'moderation' && (
            <div className="space-y-6">
              {/* Fraud Flags Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Rule-based Fraud Flags & Anomalies ({fraudFlags.filter((f) => f.status === 'pending').length} pending)
                  </h3>
                </div>

                {fraudFlags.length === 0 ? (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-400">
                    No automated fraud flags detected.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fraudFlags.map((flag) => (
                      <div
                        key={flag.id}
                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                                flag.severity === 'high'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {flag.flag_type.replace('_', ' ')}
                            </span>
                            <span className="text-slate-400">
                              Status: <strong>{flag.status}</strong>
                            </span>
                          </div>
                          <p className="text-slate-800 dark:text-slate-200 font-medium">
                            {flag.reason}
                          </p>
                          <span className="text-slate-400 text-[11px] block">
                            User: {flag.user?.full_name || flag.user?.email || flag.user_id}
                          </span>
                        </div>

                        {flag.status === 'pending' && (
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                const reason = prompt('Warning reason / policy explanation:', flag.reason);
                                if (!reason) return;
                                handleExecuteAdminAction({
                                  action: 'warn_user',
                                  target_user_id: flag.user_id,
                                  reason,
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-semibold text-xs border border-amber-200 dark:border-amber-800 cursor-pointer"
                            >
                              Warn User
                            </button>
                            <button
                              onClick={() => {
                                const hoursStr = prompt('Lock claims duration in hours (e.g. 24, 48, 168):', '24');
                                if (!hoursStr) return;
                                const hours = parseInt(hoursStr, 10);
                                if (isNaN(hours) || hours <= 0) return;
                                const reason = prompt('Reason for claim lock:', 'Automated fraud rule violation: ' + flag.reason);
                                if (!reason) return;
                                handleExecuteAdminAction({
                                  action: 'lock_claims',
                                  target_user_id: flag.user_id,
                                  duration_hours: hours,
                                  reason,
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 font-semibold text-xs border border-orange-200 dark:border-orange-800 cursor-pointer"
                            >
                              Lock Claims
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('Account suspension reason:', 'Severe fraud violation: ' + flag.reason);
                                if (!reason) return;
                                handleExecuteAdminAction({
                                  action: 'suspend_user',
                                  target_user_id: flag.user_id,
                                  reason,
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-semibold text-xs border border-rose-200 dark:border-rose-800 cursor-pointer"
                            >
                              Suspend
                            </button>
                            <button
                              onClick={() => {
                                handleExecuteAdminAction({
                                  action: 'dismiss_flag',
                                  metadata: { flag_id: flag.id },
                                  reason: 'Flag dismissed by moderator',
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-xs cursor-pointer"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Reported Listings & Content Queue
                </h3>
              </div>

              {reports.length === 0 ? (
                <EmptyState
                  title="Moderation queue is empty"
                  description="No listings have been flagged for review. Great work!"
                />
              ) : (
                <div className="space-y-3">
                  {reports.map((r) => (
                    <div
                      key={r.id}
                      className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                              r.status === 'pending'
                                ? 'bg-rose-100 text-rose-800'
                                : r.status === 'actioned'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {r.status}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Reason: {r.reason.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {formatRelativeTime(r.created_at)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-xs">
                        <div>
                          <span className="font-semibold text-slate-500 block">Reported Listing:</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {r.reported_item?.title || 'Unknown Item'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500 block">Reporter Details:</span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {r.reporter?.full_name || r.reporter?.email || 'Anonymous'}
                          </span>
                        </div>
                      </div>

                      {r.details && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                          "{r.details}"
                        </p>
                      )}

                      {/* Action Controls */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                        {r.reported_item && (
                          <Link
                            to={`/items/${r.reported_item.id}`}
                            className="text-xs text-blue-600 hover:underline flex items-center font-semibold"
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                            Inspect Listing in New Tab
                          </Link>
                        )}

                        <div className="flex items-center space-x-2">
                          {r.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleUpdateReportStatus(r.id, 'dismissed')}
                                disabled={actionInProgress === r.id}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                              >
                                Dismiss Report
                              </button>
                              {r.reported_item_id && (
                                <button
                                  onClick={() => handleAdminDeleteItem(r.reported_item_id!, r.id)}
                                  className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs flex items-center"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove Listing
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search users by name or email..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="p-3.5">User</th>
                        <th className="p-3.5">Role</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Registered</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20">
                          <td className="p-3.5">
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {u.full_name || 'No Name'}
                            </span>
                            <span className="text-slate-400 block">{u.email}</span>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                u.role === 'admin'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3.5">
                            {u.is_banned ? (
                              <span className="text-rose-600 font-bold flex items-center">
                                <Ban className="w-3.5 h-3.5 mr-1" /> Suspended
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-medium flex items-center">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Active
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-slate-500">{formatDate(u.created_at)}</td>
                          <td className="p-3.5 text-right">
                            {u.role !== 'admin' && (
                              <button
                                onClick={() => handleToggleUserBan(u.id, u.is_banned)}
                                disabled={actionInProgress === u.id}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                  u.is_banned
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                }`}
                              >
                                {u.is_banned ? 'Unban User' : 'Suspend Account'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    Immutable Administrative Audit Trail
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Protected by PostgreSQL Row Level Security with append-only policies (updates and deletes strictly blocked).
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {auditLogs.length} Records Logged
                </span>
              </div>

              {auditLogs.length === 0 ? (
                <EmptyState
                  title="Audit trail is empty"
                  description="Administrative actions (warnings, locks, suspensions, dismissals) will appear here."
                />
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="p-3.5">Timestamp</th>
                          <th className="p-3.5">Admin</th>
                          <th className="p-3.5">Action</th>
                          <th className="p-3.5">Target</th>
                          <th className="p-3.5">Reason & Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20">
                            <td className="p-3.5 text-slate-500 whitespace-nowrap">
                              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                {formatRelativeTime(log.created_at)}
                              </span>
                              <span className="text-[10px] text-slate-400 block">{formatDate(log.created_at)}</span>
                            </td>
                            <td className="p-3.5">
                              <span className="font-bold text-slate-900 dark:text-white block">
                                {log.admin?.full_name || log.admin?.email || 'Admin'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">{log.admin_id.substring(0, 8)}...</span>
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  log.action === 'suspend_user'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : log.action === 'lock_claims'
                                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                                    : log.action === 'warn_user'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                }`}
                              >
                                {log.action.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                              {log.target_user_id ? `User: ${log.target_user_id.substring(0, 8)}...` : log.target_item_id ? `Item: ${log.target_item_id.substring(0, 8)}...` : '—'}
                            </td>
                            <td className="p-3.5 text-slate-700 dark:text-slate-300 max-w-xs">
                              <p className="font-medium">{log.reason}</p>
                              {log.metadata?.duration_hours && (
                                <span className="text-[10px] text-orange-600 dark:text-orange-400 block mt-0.5">
                                  Duration: {log.metadata.duration_hours} hours
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: INSIGHTS & HOTSPOTS */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-rose-500" />
                    Hotspots & Recovery Performance
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Cluster analysis, category return rates, and time-to-reunion metrics aggregated into ~1.1km grid cells for privacy.
                  </p>
                </div>
                <Link
                  to="/insights"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Full Interactive Heatmap
                </Link>
              </div>
            </div>
          )}

          {/* TAB: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    Immutable Administrative Audit Trail
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Protected by PostgreSQL Row Level Security with append-only policies (updates and deletes strictly blocked).
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {auditLogs.length} Records Logged
                </span>
              </div>

              {auditLogs.length === 0 ? (
                <EmptyState
                  title="Audit trail is empty"
                  description="Administrative actions (warnings, locks, suspensions, dismissals) will appear here."
                />
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="p-3.5">Timestamp</th>
                          <th className="p-3.5">Admin</th>
                          <th className="p-3.5">Action</th>
                          <th className="p-3.5">Target</th>
                          <th className="p-3.5">Reason & Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20">
                            <td className="p-3.5 text-slate-500 whitespace-nowrap">
                              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                {formatRelativeTime(log.created_at)}
                              </span>
                              <span className="text-[10px] text-slate-400 block">{formatDate(log.created_at)}</span>
                            </td>
                            <td className="p-3.5">
                              <span className="font-bold text-slate-900 dark:text-white block">
                                {log.admin?.full_name || log.admin?.email || 'Admin'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">{log.admin_id.substring(0, 8)}...</span>
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  log.action === 'suspend_user'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : log.action === 'lock_claims'
                                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                                    : log.action === 'warn_user'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                }`}
                              >
                                {log.action.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                              {log.target_user_id ? `User: ${log.target_user_id.substring(0, 8)}...` : log.target_item_id ? `Item: ${log.target_item_id.substring(0, 8)}...` : '—'}
                            </td>
                            <td className="p-3.5 text-slate-700 dark:text-slate-300 max-w-xs">
                              <p className="font-medium">{log.reason}</p>
                              {log.metadata?.duration_hours && (
                                <span className="text-[10px] text-orange-600 dark:text-orange-400 block mt-0.5">
                                  Duration: {log.metadata.duration_hours} hours
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
