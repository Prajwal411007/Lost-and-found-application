import { Router, Request, Response } from 'express';
import * as z from 'zod';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { searchLimiter } from '../middleware/rateLimiter.js';
import { matchingService } from '../services/matching/matchingService.js';
import { redactSensitiveData } from '../services/redaction.js';
import { findSimilarOpenItems, checkUserFraudRules } from '../services/fraudDetection.js';

export const itemsRouter = Router();

const searchItemsQuerySchema = z.object({
  q: z.string().optional(),
  type: z.enum(['all', 'lost', 'found']).optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  dateRange: z.string().optional(),
  sort: z.enum(['newest', 'oldest']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// GET /api/items - Browse & search with server validation and rate limiting
itemsRouter.get(
  '/',
  searchLimiter,
  validateQuery(searchItemsQuerySchema),
  async (req: Request, res: Response) => {
    if (!isServerSupabaseConfigured) {
      return res.json({ items: [], total: 0, notice: 'Supabase unconfigured' });
    }

    try {
      const { q, type, category, location, dateRange, sort, page = '1', limit = '12' } = req.query as any;

      let query = supabaseAdmin
        .from('items')
        .select('*, category:categories(*)', { count: 'exact' });

      if (type && type !== 'all') {
        query = query.eq('type', type);
      }

      if (category) {
        query = query.eq('category_id', category);
      }

      if (q) {
        query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
      }

      if (location) {
        query = query.or(
          `location_city.ilike.%${location}%,location_state.ilike.%${location}%,location_country.ilike.%${location}%,location_landmark.ilike.%${location}%`
        );
      }

      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        let days = 0;
        if (dateRange === 'today') days = 1;
        if (dateRange === '7d') days = 7;
        if (dateRange === '30d') days = 30;
        if (days > 0) {
          const startDate = new Date(now.setDate(now.getDate() - days)).toISOString().split('T')[0];
          query = query.gte('date_occurred', startDate);
        }
      }

      if (sort === 'oldest') {
        query = query.order('created_at', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const pageNum = parseInt(page, 10) || 1;
      const pageSize = parseInt(limit, 10) || 12;
      const from = (pageNum - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query.range(from, to);

      if (error) {
        return res.status(503).json({ items: [], total: 0, error: 'Database service unavailable' });
      }

      res.json({
        items: data || [],
        total: count || 0,
        page: pageNum,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      });
    } catch (err: any) {
      res.status(503).json({ error: err.message || 'Database service temporarily unavailable' });
    }
  }
);

// POST /api/items/check-duplicates - Check similar open reports before submission
itemsRouter.post('/check-duplicates', async (req: Request, res: Response) => {
  try {
    const { title, category_id, type, latitude, longitude } = req.body;
    const duplicates = await findSimilarOpenItems({
      title,
      category_id,
      type,
      latitude,
      longitude,
    });
    res.json({ duplicates });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Duplicate check error' });
  }
});

// GET /api/items/:id - Item Details
itemsRouter.get('/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.status(503).json({ error: 'Supabase unconfigured' });
  }

  try {
    const { id } = req.params;

    const { data: item, error } = await supabaseAdmin
      .from('items')
      .select('*, category:categories(*), user:profiles(id, full_name, avatar_url, role)')
      .eq('id', id)
      .single();

    if (error || !item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const { data: images } = await supabaseAdmin
      .from('item_images')
      .select('*')
      .eq('item_id', id)
      .order('order_index');

    res.json({
      item,
      images: images || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch item' });
  }
});

const createItemSchema = z.object({
  type: z.enum(['lost', 'found']),
  title: z.string().min(3).max(100),
  description: z.string().min(10),
  category_id: z.string().uuid(),
  date_occurred: z.string(),
  location_country: z.string(),
  location_state: z.string().nullable().optional(),
  location_city: z.string(),
  location_landmark: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  primary_image_url: z.string().url().nullable().optional(),
  attributes: z.record(z.any()).optional(),
  images: z.array(z.string().url()).optional(),
  private_details: z
    .array(
      z.object({
        detail_type: z.string(),
        detail_label: z.string(),
        detail_value: z.string().min(1),
      })
    )
    .max(3)
    .optional(),
});

// POST /api/items - Create item & trigger matching
itemsRouter.post(
  '/',
  requireAuth,
  validateBody(createItemSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { images, private_details, ...itemData } = req.body;

      const safeTitle = redactSensitiveData(itemData.title);
      const safeDescription = redactSensitiveData(itemData.description);

      const { data: createdItem, error } = await supabaseAdmin
        .from('items')
        .insert({
          ...itemData,
          title: safeTitle,
          description: safeDescription,
          user_id: userId,
          status: 'open',
        })
        .select()
        .single();

      if (error) throw error;

      // Insert extra images if present
      if (images && images.length > 0 && createdItem) {
        const imageRows = images.map((url: string, index: number) => ({
          item_id: createdItem.id,
          storage_path: `items/${createdItem.id}/${index}`,
          public_url: url,
          order_index: index,
        }));
        await supabaseAdmin.from('item_images').insert(imageRows);
      }

      // Insert hidden private proof details if found item
      if (itemData.type === 'found' && private_details && Array.isArray(private_details) && createdItem) {
        const detailRows = private_details.slice(0, 3).map((d: any) => ({
          item_id: createdItem.id,
          detail_type: d.detail_type || 'custom',
          detail_label: d.detail_label || 'Proof Detail',
          detail_value: redactSensitiveData(d.detail_value || ''),
        }));
        if (detailRows.length > 0) {
          await supabaseAdmin.from('item_private_details').insert(detailRows);
        }
      }

      // Background match execution
      matchingService.computeMatchesForItem(createdItem.id).catch((err) => {
        console.warn('Match computation background notice:', err.message);
      });

      // Background fraud check for rapid reports (> 5 / hr)
      checkUserFraudRules(userId).catch((err) => {
        console.warn('Fraud check notice on item creation:', err);
      });

      res.status(201).json({ item: createdItem });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create item' });
    }
  }
);

// GET /api/items/:id/private-details - Fetch finder's hidden proof details (Finder/Admin only)
itemsRouter.get('/:id/private-details', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.status(503).json({ error: 'Database service unavailable' });
  }

  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const { data: item, error: itemError } = await supabaseAdmin
      .from('items')
      .select('user_id')
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

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Private proof details are accessible only by the finder.' });
    }

    const { data: details, error: detailsErr } = await supabaseAdmin
      .from('item_private_details')
      .select('*')
      .eq('item_id', id);

    if (detailsErr) throw detailsErr;

    res.json({ privateDetails: details || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch private details' });
  }
});

// POST /api/items/:id/private-details - Add or replace hidden proof details (Finder only, max 3)
const savePrivateDetailsSchema = z.object({
  details: z
    .array(
      z.object({
        detail_type: z.string(),
        detail_label: z.string(),
        detail_value: z.string().min(1),
      })
    )
    .max(3),
});

itemsRouter.post(
  '/:id/private-details',
  requireAuth,
  validateBody(savePrivateDetailsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isServerSupabaseConfigured) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    try {
      const { id } = req.params;
      const { details } = req.body;
      const userId = req.user!.id;

      const { data: item } = await supabaseAdmin
        .from('items')
        .select('user_id, type')
        .eq('id', id)
        .maybeSingle();

      if (!item) return res.status(404).json({ error: 'Item not found' });

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      const isOwner = item.user_id === userId;
      const isAdmin = profile?.role === 'admin' || profile?.role === 'moderator';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Only the finder can update private proof details.' });
      }

      // Delete existing and re-insert
      await supabaseAdmin.from('item_private_details').delete().eq('item_id', id);

      const rows = details.slice(0, 3).map((d: any) => ({
        item_id: id,
        detail_type: d.detail_type,
        detail_label: d.detail_label,
        detail_value: redactSensitiveData(d.detail_value),
      }));

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('item_private_details')
        .insert(rows)
        .select();

      if (insertErr) throw insertErr;

      res.status(201).json({ privateDetails: inserted });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to save private details' });
    }
  }
);

// PATCH /api/items/:id/held-at - Link found item to drop-off desk
const setHeldAtSchema = z.object({
  organization_id: z.string().uuid().optional().nullable(),
  held_at_desk: z.boolean(),
  desk_pickup_instructions: z.string().max(500).optional().nullable(),
});

itemsRouter.patch(
  '/:id/held-at',
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

// DELETE /api/items/:id - Delete item (owner or admin only)
itemsRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check ownership
    const { data: item } = await supabaseAdmin
      .from('items')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Check admin role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const isAdmin = profile?.role === 'admin';

    if (item.user_id !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own listings' });
    }

    await supabaseAdmin.from('items').delete().eq('id', id);

    res.json({ success: true, message: 'Item listing deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete item' });
  }
});

