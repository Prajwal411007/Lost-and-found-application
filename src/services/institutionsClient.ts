/**
 * Direct client-side OpenStreetMap Overpass service.
 * Used as a resilient fallback when backend API routes are unavailable, returning HTML (SPA rewrites),
 * or in standalone frontend deployments on platforms like Vercel.
 */

import { haversineDistance } from '@/lib/utils';
import { NearbyInstitution } from '@/hooks/useNearbyInstitutions';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// In-memory client cache (5-minute TTL)
interface CacheEntry {
  data: NearbyInstitution[];
  timestamp: number;
}
const clientCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function clearInstitutionsClientCache() {
  clientCache.clear();
}

function normalizeType(
  tags: Record<string, string>
): 'university' | 'college' | 'school' | 'kindergarten' | 'research_institute' | 'other' {
  const amenity = tags.amenity?.toLowerCase();
  const building = tags.building?.toLowerCase();

  if (amenity === 'university' || building === 'university') return 'university';
  if (amenity === 'college' || building === 'college') return 'college';
  if (amenity === 'school') return 'school';
  if (amenity === 'kindergarten') return 'kindergarten';
  if (amenity === 'research_institute') return 'research_institute';
  return 'other';
}

function buildAddress(tags: Record<string, string>): string | undefined {
  const parts: string[] = [];
  const houseNumber = tags['addr:housenumber'];
  const street = tags['addr:street'];
  const city = tags['addr:city'] || tags['addr:suburb'] || tags['addr:town'];
  const postcode = tags['addr:postcode'];

  if (houseNumber && street) {
    parts.push(`${houseNumber} ${street}`);
  } else if (street) {
    parts.push(street);
  }

  if (city) parts.push(city);
  if (postcode) parts.push(postcode);

  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Queries OpenStreetMap Overpass directly from the client.
 * Respects usage policy: 15s timeout, spatial filtering, and automatic mirror failover.
 */
export async function queryOverpassDirectly(
  lat: number,
  lng: number,
  radiusMeters: number = 2000,
  typesFilter?: string[]
): Promise<NearbyInstitution[]> {
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLng = Math.round(lng * 1000) / 1000;
  const sortedTypes = typesFilter ? [...typesFilter].sort().join(',') : 'all';
  const cacheKey = `${roundedLat}_${roundedLng}_${radiusMeters}_${sortedTypes}`;

  // Check client in-memory cache
  const cached = clientCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const query = `
    [out:json][timeout:15];
    (
      node(around:${radiusMeters},${roundedLat},${roundedLng})["amenity"~"^(university|college|school|kindergarten|research_institute)$"];
      way(around:${radiusMeters},${roundedLat},${roundedLng})["amenity"~"^(university|college|school|kindergarten|research_institute)$"];
      way(around:${radiusMeters},${roundedLat},${roundedLng})["building"~"^(university|college)$"];
    );
    out center;
  `.trim();

  let elements: any[] = [];
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Accept': 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error(`Overpass returned HTTP ${res.status}`);
      }

      const json = await res.json();
      elements = json.elements || [];
      break; // Success
    } catch (err: any) {
      lastError = err;
      // Failover to next mirror
    }
  }

  if (elements.length === 0 && lastError) {
    // If all mirrors timed out, return empty or cached
    if (cached?.data) return cached.data;
    return [];
  }

  const parsed: NearbyInstitution[] = [];
  const seenKeys = new Set<string>();

  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name?.trim();
    if (!name) continue;

    const itemLat = el.lat ?? el.center?.lat;
    const itemLng = el.lon ?? el.center?.lon;
    if (itemLat === undefined || itemLng === undefined) continue;

    const instType = normalizeType(tags);
    if (typesFilter && typesFilter.length > 0 && !typesFilter.includes(instType)) {
      continue;
    }

    const dedupKey = `${name.toLowerCase()}_${Math.round(itemLat * 100) / 100}_${Math.round(itemLng * 100) / 100}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    // Distance in meters using Haversine formula
    const distanceKm = haversineDistance(lat, lng, itemLat, itemLng);
    const distanceMeters = Math.round(distanceKm * 1000);

    parsed.push({
      id: `osm-${el.type}-${el.id}`,
      name,
      type: instType,
      address: buildAddress(tags),
      lat: itemLat,
      lng: itemLng,
      website: tags['contact:website'] || tags.website || tags.url,
      phone: tags['contact:phone'] || tags.phone,
      distance: distanceMeters,
    });
  }

  // Sort nearest first
  parsed.sort((a, b) => a.distance - b.distance);

  // Cache parsed result
  clientCache.set(cacheKey, { data: parsed, timestamp: Date.now() });

  return parsed;
}
