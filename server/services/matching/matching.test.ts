import { describe, it, expect } from 'vitest';
import { RuleBasedMatchStrategy } from './RuleBasedMatchStrategy.js';
import { computeTfIdfCosineSimilarity, extractNormalizedTokens } from './textSimilarity.js';
import { calculateHammingDistance, evaluateImageHashSimilarity, computePerceptualHash } from './imageHash.js';
import { evaluateAttributeSimilarity } from './attributeMatching.js';

describe('Matching Engine - Smarter Matching & Visual Phash', () => {
  const strategy = new RuleBasedMatchStrategy();

  it('TF-IDF recognizes synonyms like mobile/phone/cellphone and bag/backpack/purse with stemming', () => {
    const textA = 'Lost my blue cellphone inside a black backpack near student library';
    const textB = 'Found a navy phone in a dark bag by the library';

    const tokensA = extractNormalizedTokens(textA);
    const tokensB = extractNormalizedTokens(textB);

    // Both should contain canonicalized tokens: 'phone' and 'bag'
    expect(tokensA).toContain('phone');
    expect(tokensA).toContain('bag');
    expect(tokensB).toContain('phone');
    expect(tokensB).toContain('bag');

    const result = computeTfIdfCosineSimilarity(textA, textB);
    expect(result.similarity).toBeGreaterThan(0.5);
    expect(result.matchedKeywords).toContain('phone');
    expect(result.matchedKeywords).toContain('bag');
  });

  it('computes 64-bit perceptual image hashes and evaluates Hamming distance similarity', () => {
    const sampleBuffer1 = Buffer.from('image-pixel-grid-data-sample-gradient-1010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010');
    const hash1 = computePerceptualHash(sampleBuffer1);
    expect(hash1).toHaveLength(16); // 16 hex characters = 64 bits

    // Identical hash distance should be 0 and score close to 1.0
    const distanceSelf = calculateHammingDistance(hash1, hash1);
    expect(distanceSelf).toBe(0);

    const evalSelf = evaluateImageHashSimilarity(hash1, hash1);
    expect(evalSelf.score).toBe(1.0);
    expect(evalSelf.confidence).toBe('High');

    // Slight variance (differing by 3 bits)
    const hashSimilar = hash1.slice(0, 15) + (parseInt(hash1[15], 16) ^ 1).toString(16);
    const evalSimilar = evaluateImageHashSimilarity(hash1, hashSimilar);
    expect(evalSimilar.distance).toBeLessThanOrEqual(5);
    expect(evalSimilar.confidence).toBe('High');

    // Opposite / random hash should have large distance
    const hashDistant = 'ffffffffffffffff';
    const evalDistant = evaluateImageHashSimilarity('0000000000000000', hashDistant);
    expect(evalDistant.distance).toBe(64);
    expect(evalDistant.confidence).toBe('Low');
    expect(evalDistant.score).toBe(0);
  });

  it('normalizes colors and brands in attribute matching', () => {
    const lostAttrs = { brand: 'Apple Inc.', color: 'Space Grey', model: 'MacBook Pro 14' };
    const foundAttrs = { brand: 'Apple', color: 'Gray', model: 'MacBook' };

    const attrMatch = evaluateAttributeSimilarity(lostAttrs, foundAttrs);
    expect(attrMatch.score).toBe(1.0);
    expect(attrMatch.matchedDetails.length).toBeGreaterThanOrEqual(2);
    expect(attrMatch.explanation).toContain('Brand: Apple Inc.');
  });

  it('computes High tier match with explainable breakdown including image pHash', () => {
    const sampleHash = '3a5f9c1e2b4d8a70';

    const lostItem = {
      title: 'Black Apple iPhone 15 Pro Max',
      description: 'Lost my black iPhone with a clear MagSafe case and small scratch on bottom left',
      category_id: 'cat-electronics',
      latitude: 37.7749,
      longitude: -122.4194,
      date_occurred: '2026-11-10',
      image_phash: sampleHash,
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
      image_phash: sampleHash, // Same visual hash
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
    expect(result.breakdown).toHaveProperty('image_similarity');
    expect(result.breakdown.image_similarity.score).toBe(1.0);
    expect(result.breakdown.text_similarity.explanation).toContain('Text');
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
    expect(result.breakdown.distance.score).toBeLessThanOrEqual(0.1);
  });
});
