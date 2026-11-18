import { MatchStrategy } from './MatchStrategy.js';
import { MatchResult, MatchScoreDimension } from '../../types/index.js';

// Common English stopwords to ignore in text similarity
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with',
  'by', 'about', 'like', 'through', 'over', 'before', 'between', 'after', 'since',
  'without', 'under', 'within', 'along', 'following', 'across', 'behind', 'beyond',
  'plus', 'except', 'until', 'around', 'near', 'down', 'up', 'off', 'is', 'it', 'my',
  'was', 'lost', 'found', 'item', 'please', 'help', 'some', 'has', 'have',
]);

function tokenize(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(tokens);
}

function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionSize++;
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize > 0 ? intersectionSize / unionSize : 0;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class RuleBasedMatchStrategy implements MatchStrategy {
  public readonly name = 'Transparent Rule-Based Scorer v1.0';

  public computeMatch(lostItem: any, foundItem: any): MatchResult {
    const breakdown: Record<string, MatchScoreDimension> = {};

    // 1. Text Similarity (Weight: 30%)
    const lostTextTokens = tokenize(`${lostItem.title} ${lostItem.description}`);
    const foundTextTokens = tokenize(`${foundItem.title} ${foundItem.description}`);
    const textSimilarity = calculateJaccardSimilarity(lostTextTokens, foundTextTokens);

    let textScore = Math.min(1.0, textSimilarity * 2.2); // Boost moderate token overlaps
    let textExplanation = `${Math.round(textSimilarity * 100)}% token vocabulary overlap between descriptions`;

    breakdown['text_similarity'] = {
      name: 'Text & Description Similarity',
      weight: 30,
      score: textScore,
      explanation: textExplanation,
    };

    // 2. Category Match (Weight: 25%)
    let categoryScore = 0;
    let categoryExplanation = 'Different categories';

    if (lostItem.category_id && foundItem.category_id && lostItem.category_id === foundItem.category_id) {
      categoryScore = 1.0;
      categoryExplanation = 'Exact category match';
    }

    breakdown['category'] = {
      name: 'Category Match',
      weight: 25,
      score: categoryScore,
      explanation: categoryExplanation,
    };

    // 3. Distance Proximity (Weight: 25%)
    let geoScore = 0;
    let geoExplanation = 'No geographic coordinates provided';

    if (
      lostItem.latitude &&
      lostItem.longitude &&
      foundItem.latitude &&
      foundItem.longitude
    ) {
      const distanceKm = haversineDistance(
        lostItem.latitude,
        lostItem.longitude,
        foundItem.latitude,
        foundItem.longitude
      );

      if (distanceKm < 1.0) {
        geoScore = 1.0;
        geoExplanation = `Under 1 km apart (~${Math.round(distanceKm * 1000)} meters)`;
      } else if (distanceKm < 5.0) {
        geoScore = 0.8;
        geoExplanation = `Within 5 km radius (${distanceKm.toFixed(1)} km)`;
      } else if (distanceKm < 25.0) {
        geoScore = 0.5;
        geoExplanation = `Within 25 km region (${distanceKm.toFixed(1)} km)`;
      } else if (distanceKm < 50.0) {
        geoScore = 0.25;
        geoExplanation = `Same metropolitan area (${distanceKm.toFixed(1)} km)`;
      } else {
        geoScore = 0.0;
        geoExplanation = `Locations are ${distanceKm.toFixed(0)} km apart`;
      }
    } else if (
      lostItem.location_city &&
      foundItem.location_city &&
      lostItem.location_city.toLowerCase() === foundItem.location_city.toLowerCase()
    ) {
      geoScore = 0.5;
      geoExplanation = `Both reported in ${lostItem.location_city} (no GPS coordinates)`;
    }

    breakdown['distance'] = {
      name: 'Geographic Distance',
      weight: 25,
      score: geoScore,
      explanation: geoExplanation,
    };

    // 4. Date Proximity (Weight: 15%)
    let dateScore = 0;
    let dateExplanation = 'Date not specified';

    if (lostItem.date_occurred && foundItem.date_occurred) {
      const lostDate = new Date(lostItem.date_occurred).getTime();
      const foundDate = new Date(foundItem.date_occurred).getTime();
      const diffDays = Math.round((foundDate - lostDate) / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= 2) {
        dateScore = 1.0;
        dateExplanation = diffDays === 0 ? 'Reported on the same day' : `Found ${diffDays} days after being lost`;
      } else if (diffDays > 2 && diffDays <= 7) {
        dateScore = 0.8;
        dateExplanation = `Found ${diffDays} days after being lost`;
      } else if (diffDays > 7 && diffDays <= 21) {
        dateScore = 0.5;
        dateExplanation = `Found ${diffDays} days after being lost`;
      } else if (diffDays < 0 && diffDays >= -1) {
        // Allow 1 day timezone leeway
        dateScore = 0.7;
        dateExplanation = 'Dates align within timezone difference';
      } else {
        dateScore = 0.1;
        dateExplanation = 'Significant date difference';
      }
    }

    breakdown['date_proximity'] = {
      name: 'Date Proximity',
      weight: 15,
      score: dateScore,
      explanation: dateExplanation,
    };

    // 5. Attributes Match (Weight: 5%)
    let attrScore = 0;
    let attrExplanation = 'No common attributes matched';

    const lostAttr = lostItem.attributes || {};
    const foundAttr = foundItem.attributes || {};

    let matchesCount = 0;
    if (lostAttr.brand && foundAttr.brand && lostAttr.brand.toLowerCase() === foundAttr.brand.toLowerCase()) {
      matchesCount++;
    }
    if (lostAttr.color && foundAttr.color && lostAttr.color.toLowerCase() === foundAttr.color.toLowerCase()) {
      matchesCount++;
    }

    if (matchesCount >= 2) {
      attrScore = 1.0;
      attrExplanation = 'Both brand and color match';
    } else if (matchesCount === 1) {
      attrScore = 0.7;
      attrExplanation = 'Brand or color matches';
    }

    breakdown['attributes'] = {
      name: 'Item Attributes',
      weight: 5,
      score: attrScore,
      explanation: attrExplanation,
    };

    // Calculate Total Weighted Score (0 to 100)
    let totalScore = 0;
    for (const key of Object.keys(breakdown)) {
      const dim = breakdown[key];
      totalScore += dim.weight * dim.score;
    }

    totalScore = Math.round(totalScore * 10) / 10; // e.g. 82.5

    let tier: 'High' | 'Medium' | 'Low' = 'Low';
    if (totalScore >= 75) tier = 'High';
    else if (totalScore >= 55) tier = 'Medium';

    return {
      totalScore,
      tier,
      breakdown,
    };
  }
}

