import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';

export interface FraudFlagRecord {
  id?: string;
  user_id: string;
  flag_type:
    | 'rapid_claims'
    | 'rapid_reports'
    | 'repeated_rejections'
    | 'suspicious_activity'
    | 'fresh_account'
    | 'copied_answers'
    | 'description_mirroring'
    | 'unrelated_categories'
    | 'opportunistic_report';
  severity: 'low' | 'medium' | 'high';
  reason: string;
  metadata?: Record<string, any>;
  status?: 'pending' | 'reviewed' | 'dismissed';
}

/**
 * Evaluates rule-based fraud detection without blocking the user.
 * Flags accounts in the admin queue for human review.
 */
export async function checkUserFraudRules(userId: string): Promise<FraudFlagRecord[]> {
  if (!isServerSupabaseConfigured || !userId) return [];

  const flagsToInsert: FraudFlagRecord[] = [];
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Rule 1: Rapid claims (>3 in 1 hour)
    const { count: claimsCount } = await supabaseAdmin
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('claimant_id', userId)
      .gte('created_at', oneHourAgo);

    if (claimsCount && claimsCount > 3) {
      flagsToInsert.push({
        user_id: userId,
        flag_type: 'rapid_claims',
        severity: 'high',
        reason: `User submitted ${claimsCount} ownership claims within the past hour (threshold: 3).`,
        metadata: { claimsCount, window: '1_hour' },
      });
    }

    // Rule 2: Rapid reports (>5 in 1 hour)
    const { count: reportsCount } = await supabaseAdmin
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo);

    if (reportsCount && reportsCount > 5) {
      flagsToInsert.push({
        user_id: userId,
        flag_type: 'rapid_reports',
        severity: 'medium',
        reason: `User logged ${reportsCount} item reports within the past hour (threshold: 5).`,
        metadata: { reportsCount, window: '1_hour' },
      });
    }

    // Rule 3: Repeated rejected claims (>=3 in 7 days)
    const { count: rejectedCount } = await supabaseAdmin
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('claimant_id', userId)
      .eq('status', 'rejected')
      .gte('created_at', sevenDaysAgo);

    if (rejectedCount && rejectedCount >= 3) {
      flagsToInsert.push({
        user_id: userId,
        flag_type: 'repeated_rejections',
        severity: 'high',
        reason: `User had ${rejectedCount} ownership claims rejected within the past 7 days.`,
        metadata: { rejectedCount, window: '7_days' },
      });
    }

    // Record new flags into database if not already flagged in pending status
    for (const flag of flagsToInsert) {
      await saveFlagIfNotDuplicate(flag);
    }

    return flagsToInsert;
  } catch (err) {
    console.error('Error running fraud checks:', err);
    return [];
  }
}

/**
 * Detailed claim-time fraud evaluation against patterns:
 * - Fresh accounts (<30m old)
 * - Identical copied answers across disparate claims
 * - Description mirroring (guessing without private knowledge)
 * - Unrelated categories claimed within 24h
 * - Opportunistic lost report created after found item was posted
 */
