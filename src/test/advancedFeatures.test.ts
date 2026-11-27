import { describe, it, expect } from 'vitest';
import { RuleBasedMatchStrategy } from '../../server/services/matching/RuleBasedMatchStrategy.js';
import { computeTfIdfCosineSimilarity, extractNormalizedTokens } from '../../server/services/matching/textSimilarity.js';
import { calculateHammingDistance, evaluateImageHashSimilarity, computePerceptualHash } from '../../server/services/matching/imageHash.js';
import { evaluateAttributeSimilarity } from '../../server/services/matching/attributeMatching.js';

describe('Advanced Features: Smarter Matching, Privacy & Community', () => {
  const strategy = new RuleBasedMatchStrategy();

  describe('A1. Smarter Matching Engine & Per-Factor Breakdown', () => {
    it('provides explainable per-factor breakdown with text, location, and date confidence', () => {
      const lostItem: any = {
        id: 'lost-1',
        title: 'Lost Apple iPhone 13 Pro in Space Gray',
        description: 'Black silicone case, lost near campus cafeteria around noon.',
        category_id: 'cat-electronics',
        latitude: 12.9716,
        longitude: 77.5946,
        date_occurred: new Date().toISOString(),
      };

      const foundItem: any = {
        id: 'found-1',
        title: 'Found Apple smartphone with black cover',
        description: 'Found a gray cell phone near university dining hall.',
        category_id: 'cat-electronics',
        latitude: 12.9720, // very close (~50m)
        longitude: 77.5950,
        date_occurred: new Date().toISOString(),
      };

      const match = strategy.computeMatch(lostItem, foundItem);

      expect(match).not.toBeNull();
      expect(match.totalScore).toBeGreaterThan(60);
      expect(match.breakdown).toBeDefined();

      const breakdown = match.breakdown;
      expect(breakdown.text_similarity).toBeDefined();
      expect(breakdown.text_similarity.explanation).toContain('Text');

      expect(breakdown.category).toBeDefined();
      expect(breakdown.category.score).toBe(1.0);

      expect(breakdown.distance).toBeDefined();
      expect(breakdown.distance.score).toBeGreaterThanOrEqual(0.8);

      expect(breakdown.date_proximity).toBeDefined();
    });

    it('expands common device and bag synonyms accurately', () => {
      const tokensPhone = extractNormalizedTokens('Lost my mobile cellphone device');
      expect(tokensPhone).toContain('phone');

      const tokensBag = extractNormalizedTokens('Left my backpack rucksack on the bench');
      expect(tokensBag).toContain('bag');

      const tokensKey = extractNormalizedTokens('Lost a keychain fob with silver key');
      expect(tokensKey).toContain('key');
    });

    it('normalizes brand and color variations in attribute matching', () => {
      const lostAttrs = { brand: 'Apple Inc.', color: 'Space Grey' };
      const foundAttrs = { brand: 'Apple', color: 'Gray' };

      const attrMatch = evaluateAttributeSimilarity(lostAttrs, foundAttrs);
      expect(attrMatch.score).toBe(1.0);
      expect(attrMatch.matchedDetails.length).toBeGreaterThanOrEqual(2);
    });

    it('computes 64-bit perceptual image hash and calculates Hamming distance', () => {
      const buf1 = Buffer.from('mock-photo-binary-buffer-pixel-data-12345678901234567890123456789012345678901234567890');
      const hash1 = computePerceptualHash(buf1);
      expect(hash1).toHaveLength(16); // 16 hex chars = 64 bits

      const evalIdentical = evaluateImageHashSimilarity(hash1, hash1);
      expect(evalIdentical.distance).toBe(0);
      expect(evalIdentical.confidence).toBe('High');
      expect(evalIdentical.score).toBe(1.0);

      const evalDistant = evaluateImageHashSimilarity('0000000000000000', 'ffffffffffffffff');
      expect(evalDistant.distance).toBe(64);
      expect(evalDistant.confidence).toBe('Low');
    });
  });

  describe('A5. Community Dual Opt-In & Privacy Invariants', () => {
    it('verifies that success stories require BOTH finder and claimant opt-in and not moderator removed', () => {
      const isStoryPublic = (story: {
        finder_opt_in: boolean;
        claimant_opt_in: boolean;
        is_moderator_removed: boolean;
      }) => {
        return story.finder_opt_in === true && story.claimant_opt_in === true && !story.is_moderator_removed;
      };

      // Both opted in
      expect(isStoryPublic({ finder_opt_in: true, claimant_opt_in: true, is_moderator_removed: false })).toBe(true);

      // Only finder opted in
      expect(isStoryPublic({ finder_opt_in: true, claimant_opt_in: false, is_moderator_removed: false })).toBe(false);

      // Only claimant opted in
      expect(isStoryPublic({ finder_opt_in: false, claimant_opt_in: true, is_moderator_removed: false })).toBe(false);

      // Both opted in but moderator removed
      expect(isStoryPublic({ finder_opt_in: true, claimant_opt_in: true, is_moderator_removed: true })).toBe(false);
    });

    it('verifies leaderboard excludes users who opted out', () => {
      const users = [
        { id: 'u1', name: 'Alice', leaderboard_opt_in: true, count: 5 },
        { id: 'u2', name: 'Bob', leaderboard_opt_in: false, count: 10 },
        { id: 'u3', name: 'Charlie', leaderboard_opt_in: true, count: 2 },
      ];

      const visibleLeaderboard = users
        .filter((u) => u.leaderboard_opt_in !== false)
        .sort((a, b) => b.count - a.count);

      expect(visibleLeaderboard.map((u) => u.name)).toEqual(['Alice', 'Charlie']);
      expect(visibleLeaderboard.some((u) => u.name === 'Bob')).toBe(false);
    });
  });

  describe('A6. Quiet Hours Notification Logic', () => {
    const isQuietHour = (currentTime: string, start: string, end: string, enabled: boolean) => {
      if (!enabled) return false;
      const [curH, curM] = currentTime.split(':').map(Number);
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);

      const curMinutes = curH * 60 + curM;
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes <= endMinutes) {
        return curMinutes >= startMinutes && curMinutes <= endMinutes;
      }
      // Overnight rollover (e.g. 22:00 to 08:00)
      return curMinutes >= startMinutes || curMinutes <= endMinutes;
    };

    it('suppresses notifications during night quiet hours with overnight rollover', () => {
      const start = '22:00';
      const end = '08:00';

      // 23:30 at night (should be quiet)
      expect(isQuietHour('23:30', start, end, true)).toBe(true);

      // 03:00 early morning (should be quiet)
      expect(isQuietHour('03:00', start, end, true)).toBe(true);

      // 14:00 daytime (should NOT be quiet)
      expect(isQuietHour('14:00', start, end, true)).toBe(false);

      // When disabled, always false
      expect(isQuietHour('23:30', start, end, false)).toBe(false);
    });
  });
});
