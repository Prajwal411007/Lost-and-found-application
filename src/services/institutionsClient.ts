/**
 * Direct client-side OpenStreetMap Overpass service with Nominatim fallback.
 * Used as a resilient fallback when backend API routes are unavailable, returning HTML (SPA rewrites),
 * or in standalone frontend deployments on platforms like Vercel.
 */

import { haversineDistance } from '@/lib/utils';
import { NearbyInstitution } from '@/hooks/useNearbyInstitutions';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// In-memory client cache (24-hr TTL for non-empty, 5-min TTL for empty)
interface CacheEntry {
  data: NearbyInstitution[];
  timestamp: number;
}
const clientCache = new Map<string, CacheEntry>();
const CACHE_TTL_SUCCESS_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_EMPTY_MS = 5 * 60 * 1000;

export function clearInstitutionsClientCache() {
  clientCache.clear();
}

function normalizeType(
  tags: Record<string, string>
): 'university' | 'college' | 'school' | 'kindergarten' | 'research_institute' | 'other' {
  const amenity = tags.amenity?.toLowerCase();
  const building = tags.building?.toLowerCase();
  const education = tags.education?.toLowerCase();
  const office = tags.office?.toLowerCase();

  if (amenity === 'university' || building === 'university' || education === 'university') return 'university';
  if (amenity === 'college' || building === 'college' || education === 'college') return 'college';
  if (amenity === 'school' || building === 'school' || education === 'school') return 'school';
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

function extractInstitutionName(tags: Record<string, string>, type: string, lang: string = 'en'): { name: string; isUnnamed: boolean } {
  const langKey = lang && lang !== 'en' ? `name:${lang}` : null;
  const resolved =
    (langKey ? tags[langKey]?.trim() : null) ||
    tags.name?.trim() ||
    tags['name:en']?.trim() ||
    tags.official_name?.trim() ||
    tags.short_name?.trim() ||
    tags.alt_name?.trim() ||
    tags.operator?.trim();

  if (resolved) {
    return { name: resolved, isUnnamed: false };
  }

  const typeLabel = type === 'other' ? 'Institution' : type.charAt(0).toUpperCase() + type.slice(1);
  return {
    name: `Unnamed ${typeLabel} (OpenStreetMap)`,
    isUnnamed: true,
  };
}

async function queryNominatimDirect(
  lat: number,
  lng: number,
  radiusMeters: number,
  typesFilter?: string[],
  lang: string = 'en'
): Promise<NearbyInstitution[]> {
  const deltaLat = radiusMeters / 111320;
  const deltaLng = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const viewbox = `${lng - deltaLng},${lat + deltaLat},${lng + deltaLng},${lat - deltaLat}`;

  const queryTerms = ['college', 'university', 'school'];
  const results: NearbyInstitution[] = [];
  const seenPlaceIds = new Set<string>();

  await Promise.all(
    queryTerms.map(async (term) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          term
        )}&viewbox=${viewbox}&bounded=1&limit=25&addressdetails=1`;

        const res = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Accept-Language': lang,
          },
          signal: controller.signal,
        });

        if (!res.ok) return;

        const items = await res.json();
        if (!Array.isArray(items)) return;

        for (const item of items) {
          const placeId = String(item.place_id || item.osm_id);
          if (seenPlaceIds.has(placeId)) continue;
          seenPlaceIds.add(placeId);

          const itemLat = parseFloat(item.lat);
          const itemLng = parseFloat(item.lon);
          if (isNaN(itemLat) || isNaN(itemLng)) continue;

          const distanceMeters = Math.round(haversineDistance(lat, lng, itemLat, itemLng) * 1000);
          if (distanceMeters > radiusMeters) continue;

          let instType: NearbyInstitution['type'] = 'other';
          const rawType = (item.type || item.class || '').toLowerCase();
          if (rawType.includes('university') || term === 'university') instType = 'university';
          else if (rawType.includes('college') || term === 'college') instType = 'college';
          else if (rawType.includes('school') || term === 'school') instType = 'school';

          if (typesFilter && typesFilter.length > 0 && !typesFilter.includes(instType)) {
            continue;
          }

          const name = item.name || item.display_name?.split(',')[0]?.trim() || `Unnamed ${instType} (Nominatim)`;

          results.push({
            id: `nom-${placeId}`,
            name,
            type: instType,
            address: item.display_name,
            lat: itemLat,
            lng: itemLng,
            distance: distanceMeters,
            source: 'nominatim',
          });
        }
      } catch {
        // Ignore single term failure
      } finally {
        clearTimeout(timeoutId);
      }
    })
  );

  results.sort((a, b) => a.distance - b.distance);
  return results;
}

/**
 * Queries OpenStreetMap Overpass directly from the client with Nominatim fallback.
 */
export async function queryOverpassDirectly(
  lat: number,
  lng: number,
  radiusMeters: number = 2000,
  typesFilter?: string[],
  lang: string = 'en'
): Promise<NearbyInstitution[]> {
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLng = Math.round(lng * 1000) / 1000;
  const sortedTypes = typesFilter ? [...typesFilter].sort().join(',') : 'all';
  const cacheKey = `${lang}_${roundedLat}_${roundedLng}_${radiusMeters}_${sortedTypes}`;

  // Check client cache with differentiated TTL
  const cached = clientCache.get(cacheKey);
  if (cached) {
    const ttl = cached.data.length > 0 ? CACHE_TTL_SUCCESS_MS : CACHE_TTL_EMPTY_MS;
    if (Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
  }

  const query = `
    [out:json][timeout:25];
    (
      node(around:${radiusMeters},${roundedLat},${roundedLng})["amenity"~"^(university|college|school|kindergarten|research_institute|language_school|training)$"];
      way(around:${radiusMeters},${roundedLat},${roundedLng})["amenity"~"^(university|college|school|kindergarten|research_institute|language_school|training)$"];
      relation(around:${radiusMeters},${roundedLat},${roundedLng})["amenity"~"^(university|college|school|kindergarten|research_institute|language_school|training)$"];

      node(around:${radiusMeters},${roundedLat},${roundedLng})["building"~"^(university|college|school)$"];
      way(around:${radiusMeters},${roundedLat},${roundedLng})["building"~"^(university|college|school)$"];
      relation(around:${radiusMeters},${roundedLat},${roundedLng})["building"~"^(university|college|school)$"];

      node(around:${radiusMeters},${roundedLat},${roundedLng})["landuse"="education"];
      way(around:${radiusMeters},${roundedLat},${roundedLng})["landuse"="education"];
      relation(around:${radiusMeters},${roundedLat},${roundedLng})["landuse"="education"];

      node(around:${radiusMeters},${roundedLat},${roundedLng})["office"="educational_institution"];
      way(around:${radiusMeters},${roundedLat},${roundedLng})["office"="educational_institution"];
      relation(around:${radiusMeters},${roundedLat},${roundedLng})["office"="educational_institution"];

      node(around:${radiusMeters},${roundedLat},${roundedLng})["education"];
      way(around:${radiusMeters},${roundedLat},${roundedLng})["education"];
      relation(around:${radiusMeters},${roundedLat},${roundedLng})["education"];

      node(around:${radiusMeters},${roundedLat},${roundedLng})["isced:level"];
      way(around:${radiusMeters},${roundedLat},${roundedLng})["isced:level"];
      relation(around:${radiusMeters},${roundedLat},${roundedLng})["isced:level"];
    );
    out center;
  `.trim();

  let elements: any[] = [];
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Accept': 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error(`Overpass returned HTTP ${res.status}`);
      }

      const json = await res.json();
      if (json.remark && /runtime error|timed out|quota/i.test(json.remark)) {
        throw new Error(`Overpass query error: ${json.remark}`);
      }

      elements = json.elements || [];
      break; // Success
    } catch (err: any) {
      lastError = err;
      // Failover to next mirror
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const parsed: NearbyInstitution[] = [];
  const seenKeys = new Set<string>();

  for (const el of elements) {
    const tags = el.tags || {};
    const instType = normalizeType(tags);

    if (typesFilter && typesFilter.length > 0 && !typesFilter.includes(instType)) {
      continue;
    }

    const itemLat = el.lat ?? el.center?.lat;
    const itemLng = el.lon ?? el.center?.lon;
    if (itemLat === undefined || itemLng === undefined) continue;

    const { name, isUnnamed } = extractInstitutionName(tags, instType, lang);

    const dedupKey = `${name.toLowerCase()}_${Math.round(itemLat * 100) / 100}_${Math.round(itemLng * 100) / 100}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    const distanceMeters = Math.round(haversineDistance(lat, lng, itemLat, itemLng) * 1000);

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
      source: 'overpass',
      isUnnamed,
    });
  }

  parsed.sort((a, b) => a.distance - b.distance);

  // If Overpass returned 0 results or failed, attempt Nominatim fallback
  if (parsed.length === 0) {
    try {
      const nomResults = await queryNominatimDirect(lat, lng, radiusMeters, typesFilter, lang);
      if (nomResults.length > 0) {
        clientCache.set(cacheKey, { data: nomResults, timestamp: Date.now() });
        return nomResults;
      }
    } catch {
      // Ignore
    }

    if (lastError && cached?.data) {
      return cached.data;
    }
  }

  clientCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
  return parsed;
}
