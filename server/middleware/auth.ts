import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
  }

  if (!isServerSupabaseConfigured) {
    return res.status(503).json({
      error: 'Supabase credentials not configured on server. Please set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL in .env',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired access token' });
    }

    req.user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Authentication verification failed' });
  }
}

export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ') || !isServerSupabaseConfigured) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
      };
    }
  } catch {
    // Ignore and proceed unauthenticated
  }

  next();
}
