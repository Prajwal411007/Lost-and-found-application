import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  PlusCircle,
  Bell,
  MessageSquare,
  User,
  Shield,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Compass,
  MapPin,
  CheckCircle2,
  SlidersHorizontal,
  QrCode,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { LanguageSwitcher } from './LanguageSwitcher';

export const Navbar: React.FC = () => {
  const { t } = useTranslation('common');
  const { user, profile, isAuthenticated, isAdmin, signOut } = useAuth();
  const { theme, setTheme, isDark } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
  }, [location.pathname]);

  // Fetch unread counts when authenticated
  useEffect(() => {
    if (!isAuthenticated || !user || !isSupabaseConfigured || !supabase) return;

    const fetchCounts = async () => {
      try {
        const { count: notifCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false);

        if (notifCount !== null) setUnreadNotifications(notifCount);
      } catch (err) {
        console.error('Error fetching unread count:', err);
      }
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, [isAuthenticated, user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0B1220]/80 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition transform">
                <Search className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 via-blue-700 to-teal-600 bg-clip-text text-transparent">
                  FindIt
                </span>
                <span className="hidden sm:inline-block ml-1.5 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-900">
                  Global
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1 text-sm font-medium">
              <Link
                to="/browse"
                className={`px-3 py-2 rounded-lg transition whitespace-nowrap ${
                  location.pathname === '/browse'
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/40'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                {t('nav.browse')}
              </Link>
              <Link
                to="/campus"
                className={`px-3 py-2 rounded-lg flex items-center space-x-1.5 transition whitespace-nowrap ${
                  location.pathname === '/campus'
                    ? 'text-teal-600 dark:text-teal-400 bg-teal-50/60 dark:bg-teal-950/40'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <Compass className="w-4 h-4 text-teal-500" />
                <span>{t('nav.campus')}</span>
              </Link>
              <Link
                to="/how-it-works"
                className={`px-3 py-2 rounded-lg transition whitespace-nowrap ${
                  location.pathname === '/how-it-works'
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/40'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                {t('nav.how_it_works', 'How It Works')}
              </Link>
            </nav>
          </div>

          {/* Action CTAs & Right Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Quick Report CTAs */}
            <div className="hidden lg:flex items-center space-x-2">
              <Link
                to="/report/lost"
                className="px-3 py-2 text-xs font-semibold rounded-xl text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition shadow-sm whitespace-nowrap"
              >
                {t('nav.report_lost')}
              </Link>
              <Link
                to="/report/found"
                className="px-3 py-2 text-xs font-semibold rounded-xl text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition shadow-sm whitespace-nowrap"
              >
                {t('nav.report_found')}
              </Link>
            </div>

            {/* Language Switcher */}
            <LanguageSwitcher variant="navbar" />

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label={isDark ? t('nav.theme_light') : t('nav.theme_dark')}
            >
              {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>

            {isAuthenticated ? (
              <>
                {/* Notifications Link */}
                <Link
                  to="/dashboard?tab=notifications"
                  className="relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  aria-label={t('nav.notifications')}
                >
                  <Bell className="w-5 h-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 text-[10px] font-bold text-white bg-rose-500 rounded-full flex items-center justify-center animate-pulse">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </span>
                  )}
                </Link>

                {/* Messages Link */}
                <Link
                  to="/messages"
                  className="relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  aria-label={t('nav.messages')}
                >
                  <MessageSquare className="w-5 h-5" />
                  {unreadMessages > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 text-[10px] font-bold text-white bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </span>
                  )}
                </Link>

                {/* Profile / Menu Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition focus:outline-none"
                    aria-label="User menu"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                      {profile?.full_name ? profile.full_name[0].toUpperCase() : 'U'}
                    </div>
                  </button>

                  {userDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {profile?.full_name || 'My Account'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                        {isAdmin && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 rounded">
                            Admin
                          </span>
                        )}
                      </div>

                      <div className="py-1 text-sm text-slate-700 dark:text-slate-300">
                        <Link
                          to="/dashboard"
                          className="flex items-center px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        >
                          <SlidersHorizontal className="w-4 h-4 mr-2.5 text-slate-400" />
                          {t('nav.dashboard')}
                        </Link>
                        <Link
                          to="/my-items"
                          className="flex items-center px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        >
                          <QrCode className="w-4 h-4 mr-2.5 text-blue-500" />
                          {t('nav.my_items')}
                        </Link>
                        <Link
                          to="/messages"
                          className="flex items-center px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        >
                          <MessageSquare className="w-4 h-4 mr-2.5 text-slate-400" />
                          {t('nav.messages')}
                        </Link>
                        <Link
                          to="/profile"
                          className="flex items-center px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        >
                          <User className="w-4 h-4 mr-2.5 text-slate-400" />
                          Profile Settings
                        </Link>
                        {isAdmin && (
                          <Link
                            to="/admin"
                            className="flex items-center px-4 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium"
                          >
                            <Shield className="w-4 h-4 mr-2.5 text-rose-500" />
                            {t('nav.admin')}
                          </Link>
                        )}
                      </div>

                      <div className="pt-1 border-t border-slate-100 dark:border-slate-700">
                        <button
                          onClick={handleSignOut}
                          className="flex w-full items-center px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <LogOut className="w-4 h-4 mr-2.5" />
                          {t('nav.signout')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition whitespace-nowrap"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/signup"
                  className="px-3 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm shadow-blue-500/20 whitespace-nowrap"
                >
                  {t('nav.signup')}
                </Link>
              </div>
            )}

            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#0B1220]/95 backdrop-blur-md px-4 pt-3 pb-6 space-y-3">
          <div className="grid grid-cols-2 gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Link
              to="/report/lost"
              className="py-2.5 px-3 text-center text-xs font-semibold rounded-xl text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200"
            >
              {t('nav.report_lost')}
            </Link>
            <Link
              to="/report/found"
              className="py-2.5 px-3 text-center text-xs font-semibold rounded-xl text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border border-teal-200"
            >
              {t('nav.report_found')}
            </Link>
          </div>

          <div className="space-y-1 text-sm font-medium">
            <Link
              to="/browse"
              className="block px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t('nav.browse')}
            </Link>
            <Link
              to="/campus"
              className="block px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t('nav.campus')}
            </Link>
            <Link
              to="/how-it-works"
              className="block px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t('footer.how_it_works')}
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  to="/dashboard"
                  className="block px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t('nav.dashboard')}
                </Link>
                <Link
                  to="/my-items"
                  className="block px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t('nav.my_items')}
                </Link>
                <Link
                  to="/messages"
                  className="block px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t('nav.messages')}
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="block px-3 py-2 rounded-lg text-rose-600 dark:text-rose-400 font-semibold"
                  >
                    {t('nav.admin')}
                  </Link>
                )}
              </>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('nav.language')}:</span>
            <LanguageSwitcher variant="inline" />
          </div>
        </div>
      )}
    </header>
  );
};
