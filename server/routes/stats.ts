import { Router, Request, Response } from 'express';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';

export const statsRouter = Router();

// GET /api/stats - Public live statistics (database backed, no hardcoding)
statsRouter.get('/', async (req: Request, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({
      totalReported: 0,
      itemsReturned: 0,
      activeMatches: 0,
      returnRate: 0,
    });
  }

  try {
    const { count: totalReported } = await supabaseAdmin
      .from('items')
      .select('*', { count: 'exact', head: true });

    const { count: itemsReturned } = await supabaseAdmin
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'returned');

    const { count: activeMatches } = await supabaseAdmin
      .from('matches')
      .select('*', { count: 'exact', head: true });

    const total = totalReported || 0;
    const returned = itemsReturned || 0;
    const returnRate = total > 0 ? Math.round((returned / total) * 100) : 0;

    res.json({
      totalReported: total,
      itemsReturned: returned,
      activeMatches: activeMatches || 0,
      returnRate,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch platform stats' });
  }
});

