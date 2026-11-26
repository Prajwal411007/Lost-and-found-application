-- =====================================================================
-- Migration 007: Hotspots, Aggregate Analytics & Platform Insights Views
-- =====================================================================

-- 1. Aggregated Hotspot Clusters (Coords rounded to 2 decimals ~1.1 km to protect privacy)
CREATE OR REPLACE VIEW public.item_hotspots AS
SELECT
  ROUND(latitude::numeric, 2) AS lat_rounded,
  ROUND(longitude::numeric, 2) AS lng_rounded,
  COUNT(*)::integer AS total_items,
  COUNT(*) FILTER (WHERE type = 'lost')::integer AS lost_count,
  COUNT(*) FILTER (WHERE type = 'found')::integer AS found_count,
  COUNT(*) FILTER (WHERE status = 'returned')::integer AS returned_count,
  MIN(location_city) AS city,
  MIN(location_state) AS state,
  MAX(updated_at) AS last_activity_at
FROM public.items
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
GROUP BY ROUND(latitude::numeric, 2), ROUND(longitude::numeric, 2)
HAVING COUNT(*) > 0
ORDER BY total_items DESC;

-- 2. Category Performance and Time-to-Return Breakdown
CREATE OR REPLACE VIEW public.item_category_stats AS
SELECT
  c.id AS category_id,
  c.name AS category_name,
  c.slug AS category_slug,
  c.icon AS category_icon,
  COUNT(i.id)::integer AS total_items,
  COUNT(i.id) FILTER (WHERE i.type = 'lost')::integer AS lost_count,
  COUNT(i.id) FILTER (WHERE i.type = 'found')::integer AS found_count,
  COUNT(i.id) FILTER (WHERE i.status = 'returned')::integer AS returned_count,
  CASE
    WHEN COUNT(i.id) > 0 THEN ROUND((COUNT(i.id) FILTER (WHERE i.status = 'returned')::numeric / COUNT(i.id)::numeric) * 100, 1)
    ELSE 0.0
  END AS return_rate_pct,
  ROUND(
    COALESCE(
      AVG(EXTRACT(EPOCH FROM (i.updated_at - i.date_occurred)) / 3600)
      FILTER (WHERE i.status = 'returned' AND i.updated_at >= i.date_occurred),
      0
    )::numeric,
    1
  ) AS avg_return_time_hours
FROM public.categories c
LEFT JOIN public.items i ON c.id = i.category_id
GROUP BY c.id, c.name, c.slug, c.icon
ORDER BY total_items DESC;

-- 3. Weekly Trends
CREATE OR REPLACE VIEW public.item_weekly_trends AS
SELECT
  DATE_TRUNC('week', date_occurred) AS week_start,
  COUNT(*)::integer AS total_items,
  COUNT(*) FILTER (WHERE type = 'lost')::integer AS lost_count,
  COUNT(*) FILTER (WHERE type = 'found')::integer AS found_count,
  COUNT(*) FILTER (WHERE status = 'returned')::integer AS returned_count
FROM public.items
WHERE date_occurred IS NOT NULL
GROUP BY DATE_TRUNC('week', date_occurred)
ORDER BY week_start DESC
LIMIT 12;

-- 4. Global Platform Insights Aggregate
CREATE OR REPLACE VIEW public.platform_insights AS
SELECT
  COUNT(*)::integer AS total_reported,
  COUNT(*) FILTER (WHERE type = 'lost')::integer AS total_lost,
  COUNT(*) FILTER (WHERE type = 'found')::integer AS total_found,
  COUNT(*) FILTER (WHERE status = 'returned')::integer AS items_returned,
  CASE
    WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status = 'returned')::numeric / COUNT(*)::numeric) * 100, 1)
    ELSE 0.0
  END AS return_rate_pct,
  ROUND(
    COALESCE(
      AVG(EXTRACT(EPOCH FROM (updated_at - date_occurred)) / 3600)
      FILTER (WHERE status = 'returned' AND updated_at >= date_occurred),
      0
    )::numeric,
    1
  ) AS avg_time_to_return_hours
FROM public.items;

-- 5. Permissions (Views are public read-only for public insights and admin dashboards)
GRANT SELECT ON public.item_hotspots TO anon, authenticated;
GRANT SELECT ON public.item_category_stats TO anon, authenticated;
GRANT SELECT ON public.item_weekly_trends TO anon, authenticated;
GRANT SELECT ON public.platform_insights TO anon, authenticated;
