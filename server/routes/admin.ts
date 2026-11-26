import { Router, Response } from 'express';
import * as z from 'zod';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { validateBody } from '../middleware/validate.js';
import { sendNotification } from '../services/notificationService.js';

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

// GET /api/admin/fraud-flags - Pending rule-based fraud detection flags
adminRouter.get('/fraud-flags', async (req: AuthenticatedRequest, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({ flags: [] });
  }

  try {
    const { data: flags, error } = await supabaseAdmin
      .from('user_flags')
      .select('*, user:profiles(id, full_name, email, is_banned, role)')
      .order('created_at', { ascending: false });

    if (error) {
      return res.json({ flags: [] });
    }

    res.json({ flags: flags || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch fraud flags' });
  }
});

// PATCH /api/admin/fraud-flags/:id - Review/dismiss flag
const updateFraudFlagSchema = z.object({
  status: z.enum(['pending', 'reviewed', 'dismissed']),
});

adminRouter.patch(
  '/fraud-flags/:id',
  validateBody(updateFraudFlagSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isServerSupabaseConfigured) {
      return res.status(503).json({ error: 'Supabase service unconfigured' });
    }

    try {
      const { id } = req.params;
      const { status } = req.body;
      const adminId = req.user!.id;

      const { data, error } = await supabaseAdmin
        .from('user_flags')
        .update({
          status,
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update fraud flag status' });
    }
  }
);

// POST /api/admin/actions - Execute moderator action and record into immutable audit log
const executeAdminActionSchema = z.object({
  action: z.enum(['dismiss_flag', 'warn_user', 'lock_claims', 'suspend_user', 'resolve_dispute']),
  target_user_id: z.string().uuid().optional().nullable(),
  target_item_id: z.string().uuid().optional().nullable(),
  target_claim_id: z.string().uuid().optional().nullable(),
  reason: z.string().min(3),
  duration_hours: z.number().int().min(1).max(720).optional().default(24),
  metadata: z.record(z.any()).optional().default({}),
});

adminRouter.post(
  '/actions',
  validateBody(executeAdminActionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isServerSupabaseConfigured) {
      return res.status(503).json({ error: 'Supabase service unconfigured' });
    }

    try {
      const adminId = req.user!.id;
      const { action, target_user_id, target_item_id, target_claim_id, reason, duration_hours, metadata } = req.body;

      // 1. Execute specific action logic
      if (action === 'warn_user' && target_user_id) {
        await sendNotification({
          userId: target_user_id,
          type: 'system',
          title: 'Account Moderation Notice',
          message: `Official moderator notice: ${reason}`,
          linkUrl: '/dashboard',
        });
      } else if (action === 'lock_claims' && target_user_id) {
        const lockedUntil = new Date(Date.now() + duration_hours * 60 * 60 * 1000).toISOString();
        await supabaseAdmin.from('user_claim_locks').upsert({
          user_id: target_user_id,
          locked_until: lockedUntil,
          reason,
          locked_by: adminId,
        });

        await sendNotification({
          userId: target_user_id,
          type: 'system',
          title: 'Claim Privileges Temporarily Locked',
          message: `Your ownership claim submissions have been locked until ${new Date(lockedUntil).toLocaleString()}: ${reason}`,
          linkUrl: '/dashboard',
        });
      } else if (action === 'suspend_user' && target_user_id) {
        await supabaseAdmin
          .from('profiles')
          .update({ is_banned: true })
          .eq('id', target_user_id);
      } else if (action === 'dismiss_flag' && metadata?.flag_id) {
        await supabaseAdmin
          .from('user_flags')
          .update({ status: 'dismissed', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
          .eq('id', metadata.flag_id);
      } else if (action === 'resolve_dispute' && target_claim_id) {
        await supabaseAdmin
          .from('claims')
          .update({ is_disputed: false, status: 'resolved', resolved_at: new Date().toISOString() })
          .eq('id', target_claim_id);
      }

      // 2. Insert into immutable audit log
      const { data: logEntry, error: logErr } = await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: adminId,
          action,
          target_user_id: target_user_id || null,
          target_item_id: target_item_id || null,
          target_claim_id: target_claim_id || null,
          reason,
          metadata: {
            ...metadata,
            duration_hours: action === 'lock_claims' ? duration_hours : undefined,
          },
        })
        .select('*, admin:profiles!admin_audit_logs_admin_id_fkey(id, full_name, email)')
        .single();

      if (logErr) throw logErr;

      res.status(201).json({
        success: true,
        auditLog: logEntry,
        message: `Moderator action "${action}" completed and permanently logged.`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to execute moderator action' });
    }
  }
);

// GET /api/admin/audit-logs - View immutable audit trail
adminRouter.get('/audit-logs', async (req: AuthenticatedRequest, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({ logs: [] });
  }

  try {
    const { data: logs, error } = await supabaseAdmin
      .from('admin_audit_logs')
      .select('*, admin:profiles!admin_audit_logs_admin_id_fkey(id, full_name, email)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return res.json({ logs: [] });
    }

    res.json({ logs: logs || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch audit logs' });
  }
});

