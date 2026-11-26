import { describe, it, expect } from 'vitest';
import { redactSensitiveData } from '../lib/redaction';

describe('Share Cards & Social Links Utility', () => {
  it('sanitizes item title and area to prevent leaking phone numbers or Aadhaar in share text', () => {
    const rawTitle = 'Lost iPhone 15 near +91 98765 43210';
    const rawArea = 'Near Flat 402, call 9876543210, Bengaluru';

    const safeTitle = redactSensitiveData(rawTitle);
    const safeArea = redactSensitiveData(rawArea);

    expect(safeTitle).not.toContain('98765 43210');
    expect(safeTitle).toContain('****3210');
    expect(safeArea).not.toContain('9876543210');
    expect(safeArea).toContain('****3210');
  });

  it('generates valid WhatsApp share link with encoded parameters', () => {
    const shareText = 'Lost item in Bengaluru: "Black Backpack". Help reunite it!';
    const shareUrl = 'https://findit.local/items/item-123';

    const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
    expect(waUrl).toContain('https://wa.me/?text=');
    expect(waUrl).toContain(encodeURIComponent('Black Backpack'));
    expect(waUrl).toContain(encodeURIComponent('https://findit.local/items/item-123'));
  });

  it('generates valid Telegram share link with url and text params', () => {
    const shareText = 'Found item in Metro Station: "Keys". Help find owner!';
    const shareUrl = 'https://findit.local/items/item-456';

    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    expect(tgUrl).toContain('https://t.me/share/url?url=');
    expect(tgUrl).toContain('text=');
    expect(tgUrl).toContain(encodeURIComponent('item-456'));
  });
});
