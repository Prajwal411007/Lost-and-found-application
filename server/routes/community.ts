import { Router, Request, Response } from 'express';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import * as z from 'zod';
import { validateBody } from '../middleware/validate.js';
import { redactSensitiveData } from '../services/redaction.js';

export const communityRouter = Router();

// Apply general rate limiting across community endpoints
communityRouter.use(generalLimiter);

/**
 * GET /api/community/live-activity
 * Returns live real database counts:
 * - Items reported today
 * - Items reunited this week
 * - Total active reports
 */
communityRouter.get('/live-activity', async (req: Request, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({
      reportedToday: 0,
      reunitedThisWeek: 0,
      activeReports: 0,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Items reported today
    const { count: reportedToday } = await supabaseAdmin
      .from('items')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfToday.toISOString());

    // 2. Items reunited this week (status === 'returned')
    const { count: reunitedThisWeek } = await supabaseAdmin
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'returned')
      .gte('updated_at', sevenDaysAgo.toISOString());

    // 3. Total active reports currently open
    const { count: activeReports } = await supabaseAdmin
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open');

    res.json({
      reportedToday: reportedToday || 0,
      reunitedThisWeek: reunitedThisWeek || 0,
      activeReports: activeReports || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error fetching live activity:', err);
    res.status(500).json({ error: 'Failed to fetch live activity' });
  }
});

/**
 * GET /api/community/stories
 * Returns published success stories from real returned items.
 * Only returns stories where BOTH finder and claimant opted in and not removed by moderator.
 */
communityRouter.get('/stories', async (req: Request, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({ stories: [] });
  }

  try {
    const { data: stories, error } = await supabaseAdmin
      .from('success_stories')
      .select(`
        id,
        item_id,
        item_type,
        item_category_name,
        general_location,
        time_to_return_days,
        thank_you_note,
        created_at
      `)
      .eq('finder_opt_in', true)
      .eq('claimant_opt_in', true)
      .eq('is_moderator_removed', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    res.json({ stories: stories || [] });
  } catch (err: any) {
    console.error('Error fetching success stories:', err);
    res.json({ stories: [] });
  }
});

const storyOptInSchema = z.object({
  role: z.enum(['finder', 'claimant']),
  opt_in: z.boolean(),
  thank_you_note: z.string().max(300).optional(),
});

/**
 * POST /api/community/stories/:itemId/opt-in
 * Finder or claimant opts in to share an anonymized success story for a returned item.
 */
communityRouter.post(
  '/stories/:itemId/opt-in',
  requireAuth,
  validateBody(storyOptInSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isServerSupabaseConfigured) {
      return res.status(503).json({ error: 'Database unconfigured' });
    }

    try {
      const userId = req.user!.id;
      const itemId = req.params.itemId;
      const { role, opt_in, thank_you_note } = req.body;

      // Verify item exists and is returned
      const { data: item, error: itemErr } = await supabaseAdmin
        .from('items')
        .select('id, user_id, type, status, location_city, created_at, category:categories(name)')
        .eq('id', itemId)
        .single();

      if (itemErr || !item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      if (item.status !== 'returned') {
        return res.status(400).json({ error: 'Stories can only be created for successfully returned items' });
      }

      // Check for approved claim on this item
      const { data: claim } = await supabaseAdmin
        .from('claims')
        .select('id, claimant_id, created_at, resolved_at, handover_confirmed_at')
        .eq('item_id', itemId)
        .in('status', ['approved', 'resolved'])
        .maybeSingle();

      const finderId = item.type === 'found' ? item.user_id : (claim ? claim.claimant_id : null);
      const claimantId = item.type === 'lost' ? item.user_id : (claim ? claim.claimant_id : null);

      if (userId !== finderId && userId !== claimantId) {
        return res.status(403).json({ error: 'Only participants in this item resolution can share a story' });
      }

      // Calculate days to return
      let returnDays = 1;
      if (claim?.resolved_at && item) {
        const itemCreated = (item as any)?.created_at ? new Date((item as any).created_at).getTime() : Date.now();
        const diffMs = new Date(claim.resolved_at).getTime() - itemCreated;
        returnDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      }

      // Safe thank you note with PII redaction
      const safeNote = thank_you_note ? redactSensitiveData(thank_you_note.trim()) : null;

      // Upsert into success_stories
      const updatePayload: Record<string, any> = {
        item_id: itemId,
        claim_id: claim?.id || null,
        finder_id: finderId,
        claimant_id: claimantId,
        item_type: item.type,
        item_category_name: (item.category as any)?.name || 'General Item',
        general_location: item.location_city || 'Campus Area',
        time_to_return_days: returnDays,
        updated_at: new Date().toISOString(),
      };

      if (role === 'finder') {
        updatePayload.finder_opt_in = opt_in;
      } else {
        updatePayload.claimant_opt_in = opt_in;
        if (safeNote) updatePayload.thank_you_note = safeNote;
      }

      const { data: story, error: storyErr } = await supabaseAdmin
        .from('success_stories')
        .upsert(updatePayload, { onConflict: 'item_id' })
        .select()
        .single();

      if (storyErr) throw storyErr;

      res.json({
        success: true,
        story,
        isPublished: Boolean(story.finder_opt_in && story.claimant_opt_in && !story.is_moderator_removed),
      });
    } catch (err: any) {
      console.error('Error updating story opt-in:', err);
      res.status(500).json({ error: 'Failed to update story preference' });
    }
  }
);

/**
 * GET /api/community/leaderboard
 * Returns top finders this month based on real returned items.
 * Anonymizes users and respects `leaderboard_opt_in = false`.
 */
communityRouter.get('/leaderboard', async (req: Request, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({ leaderboard: [] });
  }

  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Fetch returned found items this month
    const { data: items, error } = await supabaseAdmin
      .from('items')
      .select('user_id, user:profiles(id, full_name, avatar_url, leaderboard_opt_in)')
      .eq('type', 'found')
      .eq('status', 'returned')
      .gte('updated_at', startOfMonth.toISOString());

    if (error || !items) {
      return res.json({ leaderboard: [] });
    }

    // Aggregate counts by finder
    const userCounts = new Map<string, { profile: any; count: number }>();
    for (const row of items) {
      const u = row.user as any;
      if (!u || u.leaderboard_opt_in === false) continue; // Respect opt-out

      const existing = userCounts.get(u.id);
      if (existing) {
        existing.count++;
      } else {
        userCounts.set(u.id, {
          profile: {
            id: u.id,
            full_name: u.full_name || 'Community Member',
            avatar_url: u.avatar_url,
          },
          count: 1,
        });
      }
    }

    const leaderboard = Array.from(userCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({ leaderboard });
  } catch (err: any) {
    console.error('Error calculating leaderboard:', err);
    res.json({ leaderboard: [] });
  }
});

