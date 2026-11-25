import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import {
  formatLocalizedDate,
  formatLocalizedNumber,
  formatLocalizedDistance,
  getCategoryDisplayName,
  resolveErrorMessage,
} from '@/lib/i18nHelpers';

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    updateProfile: vi.fn(),
    refreshProfile: vi.fn(),
    isAuthenticated: false,
    isAdmin: false,
  }),
}));

describe('Multi-language Support (i18n) Unit Tests', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('en');
  });

  describe('1. Language Switching and DOM Updates', () => {
    it('initializes in English by default and updates document.documentElement.lang', async () => {
      expect(i18n.language).toBe('en');
      expect(document.documentElement.lang).toBe('en');
      expect(document.title).toContain('FindIt');
      expect(i18n.t('common:nav.home')).toBe('Home');
    });

    it('switches to Kannada and updates DOM attributes and translations', async () => {
      await i18n.changeLanguage('kn');
      expect(i18n.language).toBe('kn');
      expect(document.documentElement.lang).toBe('kn');
      expect(document.title).toBe('FindIt - ಜಾಗತಿಕ ಕಳೆದುಹೋದ ಮತ್ತು ಪತ್ತೆಯಾದ ವೇದಿಕೆ');
      expect(i18n.t('common:nav.home')).toBe('ಮುಖಪುಟ');
      expect(i18n.t('common:actions.search')).toBe('ಹುಡುಕಿ');
    });

    it('switches to Hindi and updates DOM attributes and translations', async () => {
      await i18n.changeLanguage('hi');
      expect(i18n.language).toBe('hi');
      expect(document.documentElement.lang).toBe('hi');
      expect(document.title).toBe('FindIt - ग्लोबल खोया और पाया प्लेटफ़ॉर्म');
      expect(i18n.t('common:nav.home')).toBe('होम');
      expect(i18n.t('common:actions.search')).toBe('खोजें');
    });
  });

  describe('2. LocalStorage Persistence', () => {
    it('stores selected language in localStorage upon language change', async () => {
      await i18n.changeLanguage('kn');
      expect(localStorage.getItem('findit_language')).toBe('kn');

      await i18n.changeLanguage('hi');
      expect(localStorage.getItem('findit_language')).toBe('hi');

      await i18n.changeLanguage('en');
      expect(localStorage.getItem('findit_language')).toBe('en');
    });
  });

  describe('3. Plural Forms Handling', () => {
    it('correctly formats singular and plural forms in English', async () => {
      await i18n.changeLanguage('en');
      const singular = i18n.t('browse:results.count', { count: 1 });
      const plural = i18n.t('browse:results.count', { count: 5 });

      expect(singular).toBe('1 item found');
      expect(plural).toBe('5 items found');
    });

    it('correctly formats singular and plural forms in Kannada', async () => {
      await i18n.changeLanguage('kn');
      const singular = i18n.t('browse:results.count', { count: 1 });
      const plural = i18n.t('browse:results.count', { count: 5 });

      expect(singular).toBe('1 ವಸ್ತು ಕಂಡುಬಂದಿದೆ');
      expect(plural).toBe('5 ವಸ್ತುಗಳು ಕಂಡುಬಂದಿವೆ');
    });

    it('correctly formats singular and plural forms in Hindi', async () => {
      await i18n.changeLanguage('hi');
      const singular = i18n.t('browse:results.count', { count: 1 });
      const plural = i18n.t('browse:results.count', { count: 5 });

      expect(singular).toBe('1 वस्तु मिली');
      expect(plural).toBe('5 वस्तुएं मिलीं');
    });
  });

  describe('4. LanguageSwitcher Accessibility and Keyboard Navigation', () => {
    it('renders with accessible aria attributes', () => {
      render(
        <I18nextProvider i18n={i18n}>
          <LanguageSwitcher />
        </I18nextProvider>
      );

      const button = screen.getByRole('button', { name: /language/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens and closes dropdown on click and exposes role="option" items', async () => {
      render(
        <I18nextProvider i18n={i18n}>
          <LanguageSwitcher />
        </I18nextProvider>
      );

      const button = screen.getByRole('button', { name: /language/i });
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');

      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveTextContent('English');
      expect(options[1]).toHaveTextContent('ಕನ್ನಡ');
      expect(options[2]).toHaveTextContent('हिन्दी');

      // Click Kannada
      fireEvent.click(options[1]);
      await waitFor(() => {
        expect(i18n.language).toBe('kn');
        expect(button).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('supports keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)', async () => {
      render(
        <I18nextProvider i18n={i18n}>
          <LanguageSwitcher />
        </I18nextProvider>
      );

      const button = screen.getByRole('button', { name: /language/i });

      // Open via ArrowDown
      fireEvent.keyDown(button, { key: 'ArrowDown' });
      expect(button).toHaveAttribute('aria-expanded', 'true');

      // Close via Escape
      fireEvent.keyDown(button, { key: 'Escape' });
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('5. Formatting Helpers & Fallbacks', () => {
    it('formats localized numbers using native Intl.NumberFormat', () => {
      expect(formatLocalizedNumber(1250, 'en')).toBe('1,250');
      // Indian numbering system format (1,250)
      expect(formatLocalizedNumber(1250, 'kn')).toBe('1,250');
      expect(formatLocalizedNumber(1250, 'hi')).toBe('1,250');
    });

    it('formats localized dates using native Intl.DateTimeFormat', () => {
      const sampleDate = '2026-11-25T12:00:00Z';
      const enDate = formatLocalizedDate(sampleDate, 'en');
      const knDate = formatLocalizedDate(sampleDate, 'kn');
      const hiDate = formatLocalizedDate(sampleDate, 'hi');

      expect(enDate).toContain('2026');
      expect(knDate).toContain('2026');
      expect(hiDate).toContain('2026');
    });

    it('formats distance with localized numbers and units', () => {
      const t = (key: string, def?: string) => (key === 'units.m' ? 'ಮೀ' : key === 'units.km' ? 'ಕಿ.ಮೀ' : def || '');
      expect(formatLocalizedDistance(450, t, 'kn')).toBe('450 ಮೀ');
      expect(formatLocalizedDistance(2400, t, 'kn')).toBe('2.4 ಕಿ.ಮೀ');
    });

    it('returns category name translation when present and falls back to English', () => {
      const categoryWithTranslations = {
        name: 'Keys',
        name_translations: {
          kn: 'ಕೀಲಿಗಳು',
          hi: 'चाबियाँ',
        },
      };

      expect(getCategoryDisplayName(categoryWithTranslations, 'kn')).toBe('ಕೀಲಿಗಳು');
      expect(getCategoryDisplayName(categoryWithTranslations, 'hi')).toBe('चाबियाँ');
      expect(getCategoryDisplayName(categoryWithTranslations, 'en')).toBe('Keys');

      // Fallback when translation not available
      const categoryWithoutTranslations = {
        name: 'Custom New Category',
        name_translations: {},
      };
      expect(getCategoryDisplayName(categoryWithoutTranslations, 'kn')).toBe('Custom New Category');
    });

    it('resolves standard error codes from errors.json', () => {
      const tErrors = (code: string) => i18n.t(`errors:${code}`);

      expect(resolveErrorMessage('ITEM_NOT_FOUND', tErrors)).toBe('The requested item could not be found.');
      expect(resolveErrorMessage('SERVICE_UNREACHABLE', tErrors)).toBe('Unable to reach service. Please check your network connection.');
      expect(resolveErrorMessage('UNKNOWN_CODE_XYZ', tErrors)).toBe('An unknown error occurred. Please try again.');
    });
  });
});