export async function evaluateClaimFraudRules(params: {
  claimantId: string;
  itemId: string;
  claimAnswersText: string;
  publicDescription?: string;
  itemCategoryId?: string;
  descriptionOverlapPercent?: number;
}): Promise<FraudFlagRecord[]> {
  if (!isServerSupabaseConfigured || !params.claimantId) return [];

  const flags: FraudFlagRecord[] = [];
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Fresh Account Check (< 30 minutes old)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('created_at')
      .eq('id', params.claimantId)
      .maybeSingle();

    if (profile?.created_at) {
      const ageMs = Date.now() - new Date(profile.created_at).getTime();
      const ageMinutes = Math.round(ageMs / (60 * 1000));
      if (ageMinutes < 30) {
        flags.push({
          user_id: params.claimantId,
          flag_type: 'fresh_account',
          severity: 'medium',
          reason: `Claim submitted from a newly registered account (${ageMinutes} minutes old).`,
          metadata: { accountAgeMinutes: ageMinutes, itemId: params.itemId },
        });
      }
    }

    // 2. Copied Answers Check
    // Check if claimant submitted the identical answer text on other claims
    const cleanAnswers = params.claimAnswersText.trim().toLowerCase();
    if (cleanAnswers.length > 20) {
      const { data: prevClaims } = await supabaseAdmin
        .from('claims')
        .select('id, verification_answers, item_id')
        .eq('claimant_id', params.claimantId)
        .neq('item_id', params.itemId)
        .limit(10);

      if (prevClaims) {
        for (const prev of prevClaims) {
          const prevText = Object.values(prev.verification_answers?.answers || {}).join(' ') +
            ' ' + (prev.verification_answers?.proof_description || '');
          if (prevText.trim().toLowerCase() === cleanAnswers) {
            flags.push({
              user_id: params.claimantId,
              flag_type: 'copied_answers',
              severity: 'high',
              reason: `Identical verification answers copied verbatim across multiple different item claims.`,
              metadata: { otherClaimId: prev.id, otherItemId: prev.item_id },
            });
            break;
          }
        }
      }
    }

    // 3. Description Mirroring Check (Sign of guessing public listing)
    if (params.descriptionOverlapPercent && params.descriptionOverlapPercent > 65) {
      flags.push({
        user_id: params.claimantId,
        flag_type: 'description_mirroring',
        severity: 'medium',
        reason: `Claimant answers closely mirror the public description (${params.descriptionOverlapPercent}% word overlap), suggesting guessing rather than independent knowledge.`,
        metadata: { overlapPercent: params.descriptionOverlapPercent, itemId: params.itemId },
      });
    }

    // 4. Claims on Unrelated Categories in 24h
    const { data: recentClaims } = await supabaseAdmin
      .from('claims')
      .select('item:items(category_id)')
      .eq('claimant_id', params.claimantId)
      .gte('created_at', twentyFourHoursAgo);

    if (recentClaims && recentClaims.length >= 3) {
      const categoryIds = new Set(
        recentClaims.map((c: any) => c.item?.category_id).filter(Boolean)
      );
      if (params.itemCategoryId) categoryIds.add(params.itemCategoryId);

      if (categoryIds.size >= 3) {
        flags.push({
          user_id: params.claimantId,
          flag_type: 'unrelated_categories',
          severity: 'medium',
          reason: `Claimant submitted claims across ${categoryIds.size} completely different categories within 24 hours.`,
          metadata: { distinctCategoriesCount: categoryIds.size },
        });
      }
    }

    // 5. Opportunistic Lost Report Check:
    // Did claimant submit a matching lost report *after* the found item was posted?
    const { data: foundItem } = await supabaseAdmin
      .from('items')
      .select('created_at, title, category_id')
      .eq('id', params.itemId)
      .maybeSingle();

    if (foundItem) {
      const { data: lateLostItems } = await supabaseAdmin
        .from('items')
        .select('id, title, created_at')
        .eq('user_id', params.claimantId)
        .eq('type', 'lost')
        .eq('category_id', foundItem.category_id)
        .gt('created_at', foundItem.created_at)
        .limit(1);

      if (lateLostItems && lateLostItems.length > 0) {
        flags.push({
          user_id: params.claimantId,
          flag_type: 'opportunistic_report',
          severity: 'low',
          reason: `Claimant published a matching lost report ("${lateLostItems[0].title}") only AFTER the found item was posted.`,
          metadata: { foundItemId: params.itemId, lostItemId: lateLostItems[0].id },
        });
      }
    }

    // Save flags
    for (const flag of flags) {
      await saveFlagIfNotDuplicate(flag);
    }

    return flags;
  } catch (err) {
    console.warn('Error in evaluateClaimFraudRules:', err);
    return [];
  }
}

async function saveFlagIfNotDuplicate(flag: FraudFlagRecord) {
  try {
    const { data: existing } = await supabaseAdmin
      .from('user_flags')
      .select('id')
      .eq('user_id', flag.user_id)
      .eq('flag_type', flag.flag_type)
      .eq('status', 'pending')
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from('user_flags').insert({
        ...flag,
        status: 'pending',
      });
    }
  } catch (insertErr) {
    console.warn('Failed to insert user flag:', insertErr);
  }
}

/**
 * Searches for similar active reports to prevent duplicate submissions.
 */
export async function findSimilarOpenItems(params: {
  title: string;
  category_id?: string | null;
  type?: string;
  latitude?: number | null;
  longitude?: number | null;
  userId?: string | null;
}): Promise<any[]> {
  if (!isServerSupabaseConfigured || !params.title) return [];

  try {
    const stopWords = new Set(['the', 'and', 'with', 'for', 'lost', 'found', 'near', 'black', 'blue', 'item']);
    const tokens = params.title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    let query = supabaseAdmin
      .from('items')
      .select('id, title, type, status, category_id, location_city, date_occurred, primary_image_url')
      .neq('status', 'returned')
      .limit(10);

    if (params.category_id) {
      query = query.eq('category_id', params.category_id);
    }

    if (params.type) {
      query = query.eq('type', params.type);
    }

    const { data: items, error } = await query;
    if (error || !items) return [];

    const matches = items
      .map((item) => {
        const itemTitleTokens = item.title
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((w: string) => w.length > 2 && !stopWords.has(w));

        const commonTokens = tokens.filter((t) => itemTitleTokens.includes(t));
        return {
          ...item,
          sharedWordsCount: commonTokens.length,
          sharedWords: commonTokens,
        };
      })
      .filter((item) => item.sharedWordsCount >= 1)
      .sort((a, b) => b.sharedWordsCount - a.sharedWordsCount);

    return matches.slice(0, 3);
  } catch (err) {
    console.warn('Error checking duplicates:', err);
    return [];
  }
}
