/**
 * Vercel Serverless Function handler for GET /api/nearby-institutions.
 * Automatically deployed and run by Vercel on edge/serverless infrastructure.
 * Includes Nominatim fallback, expanded Overpass query, and differentiated caching.
 */

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

interface NearbyInstitution {
  id: string;
  name: string;
  type: 'university' | 'college' | 'school' | 'kindergarten' | 'research_institute' | 'other';
  address?: string;
  lat: number;
  lng: number;
  website?: string;
  phone?: string;
  distance: number;
  source?: 'overpass' | 'nominatim';
  isUnnamed?: boolean;
}

// In-memory cache for warm serverless instances (24-hr TTL for success, 5-min TTL for empty)
const cache = new Map<string, { data: NearbyInstitution[]; timestamp: number }>();
const CACHE_TTL_SUCCESS_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_EMPTY_MS = 5 * 60 * 1000;

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
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

async function queryNominatimFallback(
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
            'User-Agent': 'FindIt-Global-Platform/1.0 (Lost & Found Non-Profit; contact: info@findit.org)',
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

          const distance = haversineDistanceMeters(lat, lng, itemLat, itemLng);
          if (distance > radiusMeters) continue;

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
            distance,
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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const query = req.query || {};
  const lat = parseFloat(query.lat);
  const lng = parseFloat(query.lng);
  const radius = Math.min(Math.max(parseInt(query.radius, 10) || 2000, 100), 10000);
  const types = query.types
    ? String(query.types)
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    : undefined;

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({
      error: 'Invalid coordinates: lat must be between -90 and 90, lng between -180 and 180.',
    });
  }

  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLng = Math.round(lng * 1000) / 1000;
  const sortedTypes = types ? [...types].sort().join(',') : 'all';
  const reqLang = (query.lang as string) || (req.headers['accept-language']?.startsWith('kn') ? 'kn' : req.headers['accept-language']?.startsWith('hi') ? 'hi' : 'en');
  const cacheKey = `${reqLang}_${roundedLat}_${roundedLng}_${radius}_${sortedTypes}`;

  // Check cache with differentiated TTL
  const cached = cache.get(cacheKey);
  if (cached) {
    const ttl = cached.data.length > 0 ? CACHE_TTL_SUCCESS_MS : CACHE_TTL_EMPTY_MS;
    if (Date.now() - cached.timestamp < ttl) {
      const unnamedCount = cached.data.filter((i) => i.isUnnamed).length;
      return res.status(200).json({
        institutions: cached.data,
        count: cached.data.length,
        unnamedCount,
        centre: { lat: roundedLat, lng: roundedLng },
        radius,
        attribution: '© OpenStreetMap contributors',
      });
    }
  }

  const overpassQuery = `
    [out:json][timeout:25];
    (
      node(around:${radius},${roundedLat},${roundedLng})["amenity"~"^(university|college|school|kindergarten|research_institute|language_school|training)$"];
      way(around:${radius},${roundedLat},${roundedLng})["amenity"~"^(university|college|school|kindergarten|research_institute|language_school|training)$"];
      relation(around:${radius},${roundedLat},${roundedLng})["amenity"~"^(university|college|school|kindergarten|research_institute|language_school|training)$"];

      node(around:${radius},${roundedLat},${roundedLng})["building"~"^(university|college|school)$"];
      way(around:${radius},${roundedLat},${roundedLng})["building"~"^(university|college|school)$"];
      relation(around:${radius},${roundedLat},${roundedLng})["building"~"^(university|college|school)$"];

      node(around:${radius},${roundedLat},${roundedLng})["landuse"="education"];
      way(around:${radius},${roundedLat},${roundedLng})["landuse"="education"];
      relation(around:${radius},${roundedLat},${roundedLng})["landuse"="education"];

      node(around:${radius},${roundedLat},${roundedLng})["office"="educational_institution"];
      way(around:${radius},${roundedLat},${roundedLng})["office"="educational_institution"];
      relation(around:${radius},${roundedLat},${roundedLng})["office"="educational_institution"];

      node(around:${radius},${roundedLat},${roundedLng})["education"];
      way(around:${radius},${roundedLat},${roundedLng})["education"];
      relation(around:${radius},${roundedLat},${roundedLng})["education"];

      node(around:${radius},${roundedLat},${roundedLng})["isced:level"];
      way(around:${radius},${roundedLat},${roundedLng})["isced:level"];
      relation(around:${radius},${roundedLat},${roundedLng})["isced:level"];
    );
    out center;
  `.trim();

  let elements: any[] = [];
  let overpassFailed = false;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'FindIt-Global-Platform/1.0 (Lost & Found Non-Profit; contact: info@findit.org)',
          'Accept': 'application/json',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('application/json')) {
        throw new Error(`Endpoint returned HTTP ${response.status}`);
      }

      const json = await response.json();
      if (json.remark && /runtime error|timed out|quota/i.test(json.remark)) {
        throw new Error(`Overpass query error: ${json.remark}`);
      }

      elements = json.elements || [];
      break;
    } catch {
      // Try next mirror
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (elements.length === 0) {
    overpassFailed = true;
  }

  const parsed: NearbyInstitution[] = [];
  const seenKeys = new Set<string>();

  for (const el of elements) {
    const tags = el.tags || {};
    const instType = normalizeType(tags);

    if (types && types.length > 0 && !types.includes(instType)) {
      continue;
    }

    const itemLat = el.lat ?? el.center?.lat;
    const itemLng = el.lon ?? el.center?.lon;
    if (itemLat === undefined || itemLng === undefined) continue;

    const { name, isUnnamed } = extractInstitutionName(tags, instType, reqLang);

    const dedupKey = `${name.toLowerCase()}_${Math.round(itemLat * 100) / 100}_${Math.round(itemLng * 100) / 100}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    parsed.push({
      id: `osm-${el.type}-${el.id}`,
      name,
      type: instType,
      address: buildAddress(tags),
      lat: itemLat,
      lng: itemLng,
      website: tags['contact:website'] || tags.website || tags.url,
      phone: tags['contact:phone'] || tags.phone,
      distance: haversineDistanceMeters(lat, lng, itemLat, itemLng),
      source: 'overpass',
      isUnnamed,
    });
  }

  parsed.sort((a, b) => a.distance - b.distance);

  // If Overpass returned 0 results or failed, attempt Nominatim fallback
  if (parsed.length === 0) {
    try {
      const nomResults = await queryNominatimFallback(lat, lng, radius, types, reqLang);
      if (nomResults.length > 0) {
        cache.set(cacheKey, { data: nomResults, timestamp: Date.now() });
        return res.status(200).json({
          institutions: nomResults,
          count: nomResults.length,
          unnamedCount: 0,
          centre: { lat: roundedLat, lng: roundedLng },
          radius,
          attribution: '© OpenStreetMap & Nominatim contributors',
        });
      }
    } catch {
      // Ignore
    }

    if (overpassFailed && cached?.data) {
      // Return stale cache if available
      return res.status(200).json({
        institutions: cached.data,
        count: cached.data.length,
        unnamedCount: cached.data.filter((i) => i.isUnnamed).length,
        centre: { lat: roundedLat, lng: roundedLng },
        radius,
        attribution: '© OpenStreetMap contributors',
      });
    }
  }

  cache.set(cacheKey, { data: parsed, timestamp: Date.now() });

  const unnamedCount = parsed.filter((i) => i.isUnnamed).length;
  return res.status(200).json({
    institutions: parsed,
    count: parsed.length,
    unnamedCount,
    centre: { lat: roundedLat, lng: roundedLng },
    radius,
    attribution: '© OpenStreetMap contributors',
  });
}
