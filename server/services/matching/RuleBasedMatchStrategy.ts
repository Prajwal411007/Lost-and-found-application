import { MatchStrategy } from './MatchStrategy.js';
import { MatchResult, MatchScoreDimension } from '../../types/index.js';
import { computeTfIdfCosineSimilarity } from './textSimilarity.js';
import { evaluateImageHashSimilarity } from './imageHash.js';
import { evaluateAttributeSimilarity } from './attributeMatching.js';

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
  public readonly name = 'Smarter Hybrid TF-IDF & Visual Match Engine v2.0';

  public computeMatch(lostItem: any, foundItem: any): MatchResult {
    const breakdown: Record<string, MatchScoreDimension> = {};

    // Determine if both items have perceptual image hashes
    const hasImageComparison = Boolean(lostItem.image_phash && foundItem.image_phash);

    // Weights allocation
    const weights = hasImageComparison
      ? { text: 25, category: 20, distance: 25, date: 10, attributes: 10, image: 10 }
      : { text: 30, category: 25, distance: 25, date: 15, attributes: 5, image: 0 };

    // 1. Text Similarity (TF-IDF Cosine Similarity + Stemming & Synonyms)
    const lostFullText = `${lostItem.title || ''} ${lostItem.description || ''}`.trim();
    const foundFullText = `${foundItem.title || ''} ${foundItem.description || ''}`.trim();

    const textResult = computeTfIdfCosineSimilarity(lostFullText, foundFullText);
    const textPercent = Math.round(textResult.similarity * 100);

    const keywordNote = textResult.matchedKeywords.length > 0
      ? ` (matched: ${textResult.matchedKeywords.slice(0, 3).join(', ')})`
      : '';

    breakdown['text_similarity'] = {
      name: 'Text & Concept Similarity',
      weight: weights.text,
      score: textResult.similarity,
      explanation: `Text ${textPercent}%: TF-IDF cosine similarity with stemming and synonyms${keywordNote}`,
    };

    // 2. Category Match
    let categoryScore = 0;
    let categoryExplanation = 'Category 0%: Different item categories';

    if (lostItem.category_id && foundItem.category_id && lostItem.category_id === foundItem.category_id) {
      categoryScore = 1.0;
      categoryExplanation = 'Category 100%: Exact category taxonomy match';
    }

    breakdown['category'] = {
      name: 'Category Match',
      weight: weights.category,
      score: categoryScore,
      explanation: categoryExplanation,
    };

    // 3. Geographic Distance Proximity
    let geoScore = 0;
    let geoExplanation = 'Location 0%: No coordinates available';

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
        geoExplanation = `Location 100%: Under 1 km apart (~${Math.round(distanceKm * 1000)}m)`;
      } else if (distanceKm < 5.0) {
        geoScore = 0.85;
        geoExplanation = `Location 85%: Within 5 km radius (${distanceKm.toFixed(1)} km)`;
      } else if (distanceKm < 25.0) {
        geoScore = 0.55;
        geoExplanation = `Location 55%: Within 25 km region (${distanceKm.toFixed(1)} km)`;
      } else if (distanceKm < 50.0) {
        geoScore = 0.30;
        geoExplanation = `Location 30%: Same metro area (${distanceKm.toFixed(1)} km)`;
      } else {
        geoScore = 0.05;
        geoExplanation = `Location 5%: Far apart (${distanceKm.toFixed(0)} km)`;
      }
    } else if (
      lostItem.location_city &&
      foundItem.location_city &&
      lostItem.location_city.toLowerCase() === foundItem.location_city.toLowerCase()
    ) {
      geoScore = 0.60;
      geoExplanation = `Location 60%: Both reported in ${lostItem.location_city} (city match)`;
    }

    breakdown['distance'] = {
      name: 'Geographic Distance',
      weight: weights.distance,
      score: geoScore,
      explanation: geoExplanation,
    };

    // 4. Date Proximity
    let dateScore = 0;
    let dateExplanation = 'Date: Not specified';

    if (lostItem.date_occurred && foundItem.date_occurred) {
      const lostDate = new Date(lostItem.date_occurred).getTime();
      const foundDate = new Date(foundItem.date_occurred).getTime();
      const diffDays = Math.round((foundDate - lostDate) / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= 2) {
        dateScore = 1.0;
        dateExplanation = diffDays === 0
          ? 'Date 100%: Reported on the exact same date'
          : `Date 100%: Found ${diffDays} day(s) after being lost`;
      } else if (diffDays > 2 && diffDays <= 7) {
        dateScore = 0.85;
        dateExplanation = `Date 85%: Found ${diffDays} days after being lost`;
      } else if (diffDays > 7 && diffDays <= 21) {
        dateScore = 0.55;
        dateExplanation = `Date 55%: Found ${diffDays} days after being lost`;
      } else if (diffDays < 0 && diffDays >= -1) {
        dateScore = 0.70;
        dateExplanation = 'Date 70%: Aligns within 24h timezone window';
      } else {
        dateScore = 0.15;
        dateExplanation = 'Date 15%: Significant date interval (>3 weeks)';
      }
    }

    breakdown['date_proximity'] = {
      name: 'Date Proximity',
      weight: weights.date,
      score: dateScore,
      explanation: dateExplanation,
    };

    // 5. Item Attributes (Color & Brand Normalized Matching)
    const attrResult = evaluateAttributeSimilarity(
      lostItem.attributes || {},
      foundItem.attributes || {}
    );
    const attrPercent = Math.round(attrResult.score * 100);

    breakdown['attributes'] = {
      name: 'Item Attributes',
      weight: weights.attributes,
      score: attrResult.score,
      explanation: `Attributes ${attrPercent}%: ${attrResult.explanation}`,
    };

    // 6. Image Perceptual Hash Similarity
    if (hasImageComparison) {
      const imageResult = evaluateImageHashSimilarity(
        lostItem.image_phash,
        foundItem.image_phash
      );
      const imgPercent = Math.round(imageResult.score * 100);

      breakdown['image_similarity'] = {
        name: 'Visual Photo Similarity',
        weight: weights.image,
        score: imageResult.score,
        explanation: `Image ${imgPercent}%: ${imageResult.explanation}`,
      };
    }

    // Calculate Total Weighted Score (0 to 100)
    let totalScore = 0;
    for (const key of Object.keys(breakdown)) {
      const dim = breakdown[key];
      totalScore += dim.weight * dim.score;
    }

    totalScore = Math.round(totalScore * 10) / 10; // e.g. 84.5

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
