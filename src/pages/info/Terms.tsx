import React from 'react';
import { FileText } from 'lucide-react';

export const TermsPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div>
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center mb-3">
          <FileText className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Terms of Service</h1>
        <p className="text-sm text-slate-500 mt-1">Effective Date: November 2026</p>
      </div>

      <div className="text-sm text-slate-600 dark:text-slate-300 space-y-6 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Community Good Faith</h2>
          <p>
            FindIt is a community network designed to facilitate the honest recovery and return of lost items. By using this service, you agree to act in good faith and report lost and found items accurately.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Prohibited Conduct</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Posting fake, fraudulent, or harassing listings.</li>
            <li>Demanding ransom, fee, or compensation for returning an item found in a public or private venue.</li>
            <li>Uploading explicit, offensive, or infringing imagery.</li>
            <li>Publishing another individual's government ID numbers or credit card numbers.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. Limitation of Liability</h2>
          <p>
            FindIt provides the communication and matching platform as-is. Users are responsible for exercising judgment and adhering to safe exchange recommendations when meeting in person.
          </p>
        </section>
      </div>
    </div>
  );
};

