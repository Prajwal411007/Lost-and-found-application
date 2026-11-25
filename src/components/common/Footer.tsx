import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

export const Footer: React.FC = () => {
  const { t } = useTranslation('common');

  return (
    <footer className="w-full bg-white/70 dark:bg-[#0F2A33]/70 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 text-sm transition-colors duration-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Col */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-teal-500 flex items-center justify-center text-white">
                <Search className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span className="text-lg font-bold text-slate-900 dark:text-white">FindIt</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t('footer.description')}
            </p>
            <div className="flex items-center space-x-2 text-xs text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{t('footer.operational_status')}</span>
            </div>
            <div className="pt-2">
              <LanguageSwitcher variant="footer" />
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-3">
              {t('footer.explore')}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <RouterLink to="/browse" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t('footer.browse_all')}
                </RouterLink>
              </li>
              <li>
                <RouterLink to="/report/lost" className="hover:text-rose-600 dark:hover:text-rose-400 transition">
                  {t('footer.report_lost')}
                </RouterLink>
              </li>
              <li>
                <RouterLink to="/report/found" className="hover:text-teal-600 dark:hover:text-teal-400 transition">
                  {t('footer.report_found')}
                </RouterLink>
              </li>
              <li>
                <RouterLink to="/campus" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t('footer.campus_nav')}
                </RouterLink>
              </li>
            </ul>
          </div>

          {/* Trust & Safety */}
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-3">
              {t('footer.safety')}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <RouterLink to="/how-it-works" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t('footer.how_it_works')}
                </RouterLink>
              </li>
              <li>
                <RouterLink to="/how-it-works#safety" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t('footer.safe_guidelines')}
                </RouterLink>
              </li>
              <li>
                <RouterLink to="/privacy" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t('footer.privacy_policy')}
                </RouterLink>
              </li>
              <li>
                <RouterLink to="/terms" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t('footer.terms')}
                </RouterLink>
              </li>
            </ul>
          </div>

          {/* Platform Links */}
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-3">
              FindIt Platform
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <RouterLink to="/my-items" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t('nav.qr_tags')}
                </RouterLink>
              </li>
              <li>
                <RouterLink to="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {t('nav.dashboard')}
                </RouterLink>
              </li>
              <li>
                <RouterLink to="/contact" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  Contact & Support
                </RouterLink>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© {new Date().getFullYear()} FindIt Global. {t('footer.rights_reserved')}</p>
          <div className="flex items-center space-x-4">
            <RouterLink to="/privacy" className="hover:underline">{t('footer.privacy_policy')}</RouterLink>
            <RouterLink to="/terms" className="hover:underline">{t('footer.terms')}</RouterLink>
          </div>
        </div>
      </div>
    </footer>
  );
};
