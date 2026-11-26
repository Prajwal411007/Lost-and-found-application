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
      avgTimeToReturnHours: 0,
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

    // Calculate avg time to return
    let avgHours = 0;
    const { data: returnedItems } = await supabaseAdmin
      .from('items')
      .select('date_occurred, updated_at')
      .eq('status', 'returned')
      .limit(100);

    if (returnedItems && returnedItems.length > 0) {
      let totalHours = 0;
      let validCount = 0;
      for (const item of returnedItems) {
        if (item.date_occurred && item.updated_at) {
          const diffMs = new Date(item.updated_at).getTime() - new Date(item.date_occurred).getTime();
          if (diffMs > 0) {
            totalHours += diffMs / (1000 * 60 * 60);
            validCount++;
          }
        }
      }
      if (validCount > 0) {
        avgHours = Math.round((totalHours / validCount) * 10) / 10;
      }
    }

    res.json({
      totalReported: total,
      itemsReturned: returned,
      activeMatches: activeMatches || 0,
      returnRate,
      avgTimeToReturnHours: avgHours,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch platform stats' });
  }
});

// GET /api/stats/hotspots - Aggregated clusters with coordinates rounded to 2 decimals (~1.1 km)
statsRouter.get('/hotspots', async (req: Request, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({ hotspots: [] });
  }

  try {
    // Attempt 1: Query database view
    const { data: viewData, error: viewError } = await supabaseAdmin
      .from('item_hotspots')
      .select('*');

    if (!viewError && viewData) {
      return res.json({ hotspots: viewData });
    }

    // Fallback: Compute in memory from items table
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('items')
      .select('latitude, longitude, type, status, location_city, location_state, updated_at')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (itemsError || !items) {
      return res.json({ hotspots: [] });
    }

    const clustersMap = new Map<string, any>();

    for (const item of items) {
      const lat = Math.round(Number(item.latitude) * 100) / 100;
      const lng = Math.round(Number(item.longitude) * 100) / 100;
      const key = `${lat},${lng}`;

      if (!clustersMap.has(key)) {
        clustersMap.set(key, {
          lat_rounded: lat,
          lng_rounded: lng,
          total_items: 0,
          lost_count: 0,
          found_count: 0,
          returned_count: 0,
          city: item.location_city || null,
          state: item.location_state || null,
          last_activity_at: item.updated_at,
        });
      }

      const cluster = clustersMap.get(key);
      cluster.total_items += 1;
      if (item.type === 'lost') cluster.lost_count += 1;
      if (item.type === 'found') cluster.found_count += 1;
      if (item.status === 'returned') cluster.returned_count += 1;
    }

    const hotspots = Array.from(clustersMap.values()).sort(
      (a, b) => b.total_items - a.total_items
    );

    res.json({ hotspots });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch hotspots' });
  }
});

