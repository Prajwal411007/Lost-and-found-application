import { Router, Response } from 'express';
import * as z from 'zod';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { validateBody } from '../middleware/validate.js';

export const adminRouter = Router();

// Apply auth + admin checks to all routes
adminRouter.use(requireAuth, requireAdmin);

// GET /api/admin/overview - Platform Analytics & Metrics
adminRouter.get('/overview', async (req: AuthenticatedRequest, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({
      totalUsers: 0,
      totalItems: 0,
      returnedItems: 0,
      openItems: 0,
      pendingClaims: 0,
      pendingReports: 0,
    });
  }

  try {
    const { count: totalUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: totalItems } = await supabaseAdmin
      .from('items')
      .select('*', { count: 'exact', head: true });

    const { count: returnedItems } = await supabaseAdmin
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'returned');

    const { count: openItems } = await supabaseAdmin
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    const { count: pendingClaims } = await supabaseAdmin
      .from('claims')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: pendingReports } = await supabaseAdmin
      .from('abuse_reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    res.json({
      totalUsers: totalUsers || 0,
      totalItems: totalItems || 0,
      returnedItems: returnedItems || 0,
      openItems: openItems || 0,
      pendingClaims: pendingClaims || 0,
      pendingReports: pendingReports || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch admin overview' });
  }
});

// GET /api/admin/reports - Moderation Queue
adminRouter.get('/reports', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: reports, error } = await supabaseAdmin
      .from('abuse_reports')
      .select(`
        *,
        reporter:profiles!abuse_reports_reporter_id_fkey(id, full_name, email),
        reported_user:profiles!abuse_reports_reported_user_id_fkey(id, full_name, email, is_banned),
        reported_item:items(id, title, status, primary_image_url)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ reports: reports || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch abuse reports' });
  }
});

const updateReportSchema = z.object({
  status: z.enum(['pending', 'reviewed', 'actioned', 'dismissed']),
  admin_notes: z.string().optional(),
});

// PATCH /api/admin/reports/:id - Update report status
adminRouter.patch(
  '/reports/:id',
  validateBody(updateReportSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, admin_notes } = req.body;

      const { data, error } = await supabaseAdmin
        .from('abuse_reports')
        .update({
          status,
          admin_notes: admin_notes || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ report: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update report' });
    }
  }
);

const banUserSchema = z.object({
  is_banned: z.boolean(),
});

// PATCH /api/admin/users/:id/ban - Ban or unban user
adminRouter.patch(
  '/users/:id/ban',
  validateBody(banUserSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { is_banned } = req.body;

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ is_banned })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ profile: data, message: is_banned ? 'User banned' : 'User unbanned' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update ban status' });
    }
  }
);

// DELETE /api/admin/items/:id - Moderation deletion
adminRouter.delete('/items/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('items').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Listing removed by administrator' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to remove listing' });
  }
});

