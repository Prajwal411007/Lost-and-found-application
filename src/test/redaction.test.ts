import { describe, it, expect } from 'vitest';
import {
  detectSensitiveData,
  hasSensitiveData,
  redactSensitiveData,
  isValidLuhn,
} from '@/lib/redaction';

describe('Feature 1: Sensitive Data Redaction & Privacy Engine', () => {
  describe('Luhn Algorithm for Payment Cards', () => {
    it('validates genuine card numbers and rejects invalid sequences', () => {
      // Standard valid test card numbers
      expect(isValidLuhn('4532015112830366')).toBe(true); // Visa
      expect(isValidLuhn('4532 0151 1283 0366')).toBe(true);
      expect(isValidLuhn('4532-0151-1283-0366')).toBe(true);

      // Invalid card numbers (fails Luhn check)
      expect(isValidLuhn('4532015112830367')).toBe(false);
      expect(isValidLuhn('1234567890123456')).toBe(false);
      expect(isValidLuhn('9999999999999999')).toBe(false);
    });
  });

  describe('Phone Numbers Detection & Masking', () => {
    it('detects 10-digit Indian mobile numbers with various formatting', () => {
      const texts = [
        'Call me on 9876543210 if found',
        'Contact: +91 98765 43210',
        'Phone is +91-98765-43210',
        'Reach me at 09876543210 immediately',
        'US number +1 (555) 123-4567 please call',
      ];

      for (const text of texts) {
        expect(hasSensitiveData(text)).toBe(true);
        const redacted = redactSensitiveData(text);
        expect(redacted).toContain('****');
        // Original raw unmasked phone should not be present
        expect(redacted).not.toContain('9876543210');
      }
    });

    it('masks phone numbers to show only the last 4 digits', () => {
      expect(redactSensitiveData('Call 9876543210')).toBe('Call ****3210');
      expect(redactSensitiveData('Contact +91 98765 43210')).toBe('Contact ****3210');
    });
  });

  describe('Aadhaar-style 12-digit Identification Numbers', () => {
    it('detects 12-digit numbers formatted in 4-4-4 or contiguous form', () => {
      const texts = [
        'Aadhaar number is 2345 6789 0123',
        'Card ID 2345-6789-0123 left in bag',
        'My ID is 234567890123',
      ];

      for (const text of texts) {
        expect(hasSensitiveData(text)).toBe(true);
        const redacted = redactSensitiveData(text);
        expect(redacted).toContain('****');
        expect(redacted).toContain('0123');
      }
    });
  });

  describe('Card Numbers Detection (Luhn-verified)', () => {
    it('masks valid payment cards and ignores non-card sequences', () => {
      const withValidCard = 'Card found with number 4532 0151 1283 0366 on front';
      expect(hasSensitiveData(withValidCard)).toBe(true);
      expect(redactSensitiveData(withValidCard)).toBe(
        'Card found with number **** **** **** 0366 on front'
      );

      // Random 16 digit serial number that fails Luhn is NOT treated as a card
      const withSerial = 'Serial number is 1234567890123456 on device';
      // If it doesn't match other rules, it should not be masked as card
      const detected = detectSensitiveData(withSerial);
      const cardMatches = detected.filter((d) => d.type === 'card');
      expect(cardMatches.length).toBe(0);
    });
  });

  describe('Email Addresses', () => {
    it('detects and masks personal email addresses', () => {
      const text = 'Send proof to rajesh.kumar@gmail.com or support@findit.org';
      expect(hasSensitiveData(text)).toBe(true);
      const redacted = redactSensitiveData(text);
      expect(redacted).toContain('****@gmail.com');
      expect(redacted).not.toContain('rajesh.kumar@gmail.com');
    });
  });

  describe('PAN (Permanent Account Number - India)', () => {
    it('detects 10-character alphanumeric PAN format [A-Z]{5}[0-9]{4}[A-Z]', () => {
      const text = 'PAN card found for ABCDE1234F near metro exit';
      expect(hasSensitiveData(text)).toBe(true);
      const redacted = redactSensitiveData(text);
      expect(redacted).toBe('PAN card found for ****234F near metro exit');
    });
  });

  describe('Passport Numbers', () => {
    it('detects passport numbers (1 letter + 7 digits)', () => {
      const text = 'Passport with number K1234567 found in waiting room';
      expect(hasSensitiveData(text)).toBe(true);
      const redacted = redactSensitiveData(text);
      expect(redacted).toBe('Passport with number ****4567 found in waiting room');
    });
  });

  describe('UPI IDs (Virtual Payment Address)', () => {
    it('detects common and generic UPI IDs', () => {
      const texts = [
        'Pay reward to rajesh@oksbi please',
        'Send 500 to my-shop.store@paytm',
        'UPI ID: 9876543210@upi',
        'Account is rahul@ybl',
      ];

      for (const text of texts) {
        expect(hasSensitiveData(text)).toBe(true);
        const redacted = redactSensitiveData(text);
        expect(redacted).toContain('****@');
        expect(redacted).not.toContain('rajesh@oksbi');
        expect(redacted).not.toContain('rahul@ybl');
      }
    });
  });

  describe('False Positives Prevention (Item Specs, Dates, Serials)', () => {
    it('does NOT trigger on valid item dates', () => {
      const dates = [
        'Lost on 2024-11-26 near library',
        'Lost on 26/11/2024 around 5pm',
        'Purchased on 2023-05-15',
        'Date: 12-10-2024',
      ];

      for (const text of dates) {
        const matches = detectSensitiveData(text);
        const phoneOrAadhaar = matches.filter(
          (m) => m.type === 'phone' || m.type === 'aadhaar'
        );
        expect(phoneOrAadhaar.length).toBe(0);
        expect(redactSensitiveData(text)).toBe(text);
      }
    });

    it('does NOT trigger on laptop / phone model names and resolutions', () => {
      const itemSpecs = [
        'Dell XPS 15 9500 with 4K display',
        'Screen resolution is 1920x1080',
        'External monitor 2560x1440',
        'MacBook Pro 16 inch with 512GB SSD',
        'iPhone 15 Pro Max 256GB Silver',
        'Postal code 560001 Bangalore',
      ];

      for (const text of itemSpecs) {
        expect(hasSensitiveData(text)).toBe(false);
        expect(redactSensitiveData(text)).toBe(text);
      }
    });

    it('does NOT trigger on short serial numbers or model codes', () => {
      const serials = [
        'Serial SN-882190 on back of casing',
        'Model No: A2341 in space grey',
        'SKU 992014 found inside box',
      ];

      for (const text of serials) {
        expect(hasSensitiveData(text)).toBe(false);
        expect(redactSensitiveData(text)).toBe(text);
      }
    });
  });

  describe('Complex Combined Redaction', () => {
    it('masks multiple sensitive items simultaneously in a multi-line report', () => {
      const rawReport = `
        Lost black leather wallet near Indiranagar KFC on 2024-11-25.
        Contains PAN ABCDE1234F and Aadhaar 3456 7890 1234.
        If found, please call +91 98765 43210 or email finder@test.com.
        Reward of Rs 1000 via finder@oksbi.
        Laptop model XPS 15 9500 was also in the same bag.
      `;

      expect(hasSensitiveData(rawReport)).toBe(true);
      const redacted = redactSensitiveData(rawReport);

      // Sensitive items masked
      expect(redacted).not.toContain('ABCDE1234F');
      expect(redacted).not.toContain('3456 7890 1234');
      expect(redacted).not.toContain('98765 43210');
      expect(redacted).not.toContain('finder@test.com');
      expect(redacted).not.toContain('finder@oksbi');

      // False positives preserved
      expect(redacted).toContain('2024-11-25');
      expect(redacted).toContain('XPS 15 9500');
      expect(redacted).toContain('Rs 1000');
    });
  });
});
