import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import English namespaces
import enCommon from '@/locales/en/common.json';
import enAuth from '@/locales/en/auth.json';
import enHome from '@/locales/en/home.json';
import enBrowse from '@/locales/en/browse.json';
import enReport from '@/locales/en/report.json';
import enItem from '@/locales/en/item.json';
import enDashboard from '@/locales/en/dashboard.json';
import enMessages from '@/locales/en/messages.json';
import enClaims from '@/locales/en/claims.json';
import enNotifications from '@/locales/en/notifications.json';
import enAdmin from '@/locales/en/admin.json';
import enCampus from '@/locales/en/campus.json';
import enErrors from '@/locales/en/errors.json';

// Import Kannada namespaces
import knCommon from '@/locales/kn/common.json';
import knAuth from '@/locales/kn/auth.json';
import knHome from '@/locales/kn/home.json';
import knBrowse from '@/locales/kn/browse.json';
import knReport from '@/locales/kn/report.json';
import knItem from '@/locales/kn/item.json';
import knDashboard from '@/locales/kn/dashboard.json';
import knMessages from '@/locales/kn/messages.json';
import knClaims from '@/locales/kn/claims.json';
import knNotifications from '@/locales/kn/notifications.json';
import knAdmin from '@/locales/kn/admin.json';
import knCampus from '@/locales/kn/campus.json';
import knErrors from '@/locales/kn/errors.json';

// Import Hindi namespaces
import hiCommon from '@/locales/hi/common.json';
import hiAuth from '@/locales/hi/auth.json';
import hiHome from '@/locales/hi/home.json';
import hiBrowse from '@/locales/hi/browse.json';
import hiReport from '@/locales/hi/report.json';
import hiItem from '@/locales/hi/item.json';
import hiDashboard from '@/locales/hi/dashboard.json';
import hiMessages from '@/locales/hi/messages.json';
import hiClaims from '@/locales/hi/claims.json';
import hiNotifications from '@/locales/hi/notifications.json';
import hiAdmin from '@/locales/hi/admin.json';
import hiCampus from '@/locales/hi/campus.json';
import hiErrors from '@/locales/hi/errors.json';

export const SUPPORTED_LANGUAGES = ['en', 'kn', 'hi'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_METADATA: Record<
  SupportedLanguage,
  { name: string; nativeName: string; flag?: string }
> = {
  en: { name: 'English', nativeName: 'English' },
  kn: { name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी' },
};

export const defaultNS = 'common';
export const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    home: enHome,
    browse: enBrowse,
    report: enReport,
    item: enItem,
    dashboard: enDashboard,
    messages: enMessages,
    claims: enClaims,
    notifications: enNotifications,
    admin: enAdmin,
    campus: enCampus,
    errors: enErrors,
  },
  kn: {
    common: knCommon,
    auth: knAuth,
    home: knHome,
    browse: knBrowse,
    report: knReport,
    item: knItem,
    dashboard: knDashboard,
    messages: knMessages,
    claims: knClaims,
    notifications: knNotifications,
    admin: knAdmin,
    campus: knCampus,
    errors: knErrors,
  },
  hi: {
    common: hiCommon,
    auth: hiAuth,
    home: hiHome,
    browse: hiBrowse,
    report: hiReport,
    item: hiItem,
    dashboard: hiDashboard,
    messages: hiMessages,
    claims: hiClaims,
    notifications: hiNotifications,
    admin: hiAdmin,
    campus: hiCampus,
    errors: hiErrors,
  },
} as const;

// Configure language detection with localStorage priority
const detector = new LanguageDetector();
detector.addDetector({
  name: 'customLocalStorageDetector',
  lookup() {
    try {
      const saved = localStorage.getItem('findit_language');
      if (saved && (SUPPORTED_LANGUAGES as readonly string[]).includes(saved)) {
        return saved;
      }
    } catch {
      // ignore localStorage disabled error
    }
    return undefined;
  },
  cacheUserLanguage(lng: string) {
    try {
      localStorage.setItem('findit_language', lng);
    } catch {
      // ignore
    }
  },
});

i18n
  .use(detector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS,
    ns: [
      'common',
      'auth',
      'home',
      'browse',
      'report',
      'item',
      'dashboard',
      'messages',
      'claims',
      'notifications',
      'admin',
      'campus',
      'errors',
    ],
    detection: {
      order: ['querystring', 'customLocalStorageDetector', 'localStorage', 'navigator'],
      lookupQuerystring: 'lng',
      lookupLocalStorage: 'findit_language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already safes from XSS
    },
    saveMissing: import.meta.env?.DEV ?? false,
    missingKeyHandler: (lngs, ns, key) => {
      if (import.meta.env?.DEV) {
        console.warn(`[i18n missing key]: [${lngs.join(',')}] ${ns}:${key}`);
      }
    },
    react: {
      useSuspense: false,
    },
  });

// Handle HTML lang attribute and document title updates
function syncDocumentLanguage(lng: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
    const titleKey = `${lng === 'kn' ? 'FindIt - ಜಾಗತಿಕ ಕಳೆದುಹೋದ ಮತ್ತು ಪತ್ತೆಯಾದ ವೇದಿಕೆ' : lng === 'hi' ? 'FindIt - ग्लोबल खोया और पाया प्लेटफ़ॉर्म' : 'FindIt - Global Lost & Found Platform'}`;
    document.title = titleKey;
  }
}

// Initial sync
syncDocumentLanguage(i18n.language || 'en');

i18n.on('languageChanged', (lng) => {
  syncDocumentLanguage(lng);
  try {
    localStorage.setItem('findit_language', lng);
  } catch {
    // Ignore error
  }
});

export default i18n;