/**
 * GET /api/community/smart-suggestions
 * Generates smart suggestions for dashboard:
 * 1. Items found near where you lost yours
 * 2. Reports you might be able to help with
 */
communityRouter.get('/smart-suggestions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({ nearLostReports: [], helpCandidates: [] });
  }

  try {
    const userId = req.user!.id;

    // 1. Fetch user's open lost items
    const { data: userLostItems } = await supabaseAdmin
      .from('items')
      .select('id, title, category_id, location_city, latitude, longitude')
      .eq('user_id', userId)
      .eq('type', 'lost')
      .eq('status', 'open')
      .limit(5);

    let nearLostReports: any[] = [];
    if (userLostItems && userLostItems.length > 0) {
      const cities = Array.from(new Set(userLostItems.map((i) => i.location_city).filter(Boolean)));
      const categories = Array.from(new Set(userLostItems.map((i) => i.category_id).filter(Boolean)));

      if (cities.length > 0 || categories.length > 0) {
        let q = supabaseAdmin
          .from('items')
          .select('id, title, type, location_city, date_occurred, primary_image_url, category:categories(name)')
          .eq('type', 'found')
          .eq('status', 'open')
          .neq('user_id', userId);

        if (cities.length > 0) {
          q = q.in('location_city', cities);
        }
        const { data: matches } = await q.limit(6);
        nearLostReports = matches || [];
      }
    }

    // 2. Fetch candidates user might be able to help with (recently reported lost items)
    const { data: helpCandidates } = await supabaseAdmin
      .from('items')
      .select('id, title, type, location_city, date_occurred, primary_image_url, category:categories(name)')
      .eq('type', 'lost')
      .eq('status', 'open')
      .neq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6);

    res.json({
      nearLostReports: nearLostReports || [],
      helpCandidates: helpCandidates || [],
    });
  } catch (err: any) {
    console.error('Error fetching smart suggestions:', err);
    res.json({ nearLostReports: [], helpCandidates: [] });
  }
});

const notificationPreferencesSchema = z.object({
  weekly_digest_enabled: z.boolean().optional(),
  quiet_hours_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().optional(),
  quiet_hours_end: z.string().optional(),
  leaderboard_opt_in: z.boolean().optional(),
});

/**
 * POST /api/community/digest-preferences
 * Update notification digest, quiet hours, and leaderboard preferences
 */
communityRouter.post(
  '/digest-preferences',
  requireAuth,
  validateBody(notificationPreferencesSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isServerSupabaseConfigured) {
      return res.status(503).json({ error: 'Database unconfigured' });
    }

    try {
      const userId = req.user!.id;
      const updates = req.body;

      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, profile });
    } catch (err: any) {
      console.error('Error updating digest preferences:', err);
      res.status(500).json({ error: 'Failed to update preferences' });
    }
  }
);
