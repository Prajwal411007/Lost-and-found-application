import { Router, Response } from 'express';
import * as z from 'zod';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { strictActionLimiter } from '../middleware/rateLimiter.js';
import { sendNotification } from '../services/notificationService.js';
import { checkUserFraudRules, evaluateClaimFraudRules } from '../services/fraudDetection.js';
import { computeVerificationMatch } from '../services/verificationMatch.js';
import { redactSensitiveData } from '../services/redaction.js';

export const claimsRouter = Router();

const createClaimSchema = z.object({
  item_id: z.string().uuid(),
  verification_answers: z.object({
    answers: z.record(z.string()).default({}),
    proof_description: z.string().min(5),
  }),
  proof_files: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
        file_type: z.string(),
        size: z.number().max(5 * 1024 * 1024),
      })
    )
    .optional()
    .default([]),
});

const HIGH_VALUE_CATEGORY_KEYWORDS = [
  'phone',
  'laptop',
  'tablet',
  'wallet',
  'card',
  'jewelry',
  'watch',
  'electronic',
];

// POST /api/claims - Submit an ownership claim with full hardening
claimsRouter.post(
  '/',
  requireAuth,
  strictActionLimiter,
  validateBody(createClaimSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const claimantId = req.user!.id;
      const { item_id, verification_answers, proof_files } = req.body;

      if (!isServerSupabaseConfigured) {
        return res.status(503).json({ error: 'Database service unavailable' });
      }

      // 1. Verify item exists and claimant is NOT the reporter
      const { data: item, error: itemErr } = await supabaseAdmin
        .from('items')
        .select('*, category:categories(name)')
        .eq('id', item_id)
        .single();

      if (itemErr || !item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      if (item.user_id === claimantId) {
        return res.status(400).json({ error: 'You cannot submit an ownership claim on your own listing.' });
      }

      if (item.status === 'returned') {
        return res.status(400).json({ error: 'This item has already been marked as returned to its owner.' });
      }

      // 2. Check for active temporary claim lock
      const { data: lock } = await supabaseAdmin
        .from('user_claim_locks')
        .select('*')
        .eq('user_id', claimantId)
        .gt('locked_until', new Date().toISOString())
        .maybeSingle();

      if (lock) {
        return res.status(403).json({
          error: `Claim submission is temporarily locked until ${new Date(lock.locked_until).toLocaleDateString()}: ${lock.reason}`,
          locked_until: lock.locked_until,
        });
      }

      // 3. Daily & Weekly Rejection Limits across all items
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { count: rejectedToday } = await supabaseAdmin
        .from('claims')
        .select('id', { count: 'exact', head: true })
        .eq('claimant_id', claimantId)
        .eq('status', 'rejected')
        .gte('updated_at', oneDayAgo);

      if (rejectedToday && rejectedToday >= 3) {
        const lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await supabaseAdmin.from('user_claim_locks').upsert({
          user_id: claimantId,
          locked_until: lockUntil,
          reason: 'Daily limit exceeded: Maximum 3 rejected claims per 24 hours.',
        });
        return res.status(429).json({
          error: 'Daily claim limit reached (maximum 3 rejected claims per day). Claim submission locked for 24 hours.',
          locked_until: lockUntil,
        });
      }

      const { count: rejectedThisWeek } = await supabaseAdmin
        .from('claims')
        .select('id', { count: 'exact', head: true })
        .eq('claimant_id', claimantId)
        .eq('status', 'rejected')
        .gte('updated_at', oneWeekAgo);

      if (rejectedThisWeek && rejectedThisWeek >= 10) {
        const lockUntil = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        await supabaseAdmin.from('user_claim_locks').upsert({
          user_id: claimantId,
          locked_until: lockUntil,
          reason: 'Weekly limit exceeded: Maximum 10 rejected claims per week.',
        });
        return res.status(429).json({
          error: 'Weekly claim limit reached (maximum 10 rejected claims per week). Claim submission locked for 48 hours.',
          locked_until: lockUntil,
        });
      }

      // 4. One active claim per user per item
      const { data: activeClaim } = await supabaseAdmin
        .from('claims')
        .select('id, status')
        .eq('item_id', item_id)
        .eq('claimant_id', claimantId)
        .in('status', ['pending', 'approved', 'handover_pending', 'on_hold'])
        .maybeSingle();

      if (activeClaim) {
        return res.status(400).json({ error: 'You already have an active claim under review for this item.' });
      }

      // 5. Check previous attempts for this specific item (max 2 attempts, 24h cooldown on rejection)
      const { data: prevItemClaims } = await supabaseAdmin
        .from('claims')
        .select('id, status, updated_at, attempt_number')
        .eq('item_id', item_id)
        .eq('claimant_id', claimantId)
        .order('updated_at', { ascending: false });

      const attemptCount = prevItemClaims ? prevItemClaims.length : 0;
      if (attemptCount >= 2) {
        return res.status(400).json({
          error: 'Maximum claim attempts reached for this item (maximum 2 attempts per user).',
        });
      }

      const latestRejected = prevItemClaims?.find((c) => c.status === 'rejected');
      if (latestRejected && latestRejected.updated_at) {
        const msSinceRejection = Date.now() - new Date(latestRejected.updated_at).getTime();
        const cooldownMs = 24 * 60 * 60 * 1000;
        if (msSinceRejection < cooldownMs) {
          const hoursRemaining = Math.ceil((cooldownMs - msSinceRejection) / (60 * 60 * 1000));
          return res.status(400).json({
            error: `Claim cooldown active: Please wait 24 hours after a rejection before submitting another claim for this item (${hoursRemaining} hours remaining).`,
            hoursRemaining,
          });
        }
      }

      // 6. High-value category age restrictions (accounts under 24 hours old cannot claim)
      const catName = (item.category?.name || '').toLowerCase();
      const isHighValue = HIGH_VALUE_CATEGORY_KEYWORDS.some((kw) => catName.includes(kw));

      if (isHighValue) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('created_at, role')
          .eq('id', claimantId)
          .single();

        if (profile?.created_at && profile.role !== 'admin') {
          const accountAgeHours = (Date.now() - new Date(profile.created_at).getTime()) / (3600 * 1000);
          if (accountAgeHours < 24) {
            return res.status(403).json({
              error:
                'Newly created accounts (under 24 hours old) cannot submit claims on high-value categories (phones, laptops, wallets, jewellery). Please wait until your account reaches 24 hours.',
            });
          }
        }
      }

      // 7. Fetch Finder's Private Proof Details to compute match score
      const { data: privateDetails } = await supabaseAdmin
        .from('item_private_details')
        .select('detail_type, detail_label, detail_value')
        .eq('item_id', item_id);

      const allAnswersMap: Record<string, string> = {
        ...(verification_answers.answers || {}),
        proof_description: verification_answers.proof_description || '',
      };

      // Mask sensitive contact data in answers before storage
      const sanitizedAnswers: Record<string, string> = {};
      for (const [k, v] of Object.entries(verification_answers.answers || {})) {
        sanitizedAnswers[k] = redactSensitiveData(String(v));
      }

      const matchResult = computeVerificationMatch(
        privateDetails || [],
        allAnswersMap,
        item.description || ''
      );

      // 8. Insert new claim
      const { data: newClaim, error: insertErr } = await supabaseAdmin
        .from('claims')
        .insert({
          item_id,
          claimant_id: claimantId,
          status: 'pending',
          verification_answers: {
            answers: sanitizedAnswers,
            proof_description: redactSensitiveData(verification_answers.proof_description),
            submitted_at: new Date().toISOString(),
          },
          proof_files: proof_files || [],
          match_score: matchResult.score,
          match_explanation: matchResult.explanation,
          attempt_number: attemptCount + 1,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // 9. Run background fraud checks asynchronously (never blocking user)
      const claimantAllText = Object.values(allAnswersMap).join(' ');
      evaluateClaimFraudRules({
        claimantId,
        itemId: item_id,
        claimAnswersText: claimantAllText,
        publicDescription: item.description,
        itemCategoryId: item.category_id,
        descriptionOverlapPercent: matchResult.descriptionOverlapPercent,
      }).catch((e) => console.warn('Claim fraud evaluation notice:', e));

      checkUserFraudRules(claimantId).catch((e) => console.warn('User fraud check notice:', e));

      // 10. Notify finder
      await sendNotification({
        userId: item.user_id,
        type: 'claim_received',
        title: 'New Ownership Claim Submitted',
        message: `A community member has submitted an ownership claim with answers for your found item "${item.title}".`,
        linkUrl: `/dashboard?tab=claims`,
      });

      // Never leak match_explanation or internal scores to claimant
      res.status(201).json({
        claim: {
          ...newClaim,
          match_score: undefined,
          match_explanation: undefined,
        },
      });
    } catch (err: any) {
      console.error('Error submitting claim:', err);
      res.status(500).json({ error: err.message || 'Failed to submit claim' });
    }
  }
);

// GET /api/claims - Get claims for current user (claims submitted by me & received on my found items)
claimsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({ submittedClaims: [], receivedClaims: [] });
  }

  try {
    const userId = req.user!.id;

    // Claims submitted by user (strip match_explanation so claimant never sees verification reasoning)
    const { data: submittedClaims } = await supabaseAdmin
      .from('claims')
      .select('*, item:items(*, category:categories(*))')
      .eq('claimant_id', userId)
      .order('created_at', { ascending: false });

    const safeSubmitted = (submittedClaims || []).map((c) => ({
      ...c,
      match_score: undefined,
      match_explanation: undefined,
    }));

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
        .select('*, claimant:profiles(id, full_name, avatar_url, created_at), item:items(*, category:categories(*))')
        .in('item_id', userItemIds)
        .order('created_at', { ascending: false });

      // Aggregate claimant account age and history for finder review
      if (received && received.length > 0) {
        receivedClaims = await Promise.all(
          received.map(async (c) => {
            const claimantCreated = c.claimant?.created_at ? new Date(c.claimant.created_at).getTime() : Date.now();
            const accountAgeDays = Math.floor((Date.now() - claimantCreated) / (24 * 3600 * 1000));

            const { count: successfulReturns } = await supabaseAdmin
              .from('claims')
              .select('id', { count: 'exact', head: true })
              .eq('claimant_id', c.claimant_id)
              .in('status', ['approved', 'resolved']);

            const { count: totalClaims } = await supabaseAdmin
              .from('claims')
              .select('id', { count: 'exact', head: true })
              .eq('claimant_id', c.claimant_id);

            return {
              ...c,
              claimant_aggregate: {
                account_age_days: accountAgeDays,
                successful_returns: successfulReturns || 0,
                total_claims: totalClaims || 0,
              },
            };
          })
        );
      }
    }

    res.json({
      submittedClaims: safeSubmitted,
      receivedClaims,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch claims' });
  }
});

