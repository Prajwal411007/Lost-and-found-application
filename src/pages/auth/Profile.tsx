import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { User, Phone, Mail, Shield, CheckCircle2, AlertCircle, Loader2, Globe, Star, ShieldCheck } from 'lucide-react';
import { formatDate } from '@/lib/utils';

const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  avatarUrl: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  contactPreference: z.enum(['in_app', 'email', 'phone']),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export const ProfilePage: React.FC = () => {
  const { t, i18n } = useTranslation(['dashboard', 'common']);
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reviewsData, setReviewsData] = useState<{
    reviews: any[];
    averageRating: number;
    totalReviews: number;
  }>({ reviews: [], averageRating: 0, totalReviews: 0 });
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const fetchReviews = async () => {
      setIsLoadingReviews(true);
      try {
        const res = await fetch(`/api/reviews/user/${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setReviewsData(data);
        }
      } catch (err) {
        console.error('Failed to load user reviews:', err);
      } finally {
        setIsLoadingReviews(false);
      }
    };
    fetchReviews();
  }, [user?.id]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.full_name || '',
      phone: profile?.phone || '',
      avatarUrl: profile?.avatar_url || '',
      contactPreference: (profile?.contact_preference as any) || 'in_app',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await updateProfile({
        full_name: data.fullName,
        phone: data.phone || null,
        avatar_url: data.avatarUrl || null,
        contact_preference: data.contactPreference,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('Profile settings updated successfully!');
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
        <div className="flex items-center space-x-4 pb-6 border-b border-slate-100 dark:border-slate-700">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold uppercase shadow-md">
            {profile?.full_name ? profile.full_name[0] : (user?.email ? user.email[0] : 'U')}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Profile Settings</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
            <div className="flex items-center space-x-2 mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                <Shield className="w-3 h-3 mr-1" />
                Role: {profile?.role || 'User'}
              </span>
            </div>
          </div>
        </div>

        {successMsg && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-200 text-sm flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-800 dark:text-rose-200 text-sm flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form className="mt-6 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              {...register('fullName')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            />
            {errors.fullName && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.fullName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Phone Number (Optional - Kept Private)
            </label>
            <input
              type="tel"
              {...register('phone')}
              placeholder="+1 (555) 000-0000"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Your phone number is never displayed publicly on item listings.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Avatar Image URL (Optional)
            </label>
            <input
              type="url"
              {...register('avatarUrl')}
              placeholder="https://images.unsplash.com/..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            />
            {errors.avatarUrl && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.avatarUrl.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center">
              <Globe className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
              {t('dashboard:profile.preferred_language', 'Preferred Language')}
            </label>
            <select
              value={i18n.language}
              onChange={(e) => {
                const newLang = e.target.value as any;
                i18n.changeLanguage(newLang);
                if (user?.id) {
                  updateProfile({ preferred_language: newLang });
                }
              }}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">English (English)</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('dashboard:profile.language_help', 'Choose the language used for the interface and notifications.')}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Primary Contact Preference
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { value: 'in_app', label: 'In-App Messaging', icon: Mail },
                { value: 'email', label: 'Email Notifications', icon: Mail },
                { value: 'phone', label: 'Phone Call/SMS', icon: Phone },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center space-x-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 cursor-pointer hover:border-blue-400 transition"
                >
                  <input
                    type="radio"
                    value={opt.value}
                    {...register('contactPreference')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-60 flex items-center"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Community Trust & Thank-You Feedback Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {t('dashboard:feedback.title')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('dashboard:feedback.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 bg-amber-50/70 dark:bg-amber-950/30 px-3.5 py-2 rounded-xl border border-amber-200/60 dark:border-amber-800/50 self-start sm:self-auto">
            <div className="flex items-center text-amber-500">
              <Star className="w-4 h-4 fill-amber-400 mr-1.5" />
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {reviewsData.totalReviews > 0 ? `${reviewsData.averageRating.toFixed(1)} / 5.0` : '5.0 / 5.0'}
              </span>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              {reviewsData.totalReviews} {t('dashboard:feedback.total_reviews')}
            </span>
          </div>
        </div>

        {reviewsData.reviews.length === 0 ? (
          <div className="text-center py-8">
            <Star className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2.5 stroke-1" />
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {t('dashboard:feedback.no_reviews')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {reviewsData.reviews.map((rev) => (
              <div
                key={rev.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-teal-500 text-white font-bold flex items-center justify-center text-xs uppercase">
                      {rev.reviewer?.full_name ? rev.reviewer.full_name[0] : 'C'}
                    </div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      {rev.reviewer?.full_name || 'Community Member'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-0.5 text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= (rev.rating || 5)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300 dark:text-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {rev.note && (
                  <p className="text-xs text-slate-700 dark:text-slate-300 italic">
                    "{rev.note}"
                  </p>
                )}

                <span className="text-[10px] text-slate-400 block pt-1">
                  {formatDate(rev.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

