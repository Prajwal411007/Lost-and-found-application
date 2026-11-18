import { MatchStrategy } from './MatchStrategy.js';
import { RuleBasedMatchStrategy } from './RuleBasedMatchStrategy.js';
import { supabaseAdmin, isServerSupabaseConfigured } from '../../config/supabase.js';

class MatchingService {
  private strategy: MatchStrategy;

  constructor(strategy?: MatchStrategy) {
    this.strategy = strategy || new RuleBasedMatchStrategy();
  }

  public setStrategy(strategy: MatchStrategy) {
    this.strategy = strategy;
  }

  public getStrategyName(): string {
    return this.strategy.name;
  }

  /**
   * Evaluates all candidates for a newly created or updated item and persists suggestions
   */
  public async computeMatchesForItem(itemId: string) {
    if (!isServerSupabaseConfigured) {
      console.warn('Cannot compute matches: Supabase server not configured.');
      return { matchesFound: 0 };
    }

    try {
      // 1. Fetch target item
      const { data: targetItem, error: fetchErr } = await supabaseAdmin
        .from('items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (fetchErr || !targetItem) {
        throw new Error(`Target item not found: ${itemId}`);
      }

      // Opposite type: lost looks for found, found looks for lost
      const oppositeType = targetItem.type === 'lost' ? 'found' : 'lost';

      // 2. Fetch active candidates of opposite type
      const { data: candidates, error: candidateErr } = await supabaseAdmin
        .from('items')
        .select('*')
        .eq('type', oppositeType)
        .eq('status', 'open')
        .neq('user_id', targetItem.user_id) // don't match against own items
        .limit(100);

      if (candidateErr || !candidates) {
        return { matchesFound: 0 };
      }

      let matchesCreated = 0;

      for (const candidate of candidates) {
        const lostItem = targetItem.type === 'lost' ? targetItem : candidate;
        const foundItem = targetItem.type === 'found' ? targetItem : candidate;

        const matchResult = this.strategy.computeMatch(lostItem, foundItem);

        // Only store matches above minimum threshold of 45%
        if (matchResult.totalScore >= 45) {
          const matchPayload = {
            lost_item_id: lostItem.id,
            found_item_id: foundItem.id,
            score: matchResult.totalScore,
            score_breakdown: matchResult.breakdown,
            status: 'suggested',
            notified: true,
          };

          const { error: upsertErr } = await supabaseAdmin
            .from('matches')
            .upsert(matchPayload, { onConflict: 'lost_item_id,found_item_id' });

          if (!upsertErr) {
            matchesCreated++;

            // Create notification for lost item owner
            await supabaseAdmin.from('notifications').insert({
              user_id: lostItem.user_id,
              type: 'match_found',
              title: `Potential ${matchResult.tier} Match Found (${matchResult.totalScore}%)`,
              message: `A found item "${foundItem.title}" strongly matches your lost "${lostItem.title}".`,
              link_url: `/dashboard?tab=matches`,
            });

            // Create notification for found item reporter
            await supabaseAdmin.from('notifications').insert({
              user_id: foundItem.user_id,
              type: 'match_found',
              title: `Potential Owner Identified (${matchResult.tier} Match)`,
              message: `Your found item "${foundItem.title}" may belong to someone looking for "${lostItem.title}".`,
              link_url: `/dashboard?tab=matches`,
            });
          }
        }
      }

      return { matchesFound: matchesCreated };
    } catch (error) {
      console.error('Error during match computation:', error);
      throw error;
    }
  }
}

export const matchingService = new MatchingService();

