import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }

  if (!isServerSupabaseConfigured) {
    return res.status(503).json({ error: 'Supabase credentials not configured' });
  }

  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('role, is_banned')
      .eq('id', req.user.id)
      .single();

    if (error || !profile) {
      return res.status(403).json({ error: 'Forbidden: Profile record not found' });
    }

    if (profile.is_banned) {
      return res.status(403).json({ error: 'Forbidden: Your account has been suspended' });
    }

    if (profile.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden: Administrative clearance required to access this endpoint',
      });
    }

    req.user.role = profile.role;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify administrative authorization' });
  }
}

