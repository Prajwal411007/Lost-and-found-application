import React from 'react';
import { Shield } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div>
        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center mb-3">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mt-1">Last updated: November 2026</p>
      </div>

      <div className="prose dark:prose-invert text-sm text-slate-600 dark:text-slate-300 space-y-6 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Core Privacy Philosophy</h2>
          <p>
            FindIt was engineered with strict privacy isolation principles. We believe that recovering your lost personal belongings should never necessitate public disclosure of your personal identity, phone number, email address, or residential address.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Information We Never Disclose Publicly</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Your account email address and phone number are never rendered in public HTML or API responses.</li>
            <li>Verification questions, proofs of ownership, and claim verification answers are strictly private between claimant and finder.</li>
            <li>Exact home addresses are prohibited; listings only present approximate neighborhoods, landmarks, or campus coordinates.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. Data Retention and Deletion</h2>
          <p>
            When an item is marked as returned or closed, you can delete or archive the report at any time from your dashboard, removing uploaded photos and metadata permanently from active search indexing.
          </p>
        </section>
      </div>
    </div>
  );
};

