import React from 'react';
import { HelpCircle, ChevronRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export const HelpPage: React.FC = () => {
  const faqs = [
    {
      q: 'How does item matching work?',
      a: 'When you submit a report, our scoring engine runs automatically against active opposite listings (lost vs found). It evaluates category, description keywords, GPS distance, and date closeness, generating High, Medium, or Low match suggestions.',
    },
    {
      q: 'Is my phone number or email address shared publicly?',
      a: 'Never. All contact is facilitated strictly through our secure in-app messaging system. Only you can decide what personal contact info to provide during a private verification conversation.',
    },
    {
      q: 'What is Campus Navigation Mode?',
      a: 'Campus mode allows university students and visitors to filter listings by campus grounds, view building and landmark markers on an interactive map, and calculate walking directions to where an item was found.',
    },
    {
      q: 'What should I do if someone demands money to return my item?',
      a: 'Do not pay. Demanding rewards or compensation is a violation of our community standards and often unlawful. Report the listing immediately using the "Report Listing" button on the item page.',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div>
        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center mb-3">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Help & Frequently Asked Questions</h1>
        <p className="text-sm text-slate-500 mt-1">Answers to common questions regarding reports, safety, and claims.</p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('replay-onboarding-tour'))}
          className="mt-4 inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition shadow-2xs cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <span>Replay Guided Platform Tour</span>
        </button>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <div
            key={i}
            className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2"
          >
            <h3 className="font-bold text-slate-900 dark:text-white text-base">{faq.q}</h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 flex items-center justify-between">
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Still have questions?</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">Our support team is happy to help.</p>
        </div>
        <Link
          to="/contact"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
        >
          Contact Us
        </Link>
      </div>
    </div>
  );
};

