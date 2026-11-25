import { Category } from '@/types';

/**
 * Localized date formatter using native Intl.DateTimeFormat.
 */
export function formatLocalizedDate(
  dateInput: string | Date | number | null | undefined,
  lang: string = 'en',
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '';

  const date = typeof dateInput === 'string' || typeof dateInput === 'number'
    ? new Date(dateInput)
    : dateInput;

  if (isNaN(date.getTime())) return '';

  const locale = lang === 'kn' ? 'kn-IN' : lang === 'hi' ? 'hi-IN' : 'en-US';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };

  try {
    return new Intl.DateTimeFormat(locale, defaultOptions).format(date);
  } catch (err) {
    console.warn('Error formatting localized date:', err);
    return date.toLocaleDateString();
  }
}

/**
 * Localized number formatter using native Intl.NumberFormat.
 */
export function formatLocalizedNumber(
  num: number | null | undefined,
  lang: string = 'en',
  options?: Intl.NumberFormatOptions
): string {
  if (num === null || num === undefined || isNaN(num)) return '0';

  const locale = lang === 'kn' ? 'kn-IN' : lang === 'hi' ? 'hi-IN' : 'en-US';

  try {
    return new Intl.NumberFormat(locale, options).format(num);
  } catch (err) {
    console.warn('Error formatting localized number:', err);
    return num.toString();
  }
}

/**
 * Formats distance with localized units and numbers (km or m).
 */
export function formatLocalizedDistance(
  meters: number | null | undefined,
  t: (key: string, defaultValueOrOpts?: any) => string,
  lang: string = 'en'
): string {
  if (meters === null || meters === undefined || isNaN(meters)) return '';

  if (meters < 1000) {
    const formattedNum = formatLocalizedNumber(Math.round(meters), lang);
    const unit = t('units.m', 'm');
    return `${formattedNum} ${unit}`;
  }

  const km = (meters / 1000).toFixed(1);
  const formattedNum = formatLocalizedNumber(parseFloat(km), lang, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const unit = t('units.km', 'km');
  return `${formattedNum} ${unit}`;
}

/**
 * Returns localized name for category from name_translations or falls back to English name.
 */
export function getCategoryDisplayName(
  category?: Partial<Category> | null,
  lang: string = 'en'
): string {
  if (!category) return '';

  if (lang !== 'en' && category.name_translations && category.name_translations[lang]) {
    return category.name_translations[lang];
  }

  return category.name || '';
}

/**
 * Resolves standard server error code into user-friendly localized message.
 */
export function resolveErrorMessage(
  errorCode: string | undefined,
  tErrors: (key: string, defaultValue?: string) => string
): string {
  if (!errorCode) return tErrors('UNKNOWN_ERROR', 'An unexpected error occurred. Please try again.');

  // If errorCode matches known error keys
  const translated = tErrors(errorCode);
  if (translated && translated !== errorCode) return translated;

  return tErrors('UNKNOWN_ERROR', 'An unexpected error occurred. Please try again.');
}
