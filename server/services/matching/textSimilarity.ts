/**
 * Text Similarity Engine with TF-IDF, Cosine Similarity, Stemming and Synonym Expansion
 */

// Common English stopwords
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with',
  'by', 'about', 'like', 'through', 'over', 'before', 'between', 'after', 'since',
  'without', 'under', 'within', 'along', 'following', 'across', 'behind', 'beyond',
  'plus', 'except', 'until', 'around', 'near', 'down', 'up', 'off', 'is', 'it', 'my',
  'was', 'were', 'lost', 'found', 'item', 'please', 'help', 'some', 'has', 'have',
  'had', 'there', 'this', 'that', 'from', 'they', 'them', 'their', 'very', 'also',
  'one', 'two', 'left', 'saw', 'got', 'get', 'can', 'could', 'would', 'will',
]);

// Canonical Synonym Groups
const SYNONYM_GROUPS: string[][] = [
  // Mobile devices
  ['phone', 'mobile', 'cellphone', 'smartphone', 'iphone', 'android', 'handset'],
  // Bags
  ['bag', 'backpack', 'purse', 'handbag', 'knapsack', 'tote', 'satchel', 'duffel', 'rucksack'],
  // Wallets
  ['wallet', 'purse', 'billfold', 'cardholder', 'pouch'],
  // Laptops / Computers
  ['laptop', 'notebook', 'macbook', 'chromebook', 'computer', 'ultrabook'],
  // Keys
  ['keys', 'keychain', 'keyfob', 'fob', 'ring', 'latchkey'],
  // Audio
  ['earphones', 'earbuds', 'airpods', 'headphones', 'headset', 'buds'],
  // Eyewear
  ['glasses', 'spectacles', 'sunglasses', 'eyewear', 'shades'],
  // Outerwear / Clothes
  ['jacket', 'coat', 'hoodie', 'sweater', 'sweatshirt', 'cardigan', 'pullover', 'windbreaker'],
  // Watches
  ['watch', 'smartwatch', 'timepiece', 'chronograph', 'iwatch'],
  // Identification / Cards
  ['card', 'id', 'license', 'pass', 'badge', 'permit'],
  // Containers / Bottles
  ['bottle', 'flask', 'thermos', 'tumbler', 'sipper'],
  // Umbrellas
  ['umbrella', 'parasol', 'rainshade'],
];

// Map each word to its canonical representative (the first word in its group)
const SYNONYM_MAP = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  const canonical = group[0];
  for (const word of group) {
    SYNONYM_MAP.set(word, canonical);
  }
}

/**
 * Porter-like simple suffix stemmer for common English word endings.
 */
export function simpleStem(word: string): string {
  if (word.length <= 3) return word;

  let stem = word;

  // Common suffix reductions
  if (stem.endsWith('sses')) {
    stem = stem.slice(0, -2);
  } else if (stem.endsWith('ies')) {
    stem = stem.slice(0, -3) + 'y';
  } else if (stem.endsWith('ss')) {
    // leave as is
  } else if (stem.endsWith('s') && !stem.endsWith('us') && !stem.endsWith('is')) {
    stem = stem.slice(0, -1);
  }

  if (stem.endsWith('ing') && stem.length > 5) {
    stem = stem.slice(0, -3);
    if (stem.endsWith('bl') || stem.endsWith('iz')) stem += 'e';
  } else if (stem.endsWith('ed') && stem.length > 4) {
    stem = stem.slice(0, -2);
    if (stem.endsWith('bl') || stem.endsWith('iz')) stem += 'e';
  } else if (stem.endsWith('ly') && stem.length > 4) {
    stem = stem.slice(0, -2);
  } else if (stem.endsWith('er') && stem.length > 4) {
    stem = stem.slice(0, -2);
  }

  return stem;
}

/**
 * Normalizes and tokenizes text with stemming and synonym expansion.
 */
export function extractNormalizedTokens(text: string | null | undefined): string[] {
  if (!text) return [];

  const rawWords = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  return rawWords.map((word) => {
    // 1. Check direct synonym map
    const mapped = SYNONYM_MAP.get(word) || word;
    // 2. Apply simple stemming
    const stemmed = simpleStem(mapped);
    // 3. Check synonym map again after stemming
    return SYNONYM_MAP.get(stemmed) || stemmed;
  });
}

/**
 * Computes TF-IDF vector for a document given a term frequency distribution.
 */
function computeTfIdfVector(
  tokens: string[],
  termWeights: Map<string, number>
): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  const vector = new Map<string, number>();
  for (const [term, count] of tf.entries()) {
    // Sublinear term frequency scaling
    const tfScore = 1 + Math.log(count);
    // Informational weight / pseudo-IDF: words longer or distinctive get higher weight
    const idfScore = termWeights.get(term) || (term.length > 4 ? 1.5 : 1.0);
    vector.set(term, tfScore * idfScore);
  }

  return vector;
}

/**
 * Computes Cosine Similarity between two term vectors.
 */
export function cosineSimilarity(
  vectorA: Map<string, number>,
  vectorB: Map<string, number>
): number {
  if (vectorA.size === 0 || vectorB.size === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, valA] of vectorA.entries()) {
    normA += valA * valA;
    const valB = vectorB.get(term);
    if (valB !== undefined) {
      dotProduct += valA * valB;
    }
  }

  for (const valB of vectorB.values()) {
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Computes enhanced TF-IDF Cosine similarity between two texts.
 * Returns a score between 0.0 and 1.0.
 */
export function computeTfIdfCosineSimilarity(textA: string, textB: string): {
  similarity: number;
  matchedKeywords: string[];
} {
  const tokensA = extractNormalizedTokens(textA);
  const tokensB = extractNormalizedTokens(textB);

  if (tokensA.length === 0 || tokensB.length === 0) {
    return { similarity: 0, matchedKeywords: [] };
  }

  // Pre-calculate common high-value terms for IDF boost
  const termWeights = new Map<string, number>();
  const allUnique = new Set([...tokensA, ...tokensB]);
  for (const term of allUnique) {
    let weight = 1.0;
    // Model numbers or alphanumeric strings have high discriminative value
    if (/\d/.test(term)) weight += 0.8;
    // Specific item types get strong weight
    if (SYNONYM_MAP.has(term)) weight += 0.5;
    termWeights.set(term, weight);
  }

  const vectorA = computeTfIdfVector(tokensA, termWeights);
  const vectorB = computeTfIdfVector(tokensB, termWeights);

  const rawCosine = cosineSimilarity(vectorA, vectorB);

  // Find overlapping matched concepts
  const matchedKeywords: string[] = [];
  for (const term of vectorA.keys()) {
    if (vectorB.has(term)) {
      matchedKeywords.push(term);
    }
  }

  // Jaccard support boost for small text snippets
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let overlapCount = 0;
  for (const t of setA) {
    if (setB.has(t)) overlapCount++;
  }
  const jaccard = setA.size + setB.size - overlapCount > 0
    ? overlapCount / (setA.size + setB.size - overlapCount)
    : 0;

  // Balanced combination: 70% TF-IDF Cosine + 30% Token Jaccard
  const combined = rawCosine * 0.7 + jaccard * 0.3;
  const normalized = Math.min(1.0, Math.round(combined * 1000) / 1000);

  return {
    similarity: normalized,
    matchedKeywords,
  };
}
