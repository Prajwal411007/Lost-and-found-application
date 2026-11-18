import { describe, it, expect } from 'vitest';
import { RuleBasedMatchStrategy } from './RuleBasedMatchStrategy.js';

describe('Matching Engine - RuleBasedMatchStrategy', () => {
  const strategy = new RuleBasedMatchStrategy();

  it('computes High tier match for identical category, high text overlap, and close coordinates', () => {
    const lostItem = {
      title: 'Black Apple iPhone 15 Pro Max',
      description: 'Lost my black iPhone with a clear MagSafe case and small scratch on bottom left',
      category_id: 'cat-electronics',
      latitude: 37.7749,
      longitude: -122.4194,
      date_occurred: '2026-11-10',
      attributes: {
        brand: 'Apple',
        color: 'Black',
      },
    };

    const foundItem = {
      title: 'Found iPhone 15 Pro with clear case',
      description: 'Found black iPhone 15 near platform, clear case, small scratch on bottom edge',
      category_id: 'cat-electronics',
      latitude: 37.7752,
      longitude: -122.4190, // ~50 meters away
      date_occurred: '2026-11-11', // 1 day after
      attributes: {
        brand: 'Apple',
        color: 'Black',
      },
    };

    const result = strategy.computeMatch(lostItem, foundItem);

    expect(result.totalScore).toBeGreaterThanOrEqual(75);
    expect(result.tier).toBe('High');
    expect(result.breakdown.category.score).toBe(1.0);
    expect(result.breakdown.distance.score).toBe(1.0);
    expect(result.breakdown.date_proximity.score).toBe(1.0);
    expect(result.breakdown.attributes.score).toBe(1.0);
  });

  it('computes Low tier match for completely different category and distant locations', () => {
    const lostItem = {
      title: 'Golden Retriever Dog',
      description: 'Lost golden retriever friendly pet with brown collar',
      category_id: 'cat-pets',
      latitude: 37.7749,
      longitude: -122.4194, // San Francisco
      date_occurred: '2026-11-01',
    };

    const foundItem = {
      title: 'Silver Car Key Fob',
      description: 'Found Honda car key fob on the sidewalk',
      category_id: 'cat-keys',
      latitude: 40.7128,
      longitude: -74.0060, // New York
      date_occurred: '2026-11-15',
    };

    const result = strategy.computeMatch(lostItem, foundItem);

    expect(result.totalScore).toBeLessThan(45);
    expect(result.tier).toBe('Low');
    expect(result.breakdown.category.score).toBe(0);
    expect(result.breakdown.distance.score).toBe(0);
  });
});

