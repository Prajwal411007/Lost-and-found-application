/**
 * Server-side Sensitive Data Redaction Utility
 * Detects and masks:
 * - Phone numbers (Indian mobile, international)
 * - Aadhaar-style 12-digit numbers
 * - Card numbers (Luhn check validated)
 * - Email addresses
 * - PAN (Permanent Account Number - India)
 * - Passport-like numbers
 * - UPI IDs (Virtual Payment Address)
 *
 * Avoids false positives:
 * - Dates (e.g. 2024-11-26, 26/11/2024, 2024/05/12)
 * - Item serial numbers (e.g. SN12345678, MBP-2023-M2)
 * - Resolution / dimensions / storage specs (e.g. 1920x1080, 256GB, 15.6 inch)
 * - Postal codes / PIN codes (6 digits)
 */

export type SensitiveType =
  | 'phone'
  | 'aadhaar'
  | 'card'
  | 'email'
  | 'pan'
  | 'passport'
  | 'upi';

export interface DetectedSensitiveItem {
  type: SensitiveType;
  value: string;
  masked: string;
  index: number;
}

/**
 * Validates credit/debit card numbers using the standard Luhn algorithm.
 */
export function isValidLuhn(rawDigits: string): boolean {
  const digits = rawDigits.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (isNaN(digit)) return false;

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Checks if a string slice matches standard date patterns to prevent false positives.
 */
function isDateString(str: string): boolean {
  return /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(str) ||
         /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(str);
}

/**
 * Masks a matched string based on its sensitive type.
 */
export function maskSensitiveValue(value: string, type: SensitiveType): string {
  switch (type) {
    case 'card': {
      const clean = value.replace(/\D/g, '');
      const last4 = clean.slice(-4);
      return `**** **** **** ${last4}`;
    }
    case 'aadhaar': {
      const clean = value.replace(/\D/g, '');
      const last4 = clean.slice(-4);
      return `**** **** ${last4}`;
    }
    case 'phone': {
      const clean = value.replace(/\D/g, '');
      const last4 = clean.slice(-4);
      return `****${last4}`;
    }
    case 'email': {
      const atIdx = value.indexOf('@');
      if (atIdx <= 1) return `****${value.slice(atIdx)}`;
      const domain = value.slice(atIdx);
      return `${value[0]}****${domain}`;
    }
    case 'pan': {
      const clean = value.trim().toUpperCase();
      const last4 = clean.slice(-4);
      return `****${last4}`;
    }
    case 'passport': {
      const clean = value.trim().toUpperCase();
      const last4 = clean.slice(-4);
      return `****${last4}`;
    }
    case 'upi': {
      const atIdx = value.indexOf('@');
      const handle = value.slice(atIdx);
      return `****${handle}`;
    }
    default:
      return '****';
  }
}

/**
 * Detects all sensitive data items in a given text.
 */
export function detectSensitiveData(text: string): DetectedSensitiveItem[] {
  if (!text || typeof text !== 'string') return [];

  const matches: DetectedSensitiveItem[] = [];

  const overlaps = (start: number, end: number) => {
    return matches.some((m) => {
      const mStart = m.index;
      const mEnd = m.index + m.value.length;
      return Math.max(start, mStart) < Math.min(end, mEnd);
    });
  };

  // 1. Email Addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  let emailMatch: RegExpExecArray | null;
  while ((emailMatch = emailRegex.exec(text)) !== null) {
    const val = emailMatch[0];
    matches.push({
      type: 'email',
      value: val,
      masked: maskSensitiveValue(val, 'email'),
      index: emailMatch.index,
    });
  }

  // 2. UPI IDs (e.g. user@oksbi, name@paytm, 9876543210@upi, name@bank)
  const upiRegex = /\b[A-Za-z0-9._-]{2,64}@(?![-.])(?:oksbi|okhdfcbank|okicici|okaxis|paytm|ybl|ibl|axl|upi|sbi|hdfcbank|icici|postbank|barodampay|pnb|allbank|cnrb|federal|rbl|kotak|indus|airtel|gpay|apl|[a-zA-Z]{2,30})\b/g;
  let upiMatch: RegExpExecArray | null;
  while ((upiMatch = upiRegex.exec(text)) !== null) {
    const val = upiMatch[0];
    const afterAt = val.slice(val.indexOf('@') + 1);
    if (afterAt.includes('.')) continue;

    if (!overlaps(upiMatch.index, upiMatch.index + val.length)) {
      matches.push({
        type: 'upi',
        value: val,
        masked: maskSensitiveValue(val, 'upi'),
        index: upiMatch.index,
      });
    }
  }

  // 3. Card Numbers (13-19 digits with Luhn algorithm check)
  const cardCandidateRegex = /\b(?:\d[ -]*?){13,19}\b/g;
  let cardMatch: RegExpExecArray | null;
  while ((cardMatch = cardCandidateRegex.exec(text)) !== null) {
    const rawVal = cardMatch[0];
    const digitsOnly = rawVal.replace(/\D/g, '');

    if (!isDateString(rawVal) && isValidLuhn(digitsOnly)) {
      if (!overlaps(cardMatch.index, cardMatch.index + rawVal.length)) {
        matches.push({
          type: 'card',
          value: rawVal,
          masked: maskSensitiveValue(rawVal, 'card'),
          index: cardMatch.index,
        });
      }
    }
  }

  // 4. PAN Card Numbers (India: 5 letters, 4 digits, 1 letter)
  const panRegex = /\b[A-Za-z]{5}\d{4}[A-Za-z]\b/g;
  let panMatch: RegExpExecArray | null;
  while ((panMatch = panRegex.exec(text)) !== null) {
    const val = panMatch[0];
    if (!overlaps(panMatch.index, panMatch.index + val.length)) {
      matches.push({
        type: 'pan',
        value: val,
        masked: maskSensitiveValue(val, 'pan'),
        index: panMatch.index,
      });
    }
  }

  // 5. Passport Numbers (1 uppercase letter followed by 7 digits, e.g. A1234567)
  const passportRegex = /\b[A-Za-z]\d{7}\b/g;
  let passportMatch: RegExpExecArray | null;
  while ((passportMatch = passportRegex.exec(text)) !== null) {
    const val = passportMatch[0];
    const prevChar = text.charAt(passportMatch.index - 1);
    if (!/[A-Za-z0-9]/.test(prevChar)) {
      if (!overlaps(passportMatch.index, passportMatch.index + val.length)) {
        matches.push({
          type: 'passport',
          value: val,
          masked: maskSensitiveValue(val, 'passport'),
          index: passportMatch.index,
        });
      }
    }
  }

  // 6. Aadhaar Numbers (12 digits, cannot start with 0 or 1, grouped as 4-4-4 or continuous)
  const aadhaarRegex = /\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/g;
  let aadhaarMatch: RegExpExecArray | null;
  while ((aadhaarMatch = aadhaarRegex.exec(text)) !== null) {
    const val = aadhaarMatch[0];
    const digitsOnly = val.replace(/\D/g, '');
    if (digitsOnly.length === 12 && !isDateString(val)) {
      if (!overlaps(aadhaarMatch.index, aadhaarMatch.index + val.length)) {
        matches.push({
          type: 'aadhaar',
          value: val,
          masked: maskSensitiveValue(val, 'aadhaar'),
          index: aadhaarMatch.index,
        });
      }
    }
  }

  // 7. Phone Numbers (Indian mobile + international)
  const phoneRegexes = [
    /(?:\+?91[\s.-]?)?[6-9]\d{4}[\s.-]?\d{5}\b/g,
    /(?:\+?91[\s.-]?)?[6-9]\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    /\b0[6-9]\d{9}\b/g,
    /\b[6-9]\d{9}\b/g,
    /\+(?:[1-9]\d{0,2})[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g,
  ];

  for (const regex of phoneRegexes) {
    let phoneMatch: RegExpExecArray | null;
    while ((phoneMatch = regex.exec(text)) !== null) {
      const val = phoneMatch[0];
      const digitsOnly = val.replace(/\D/g, '');

      if (isDateString(val)) continue;
      if (/^\d{3,4}x\d{3,4}$/i.test(val)) continue;
      if (digitsOnly.length < 10 || digitsOnly.length > 15) continue;

      if (!overlaps(phoneMatch.index, phoneMatch.index + val.length)) {
        matches.push({
          type: 'phone',
          value: val,
          masked: maskSensitiveValue(val, 'phone'),
          index: phoneMatch.index,
        });
      }
    }
  }

  return matches.sort((a, b) => a.index - b.index);
}

/**
 * Returns true if sensitive data is detected in the input text.
 */
export function hasSensitiveData(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return detectSensitiveData(text).length > 0;
}

/**
 * Masks all detected sensitive data items inside a string.
 */
export function redactSensitiveData(text: string): string {
  if (!text || typeof text !== 'string') return text;

  const detected = detectSensitiveData(text);
  if (detected.length === 0) return text;

  let result = text;
  for (let i = detected.length - 1; i >= 0; i--) {
    const item = detected[i];
    result =
      result.slice(0, item.index) +
      item.masked +
      result.slice(item.index + item.value.length);
  }

  return result;
}
