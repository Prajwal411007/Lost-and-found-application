/**
 * Deterministic and Explainable Verification Match Engine
 * Compares claimant answers against finder's hidden proof details while
 * penalizing description-mirroring (guessing from public text).
 *
 * IMPORTANT: This provides guidance only. Decisions are made by the finder or moderator.
 */

export interface PrivateDetailItem {
  detail_type: string;
  detail_label: string;
  detail_value: string;
}

export interface VerificationMatchResult {
  score: 'high' | 'medium' | 'low' | 'unmatched';
  explanation: string;
  detailsMatchedCount: number;
  totalDetailsCount: number;
  descriptionOverlapPercent: number;
  disclaimer: string;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
  'of', 'from', 'it', 'its', 'my', 'is', 'was', 'are', 'were', 'has', 'have',
  'had', 'that', 'this', 'there', 'here', 'when', 'where', 'what', 'who',
  'some', 'very', 'also', 'item', 'lost', 'found',
]);

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Computes the verification match level between claimant answers and finder proof details.
 */
export function computeVerificationMatch(
  privateDetails: PrivateDetailItem[],
  answers: Record<string, string>,
  publicDescription: string = ''
): VerificationMatchResult {
  const disclaimer =
    'Guidance only: A matching description alone is never proof of ownership. The finder or a moderator makes the final decision.';

  // Aggregate all claimant text
  const claimantText = Object.values(answers || {}).join(' ');
  const claimantTokens = new Set(tokenize(claimantText));
  const descTokens = new Set(tokenize(publicDescription));

  // 1. Calculate description overlap (to detect guessing/mirroring)
  let descOverlapCount = 0;
  if (claimantTokens.size > 0 && descTokens.size > 0) {
    for (const token of claimantTokens) {
      if (descTokens.has(token)) {
        descOverlapCount++;
      }
    }
  }
  const descriptionOverlapPercent =
    claimantTokens.size > 0
      ? Math.round((descOverlapCount / claimantTokens.size) * 100)
      : 0;

  if (!privateDetails || privateDetails.length === 0) {
    return {
      score: 'medium',
      explanation:
        'No hidden proof details were configured by the finder. Evaluate claimant answers and uploaded documentation manually.',
      detailsMatchedCount: 0,
      totalDetailsCount: 0,
      descriptionOverlapPercent,
      disclaimer,
    };
  }

  // 2. Check each private proof detail
  let matchedDetails = 0;
  const matchNotes: string[] = [];
  const normalizedClaimantText = claimantText.toLowerCase();

  for (const detail of privateDetails) {
    const rawVal = (detail.detail_value || '').toLowerCase().trim();
    if (!rawVal) continue;

    // Direct phrase match
    if (rawVal.length > 3 && normalizedClaimantText.includes(rawVal)) {
      matchedDetails++;
      matchNotes.push(`Direct phrase match on ${detail.detail_label || detail.detail_type} ("${detail.detail_value}")`);
      continue;
    }

    // Tokenized keyword match
    const detailTokens = tokenize(rawVal);
    if (detailTokens.length === 0) continue;

    const matchedTokens = detailTokens.filter((token) => claimantTokens.has(token));
    const tokenMatchRatio = matchedTokens.length / detailTokens.length;

    if (tokenMatchRatio >= 0.5) {
      matchedDetails++;
      matchNotes.push(
        `Keyword match on ${detail.detail_label || detail.detail_type} (${matchedTokens.join(', ')})`
      );
    }
  }

  // 3. Determine overall score
  let score: 'high' | 'medium' | 'low' | 'unmatched';
  let explanation = '';

  const total = privateDetails.length;
  if (matchedDetails >= 2 || (total === 1 && matchedDetails === 1)) {
    score = 'high';
    explanation = `High confidence match: ${matchedDetails} of ${total} hidden proof details matched (${matchNotes.join('; ')}).`;
  } else if (matchedDetails === 1) {
    score = 'medium';
    explanation = `Moderate match: 1 of ${total} hidden proof details matched (${matchNotes.join('; ')}).`;
  } else if (claimantTokens.size > 5) {
    score = 'low';
    explanation = `Low match: None of the ${total} hidden proof details matched claimant answers.`;
  } else {
    score = 'unmatched';
    explanation = 'Insufficient answers provided to match any private proof details.';
  }

  if (descriptionOverlapPercent > 60 && matchedDetails === 0) {
    explanation += ` Notice: Claimant answers have high overlap (${descriptionOverlapPercent}%) with the public description, which may indicate guessing.`;
  }

  return {
    score,
    explanation,
    detailsMatchedCount: matchedDetails,
    totalDetailsCount: total,
    descriptionOverlapPercent,
    disclaimer,
  };
}
