import React from 'react';
import { ShieldCheck, Search, Bell, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const HowItWorksPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          How FindIt Connects Communities
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Built from the ground up for safety, privacy, and automated matching.
        </p>
      </div>

      {/* Matching Algorithm Explanation */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
          <Search className="w-5 h-5 mr-2 text-blue-600" />
          Transparent Weighted Matching Engine
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Unlike black-box algorithms, FindIt evaluates potential matches transparently across 5 distinct dimensions:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">30% Weight</span>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm mt-1">Text & Token Similarity</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Token overlap across item title, description, color, and model identifiers.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">25% Weight</span>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm mt-1">Geographic Proximity</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Haversine formula calculates real distance between coordinates (full score if within 1km).
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">25% Weight</span>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm mt-1">Category Match</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Exact category taxonomy alignment (e.g. Electronics to Electronics).
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">15% Weight</span>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm mt-1">Date Proximity</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Scores highest when the found date is on or shortly after the reported lost date.
            </p>
          </div>
        </div>
      </div>

      {/* Safety Guidelines */}
      <div id="safety" className="bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl p-6 sm:p-8 border border-amber-200 dark:border-amber-900/50 space-y-4">
        <h2 className="text-xl font-bold text-amber-900 dark:text-amber-200 flex items-center">
          <ShieldCheck className="w-5 h-5 mr-2 text-amber-600" />
          Safe Return Guidelines
        </h2>
        <ul className="space-y-3 text-sm text-amber-950/80 dark:text-amber-200/80">
          <li className="flex items-start">
            <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 text-amber-600 flex-shrink-0" />
            <span><strong>Never meet at a private residence:</strong> Always arrange exchanges in open, well-lit, public locations such as a campus student union, police station lobby, or busy café.</span>
          </li>
          <li className="flex items-start">
            <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 text-amber-600 flex-shrink-0" />
            <span><strong>Verify ownership privately:</strong> Require the claimant to describe distinguishing markings, serial numbers, lock-screen backgrounds, or answer secret questions before meeting.</span>
          </li>
          <li className="flex items-start">
            <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 text-amber-600 flex-shrink-0" />
            <span><strong>No fees or ransoms:</strong> FindIt is a community public service. Demanding payment or extortion for returning personal property is illegal and strictly against our terms.</span>
          </li>
        </ul>
      </div>

      <div className="text-center pt-4">
        <Link
          to="/browse"
          className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-sm"
        >
          Start Browsing Listings
          <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </div>
    </div>
  );
};

