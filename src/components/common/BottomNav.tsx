import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, PlusCircle, MessageSquare, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

export const BottomNav: React.FC = () => {
  const { t } = useTranslation('common');
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const navItems = [
    {
      to: '/',
      label: t('nav.home', 'Home'),
      icon: Home,
      isActive: location.pathname === '/',
    },
    {
      to: '/browse',
      label: t('nav.browse', 'Browse'),
      icon: Compass,
      isActive: location.pathname === '/browse',
    },
    {
      to: '/report/lost',
      label: t('nav.report', 'Report'),
      icon: PlusCircle,
      isActive: location.pathname.startsWith('/report'),
      isHighlight: true,
    },
    {
      to: '/messages',
      label: t('nav.messages', 'Messages'),
      icon: MessageSquare,
      isActive: location.pathname === '/messages',
    },
    {
      to: isAuthenticated ? '/dashboard?tab=profile' : '/login',
      label: isAuthenticated ? t('nav.profile', 'Profile') : t('nav.login', 'Login'),
      icon: User,
      isActive: location.pathname === '/dashboard' || location.pathname === '/login',
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B1220]/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-1.5 shadow-lg transition-colors"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition text-[10px] font-medium ${
                item.isActive
                  ? 'text-teal-600 dark:text-teal-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition ${
                  item.isHighlight
                    ? 'bg-gradient-to-tr from-teal-500 to-blue-600 text-white shadow-md shadow-teal-500/20'
                    : item.isActive
                    ? 'bg-teal-50 dark:bg-teal-950/60'
                    : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${item.isHighlight ? 'text-white' : ''}`} />
              </div>
              <span className="mt-0.5 truncate max-w-[64px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
