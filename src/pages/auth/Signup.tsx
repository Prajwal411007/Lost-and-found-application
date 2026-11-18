import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Mail, Lock, User as UserIcon, AlertCircle, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { ConfigurationRequired } from '@/components/common/ConfigurationRequired';

const signupSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export const Signup: React.FC = () => {
  const { signUp, isConfigured } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSuccessNotice, setIsSuccessNotice] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  if (!isConfigured) {
    return <ConfigurationRequired />;
  }

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const { error, user } = await signUp(data.email, data.password, data.fullName);
      if (error) {
        setAuthError(error.message);
      } else {
        // If email confirmation is enabled on Supabase, user exists but session might be null
        setSubmittedEmail(data.email);
        setIsSuccessNotice(true);
      }
    } catch (err: any) {
      setAuthError(err.message || 'An unexpected error occurred during registration.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccessNotice) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Account Created!</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            We've sent a verification link to <strong className="text-slate-900 dark:text-white">{submittedEmail}</strong>. Please check your inbox to activate your account.
          </p>
          <div className="space-y-3">
            <Link
              to="/login"
              className="w-full inline-flex justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-slate-800 p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 mb-4">
            <Search className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Create your FindIt account
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Join the community helping reconnect people with what matters most
          </p>
        </div>

        {authError && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start space-x-3 text-rose-700 dark:text-rose-300 text-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <UserIcon className="w-5 h-5" />
              </div>
              <input
                type="text"
                {...register('fullName')}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white ${
                  errors.fullName
                    ? 'border-rose-300 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="Alex Morgan"
              />
            </div>
            {errors.fullName && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.fullName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-5 h-5" />
              </div>
              <input
                type="email"
                {...register('email')}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white ${
                  errors.email
                    ? 'border-rose-300 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="you@example.com"
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                {...register('password')}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white ${
                  errors.password
                    ? 'border-rose-300 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="At least 6 characters"
              />
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                {...register('confirmPassword')}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white ${
                  errors.confirmPassword
                    ? 'border-rose-300 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="Re-type password"
              />
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-md shadow-blue-500/20 disabled:opacity-60 transition mt-6"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

