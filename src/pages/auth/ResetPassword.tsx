import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { ConfigurationRequired } from '@/components/common/ConfigurationRequired';

const resetSchema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ResetFormData = z.infer<typeof resetSchema>;

export const ResetPassword: React.FC = () => {
  const { updatePassword, isConfigured } = useAuth();
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  if (!isConfigured) {
    return <ConfigurationRequired />;
  }

  const onSubmit = async (data: ResetFormData) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await updatePassword(data.password);
      if (error) {
        setErrorMsg(error.message);
      } else {
        setIsSuccess(true);
        setTimeout(() => navigate('/dashboard'), 2000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white dark:bg-slate-800 p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Set New Password
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Please choose a strong password with at least 6 characters.
          </p>
        </div>

        {isSuccess ? (
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Password Updated!</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Redirecting you to your dashboard...
            </p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  {...register('password')}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white"
                  placeholder="••••••••"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  {...register('confirmPassword')}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white"
                  placeholder="••••••••"
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating Password...
                </>
              ) : (
                'Save New Password'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

