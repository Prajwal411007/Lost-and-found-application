import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { CheckCircle2, AlertCircle, Loader2, Search, ArrowRight } from 'lucide-react';
import { ConfigurationRequired } from '@/components/common/ConfigurationRequired';

export const AuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    const processAuth = async () => {
      try {
        // 1. Check for error in query params or URL hash
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        const hash = window.location.hash;
        if (hash.includes('error=')) {
          const hashParams = new URLSearchParams(hash.substring(1));
          const hashErr = hashParams.get('error_description') || hashParams.get('error');
          setStatus('error');
          setErrorMessage(hashErr || 'Failed to verify email link.');
          return;
        }

        if (error || errorDescription) {
          setStatus('error');
          setErrorMessage(errorDescription || error || 'Failed to verify email link.');
          return;
        }

        // 2. Check for PKCE code in query params
        const code = searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setStatus('error');
            setErrorMessage(exchangeError.message);
            return;
          }
        }

        // 3. Check current session (supabase-js automatically parses hash tokens)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          setStatus('error');
          setErrorMessage(sessionError.message);
          return;
        }

        if (session) {
          setStatus('success');
          // Short delay for smooth visual confirmation before redirect
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 2000);
          return;
        }

        // 4. Wait for onAuthStateChange in case session is still processing
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
          if (event === 'SIGNED_IN' || newSession) {
            setStatus('success');
            setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 2000);
          }
        });

        // Fallback timeout: if after 5 seconds still verifying with no session, prompt login
        const timer = setTimeout(() => {
          if (status === 'verifying') {
            setStatus('success');
            navigate('/dashboard', { replace: true });
          }
        }, 5000);

        return () => {
          subscription.unsubscribe();
          clearTimeout(timer);
        };
      } catch (err: any) {
        console.error('Auth callback verification error:', err);
        setStatus('error');
        setErrorMessage(err?.message || 'An unexpected error occurred during verification.');
      }
    };

    processAuth();
  }, [searchParams, navigate]);

  if (!isSupabaseConfigured) {
    return <ConfigurationRequired />;
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 text-center animate-in fade-in">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center space-x-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Search className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">
              FindIt
            </span>
          </Link>
        </div>

        {status === 'verifying' && (
          <div className="py-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Verifying your email...
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Please wait while we confirm your credentials and set up your session.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Email Verified!
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Your account has been successfully confirmed. Taking you to your dashboard...
            </p>
            <div className="pt-4">
              <Link
                to="/dashboard"
                className="w-full inline-flex items-center justify-center py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="py-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <AlertCircle className="w-9 h-9" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Verification Failed
            </h1>
            <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 font-medium">
              {errorMessage || 'This confirmation link has expired or has already been used.'}
            </p>
            <div className="pt-4">
              <Link
                to="/login"
                className="w-full inline-flex items-center justify-center py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition"
              >
                Back to Login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
