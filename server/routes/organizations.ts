import { Router, Request, Response } from 'express';
import * as z from 'zod';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { validateBody } from '../middleware/validate.js';

export const organizationsRouter = Router();

const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(['college', 'transit', 'library', 'police', 'mall', 'other']),
  address: z.string().min(3).max(255),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  contact_route: z.string().max(255).optional().nullable(),
  opening_hours: z.string().max(150).optional().nullable(),
});

const verifyOrgSchema = z.object({
  verified: z.boolean(),
});

const setHeldAtSchema = z.object({
  organization_id: z.string().uuid().optional().nullable(),
  held_at_desk: z.boolean(),
  desk_pickup_instructions: z.string().max(500).optional().nullable(),
});

// GET /api/organizations - Public listing of drop-off desks
organizationsRouter.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({ organizations: [] });
  }

  try {
    const { type, search, all } = req.query;

    let query = supabaseAdmin.from('organizations').select('*');

    // Only admins or creators can see unverified organizations when all=true
    if (!all || all !== 'true') {
      query = query.eq('verified', true);
    }

    if (type && typeof type === 'string') {
      query = query.eq('type', type);
    }

    if (search && typeof search === 'string') {
      query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%`);
    }

    query = query.order('name', { ascending: true });

    const { data, error } = await query;

    if (error) {
      // Table may not have been created yet if migration pending
      return res.json({ organizations: [] });
    }

    res.json({ organizations: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch organizations' });
  }
});

// GET /api/organizations/:id - Single drop-off desk
organizationsRouter.get('/:id', async (req: Request, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.status(404).json({ error: 'Organization not found' });
  }

  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('*, members:organization_members(*)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ error: 'Drop-off desk not found' });
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve desk details' });
  }
});

// POST /api/organizations - Register a new drop-off desk
organizationsRouter.post(
  '/',
  requireAuth,
  validateBody(createOrgSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isServerSupabaseConfigured) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    try {
      const payload = req.body;
      const userId = req.user!.id;

      const { data, error } = await supabaseAdmin
        .from('organizations')
        .insert({
          ...payload,
          created_by: userId,
          verified: false, // Default requires admin review
        })
        .select()
        .single();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // Automatically assign creator as org_admin
      try {
        await supabaseAdmin.from('organization_members').insert({
          organization_id: data.id,
          user_id: userId,
          role: 'org_admin',
        });
      } catch {
        // Non-critical if table not yet migrated
      }

      res.status(201).json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to register desk' });
    }
  }
);

// PATCH /api/organizations/:id/verify - Admin toggle verification
organizationsRouter.patch(
  '/:id/verify',
  requireAuth,
  requireAdmin,
  validateBody(verifyOrgSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isServerSupabaseConfigured) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    try {
      const { id } = req.params;
      const { verified } = req.body;

      const { data, error } = await supabaseAdmin
        .from('organizations')
        .update({ verified, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Organization not found or update failed' });
      }

      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to verify organization' });
    }
  }
);

// PATCH /api/items/:id/held-at - Link found item to drop-off desk
organizationsRouter.patch(
  '/items/:id/held-at',
  requireAuth,
  validateBody(setHeldAtSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isServerSupabaseConfigured) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    try {
      const { id } = req.params;
      const { organization_id, held_at_desk, desk_pickup_instructions } = req.body;
      const userId = req.user!.id;

      // Verify user owns item or is admin / org staff
      const { data: item, error: itemError } = await supabaseAdmin
        .from('items')
        .select('user_id, organization_id')
        .eq('id', id)
        .maybeSingle();

      if (itemError || !item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      const isOwner = item.user_id === userId;
      const isAdmin = profile?.role === 'admin' || profile?.role === 'moderator';

      let isStaff = false;
      if (organization_id) {
        const { data: member } = await supabaseAdmin
          .from('organization_members')
          .select('id')
          .eq('organization_id', organization_id)
          .eq('user_id', userId)
          .maybeSingle();
        if (member) isStaff = true;
      }

      if (!isOwner && !isAdmin && !isStaff) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions to update desk holding' });
      }

      const { data: updatedItem, error: updateError } = await supabaseAdmin
        .from('items')
        .update({
          organization_id: organization_id || null,
          held_at_desk: Boolean(held_at_desk),
          desk_pickup_instructions: desk_pickup_instructions || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*, organization:organizations(*)')
        .single();

      if (updateError) {
        return res.status(400).json({ error: updateError.message });
      }

      res.json(updatedItem);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update item holding location' });
    }
  }
);
