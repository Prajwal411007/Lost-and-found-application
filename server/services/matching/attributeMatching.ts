/**
 * Canonical Attribute Matching: Colors, Brands, Models and Distinguishing Marks
 */

const COLOR_SYNONYMS = new Map<string, string>([
  ['grey', 'gray'],
  ['silver', 'gray'],
  ['charcoal', 'gray'],
  ['slate', 'gray'],
  ['space gray', 'gray'],
  ['space grey', 'gray'],
  ['navy', 'blue'],
  ['dark blue', 'blue'],
  ['light blue', 'blue'],
  ['cyan', 'blue'],
  ['teal', 'blue'],
  ['indigo', 'blue'],
  ['jet black', 'black'],
  ['midnight', 'black'],
  ['dark', 'black'],
  ['white', 'white'],
  ['ivory', 'white'],
  ['cream', 'white'],
  ['pearl', 'white'],
  ['gold', 'gold'],
  ['golden', 'gold'],
  ['yellow', 'gold'],
  ['amber', 'gold'],
  ['rose gold', 'pink'],
  ['pink', 'pink'],
  ['magenta', 'pink'],
  ['red', 'red'],
  ['maroon', 'red'],
  ['crimson', 'red'],
  ['burgundy', 'red'],
  ['green', 'green'],
  ['olive', 'green'],
  ['emerald', 'green'],
  ['brown', 'brown'],
  ['tan', 'brown'],
  ['beige', 'brown'],
  ['khaki', 'brown'],
  ['purple', 'purple'],
  ['violet', 'purple'],
  ['orange', 'orange'],
]);

export function normalizeColor(color?: string | null): string {
  if (!color) return '';
  const clean = color.trim().toLowerCase();
  return COLOR_SYNONYMS.get(clean) || clean;
}

export function normalizeBrand(brand?: string | null): string {
  if (!brand) return '';
  return brand
    .trim()
    .toLowerCase()
    .replace(/^(the|brand)\s+/i, '')
    .replace(/\s+(inc|llc|ltd|co|corp|corporation|electronics)\b/gi, '')
    .replace(/[^a-z0-9]/g, '');
}

export function evaluateAttributeSimilarity(
  lostAttrs: Record<string, any> = {},
  foundAttrs: Record<string, any> = {}
): {
  score: number;
  matchedDetails: string[];
  explanation: string;
} {
  const matchedDetails: string[] = [];
  let totalEvaluated = 0;
  let matchesCount = 0;

  // 1. Brand match
  const lostBrand = normalizeBrand(lostAttrs.brand);
  const foundBrand = normalizeBrand(foundAttrs.brand);
  if (lostBrand && foundBrand) {
    totalEvaluated++;
    if (lostBrand === foundBrand || lostBrand.includes(foundBrand) || foundBrand.includes(lostBrand)) {
      matchesCount += 1.0;
      matchedDetails.push(`Brand: ${lostAttrs.brand}`);
    }
  }

  // 2. Color match
  const lostColor = normalizeColor(lostAttrs.color);
  const foundColor = normalizeColor(foundAttrs.color);
  if (lostColor && foundColor) {
    totalEvaluated++;
    if (lostColor === foundColor || lostColor.includes(foundColor) || foundColor.includes(lostColor)) {
      matchesCount += 1.0;
      matchedDetails.push(`Color: ${lostAttrs.color}`);
    }
  }

  // 3. Model match
  const lostModel = String(lostAttrs.model || '').toLowerCase().trim();
  const foundModel = String(foundAttrs.model || '').toLowerCase().trim();
  if (lostModel && foundModel) {
    totalEvaluated++;
    if (lostModel === foundModel || lostModel.includes(foundModel) || foundModel.includes(lostModel)) {
      matchesCount += 1.0;
      matchedDetails.push(`Model: ${lostAttrs.model}`);
    }
  }

  if (totalEvaluated === 0) {
    return {
      score: 0.5, // Neutral score when attributes are not recorded
      matchedDetails: [],
      explanation: 'No specific brand or color attributes specified',
    };
  }

  const score = Math.round((matchesCount / totalEvaluated) * 100) / 100;
  const explanation = matchedDetails.length > 0
    ? `Matching ${matchedDetails.join(', ')}`
    : 'No matching brand or color attributes';

  return {
    score,
    matchedDetails,
    explanation,
  };
}
