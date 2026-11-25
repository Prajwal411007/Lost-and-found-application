import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getNearbyInstitutions } from '../services/institutionsService.js';
import { searchLimiter } from '../middleware/rateLimiter.js';

export const institutionsRouter = Router();

const querySchema = z.object({
  lat: z.coerce.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  lng: z.coerce.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  radius: z.coerce.number().min(100, 'Radius must be at least 100 meters').max(10000, 'Radius is capped at 10,000 meters (10 km)').default(2000),
  types: z.string().optional(),
});

/**
 * GET /api/nearby-institutions
 * Queries OpenStreetMap features via Overpass API within radius of lat, lng.
 * Privacy safe: never logs or stores raw coordinates.
 */
institutionsRouter.get('/', searchLimiter, async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid query parameters',
      details: parsed.error.issues.map((i) => i.message),
    });
  }

  const { lat, lng, radius, types } = parsed.data;
  const typesFilter = types ? types.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : undefined;

  try {
    const institutions = await getNearbyInstitutions(lat, lng, radius, typesFilter);
    const unnamedCount = institutions.filter((i) => i.isUnnamed).length;

    res.json({
      institutions,
      count: institutions.length,
      unnamedCount,
      centre: {
        lat: Math.round(lat * 10000) / 10000,
        lng: Math.round(lng * 10000) / 10000,
      },
      radius,
      attribution: '© OpenStreetMap contributors',
    });
  } catch (err: any) {
    res.status(502).json({
      error: 'OpenStreetMap institution query failed or timed out. Please try again.',
      details: err.message,
    });
  }
});
