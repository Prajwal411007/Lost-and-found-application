import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Search,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Lock,
  MessageSquare,
  QrCode,
  Tag,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface PublicTagInfo {
  valid: boolean;
  name: string;
  categoryName: string;
  isLost: boolean;
  tagCode: string;
}

export const PublicTagPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();

  const [tagInfo, setTagInfo] = useState<PublicTagInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [message, setMessage] = useState('');
  const [finderContact, setFinderContact] = useState('');
  const [finderName, setFinderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Abuse modal states
  const [isAbuseModalOpen, setIsAbuseModalOpen] = useState(false);
  const [abuseReason, setAbuseReason] = useState('Suspicious or spam item');
  const [abuseDetails, setAbuseDetails] = useState('');
  const [abuseSubmitting, setAbuseSubmitting] = useState(false);
  const [abuseSuccess, setAbuseSuccess] = useState(false);

  useEffect(() => {
    if (!code) {
      setError('Missing tag code');
      setIsLoading(false);
      return;
    }

    const fetchTagInfo = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(`/api/tags/${encodeURIComponent(code)}`);
        const contentType = res.headers?.get ? (res.headers.get('content-type') || '') : 'application/json';
        if (contentType.includes('text/html')) {
          throw new Error('Public tag service is currently unavailable.');
        }
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Registered item not found with this tag code');
        }

        setTagInfo(data);
      } catch (err: any) {
        setError(err.message || 'Unable to load tag information');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTagInfo();
  }, [code]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || message.trim().length < 5) {
      setSubmitError('Please provide a descriptive message of at least 5 characters');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const res = await fetch(`/api/tags/${encodeURIComponent(code!)}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user ? { Authorization: `Bearer ${(window as any)._supabaseToken || ''}` } : {}),
        },
        body: JSON.stringify({
          message: message.trim(),
          finderContact: finderContact.trim() || undefined,
          finderName: finderName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to deliver message');
      }

      setSubmitSuccess(true);
      setMessage('');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to transmit message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportAbuse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAbuseSubmitting(true);
      const res = await fetch(`/api/tags/${encodeURIComponent(code!)}/report-abuse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: abuseReason,
          details: abuseDetails.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit abuse report');

      setAbuseSuccess(true);
      setTimeout(() => {
        setIsAbuseModalOpen(false);
        setAbuseSuccess(false);
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit report');
    } finally {
      setAbuseSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden p-6 sm:p-10 space-y-6">
        {/* Brand and Shield Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>FindIt Tag Protection System</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            This item has been registered. Contact the owner
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            You scanned a personal item registered with FindIt. Use the secure form below to notify the owner.
            Your privacy and the owner's identity are completely shielded.
          </p>
        </div>

        {/* Loading & Error States */}
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner size="lg" message="Validating item tag code..." />
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
            <h3 className="font-bold text-rose-800 dark:text-rose-200 text-sm">Tag Code Not Found</h3>
            <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
            <Link
              to="/browse"
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
            >
              <span>Browse All Lost & Found Items</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : tagInfo ? (
          <>
            {/* Tag Information Card (Non-identifying) */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Registered Item
                </span>
                <p className="text-base font-extrabold text-slate-900 dark:text-white">{tagInfo.name}</p>
                <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
                  <Tag className="w-3 h-3" />
                  <span>Category: {tagInfo.categoryName}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-mono font-bold px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300">
                  {tagInfo.tagCode}
                </span>
                {tagInfo.isLost && (
                  <div className="mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                    Reported Lost
                  </div>
                )}
              </div>
            </div>

            {/* Success Confirmation Banner */}
            {submitSuccess ? (
              <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-center space-y-4 animate-in zoom-in-95">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                    Owner Notified Successfully!
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 leading-relaxed">
                    Your message has been privately transmitted to the registered owner. They have received an instant
                    alert on their FindIt dashboard. Thank you for your honesty and community spirit!
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    to="/"
                    className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition"
                  >
                    Return to Homepage
                  </Link>
                </div>
              </div>
            ) : (
              /* Contact Form */
              <form onSubmit={handleSendMessage} className="space-y-4">
                {submitError && (
                  <div className="p-3 rounded-xl text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
                    {submitError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Your Message to the Owner *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Hello! I found your item at [location/building]. It is safe with me. Please let me know how you would like to arrange a return..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Your Name</span>
                      <span className="text-[11px] font-normal text-slate-400">Optional</span>
                    </label>
                    <input
                      type="text"
                      value={finderName}
                      onChange={(e) => setFinderName(e.target.value)}
                      placeholder="e.g. Alex"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Direct Contact (Email or Phone)</span>
                      <span className="text-[11px] font-normal text-slate-400">Optional</span>
                    </label>
                    <input
                      type="text"
                      value={finderContact}
                      onChange={(e) => setFinderContact(e.target.value)}
                      placeholder="e.g. alex@example.com"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 py-1">
                  <Lock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span>The owner's personal phone and email are kept private to protect both parties.</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-md shadow-blue-500/20 disabled:opacity-60 transition cursor-pointer flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Send Message to Owner</span>
                </button>
              </form>
            )}

            {/* Footer with Report Abuse */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>Protected by FindIt Verification</span>
              </span>

              <button
                type="button"
                onClick={() => setIsAbuseModalOpen(true)}
                className="hover:text-rose-600 dark:hover:text-rose-400 transition flex items-center space-x-1 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Report Abuse / Suspicious Tag</span>
              </button>
            </div>
          </>
        ) : null}
      </div>

      {/* Report Abuse Modal */}
      {isAbuseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Report Suspicious Tag</span>
              </h3>
              <button onClick={() => setIsAbuseModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {abuseSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs text-center">
                Report submitted for moderation. Thank you!
              </div>
            ) : (
              <form onSubmit={handleReportAbuse} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Reason
                  </label>
                  <select
                    value={abuseReason}
                    onChange={(e) => setAbuseReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-xs"
                  >
                    <option value="Suspicious or spam item">Suspicious or spam item</option>
                    <option value="Inappropriate or abusive name">Inappropriate or abusive name</option>
                    <option value="Harassment or stalker tag">Harassment or stalker tag</option>
                    <option value="Other security concern">Other security concern</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Details (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={abuseDetails}
                    onChange={(e) => setAbuseDetails(e.target.value)}
                    placeholder="Provide additional context for moderators..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-xs resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAbuseModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={abuseSubmitting}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 flex items-center space-x-1.5"
                  >
                    {abuseSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Submit Report</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
