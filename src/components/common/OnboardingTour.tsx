import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, MapPin, Shield, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ONBOARDING_STORAGE_KEY = 'lostfound_tour_completed_v1';

export const OnboardingTour: React.FC = () => {
  const { t } = useTranslation(['common', 'home']);
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if tour was already shown or user requested it via custom event
    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!completed) {
      // Delay slightly for initial page load smoothness
      const timer = setTimeout(() => setIsOpen(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen for replay event from Help / Footer
  useEffect(() => {
    const handleReplayTour = () => {
      setCurrentStep(0);
      setIsOpen(true);
    };

    window.addEventListener('replay-onboarding-tour', handleReplayTour);
    return () => window.removeEventListener('replay-onboarding-tour', handleReplayTour);
  }, []);

  const tourSteps = [
    {
      title: 'Welcome to Lost & Found',
      description:
        'A secure, community-driven platform to report lost belongings or reunite found items across campuses and cities.',
      icon: Sparkles,
      color: 'bg-blue-600 text-white',
    },
    {
      title: 'Map & Proximity Discovery',
      description:
        'Explore nearby reports with our interactive map. All public locations are rounded to ~1km to preserve user privacy.',
      icon: MapPin,
      color: 'bg-teal-600 text-white',
    },
    {
      title: 'Smarter Matching & Privacy Redaction',
      description:
        'Our engine calculates similarity using text stemming, synonyms, and image perceptual hashing, while automatically masking sensitive numbers and IDs.',
      icon: Shield,
      color: 'bg-indigo-600 text-white',
    },
    {
      title: 'Verified Anti-Fraud Claims',
      description:
        'Private proof details, verification scoring, and audit trails protect items from fraudulent claims until safe handover.',
      icon: CheckCircle2,
      color: 'bg-emerald-600 text-white',
    },
  ];

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  };

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  if (!isOpen) return null;

  const step = tourSteps[currentStep];
  const StepIcon = step.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-step-title"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden transform transition-all duration-300 scale-100">
        {/* Top Header Bar */}
        <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center space-x-1.5">
            {tourSteps.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep
                    ? 'w-6 bg-blue-600'
                    : 'w-2 bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            aria-label="Skip tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-8 text-center space-y-4">
          <div
            className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-lg transform transition-transform duration-300 hover:scale-105 ${step.color}`}
          >
            <StepIcon className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Step {currentStep + 1} of {tourSteps.length}
            </span>
            <h3
              id="tour-step-title"
              className="text-xl font-black text-slate-900 dark:text-white"
            >
              {step.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
              {step.description}
            </p>
          </div>
        </div>

        {/* Card Footer Navigation */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition flex items-center cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            Previous
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition flex items-center cursor-pointer"
          >
            <span>{currentStep === tourSteps.length - 1 ? 'Get Started' : 'Next'}</span>
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};