// GET /api/stats/insights - Comprehensive analytics breakdown
statsRouter.get('/insights', async (req: Request, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return res.json({
      summary: {
        totalReported: 0,
        totalLost: 0,
        totalFound: 0,
        itemsReturned: 0,
        returnRatePct: 0,
        avgTimeToReturnHours: 0,
      },
      categories: [],
      weeklyTrends: [],
    });
  }

  try {
    // 1. Try querying database views first
    const [viewSummary, viewCategories, viewWeekly] = await Promise.all([
      supabaseAdmin.from('platform_insights').select('*').maybeSingle(),
      supabaseAdmin.from('item_category_stats').select('*'),
      supabaseAdmin.from('item_weekly_trends').select('*'),
    ]);

    if (!viewSummary.error && viewSummary.data) {
      return res.json({
        summary: {
          totalReported: viewSummary.data.total_reported || 0,
          totalLost: viewSummary.data.total_lost || 0,
          totalFound: viewSummary.data.total_found || 0,
          itemsReturned: viewSummary.data.items_returned || 0,
          returnRatePct: viewSummary.data.return_rate_pct || 0,
          avgTimeToReturnHours: viewSummary.data.avg_time_to_return_hours || 0,
        },
        categories: viewCategories.data || [],
        weeklyTrends: viewWeekly.data || [],
      });
    }

    // 2. Fallback: Aggregate manually if views haven't been migrated yet
    const [{ data: items }, { data: categories }] = await Promise.all([
      supabaseAdmin.from('items').select('id, type, status, category_id, date_occurred, updated_at'),
      supabaseAdmin.from('categories').select('id, name, slug, icon'),
    ]);

    const allItems = items || [];
    const allCategories = categories || [];

    const totalReported = allItems.length;
    const totalLost = allItems.filter((i) => i.type === 'lost').length;
    const totalFound = allItems.filter((i) => i.type === 'found').length;
    const itemsReturned = allItems.filter((i) => i.status === 'returned').length;
    const returnRatePct = totalReported > 0 ? Math.round((itemsReturned / totalReported) * 100) : 0;

    let totalDurationHours = 0;
    let returnedWithDateCount = 0;

    for (const item of allItems) {
      if (item.status === 'returned' && item.date_occurred && item.updated_at) {
        const diff = new Date(item.updated_at).getTime() - new Date(item.date_occurred).getTime();
        if (diff > 0) {
          totalDurationHours += diff / (1000 * 60 * 60);
          returnedWithDateCount++;
        }
      }
    }

    const avgTimeToReturnHours =
      returnedWithDateCount > 0 ? Math.round((totalDurationHours / returnedWithDateCount) * 10) / 10 : 0;

    // Categories Breakdown
    const catMap = new Map<string, any>();
    for (const cat of allCategories) {
      catMap.set(cat.id, {
        category_id: cat.id,
        category_name: cat.name,
        category_slug: cat.slug,
        category_icon: cat.icon,
        total_items: 0,
        lost_count: 0,
        found_count: 0,
        returned_count: 0,
        return_rate_pct: 0,
        avg_return_time_hours: 0,
      });
    }

    for (const item of allItems) {
      if (item.category_id && catMap.has(item.category_id)) {
        const stats = catMap.get(item.category_id);
        stats.total_items += 1;
        if (item.type === 'lost') stats.lost_count += 1;
        if (item.type === 'found') stats.found_count += 1;
        if (item.status === 'returned') stats.returned_count += 1;
      }
    }

    const categoryStats = Array.from(catMap.values()).map((c) => ({
      ...c,
      return_rate_pct: c.total_items > 0 ? Math.round((c.returned_count / c.total_items) * 100) : 0,
    })).sort((a, b) => b.total_items - a.total_items);

    // Weekly Trends (last 8 weeks)
    const weeksMap = new Map<string, any>();
    for (let w = 7; w >= 0; w--) {
      const d = new Date();
      d.setDate(d.getDate() - w * 7);
      const weekLabel = `W-${d.toISOString().slice(5, 10)}`;
      weeksMap.set(weekLabel, {
        week_start: weekLabel,
        total_items: 0,
        lost_count: 0,
        found_count: 0,
        returned_count: 0,
      });
    }

    for (const item of allItems) {
      if (item.date_occurred) {
        const itemDate = new Date(item.date_occurred);
        const diffWeeks = Math.floor((Date.now() - itemDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (diffWeeks >= 0 && diffWeeks < 8) {
          const d = new Date();
          d.setDate(d.getDate() - diffWeeks * 7);
          const weekLabel = `W-${d.toISOString().slice(5, 10)}`;
          const weekEntry = weeksMap.get(weekLabel);
          if (weekEntry) {
            weekEntry.total_items += 1;
            if (item.type === 'lost') weekEntry.lost_count += 1;
            if (item.type === 'found') weekEntry.found_count += 1;
            if (item.status === 'returned') weekEntry.returned_count += 1;
          }
        }
      }
    }

    res.json({
      summary: {
        totalReported,
        totalLost,
        totalFound,
        itemsReturned,
        returnRatePct,
        avgTimeToReturnHours,
      },
      categories: categoryStats,
      weeklyTrends: Array.from(weeksMap.values()),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch insights' });
  }
});
