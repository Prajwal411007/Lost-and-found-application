import { describe, it, expect } from 'vitest';
import {
  sanitizePosterData,
  generateLostItemPosterPdf,
  DEFAULT_POSTER_LABELS,
} from '@/lib/posterGenerator';
import { Item } from '@/types';

const mockLostItem: Item = {
  id: 'item-uuid-1001',
  user_id: 'user-uuid-999',
  type: 'lost',
  title: 'Lost Blue Leather Wallet near MG Road',
  description:
    'Lost wallet containing metro card. Call me at 9876543210 or email test@gmail.com urgently.',
  category_id: 'cat-wallets',
  status: 'open',
  location_country: 'India',
  location_state: 'Karnataka',
  location_city: 'Bengaluru',
  location_landmark: 'Exact room 204 near Metro Gate B',
  latitude: 12.9716,
  longitude: 77.5946,
  date_occurred: '2026-11-20T10:00:00.000Z',
  primary_image_url: 'https://images.unsplash.com/photo-1627123424574-724758594e93',
  attributes: {
    brand: 'WildHorn',
    color: 'Navy Blue',
    reward: '500',
  },
  campus_place_id: null,
  campus_building_id: null,
  view_count: 5,
  created_at: '2026-11-20T10:30:00.000Z',
  updated_at: '2026-11-20T10:30:00.000Z',
  category: {
    id: 'cat-wallets',
    name: 'Wallets & Cards',
    slug: 'wallets',
    icon: 'wallet',
    description: 'Wallets, purses, and cardholders',
    created_at: '2026-01-01',
  },
};

describe('Printable Lost-Item Poster Generator', () => {
  it('sanitizes poster data and strictly redacts PII and exact location details', () => {
    const sanitized = sanitizePosterData(mockLostItem, 'https://lostfound.example.com');

    // 1. Phone number and email must be masked in description
    expect(sanitized.description).not.toContain('9876543210');
    expect(sanitized.description).not.toContain('test@gmail.com');
    expect(sanitized.description).toContain('****3210');

    // 2. Exact landmark, building, and coordinates must be omitted; only general area included
    expect(sanitized.generalArea).toBe('Bengaluru, Karnataka');
    expect(sanitized.generalArea).not.toContain('room 204');
    expect(sanitized.generalArea).not.toContain('Metro Gate B');

    // 3. Reward properly formatted
    expect(sanitized.reward).toBe('₹500');

    // 4. Item URL properly formed
    expect(sanitized.itemUrl).toBe('https://lostfound.example.com/items/item-uuid-1001');

    // 5. Category present
    expect(sanitized.category).toBe('Wallets & Cards');
  });

  it('handles item with no reward or no city gracefully', () => {
    const itemWithoutReward: Item = {
      ...mockLostItem,
      location_city: null,
      location_state: null,
      attributes: {},
    };

    const sanitized = sanitizePosterData(itemWithoutReward);
    expect(sanitized.generalArea).toBe('Not Specified');
    expect(sanitized.reward).toBeNull();
  });

  it('supports multi-language default labels for Kannada and Hindi', () => {
    expect(DEFAULT_POSTER_LABELS.kn.lost_header).toBe('ಕಳೆದುಹೋದ ವಸ್ತು');
    expect(DEFAULT_POSTER_LABELS.hi.lost_header).toBe('गुमशुदा वस्तु');
    expect(DEFAULT_POSTER_LABELS.en.lost_header).toBe('LOST ITEM');

    expect(DEFAULT_POSTER_LABELS.kn.reward_badge).toBe('ಬಹುಮಾನ ನಿಗದಿಪಡಿಸಲಾಗಿದೆ');
    expect(DEFAULT_POSTER_LABELS.hi.reward_badge).toBe('इनाम घोषित');
  });

  it('generates a valid A4 jsPDF instance with QR code data URL', async () => {
    const result = await generateLostItemPosterPdf(mockLostItem, {
      origin: 'https://lostfound.example.com',
      save: false, // Don't trigger browser download in test environment
      labels: {
        lost_header: 'LOST ITEM',
      },
    });

    expect(result).toBeDefined();
    expect(result.doc).toBeDefined();
    expect(result.qrDataUrl).toMatch(/^data:image\/png;base64,/);

    // Verify PDF dimensions: A4 is 210mm x 297mm
    const pageInfo = result.doc.internal.pageSize;
    expect(Math.round(pageInfo.getWidth())).toBe(210);
    expect(Math.round(pageInfo.getHeight())).toBe(297);
    expect(result.doc.getNumberOfPages()).toBe(1);
  });
});
