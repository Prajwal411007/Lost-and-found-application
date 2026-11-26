import React, { useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Lock,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Flag,
  UserCheck,
  History,
  FileText,
  Eye,
  RefreshCw,
  Send,
  ArrowRight,
  Upload,
  Check,
  ChevronRight,
  Info,
} from 'lucide-react';
import { computeVerificationMatch } from '../../../server/services/verificationMatch';

export const ClaimsWalkthroughDemo: React.FC = () => {
  const { t } = useTranslation(['claims', 'common', 'admin']);
  const { tab } = useParams<{ tab?: string }>();
  const [searchParams] = useSearchParams();
  const initialTab = (tab as any) || (searchParams.get('tab') as any) || 'genuine';
  const initialDark = tab === 'dark' || searchParams.get('dark') === 'true';
  const [activeTab, setActiveTab] = useState<'genuine' | 'false_claim' | 'claimant_wizard' | 'handover_dispute' | 'admin_audit'>(
    tab === 'dark' ? 'genuine' : initialTab
  );
  const [darkMode, setDarkMode] = useState(initialDark);

  // Sample Finder's Hidden Proof Details
  const samplePrivateDetails = [
    {
      detail_type: 'lock_screen',
      detail_label: 'Lock screen wallpaper',
      detail_value: 'Golden retriever puppy on green grass',
    },
    {
      detail_type: 'scratch_mark',
      detail_label: 'Scratch / cosmetic mark',
      detail_value: 'Small scratch near bottom right USB-C charging port',
    },
    {
      detail_type: 'bag_contents',
      detail_label: 'Internal pocket contents',
      detail_value: 'Student ID card (Alex M.) and blue transit bus pass',
    },
  ];

  const publicDescription = 'Found a space gray 14-inch laptop on floor 2 study desk near the library stairs on Tuesday afternoon.';

  // Genuine Claimant Submission
  const genuineAnswers = {
    marks: 'There is a faint scratch right next to the bottom right usb-c charging port.',
    category_detail: 'Lock screen has a golden retriever puppy on grass.',
    contents: 'Inside the sleeve pocket was my Alex M. student ID and transit bus pass.',
    proof_description: 'I purchased it last year at the campus bookstore; wallpaper is my pet dog.',
  };
  const genuineMatch = computeVerificationMatch(samplePrivateDetails, genuineAnswers, publicDescription);

  // False / Guessing Claimant Submission (Copying public text)
  const falseAnswers = {
    marks: 'Found space gray 14-inch laptop near library stairs Tuesday afternoon.',
    category_detail: 'Default system wallpaper',
    contents: 'Nothing inside the pocket',
    proof_description: 'Space gray laptop left on floor 2 study desk on Tuesday afternoon. Please return it.',
  };
  const falseMatch = computeVerificationMatch(samplePrivateDetails, falseAnswers, publicDescription);

  // Handover state
  const [finderConfirmed, setFinderConfirmed] = useState(true);
  const [claimantConfirmed, setClaimantConfirmed] = useState(false);
  const [isDisputed, setIsDisputed] = useState(false);

  return (
    <div className={`min-h-screen py-8 px-4 sm:px-6 lg:px-8 transition-colors ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                Interactive Verification Walkthrough
              </span>
              <span className="text-xs text-slate-400">Migration 011 Verified</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
              Claim & Verification Hardening Showcase
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Deterministic verification match engine, anti-fraud rules, mutual safe handover, and immutable audit logs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Toggle {darkMode ? 'Light' : 'Dark'} Mode
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('genuine')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'genuine'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            1. Genuine Claim (High Match)
          </button>

          <button
            onClick={() => setActiveTab('false_claim')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'false_claim'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            2. False / Guessing Claim (Low Match & Mirroring)
          </button>

          <button
            onClick={() => setActiveTab('claimant_wizard')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'claimant_wizard'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            3. Guided Claimant Wizard
          </button>

          <button
            onClick={() => setActiveTab('handover_dispute')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'handover_dispute'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            4. Mutual Safe Handover & Dispute
          </button>

          <button
            onClick={() => setActiveTab('admin_audit')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'admin_audit'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4" />
            5. Admin Fraud Queue & Immutable Audit
          </button>
        </div>

        {/* TAB 1: GENUINE CLAIM */}
        {activeTab === 'genuine' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Genuine Owner Verification Scenario</strong>
                The claimant independently knows the finder's private proof details (lock screen wallpaper, USB scratch, inner pocket contents) without merely repeating the public listing text.
              </div>
            </div>

            {/* Finder Review Modal Preview */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Finder Claim Review</span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Review Claim: 14-inch Space Gray Laptop</h3>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Status: Under Review
                </span>
              </div>

              <div className="p-6 space-y-6">
                {/* Claimant Aggregate Profile */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-black flex items-center justify-center text-sm">
                      A
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block text-sm">Alex Morgan</span>
                      <span className="text-slate-400">Account verified · 184 days active</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300">
                      Claims: <strong>2</strong>
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 font-semibold text-emerald-800 dark:text-emerald-300">
                      Successful Returns: <strong>2</strong>
                    </span>
                  </div>
                </div>

                {/* Verification Match Engine Indicator */}
                <div className="p-5 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Verification Match Engine
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-500 text-white shadow-sm">
                      High Match (Score: 92%)
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-emerald-950 dark:text-emerald-200 font-medium leading-relaxed">
                    {genuineMatch.explanation}
                  </p>
                  <p className="text-[11px] text-slate-500 italic">
                    Guidance only: A matching description alone is never proof of ownership. The finder or a moderator makes the final decision.
                  </p>
                </div>

                {/* Side by Side Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  {/* Claimant's Answers */}
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-4">
                    <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs border-b border-slate-200 dark:border-slate-700 pb-2">
                      Claimant's Submitted Details
                    </h4>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Marks & Distinguishing Features</span>
                      <p className="text-slate-900 dark:text-slate-100 font-medium mt-0.5">{genuineAnswers.marks}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Lock Screen / Custom Question</span>
                      <p className="text-slate-900 dark:text-slate-100 font-medium mt-0.5">{genuineAnswers.category_detail}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Internal Contents</span>
                      <p className="text-slate-900 dark:text-slate-100 font-medium mt-0.5">{genuineAnswers.contents}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Attached Proof Files</span>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-medium">
                          <ExternalLink className="w-3 h-3" />
                          apple_store_invoice_receipt.pdf (184 KB)
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-medium">
                          <ExternalLink className="w-3 h-3" />
                          find_my_serial_screenshot.png (420 KB)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Finder's Hidden Proof Details */}
                  <div className="p-5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 space-y-4">
                    <h4 className="font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider text-xs border-b border-indigo-200 dark:border-indigo-800 pb-2 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-600" />
                      Your Hidden Proof Details (Finder Only)
                    </h4>
                    {samplePrivateDetails.map((pd, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-800">
                        <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block">
                          {pd.detail_label}
                        </span>
                        <p className="text-slate-900 dark:text-white font-bold mt-0.5">
                          {pd.detail_value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Finder Action Bar */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    Approving will confirm ownership and place other competing claims <strong>on hold</strong>.
                  </span>
                  <div className="flex items-center gap-3">
                    <button className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                      Ask Follow-up in Chat
                    </button>
                    <button className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 transition">
                      Decline Claim
                    </button>
                    <button className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition">
                      Approve Ownership
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FALSE / GUESSING CLAIM */}
        {activeTab === 'false_claim' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs sm:text-sm text-rose-900 dark:text-rose-200 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Fraudulent / Guessing Claim Scenario</strong>
                The claimant repeats words copied from the public listing without matching any private proof details. The engine flags description mirroring and alerts the finder.
              </div>
            </div>

            {/* Finder Review Modal Preview */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Finder Claim Review</span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Review Claim: 14-inch Space Gray Laptop</h3>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  Suspicious Activity Flagged
                </span>
              </div>

              <div className="p-6 space-y-6">
                {/* Claimant Aggregate Profile */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-600 text-white font-black flex items-center justify-center text-sm">
                      U
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block text-sm">Unknown User (Fresh Account)</span>
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">Account created 12 minutes ago · 0 returns</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 font-semibold text-rose-800 dark:text-rose-300">
                      Recent Rejected Claims: <strong>2</strong>
                    </span>
                  </div>
                </div>

                {/* Verification Match Engine Indicator - LOW / MIRRORING */}
                <div className="p-5 rounded-2xl border-2 border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Verification Match Engine: Warning
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-rose-600 text-white shadow-sm">
                      Low Match / Guessing Detected (Score: 12%)
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-rose-950 dark:text-rose-200 font-medium leading-relaxed">
                    {falseMatch.explanation}
                  </p>
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200">
                    <strong>Rule-Based Fraud Warning:</strong> Claimant answer exhibits <strong>{falseMatch.descriptionOverlapPercent}% word overlap</strong> with the public title and description, while matching 0 of 3 secret details. High probability of opportunistic guessing.
                  </div>
                </div>

                {/* Side by Side Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  {/* Claimant's Answers */}
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-4">
                    <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs border-b border-slate-200 dark:border-slate-700 pb-2">
                      Claimant's Submitted Details
                    </h4>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Marks & Distinguishing Features</span>
                      <p className="text-rose-700 dark:text-rose-300 font-medium mt-0.5">{falseAnswers.marks}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Lock Screen / Custom Question</span>
                      <p className="text-slate-500 font-medium mt-0.5 italic">{falseAnswers.category_detail} (Mismatched)</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Internal Contents</span>
                      <p className="text-slate-500 font-medium mt-0.5 italic">{falseAnswers.contents} (Mismatched)</p>
                    </div>
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Attached Proof Files</span>
                      <p className="text-slate-400 italic">No verification receipts or documents uploaded.</p>
                    </div>
                  </div>

                  {/* Finder's Hidden Proof Details */}
                  <div className="p-5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 space-y-4">
                    <h4 className="font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider text-xs border-b border-indigo-200 dark:border-indigo-800 pb-2 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-600" />
                      Your Hidden Proof Details (Finder Only)
                    </h4>
                    {samplePrivateDetails.map((pd, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-800">
                        <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block">
                          {pd.detail_label}
                        </span>
                        <p className="text-slate-900 dark:text-white font-bold mt-0.5">
                          {pd.detail_value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Finder Action Bar */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    Declining provides a <strong>neutral rejection message</strong> without disclosing secret answers.
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-bold text-xs hover:bg-amber-100 transition flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5" />
                      Report as Suspicious
                    </button>
                    <button className="px-5 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-md shadow-rose-600/20 hover:bg-rose-700 transition">
                      Decline Claim (Neutral)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GUIDED CLAIMANT WIZARD */}
        {activeTab === 'claimant_wizard' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs sm:text-sm text-blue-900 dark:text-blue-200 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Guided 3-Step Claim Experience</strong>
                The claimant answers open-ended prompts without knowing the secret questions. Live privacy warnings protect against leaking Aadhaar, PAN, phone numbers, or card details.
              </div>
            </div>

            {/* Guided Claim Wizard Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
              {/* Wizard Step Indicator */}
              <div className="grid grid-cols-3 gap-2 pb-6 border-b border-slate-100 dark:border-slate-800 text-center">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold mb-1">1</div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Verification Questions</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold mb-1">2</div>
                  <span className="text-xs font-medium text-slate-500">Optional Proof Files</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-bold mb-1">3</div>
                  <span className="text-xs font-medium text-slate-500">Review & Privacy Check</span>
                </div>
              </div>

              {/* Step 1 Questions UI */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Describe any marks, scratches, stickers or defects
                  </label>
                  <textarea
                    rows={2}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                    defaultValue="Small scratch near bottom right USB-C port"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Lock screen wallpaper or case details (Electronics)
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                    defaultValue="Photo of my golden retriever puppy"
                  />
                </div>

                {/* Privacy Guardrail Banner */}
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Privacy Guard:</strong> Never enter sensitive identification numbers (Aadhaar, PAN, Card CVV). All entries are automatically scanned and redacted.
                  </span>
                </div>

                {/* Proof File Uploader */}
                <div className="p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                  <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-bold text-blue-600">Click to upload proof</span> (receipt, box photo, serial screenshot)
                  </div>
                  <p className="text-[11px] text-slate-400">PNG, JPG, WEBP, PDF up to 5MB. Stored in private bucket with signed URLs.</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Attempt 1 of 2 max</span>
                <button className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-600/20 hover:bg-blue-700 transition flex items-center gap-2">
                  Continue to Step 2
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: MUTUAL SAFE HANDOVER & DISPUTE */}
        {activeTab === 'handover_dispute' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs sm:text-sm text-purple-900 dark:text-purple-200 flex items-start gap-3">
              <UserCheck className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Mutual Safe Handover Invariant</strong>
                An item report moves to <strong>Returned</strong> only when BOTH finder and claimant confirm in-app. Either party can trigger an immediate dispute freeze.
              </div>
            </div>

            {/* Mutual Handover Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Handover in Progress
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Public Campus Library Pickup Desk</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    finderConfirmed && claimantConfirmed
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {finderConfirmed && claimantConfirmed ? 'Status: Returned (Fully Resolved)' : 'Status: Handover Pending'}
                  </span>
                </div>
              </div>

              {/* Status Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`p-4 rounded-2xl border ${finderConfirmed ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    {finderConfirmed ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4 text-slate-400" />}
                    Finder Confirmation
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {finderConfirmed ? 'Confirmed in-person verification on 26 Nov, 14:10' : 'Awaiting confirmation'}
                  </p>
                  <button
                    onClick={() => setFinderConfirmed(!finderConfirmed)}
                    className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Toggle Finder Confirmation
                  </button>
                </div>

                <div className={`p-4 rounded-2xl border ${claimantConfirmed ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    {claimantConfirmed ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4 text-slate-400" />}
                    Claimant Confirmation
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {claimantConfirmed ? 'Confirmed item received on 26 Nov, 14:15' : 'Awaiting confirmation'}
                  </p>
                  <button
                    onClick={() => setClaimantConfirmed(!claimantConfirmed)}
                    className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Toggle Claimant Confirmation
                  </button>
                </div>
              </div>

              {/* Dispute Button */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500">Experiencing an issue or mismatch during handover?</span>
                <button
                  onClick={() => setIsDisputed(!isDisputed)}
                  className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 transition cursor-pointer"
                >
                  {isDisputed ? 'Dispute Active (Frozen)' : 'Report a problem / dispute'}
                </button>
              </div>

              {isDisputed && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 space-y-2">
                  <div className="font-bold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    Item Status Frozen — Moderation Dispute Escalated
                  </div>
                  <p>
                    Handover actions are frozen. A platform moderator has been notified to review the in-app chat and verification records.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: ADMIN FRAUD QUEUE & IMMUTABLE AUDIT TRAIL */}
        {activeTab === 'admin_audit' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs sm:text-sm text-amber-900 dark:text-amber-200 flex items-start gap-3">
              <History className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Immutable Audit Trail (Migration 011)</strong>
                Postgres RLS enforces strictly immutable audit records (`USING (false)` on update/delete). All admin actions are permanently recorded.
              </div>
            </div>

            {/* Audit Log Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Admin Audit Log & Moderation Actions</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase tracking-wider text-[10px] text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Action</th>
                      <th className="p-4">Target User</th>
                      <th className="p-4">Reason / Rule Trigger</th>
                      <th className="p-4">Enforced By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="p-4 text-slate-400 whitespace-nowrap">26 Nov 2026, 17:42</td>
                      <td className="p-4 font-bold text-amber-600">lock_claims</td>
                      <td className="p-4 font-mono text-slate-700 dark:text-slate-300">usr_883a9f</td>
                      <td className="p-4">Exceeded 3 rejected claims in 24h. 24h cooldown lock applied.</td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">admin_sys</td>
                    </tr>
                    <tr>
                      <td className="p-4 text-slate-400 whitespace-nowrap">26 Nov 2026, 16:15</td>
                      <td className="p-4 font-bold text-rose-600">warn_user</td>
                      <td className="p-4 font-mono text-slate-700 dark:text-slate-300">usr_19e24b</td>
                      <td className="p-4">Description mirroring rule (&gt;75% overlap on found laptop).</td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">admin_mod1</td>
                    </tr>
                    <tr>
                      <td className="p-4 text-slate-400 whitespace-nowrap">26 Nov 2026, 14:30</td>
                      <td className="p-4 font-bold text-emerald-600">resolve_dispute</td>
                      <td className="p-4 font-mono text-slate-700 dark:text-slate-300">usr_alex_m</td>
                      <td className="p-4">In-person receipt confirmed at Campus Library Desk. Item returned.</td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">admin_mod1</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
