/**
 * Vercel Serverless Function handler for GET /api/nearby-institutions.
 * Automatically deployed and run by Vercel on edge/serverless infrastructure.
 */

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
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
}

// In-memory cache for warm serverless instances (24-hr TTL)
const cache = new Map<string, { data: NearbyInstitution[]; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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

export default async function handler(req: any, res: any) {
  // Always set CORS and JSON Content-Type headers
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

  // Parse query parameters
  const query = req.query || {};
  const lat = parseFloat(query.lat);
  const lng = parseFloat(query.lng);
  const radius = Math.min(Math.max(parseInt(query.radius, 10) || 2000, 100), 10000);
  const types = query.types ? String(query.types).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : undefined;

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({
      error: 'Invalid coordinates: lat must be between -90 and 90, lng between -180 and 180.',
    });
  }

  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLng = Math.round(lng * 1000) / 1000;
  const sortedTypes = types ? [...types].sort().join(',') : 'all';
  const cacheKey = `${roundedLat}_${roundedLng}_${radius}_${sortedTypes}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.status(200).json({
      institutions: cached.data,
      count: cached.data.length,
      centre: { lat: roundedLat, lng: roundedLng },
      radius,
      attribution: '© OpenStreetMap contributors',
    });
  }

  const overpassQuery = `
    [out:json][timeout:15];
    (
      node(around:${radius},${roundedLat},${roundedLng})["amenity"~"^(university|college|school|kindergarten|research_institute)$"];
      way(around:${radius},${roundedLat},${roundedLng})["amenity"~"^(university|college|school|kindergarten|research_institute)$"];
      way(around:${radius},${roundedLat},${roundedLng})["building"~"^(university|college)$"];
    );
    out center;
  `.trim();

  let elements: any[] = [];
  let lastError: any = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

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

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('application/json')) {
        throw new Error(`Endpoint returned HTTP ${response.status}`);
      }

      const json = await response.json();
      elements = json.elements || [];
      break;
    } catch (err: any) {
      lastError = err;
    }
  }

  if (elements.length === 0 && lastError && cached?.data) {
    // Return stale cache on complete upstream outage
    return res.status(200).json({
      institutions: cached.data,
      count: cached.data.length,
      centre: { lat: roundedLat, lng: roundedLng },
      radius,
      attribution: '© OpenStreetMap contributors',
    });
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
    if (types && types.length > 0 && !types.includes(instType)) {
      continue;
    }

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
    });
  }

  parsed.sort((a, b) => a.distance - b.distance);

  cache.set(cacheKey, { data: parsed, timestamp: Date.now() });

  return res.status(200).json({
    institutions: parsed,
    count: parsed.length,
    centre: { lat: roundedLat, lng: roundedLng },
    radius,
    attribution: '© OpenStreetMap contributors',
  });
}
