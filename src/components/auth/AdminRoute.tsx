import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ConfigurationRequired } from '@/components/common/ConfigurationRequired';
import { ShieldX, ArrowLeft } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAuthenticated, isAdmin, isLoading, isConfigured } = useAuth();
  const location = useLocation();

  if (!isConfigured) {
    return <ConfigurationRequired />;
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size="lg" message="Verifying administrative privileges..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-8 text-center border border-rose-200 dark:border-rose-900/50 shadow-xl">
          <div className="mx-auto w-14 h-14 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mb-4">
            <ShieldX className="w-8 h-8" />
          </div>
          <span className="text-xs font-mono font-semibold text-rose-600 uppercase tracking-widest bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded">
            Error 403 - Forbidden
          </span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-2 mb-2">
            Access Restricted
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            You do not have administrative clearance to access the Moderation & Analytics Console. This action has been logged for security auditing.
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

