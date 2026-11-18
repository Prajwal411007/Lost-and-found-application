import { Router, Response } from 'express';
import * as z from 'zod';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { strictActionLimiter } from '../middleware/rateLimiter.js';
import { sendNotification } from '../services/notificationService.js';

export const claimsRouter = Router();

const createClaimSchema = z.object({
  item_id: z.string().uuid(),
  verification_answers: z.object({
    answers: z.record(z.string()).optional(),
    proof_description: z.string().min(5),
  }),
});

// POST /api/claims - Submit an ownership claim
claimsRouter.post(
  '/',
  requireAuth,
  strictActionLimiter,
  validateBody(createClaimSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const claimantId = req.user!.id;
      const { item_id, verification_answers } = req.body;

      // 1. Verify item exists and claimant is NOT the reporter
      const { data: item, error: itemErr } = await supabaseAdmin
        .from('items')
        .select('*')
        .eq('id', item_id)
        .single();

      if (itemErr || !item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      if (item.user_id === claimantId) {
        return res.status(400).json({ error: 'You cannot submit a claim on your own listing' });
      }

      // 2. Insert claim
      const { data: claim, error: claimErr } = await supabaseAdmin
        .from('claims')
        .insert({
          item_id,
          claimant_id: claimantId,
          status: 'pending',
          verification_answers: {
            ...verification_answers,
            submitted_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (claimErr) throw claimErr;

      // 3. Notify finder
      await sendNotification({
        userId: item.user_id,
        type: 'claim_received',
        title: 'New Ownership Claim Submitted',
        message: `A community member has submitted an ownership claim for your found item "${item.title}".`,
        linkUrl: `/dashboard?tab=claims`,
      });

      res.status(201).json({ claim });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to submit claim' });
    }
  }
);

// GET /api/claims - Get claims for current user (received & submitted)
claimsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({ submittedClaims: [], receivedClaims: [] });
  }

  try {
    const userId = req.user!.id;

    // Claims submitted by user
    const { data: submittedClaims } = await supabaseAdmin
      .from('claims')
      .select('*, item:items(*, category:categories(*))')
      .eq('claimant_id', userId)
      .order('created_at', { ascending: false });

    // Claims received on user's items
    const { data: userItems } = await supabaseAdmin
      .from('items')
      .select('id')
      .eq('user_id', userId);

    const userItemIds = (userItems || []).map((i) => i.id);

    let receivedClaims: any[] = [];
    if (userItemIds.length > 0) {
      const { data: received } = await supabaseAdmin
        .from('claims')
        .select('*, claimant:profiles(id, full_name, avatar_url), item:items(*, category:categories(*))')
        .in('item_id', userItemIds)
        .order('created_at', { ascending: false });

      receivedClaims = received || [];
    }

    res.json({
      submittedClaims: submittedClaims || [],
      receivedClaims,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch claims' });
  }
});

const updateClaimStatusSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  finder_notes: z.string().optional(),
});

// PATCH /api/claims/:id/status - Approve or reject claim (finder only)
claimsRouter.patch(
  '/:id/status',
  requireAuth,
  validateBody(updateClaimStatusSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, finder_notes } = req.body;
      const userId = req.user!.id;

      // Fetch claim with item
      const { data: claim, error: fetchErr } = await supabaseAdmin
        .from('claims')
        .select('*, item:items(user_id, title)')
        .eq('id', id)
        .single();

      if (fetchErr || !claim) {
        return res.status(404).json({ error: 'Claim not found' });
      }

      // Check authorization (must be item owner or admin)
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      const isAdmin = profile?.role === 'admin';
      const isFinder = claim.item?.user_id === userId;

      if (!isFinder && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Only the finder can approve or reject claims' });
      }

      // Update claim
      const { data: updatedClaim, error: updateErr } = await supabaseAdmin
        .from('claims')
        .update({
          status,
          finder_notes: finder_notes || null,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // If approved, update item status to pending_claim
      if (status === 'approved') {
        await supabaseAdmin
          .from('items')
          .update({ status: 'pending_claim' })
          .eq('id', claim.item_id);
      }

      // Notify claimant
      await sendNotification({
        userId: claim.claimant_id,
        type: 'claim_decision',
        title: `Claim ${status === 'approved' ? 'Approved!' : 'Declined'}`,
        message:
          status === 'approved'
            ? `Your ownership claim for "${claim.item?.title}" was APPROVED! You can now coordinate safe return in messaging.`
            : `Your ownership claim for "${claim.item?.title}" was not approved by the finder.`,
        linkUrl: `/dashboard?tab=claims`,
      });

      res.json({ claim: updatedClaim });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update claim status' });
    }
  }
);