// GET /api/claims/item/:itemId - Side-by-side claim review for item finder
claimsRouter.get('/item/:itemId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({ claims: [], privateDetails: [] });
  }

  try {
    const { itemId } = req.params;
    const userId = req.user!.id;

    // Check caller is finder or admin
    const { data: item } = await supabaseAdmin
      .from('items')
      .select('id, user_id, title, status')
      .eq('id', itemId)
      .maybeSingle();

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const isFinder = item.user_id === userId;
    const isAdmin = profile?.role === 'admin' || profile?.role === 'moderator';

    if (!isFinder && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Only the finder or moderators can review item claims' });
    }

    // Fetch all claims for item
    const { data: claims } = await supabaseAdmin
      .from('claims')
      .select('*, claimant:profiles(id, full_name, avatar_url, created_at)')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });

    // Fetch finder's hidden proof details
    const { data: privateDetails } = await supabaseAdmin
      .from('item_private_details')
      .select('*')
      .eq('item_id', itemId);

    // Aggregate claimant statistics
    const claimsWithStats = await Promise.all(
      (claims || []).map(async (c) => {
        const claimantCreated = c.claimant?.created_at ? new Date(c.claimant.created_at).getTime() : Date.now();
        const accountAgeDays = Math.floor((Date.now() - claimantCreated) / (24 * 3600 * 1000));

        const { count: successfulReturns } = await supabaseAdmin
          .from('claims')
          .select('id', { count: 'exact', head: true })
          .eq('claimant_id', c.claimant_id)
          .in('status', ['approved', 'resolved']);

        return {
          ...c,
          claimant_aggregate: {
            account_age_days: accountAgeDays,
            successful_returns: successfulReturns || 0,
          },
        };
      })
    );

    res.json({
      item,
      claims: claimsWithStats,
      privateDetails: privateDetails || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch item claims' });
  }
});

const updateClaimStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'on_hold']),
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

      const { data: claim, error: fetchErr } = await supabaseAdmin
        .from('claims')
        .select('*, item:items(user_id, title, status)')
        .eq('id', id)
        .single();

      if (fetchErr || !claim) {
        return res.status(404).json({ error: 'Claim not found' });
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      const isAdmin = profile?.role === 'admin' || profile?.role === 'moderator';
      const isFinder = claim.item?.user_id === userId;

      if (!isFinder && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Only the finder can approve or reject claims' });
      }

      // Update current claim
      const { data: updatedClaim, error: updateErr } = await supabaseAdmin
        .from('claims')
        .update({
          status: status === 'approved' ? 'handover_pending' : status,
          finder_notes: finder_notes || null,
          resolved_at: status !== 'on_hold' ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // If approved:
      // 1. Put other pending claims for this item ON HOLD
      // 2. Set item status to pending_claim
      if (status === 'approved') {
        await supabaseAdmin
          .from('claims')
          .update({ status: 'on_hold' })
          .eq('item_id', claim.item_id)
          .neq('id', id)
          .eq('status', 'pending');

        await supabaseAdmin
          .from('items')
          .update({ status: 'pending_claim' })
          .eq('id', claim.item_id);

        // Notify claimant
        await sendNotification({
          userId: claim.claimant_id,
          type: 'claim_decision',
          title: 'Claim Approved — Safe Handover Ready',
          message: `Your ownership claim for "${claim.item?.title}" was approved by the finder! Coordinate safe return at a public place or drop-off desk, then confirm handover.`,
          linkUrl: `/dashboard?tab=claims`,
        });
      } else if (status === 'rejected') {
        // Asynchronously check repeated rejection rules
        checkUserFraudRules(claim.claimant_id).catch(() => {});

        // Neutral notification to claimant (never reveal which detail was wrong)
        await sendNotification({
          userId: claim.claimant_id,
          type: 'claim_decision',
          title: 'Claim Update',
          message: `Your ownership claim for "${claim.item?.title}" was not approved by the finder.`,
          linkUrl: `/dashboard?tab=claims`,
        });
      }

      res.json({ claim: updatedClaim });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update claim status' });
    }
  }
);

