import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGeolocation } from '@/contexts/LocationContext';
import { MapPin, Navigation, Shield, X, Loader2, Sparkles } from 'lucide-react';

export const LocationPermissionDialog: React.FC = () => {
  const { t } = useTranslation('common');
  const {
    coords,
    status,
    isPromptOpen,
    openPrompt,
    dismissPrompt,
    requestLocation,
  } = useGeolocation();

  const location = useLocation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const allowBtnRef = useRef<HTMLButtonElement>(null);

  // Show pre-permission dialog on first visit to Home ("/") or Browse ("/browse")
  useEffect(() => {
    const isTargetPage = location.pathname === '/' || location.pathname === '/browse';
    if (!isTargetPage) return;

    // Check if dismissed in this session
    const isDismissed = sessionStorage.getItem('findit_location_prompt_dismissed') === 'true';
    if (isDismissed || coords || status === 'denied' || status === 'granted') {
      return;
    }

    // Small delay for clean page entry
    const timer = setTimeout(() => {
      openPrompt();
    }, 600);

    return () => clearTimeout(timer);
  }, [location.pathname, coords, status, openPrompt]);

  // Focus management & Escape key handling
  useEffect(() => {
    if (!isPromptOpen) return;

    // Focus the primary button when modal opens
    const prevActiveElement = document.activeElement as HTMLElement | null;
    allowBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismissPrompt();
      }

      // Simple focus trap
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      prevActiveElement?.focus();
    };
  }, [isPromptOpen, dismissPrompt]);

  if (!isPromptOpen) return null;

  const handleAllow = async () => {
    await requestLocation();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-dialog-title"
      aria-describedby="location-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      {/* Accessible live status for screen readers */}
      <div className="sr-only" aria-live="polite">
        {status === 'requesting' ? 'Requesting your location from the browser...' : ''}
      </div>

      <div
        ref={dialogRef}
        className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-200"
      >
        {/* Close "X" button */}
        <button
          type="button"
          onClick={dismissPrompt}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/60 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Title */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Navigation className="w-7 h-7 stroke-[2.2] animate-pulse" />
          </div>
          <div>
            <h2
              id="location-dialog-title"
              className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight"
            >
              {t('location_prompt.title', 'Find Items Near You')}
            </h2>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider mt-1 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              {t('location_prompt.badge_optional', 'Optional')}
            </p>
          </div>
        </div>

        {/* Description & Privacy explanation */}
        <div id="location-dialog-desc" className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>
            {t('location_prompt.description')}
          </p>
          <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-start space-x-2.5 text-xs text-blue-900 dark:text-blue-200">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p>
              <strong>{t('location_prompt.why_title')}:</strong> {t('location_prompt.reason_3')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center gap-3 pt-2">
          <button
            type="button"
            onClick={dismissPrompt}
            className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition"
          >
            {t('location_prompt.maybe_later_btn', 'Maybe Later')}
          </button>
          <button
            ref={allowBtnRef}
            type="button"
            disabled={status === 'requesting'}
            onClick={handleAllow}
            className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 flex items-center justify-center transition disabled:opacity-60 cursor-pointer"
          >
            {status === 'requesting' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('location_prompt.requesting', 'Detecting location...')}
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 mr-1.5" />
                {t('location_prompt.allow_btn', 'Allow Location')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
