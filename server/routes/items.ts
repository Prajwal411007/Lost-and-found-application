import { Router, Request, Response } from 'express';
import * as z from 'zod';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { searchLimiter } from '../middleware/rateLimiter.js';
import { matchingService } from '../services/matching/matchingService.js';

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
});

// POST /api/items - Create item & trigger matching
itemsRouter.post(
  '/',
  requireAuth,
  validateBody(createItemSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { images, ...itemData } = req.body;

      const { data: createdItem, error } = await supabaseAdmin
        .from('items')
        .insert({
          ...itemData,
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

      // Background match execution
      matchingService.computeMatchesForItem(createdItem.id).catch((err) => {
        console.warn('Match computation background notice:', err.message);
      });

      res.status(201).json({ item: createdItem });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create item' });
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