// POST /api/claims/:id/handover-confirm - Mutual safe handover confirmation
const handoverConfirmSchema = z.object({
  handover_location_type: z.enum(['public_place', 'drop_off_desk']).optional(),
  handover_notes: z.string().optional(),
});

claimsRouter.post(
  '/:id/handover-confirm',
  requireAuth,
  validateBody(handoverConfirmSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { handover_location_type, handover_notes } = req.body;
      const userId = req.user!.id;

      const { data: claim, error: fetchErr } = await supabaseAdmin
        .from('claims')
        .select('*, item:items(user_id, title)')
        .eq('id', id)
        .single();

      if (fetchErr || !claim) {
        return res.status(404).json({ error: 'Claim not found' });
      }

      const isFinder = claim.item?.user_id === userId;
      const isClaimant = claim.claimant_id === userId;

      if (!isFinder && !isClaimant) {
        return res.status(403).json({ error: 'Forbidden: Only the finder or claimant can confirm handover' });
      }

      const updates: any = {};
      if (handover_location_type) updates.handover_location_type = handover_location_type;
      if (handover_notes) updates.handover_notes = handover_notes;

      let finderConfirmed = claim.finder_confirmed_handover;
      let claimantConfirmed = claim.claimant_confirmed_handover;

      if (isFinder) {
        updates.finder_confirmed_handover = true;
        finderConfirmed = true;
      }
      if (isClaimant) {
        updates.claimant_confirmed_handover = true;
        claimantConfirmed = true;
      }

      const bothConfirmed = finderConfirmed && claimantConfirmed;

      if (bothConfirmed) {
        updates.status = 'resolved';
        updates.handover_confirmed_at = new Date().toISOString();

        // Mark item as returned
        await supabaseAdmin
          .from('items')
          .update({ status: 'returned' })
          .eq('id', claim.item_id);

        // Notify both parties of successful return
        await sendNotification({
          userId: claim.claimant_id,
          type: 'item_returned',
          title: 'Handover Completed & Item Returned!',
          message: `Both parties confirmed handover for "${claim.item?.title}". Thank you for keeping the community safe! Please leave feedback.`,
          linkUrl: `/items/${claim.item_id}`,
        });

        await sendNotification({
          userId: claim.item.user_id,
          type: 'item_returned',
          title: 'Handover Completed & Item Returned!',
          message: `Both parties confirmed handover for "${claim.item?.title}". Thank you for your honesty!`,
          linkUrl: `/items/${claim.item_id}`,
        });
      }

      const { data: updatedClaim, error: updateErr } = await supabaseAdmin
        .from('claims')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      res.json({
        claim: updatedClaim,
        bothConfirmed,
        message: bothConfirmed
          ? 'Handover fully confirmed by both parties. Item marked as returned!'
          : 'Handover confirmation recorded. Waiting for counter-party confirmation.',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to confirm handover' });
    }
  }
);

// POST /api/claims/:id/dispute - Report a problem or dispute with a claim
const disputeClaimSchema = z.object({
  dispute_reason: z.string().min(5, 'Please provide reason for dispute'),
});

claimsRouter.post(
  '/:id/dispute',
  requireAuth,
  validateBody(disputeClaimSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { dispute_reason } = req.body;
      const userId = req.user!.id;

      const { data: claim, error: fetchErr } = await supabaseAdmin
        .from('claims')
        .select('*, item:items(user_id, title)')
        .eq('id', id)
        .single();

      if (fetchErr || !claim) {
        return res.status(404).json({ error: 'Claim not found' });
      }

      const isFinder = claim.item?.user_id === userId;
      const isClaimant = claim.claimant_id === userId;

      if (!isFinder && !isClaimant) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Update claim to disputed
      const { data: updatedClaim, error: updateErr } = await supabaseAdmin
        .from('claims')
        .update({
          status: 'disputed',
          is_disputed: true,
          dispute_reason,
          disputed_by: userId,
          disputed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Create high-severity flag in admin queue
      await supabaseAdmin.from('user_flags').insert({
        user_id: isFinder ? claim.claimant_id : claim.item?.user_id,
        flag_type: 'suspicious_activity',
        severity: 'high',
        reason: `Dispute opened on claim for "${claim.item?.title}": ${dispute_reason}`,
        metadata: { claimId: id, itemId: claim.item_id, disputedBy: userId },
        status: 'pending',
      });

      res.json({
        claim: updatedClaim,
        message: 'Dispute submitted. Status frozen and platform moderators notified.',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to submit dispute' });
    }
  }
);

// POST /api/claims/:id/report-suspicious - Finder reports claim as suspicious
const suspiciousReportSchema = z.object({
  reason: z.string().min(5),
});

claimsRouter.post(
  '/:id/report-suspicious',
  requireAuth,
  validateBody(suspiciousReportSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user!.id;

      const { data: claim } = await supabaseAdmin
        .from('claims')
        .select('*, item:items(user_id, title)')
        .eq('id', id)
        .single();

      if (!claim || claim.item?.user_id !== userId) {
        return res.status(403).json({ error: 'Forbidden: Only the finder can report a claim as suspicious' });
      }

      await supabaseAdmin
        .from('claims')
        .update({
          is_suspicious: true,
          suspicious_reason: reason,
          suspicious_reported_by: userId,
        })
        .eq('id', id);

      // Add to admin fraud flags
      await supabaseAdmin.from('user_flags').insert({
        user_id: claim.claimant_id,
        flag_type: 'suspicious_activity',
        severity: 'high',
        reason: `Finder reported claim as suspicious for "${claim.item?.title}": ${reason}`,
        metadata: { claimId: id, itemId: claim.item_id, reportedByFinder: userId },
        status: 'pending',
      });

      res.json({ success: true, message: 'Claim flagged for moderator review.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to report claim' });
    }
  }
);
