import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';
import { ConfigurationRequired } from '@/components/common/ConfigurationRequired';

const signupSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    agreeToTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the terms and privacy policy' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export const Signup: React.FC = () => {
  const { signUp, isConfigured, isAuthenticated, isLoading: authLoading } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSuccessNotice, setIsSuccessNotice] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      agreeToTerms: false as any,
    },
  });

  const currentPassword = watch('password') || '';

  // Password strength calculations
  const passwordStrength = useMemo(() => {
    const pwd = currentPassword;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    let label = 'Weak';
    let color = 'bg-rose-500';
    if (score === 2) {
      label = 'Fair';
      color = 'bg-amber-500';
    } else if (score === 3) {
      label = 'Good';
      color = 'bg-blue-500';
    } else if (score >= 4) {
      label = 'Strong';
      color = 'bg-emerald-500';
    }

    return { score, label, color };
  }, [currentPassword]);

  if (!isConfigured) {
    return <ConfigurationRequired />;
  }

  const onSubmit = async (data: SignupFormData) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const { error } = await signUp(data.email.trim(), data.password, data.fullName.trim());
      if (error) {
        setAuthError(error.message);
      } else {
        setSubmittedEmail(data.email.trim());
        setIsSuccessNotice(true);
      }
    } catch (err: any) {
      setAuthError(err.message || 'An unexpected error occurred during registration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccessNotice) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 text-center animate-in fade-in">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5 shadow-inner">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Check Your Email</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            We sent a verification link to <strong className="text-slate-900 dark:text-white">{submittedEmail}</strong>. Please click the link to verify your email and activate your account.
          </p>
          <div className="space-y-3">
            <Link
              to="/login"
              className="w-full inline-flex justify-center py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition"
            >
              Proceed to Log in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white dark:bg-slate-800 p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-700/80">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center space-x-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Search className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">
              FindIt
            </span>
          </Link>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Create an Account
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Join the community helping reunite people with lost items
          </p>
        </div>

        {authError && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start space-x-3 text-rose-800 dark:text-rose-200 text-xs sm:text-sm animate-in fade-in"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <span className="font-medium">{authError}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Full Name */}
          <div>
            <label
              htmlFor="fullName"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.fullName)}
                aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                {...register('fullName')}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white disabled:opacity-50 ${
                  errors.fullName
                    ? 'border-rose-300 dark:border-rose-800 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="Jane Doe"
              />
            </div>
            {errors.fullName && (
              <p id="fullName-error" role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {errors.fullName.message}
              </p>
            )}
          </div>

          {/* Email Address */}
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
                placeholder="jane@example.com"
              />
            </div>
            {errors.email && (
              <p id="email-error" role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
                className={`w-full pl-10 pr-11 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white disabled:opacity-50 ${
                  errors.password
                    ? 'border-rose-300 dark:border-rose-800 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="At least 8 characters"
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

            {/* Password Strength Hint */}
            {currentPassword.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">Strength:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{passwordStrength.label}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 h-1.5">
                  <div
                    className={`rounded-full transition-colors ${
                      passwordStrength.score >= 1 ? passwordStrength.color : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                  <div
                    className={`rounded-full transition-colors ${
                      passwordStrength.score >= 2 ? passwordStrength.color : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                  <div
                    className={`rounded-full transition-colors ${
                      passwordStrength.score >= 3 ? passwordStrength.color : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                  <div
                    className={`rounded-full transition-colors ${
                      passwordStrength.score >= 4 ? passwordStrength.color : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
                  <span className={`inline-flex items-center ${currentPassword.length >= 8 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
                    <Check className={`w-3 h-3 mr-0.5 ${currentPassword.length >= 8 ? 'opacity-100' : 'opacity-30'}`} /> 8+ chars
                  </span>
                  <span className={`inline-flex items-center ${/[A-Z]/.test(currentPassword) && /[a-z]/.test(currentPassword) ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
                    <Check className={`w-3 h-3 mr-0.5 ${/[A-Z]/.test(currentPassword) && /[a-z]/.test(currentPassword) ? 'opacity-100' : 'opacity-30'}`} /> Upper & lower case
                  </span>
                  <span className={`inline-flex items-center ${/[0-9]/.test(currentPassword) ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
                    <Check className={`w-3 h-3 mr-0.5 ${/[0-9]/.test(currentPassword) ? 'opacity-100' : 'opacity-30'}`} /> Number
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.confirmPassword)}
                aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                {...register('confirmPassword')}
                className={`w-full pl-10 pr-11 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white disabled:opacity-50 ${
                  errors.confirmPassword
                    ? 'border-rose-300 dark:border-rose-800 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="Re-enter your password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p id="confirmPassword-error" role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Terms and Privacy Checkbox */}
          <div className="pt-1">
            <label htmlFor="agreeToTerms" className="flex items-start space-x-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input
                id="agreeToTerms"
                type="checkbox"
                disabled={isSubmitting}
                {...register('agreeToTerms')}
                className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600 cursor-pointer"
              />
              <span>
                I agree to the{' '}
                <Link to="/terms" target="_blank" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" target="_blank" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {errors.agreeToTerms && (
              <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {errors.agreeToTerms.message}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-md shadow-blue-500/20 disabled:opacity-60 transition cursor-pointer mt-4"
          >
            {isSubmitting ? (
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

        <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-700/60">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
