import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Zap,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { ConfigurationRequired } from '@/components/common/ConfigurationRequired';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const { signIn, resendVerificationEmail, isConfigured, isAuthenticated, isLoading: authLoading } = useAuth();
  const [authError, setAuthError] = useState<{ message: string; type?: 'unverified' | 'generic' } | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string>('');
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [resendSuccess, setResendSuccess] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/dashboard';
  const initialSuccessMessage = (location.state as any)?.message || null;
  const [successBanner, setSuccessBanner] = useState<string | null>(initialSuccessMessage);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, from]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, touchedFields },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const enteredEmail = watch('email');

  if (!isConfigured) {
    return <ConfigurationRequired />;
  }

  const mapErrorMessage = (errMessage: string, email: string): { message: string; type?: 'unverified' | 'generic' } => {
    const lower = errMessage.toLowerCase();

    // Email not confirmed
    if (lower.includes('email not confirmed') || lower.includes('unverified') || lower.includes('email_not_confirmed')) {
      setUnverifiedEmail(email);
      return {
        message: 'Please verify your email first.',
        type: 'unverified',
      };
    }

    // Rate limiting / too many requests
    if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('over_email_send_rate_limit')) {
      return {
        message: 'Too many attempts. Please wait a minute and try again.',
      };
    }

    // Network / server connection error
    if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('connection') || lower.includes('can\'t reach')) {
      return {
        message: "Can't reach the server. Check your connection and try again.",
      };
    }

    // Wrong credentials - never reveal which is wrong and never reveal if email is registered
    return {
      message: 'Incorrect email or password.',
    };
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    setAuthError(null);
    setResendSuccess(false);

    try {
      const { error } = await signIn(data.email.trim(), data.password);
      if (error) {
        setAuthError(mapErrorMessage(error.message, data.email.trim()));
      } else {
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      setAuthError(mapErrorMessage(err?.message || '', data.email.trim()));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || !unverifiedEmail) return;
    try {
      const { error } = await resendVerificationEmail(unverifiedEmail);
      if (!error) {
        setResendSuccess(true);
        setResendCooldown(60);
      } else {
        alert(error.message);
      }
    } catch (err) {
      console.error('Failed to resend verification email:', err);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden">
        {/* Left Column: Brand & Benefits (Desktop) */}
        <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-blue-600 via-blue-700 to-teal-700 p-10 text-white flex-col justify-between relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <Link to="/" className="inline-flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-sm">
                <Search className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-2xl font-black tracking-tight text-white">FindIt</span>
            </Link>

            <div>
              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/20 text-blue-100 mb-3">
                Global Recovery Network
              </span>
              <h1 className="text-3xl font-black tracking-tight text-white leading-tight">
                Welcome back to your community.
              </h1>
              <p className="mt-2 text-sm text-blue-100/90 leading-relaxed">
                Log in to monitor your listings, receive automated match suggestions, and safely coordinate returns.
              </p>
            </div>

            {/* 3 Short Benefits */}
            <div className="space-y-4 pt-4 border-t border-white/20">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-white">Report Lost & Found Items</h2>
                  <p className="text-[11px] text-blue-100/80">
                    Pin approximate locations and upload photos to initiate community recovery.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-white">Automated Match Alerts</h2>
                  <p className="text-[11px] text-blue-100/80">
                    Our transparent weighted scoring engine notifies you of potential matches instantly.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-white">Safe & Private Returns</h2>
                  <p className="text-[11px] text-blue-100/80">
                    Private verification questions and safe public exchange checklists protect your privacy.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 text-xs text-blue-100/70 border-t border-white/10">
            Protected with Supabase Auth & Row-Level Security.
          </div>

          {/* Background Ambient Shapes */}
          <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-teal-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -top-16 -left-16 w-64 h-64 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Right Column: Form Card */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
          {/* Mobile Header Branding */}
          <div className="lg:hidden text-center mb-6">
            <Link to="/" className="inline-flex items-center space-x-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-500 flex items-center justify-center text-white shadow-sm">
                <Search className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">
                FindIt
              </span>
            </Link>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Welcome back</h1>
            <p className="text-xs text-slate-500 mt-1">Sign in to your account</p>
          </div>

          <div className="hidden lg:block mb-6">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Sign In to Your Account
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Enter your registered credentials below.
            </p>
          </div>

          {/* Success Banner (e.g. from password reset) */}
          {successBanner && (
            <div
              role="status"
              className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-start space-x-2.5 animate-in fade-in"
            >
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <span className="font-semibold">{successBanner}</span>
            </div>
          )}

          {/* Friendly Error Alert */}
          {authError && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs sm:text-sm space-y-2 animate-in fade-in"
            >
              <div className="flex items-start space-x-2.5">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <span className="font-semibold">{authError.message}</span>
              </div>

              {authError.type === 'unverified' && (
                <div className="pt-2 border-t border-rose-200/60 dark:border-rose-900/40 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-rose-700 dark:text-rose-300">
                    Did not receive the email confirmation link?
                  </span>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendCooldown > 0}
                    className="inline-flex items-center px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${resendCooldown > 0 ? 'animate-spin' : ''}`} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}
                  </button>
                </div>
              )}

              {resendSuccess && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center font-medium mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  New verification email sent. Please check your inbox and spam folder.
                </p>
              )}
            </div>
          )}

          {/* Login Form */}
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  {...register('email')}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white disabled:opacity-50 ${
                    errors.email
                      ? 'border-rose-300 dark:border-rose-800 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  placeholder="you@example.com"
                />
              </div>
              {errors.email && (
                <p id="email-error" role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field with Show/Hide Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                  className={`w-full pl-10 pr-11 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white disabled:opacity-50 ${
                    errors.password
                      ? 'border-rose-300 dark:border-rose-800 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label htmlFor="remember-me" className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                <input
                  id="remember-me"
                  type="checkbox"
                  disabled={isSubmitting}
                  {...register('rememberMe')}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                />
                <span>Remember me</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-md shadow-blue-500/20 disabled:opacity-60 transition cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  Log in
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="text-center pt-6 mt-6 border-t border-slate-100 dark:border-slate-700/60">
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              New here?{' '}
              <Link to="/signup" className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
