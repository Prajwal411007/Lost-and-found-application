import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ConfigurationRequired } from '@/components/common/ConfigurationRequired';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, isConfigured, profile } = useAuth();
  const location = useLocation();

  if (!isConfigured) {
    return <ConfigurationRequired />;
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size="lg" message="Checking authentication..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profile?.is_banned) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl p-6 text-center border border-rose-200 dark:border-rose-900/50 shadow-lg">
          <div className="mx-auto w-12 h-12 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-full flex items-center justify-center mb-3">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Account Suspended</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Your account has been suspended due to violations of our community safety guidelines.
          </p>
          <a
            href="mailto:support@lostandfound.local"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Contact Safety Team
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

