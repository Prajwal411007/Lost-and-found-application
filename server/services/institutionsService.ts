/**
 * Service for querying nearby educational and research institutions via OpenStreetMap (Overpass API).
 * Implements Overpass usage policy: 1-at-a-time serialized queue, 15s timeout, 24-hr caching,
 * and automatic mirror fallback.
 */

export interface NearbyInstitution {
  id: string;
  name: string;
  type: 'university' | 'college' | 'school' | 'kindergarten' | 'research_institute' | 'other';
  address?: string;
  lat: number;
  lng: number;
  website?: string;
  phone?: string;
  distance: number; // in meters
}

interface CacheEntry {
  data: NearbyInstitution[];
  timestamp: number;
}

// 24-hour server-side TTL cache
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

// In-flight deduplication
const inFlightRequests = new Map<string, Promise<NearbyInstitution[]>>();

// Overpass API Servers (Primary + Mirrors)
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Mutex queue to guarantee 1 request at a time to Overpass
let queueTail: Promise<any> = Promise.resolve();

function enqueueRequest<T>(task: () => Promise<T>): Promise<T> {
  const result = queueTail.then(task, task);
  queueTail = result.catch(() => {});
  return result;
}

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function normalizeType(tags: Record<string, string>): NearbyInstitution['type'] {
  const amenity = tags.amenity?.toLowerCase();
  const building = tags.building?.toLowerCase();

  if (amenity === 'university' || building === 'university') return 'university';
  if (amenity === 'college' || building === 'college') return 'college';
  if (amenity === 'school' || building === 'school') return 'school';
  if (amenity === 'kindergarten') return 'kindergarten';
  if (amenity === 'research_institute') return 'research_institute';
  return 'other';
}

function buildAddress(tags: Record<string, string>): string | undefined {
  const parts: string[] = [];
  const house = tags['addr:housenumber'];
  const street = tags['addr:street'];
  const city = tags['addr:city'] || tags['addr:suburb'] || tags['addr:town'];
  const postcode = tags['addr:postcode'];

  if (house && street) parts.push(`${house} ${street}`);
  else if (street) parts.push(street);

  if (city) parts.push(city);
  if (postcode) parts.push(postcode);

  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Executes Overpass query with mirror fallback and 15s timeout
 */
async function executeOverpassQuery(query: string): Promise<any> {
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 8000); // 8s timeout per mirror for responsive failover

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'FindIt-Global-Platform/1.0 (Lost & Found Non-Profit; contact: info@findit.org)',
          'Accept': 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Overpass server returned HTTP ${res.status}`);
      }

      const json = await res.json();
      return json;
    } catch (err: any) {
      lastError = err;
      // Try next mirror
    }
  }

  throw lastError || new Error('All Overpass servers failed or timed out');
}

/**
 * Fetch nearby institutions from Overpass API or 24-hr cache.
 */
export async function getNearbyInstitutions(
  lat: number,
  lng: number,
  radiusMeters: number = 2000,
  typesFilter?: string[]
): Promise<NearbyInstitution[]> {
  // Round coordinates to 3 decimals (~110 m) for cache grouping and privacy
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLng = Math.round(lng * 1000) / 1000;
  const sortedTypes = typesFilter ? [...typesFilter].sort().join(',') : 'all';
  const cacheKey = `${roundedLat}_${roundedLng}_${radiusMeters}_${sortedTypes}`;

  // Check 24-hr server-side cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Check in-flight request deduplication
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  const fetchPromise = enqueueRequest(async () => {
    // Construct Overpass QL query with "around" filter and out center
    const query = `
      [out:json][timeout:25];
      (
        node(around:${radiusMeters},${roundedLat},${roundedLng})["amenity"~"^(university|college|school|kindergarten|research_institute)$"];
        way(around:${radiusMeters},${roundedLat},${roundedLng})["amenity"~"^(university|college|school|kindergarten|research_institute)$"];
        way(around:${radiusMeters},${roundedLat},${roundedLng})["building"~"^(university|college)$"];
      );
      out center;
    `.trim();

    const result = await executeOverpassQuery(query);
    const elements: any[] = result.elements || [];

    const parsed: NearbyInstitution[] = [];
    const seenNamesAndCoords = new Set<string>();

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name?.trim();
      if (!name) continue; // Skip unnamed features per spec

      const itemLat = el.lat ?? el.center?.lat;
      const itemLng = el.lon ?? el.center?.lon;
      if (itemLat === undefined || itemLng === undefined) continue;

      const instType = normalizeType(tags);

      // Filter by types if specified
      if (typesFilter && typesFilter.length > 0 && !typesFilter.includes(instType)) {
        continue;
      }

      // Deduplicate overlapping nodes and ways for the same institution
      const dedupKey = `${name.toLowerCase()}_${Math.round(itemLat * 100) / 100}_${Math.round(itemLng * 100) / 100}`;
      if (seenNamesAndCoords.has(dedupKey)) continue;
      seenNamesAndCoords.add(dedupKey);

      const distance = haversineDistanceMeters(lat, lng, itemLat, itemLng);

      parsed.push({
        id: String(el.id),
        name,
        type: instType,
        address: buildAddress(tags),
        lat: itemLat,
        lng: itemLng,
        website: tags.website || tags['contact:website'] || tags.url,
        phone: tags.phone || tags['contact:phone'],
        distance,
      });
    }

    // Sort nearest first
    parsed.sort((a, b) => a.distance - b.distance);

    // Store in 24-hr cache
    cache.set(cacheKey, {
      data: parsed,
      timestamp: Date.now(),
    });

    return parsed;
  });

  inFlightRequests.set(cacheKey, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}

/**
 * Clear cache helper for unit tests
 */
export function clearInstitutionsCache(): void {
  cache.clear();
  inFlightRequests.clear();
}
