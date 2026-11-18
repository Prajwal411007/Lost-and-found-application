import { Router, Response } from 'express';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { matchingService } from '../services/matching/matchingService.js';

export const matchesRouter = Router();

// POST /api/matches/compute/:itemId - Compute matches for an item
matchesRouter.post('/compute/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const result = await matchingService.computeMatchesForItem(itemId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to compute matches' });
  }
});

// GET /api/matches - Get matches for authenticated user
matchesRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({ matches: [] });
  }

  try {
    const userId = req.user!.id;

    // Matches where user is owner of either the lost or found item
    const { data: matches, error } = await supabaseAdmin
      .from('matches')
      .select(`
        *,
        lost_item:items!matches_lost_item_id_fkey(*, category:categories(*)),
        found_item:items!matches_found_item_id_fkey(*, category:categories(*))
      `)
      .order('score', { ascending: false });

    if (error) throw error;

    // Filter to matches where user owns one of the items
    const userMatches = (matches || []).filter(
      (m: any) => m.lost_item?.user_id === userId || m.found_item?.user_id === userId
    );

    res.json({ matches: userMatches });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch matches' });
  }
});

// PATCH /api/matches/:id/dismiss - Dismiss a match suggestion
matchesRouter.patch('/:id/dismiss', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('matches')
      .update({ status: 'dismissed' })
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: 'Match dismissed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to dismiss match' });
  }
});

