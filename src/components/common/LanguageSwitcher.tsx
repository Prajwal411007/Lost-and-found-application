import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SUPPORTED_LANGUAGES, SupportedLanguage, LANGUAGE_METADATA } from '@/i18n';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'navbar' | 'footer' | 'inline';
  showLabel?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = '',
  variant = 'navbar',
  showLabel = true,
}) => {
  const { i18n, t } = useTranslation('common');
  const { user, profile, updateProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const currentLanguage = (
    SUPPORTED_LANGUAGES.includes(i18n.language as SupportedLanguage)
      ? i18n.language
      : 'en'
  ) as SupportedLanguage;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync profile language on mount or when profile loads
  useEffect(() => {
    if (profile?.preferred_language && profile.preferred_language !== i18n.language) {
      if (SUPPORTED_LANGUAGES.includes(profile.preferred_language as SupportedLanguage)) {
        i18n.changeLanguage(profile.preferred_language);
      }
    }
  }, [profile?.preferred_language, i18n]);

  const handleSelectLanguage = async (lng: SupportedLanguage) => {
    if (lng === i18n.language) {
      setIsOpen(false);
      return;
    }

    // Change language in i18next (instantly updates React UI)
    await i18n.changeLanguage(lng);
    try {
      localStorage.setItem('findit_language', lng);
    } catch {
      // ignore
    }

    // If logged in, persist to user profile
    if (user?.id && updateProfile) {
      try {
        await updateProfile({ preferred_language: lng });
      } catch (err) {
        console.warn('Could not save language to profile:', err);
      }
    }

    setIsOpen(false);
    buttonRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(SUPPORTED_LANGUAGES.indexOf(currentLanguage));
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % SUPPORTED_LANGUAGES.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + SUPPORTED_LANGUAGES.length) % SUPPORTED_LANGUAGES.length);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < SUPPORTED_LANGUAGES.length) {
          handleSelectLanguage(SUPPORTED_LANGUAGES[focusedIndex]);
        }
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('nav.language', 'Language')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
          variant === 'footer'
            ? 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60'
            : variant === 'inline'
            ? 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700'
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-transparent hover:border-slate-200 dark:hover:border-slate-700'
        }`}
      >
        <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-teal-400 stroke-[2.2]" />
        {showLabel && (
          <span className="font-semibold tracking-wide">
            {LANGUAGE_METADATA[currentLanguage]?.nativeName || 'English'}
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <ul
          ref={menuRef}
          role="listbox"
          aria-label="Select language"
          className="absolute right-0 bottom-full mb-1 sm:bottom-auto sm:top-full sm:mt-1.5 w-36 rounded-xl bg-white dark:bg-[#0D1626] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/10 dark:shadow-black/40 py-1 z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
        >
          {SUPPORTED_LANGUAGES.map((lng, index) => {
            const isSelected = lng === currentLanguage;
            const isFocused = index === focusedIndex;
            const meta = LANGUAGE_METADATA[lng];

            return (
              <li
                key={lng}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => handleSelectLanguage(lng)}
                onMouseEnter={() => setFocusedIndex(index)}
                className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                  isFocused
                    ? 'bg-blue-50 dark:bg-slate-800/90 text-blue-600 dark:text-teal-400'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                } ${isSelected ? 'font-bold' : 'font-normal'}`}
              >
                <div className="flex flex-col">
                  <span className="text-xs text-slate-900 dark:text-white font-medium">
                    {meta.nativeName}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {meta.name}
                  </span>
                </div>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-blue-600 dark:text-teal-400 stroke-[2.5]" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
