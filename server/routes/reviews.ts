import { Router, Request, Response } from 'express';
import * as z from 'zod';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { validateBody } from '../middleware/validate.js';
import { redactSensitiveData } from '../services/redaction.js';

export const reviewsRouter = Router();

const createReviewSchema = z.object({
  item_id: z.string().uuid(),
  reviewee_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  note: z.string().max(300).optional().nullable(),
});

const moderateReviewSchema = z.object({
  is_hidden: z.boolean(),
});

// GET /api/reviews/user/:userId - Community ratings and thank-you notes for public profile
reviewsRouter.get('/user/:userId', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({ reviews: [], averageRating: 5.0, totalReviews: 0 });
  }

  try {
    const { userId } = req.params;

    const { data: reviews, error } = await supabaseAdmin
      .from('item_reviews')
      .select('*, reviewer:profiles!item_reviews_reviewer_id_fkey(id, full_name, avatar_url)')
      .eq('reviewee_id', userId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false });

    if (error) {
      return res.json({ reviews: [], averageRating: 0, totalReviews: 0 });
    }

    const reviewList = reviews || [];
    const totalReviews = reviewList.length;
    let avg = 0;
    if (totalReviews > 0) {
      const sum = reviewList.reduce((acc, r) => acc + Number(r.rating || 0), 0);
      avg = Math.round((sum / totalReviews) * 10) / 10;
    }

    res.json({
      reviews: reviewList,
      averageRating: avg,
      totalReviews,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch reviews' });
  }
});

// GET /api/reviews/item/:itemId - Check if current item has reviews
reviewsRouter.get('/item/:itemId', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({ reviews: [] });
  }

  try {
    const { itemId } = req.params;
    const { data: reviews } = await supabaseAdmin
      .from('item_reviews')
      .select('*, reviewer:profiles!item_reviews_reviewer_id_fkey(id, full_name)')
      .eq('item_id', itemId)
      .eq('is_hidden', false);

    res.json({ reviews: reviews || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch item reviews' });
  }
});

// POST /api/reviews - Submit a thank-you note and 1-5 star rating
reviewsRouter.post(
  '/',
  requireAuth,
  validateBody(createReviewSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isServerSupabaseConfigured) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    try {
      const reviewerId = req.user!.id;
      const { item_id, reviewee_id, rating, note } = req.body;

      if (reviewerId === reviewee_id) {
        return res.status(400).json({ error: 'Self-reviews are not permitted' });
      }

      // Verify item exists
      const { data: item, error: itemErr } = await supabaseAdmin
        .from('items')
        .select('id, status, user_id')
        .eq('id', item_id)
        .maybeSingle();

      if (itemErr || !item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // Check if review already exists from this user on this item
      const { data: existing } = await supabaseAdmin
        .from('item_reviews')
        .select('id')
        .eq('item_id', item_id)
        .eq('reviewer_id', reviewerId)
        .maybeSingle();

      if (existing) {
        return res.status(400).json({ error: 'You have already submitted a review for this item' });
      }

      // Mask sensitive contact data from note
      const safeNote = note ? redactSensitiveData(note.trim().slice(0, 300)) : null;

      const { data: review, error: insertErr } = await supabaseAdmin
        .from('item_reviews')
        .insert({
          item_id,
          reviewer_id: reviewerId,
          reviewee_id,
          rating,
          note: safeNote,
          is_hidden: false,
        })
        .select('*, reviewer:profiles!item_reviews_reviewer_id_fkey(id, full_name)')
        .single();

      if (insertErr) throw insertErr;

      res.status(201).json({ review });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to submit thank-you review' });
    }
  }
);

// PATCH /api/reviews/:id/moderate - Admin moderation (hide/unhide)
reviewsRouter.patch(
  '/:id/moderate',
  requireAuth,
  requireAdmin,
  validateBody(moderateReviewSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isServerSupabaseConfigured) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    try {
      const { id } = req.params;
      const { is_hidden } = req.body;

      const { data, error } = await supabaseAdmin
        .from('item_reviews')
        .update({ is_hidden, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Review not found or update failed' });
      }

      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to moderate review' });
    }
  }
);
