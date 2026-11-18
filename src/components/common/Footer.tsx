import React from 'react';
import { Link } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { Search, Shield, Globe, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-sm transition-colors mt-auto">
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
              Global, transparent, and privacy-preserving lost and found recovery system connecting communities, cities, and university campuses.
            </p>
            <div className="flex items-center space-x-2 text-xs text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Global matching engine operational</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-3">
              Explore
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <RouterLink to="/browse" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  Browse All Items
                </RouterLink>
              </li>
              <li>
                <RouterLink to="/report/lost" className="hover:text-rose-600 dark:hover:text-rose-400 transition">
                  Report a Lost Item
                </RouterLink>
              </li>
              <li>
                <RouterLink to="/report/found" className="hover:text-teal-600 dark:hover:text-teal-400 transition">
                  Report a Found Item
                </RouterLink>
              </li>
              <li>
                <RouterLink to="/campus" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  Campus Navigation Mode
                </RouterLink>
              </li>
            </ul>
          </div>

          {/* Trust & Safety */}
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-3">
              Safety & Verification
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <RouterLink to="/how-it-works" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  How Matching Works
                </RouterLink>
              </li>
              <li>
                <RouterLink to="/how-it-works#safety" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  Safe Public Return Guidelines
                </RouterLink>
              </li>
              <li>
                <RouterLink to="/privacy" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  Privacy Policy (No Public PII)
                </RouterLink>
              </li>
              <li>
                <RouterLink to="/terms" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  Terms of Service
                </RouterLink>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-3">
              Support & Help
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <RouterLink to="/help" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  Help Center & FAQs
                </RouterLink>
              </li>
              <li>
                <RouterLink to="/contact" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  Contact Support
                </RouterLink>
              </li>
              <li>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  Open Source Architecture
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© {new Date().getFullYear()} FindIt Global Lost & Found. Built with care for communities everywhere.</p>
          <div className="flex items-center space-x-4">
            <RouterLink to="/privacy" className="hover:underline">Privacy</RouterLink>
            <RouterLink to="/terms" className="hover:underline">Terms</RouterLink>
            <RouterLink to="/contact" className="hover:underline">Contact</RouterLink>
          </div>
        </div>
      </div>
    </footer>
  );
};

