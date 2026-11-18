import { Router, Request, Response } from 'express';
import { supabaseAdmin, isServerSupabaseConfigured } from '../config/supabase.js';

export const campusRouter = Router();

// GET /api/campus/places - List all campus places
campusRouter.get('/places', async (req: Request, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({ places: [] });
  }

  try {
    const { data: places, error } = await supabaseAdmin
      .from('campus_places')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json({ places: places || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch campus places' });
  }
});

// GET /api/campus/places/:id/buildings - List buildings for a campus
campusRouter.get('/places/:id/buildings', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: buildings, error } = await supabaseAdmin
      .from('campus_buildings')
      .select('*')
      .eq('campus_id', id)
      .order('name');

    if (error) throw error;
    res.json({ buildings: buildings || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch campus buildings' });
  }
});

