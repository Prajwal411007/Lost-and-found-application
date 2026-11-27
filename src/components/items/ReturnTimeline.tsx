import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  UserCheck,
  PackageCheck,
  Clock,
} from 'lucide-react';
import { Item, Claim } from '@/types';
import { formatDate } from '@/lib/utils';

interface ReturnTimelineProps {
  item: Item;
  claim?: Claim | null;
  hasMatchSuggestion?: boolean;
  className?: string;
}

interface TimelineStep {
  id: string;
  label: string;
  timestamp?: string | null;
  isCompleted: boolean;
  isCurrent: boolean;
  icon: React.ReactNode;
}

export const ReturnTimeline: React.FC<ReturnTimelineProps> = ({
  item,
  claim,
  hasMatchSuggestion = false,
  className = '',
}) => {
  const { t } = useTranslation(['item', 'common', 'claims']);

  // Compute status progression
  const isReturned = item.status === 'returned';
  const isHandoverPending = claim?.status === 'handover_pending' || (claim?.finder_confirmed_handover || claim?.claimant_confirmed_handover);
  const isApproved = claim?.status === 'approved' || isHandoverPending || isReturned;
  const isClaimMade = Boolean(claim) || isApproved;
  const isMatchSuggested = hasMatchSuggestion || isClaimMade;

  // Determine current active step
  let currentStepId = 'reported';
  if (isReturned) currentStepId = 'returned';
  else if (isHandoverPending) currentStepId = 'handover';
  else if (isApproved) currentStepId = 'approved';
  else if (isClaimMade) currentStepId = 'claim';
  else if (isMatchSuggested) currentStepId = 'match';

  const steps: TimelineStep[] = [
    {
      id: 'reported',
      label: t('item:timeline.reported', 'Reported'),
      timestamp: item.created_at,
      isCompleted: true,
      isCurrent: currentStepId === 'reported',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      id: 'match',
      label: t('item:timeline.match_suggested', 'Match Suggested'),
      timestamp: isMatchSuggested ? item.updated_at : null,
      isCompleted: isMatchSuggested,
      isCurrent: currentStepId === 'match',
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: 'claim',
      label: t('item:timeline.claim_made', 'Claim Made'),
      timestamp: claim?.created_at || null,
      isCompleted: isClaimMade,
      isCurrent: currentStepId === 'claim',
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      id: 'approved',
      label: t('item:timeline.approved', 'Claim Approved'),
      timestamp: isApproved ? (claim?.resolved_at || claim?.updated_at) : null,
      isCompleted: isApproved,
      isCurrent: currentStepId === 'approved',
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      id: 'handover',
      label: t('item:timeline.handover', 'Handover'),
      timestamp: claim?.handover_confirmed_at || null,
      isCompleted: isReturned || (Boolean(claim?.finder_confirmed_handover) && Boolean(claim?.claimant_confirmed_handover)),
      isCurrent: currentStepId === 'handover',
      icon: <UserCheck className="w-4 h-4" />,
    },
    {
      id: 'returned',
      label: t('item:timeline.returned', 'Returned'),
      timestamp: isReturned ? item.updated_at : null,
      isCompleted: isReturned,
      isCurrent: currentStepId === 'returned',
      icon: <PackageCheck className="w-4 h-4" />,
    },
  ];

  return (
    <div
      aria-label="Return Timeline Tracker"
      className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          {t('item:timeline.title', 'Return Progress Tracker')}
        </h4>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
            isReturned
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
          }`}
        >
          {isReturned ? t('item:status.returned', 'Returned') : t('item:status.active', 'In Progress')}
        </span>
      </div>

      {/* Responsive Step Line */}
      <div className="relative">
        {/* Horizontal Connector Line for Tablet/Desktop */}
        <div className="hidden sm:block absolute top-4 left-6 right-6 h-0.5 bg-slate-200 dark:bg-slate-700 -z-0" />

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 sm:gap-1 relative z-10">
          {steps.map((step) => {
            return (
              <div
                key={step.id}
                className={`flex sm:flex-col items-center gap-2 sm:gap-1.5 p-2 rounded-xl transition ${
                  step.isCurrent
                    ? 'bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 shadow-xs'
                    : ''
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition ${
                    step.isCompleted
                      ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30 ring-4 ring-white dark:ring-slate-850'
                      : step.isCurrent
                      ? 'bg-teal-500 text-white animate-pulse ring-4 ring-teal-100 dark:ring-teal-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {step.icon}
                </div>

                <div className="sm:text-center min-w-0">
                  <span
                    className={`block text-[11px] font-bold truncate ${
                      step.isCompleted || step.isCurrent
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.timestamp ? (
                    <span className="block text-[10px] text-slate-400 truncate">
                      {formatDate(step.timestamp)}
                    </span>
                  ) : (
                    <span className="block text-[10px] text-slate-400 italic">
                      {step.isCompleted ? 'Completed' : 'Pending'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
