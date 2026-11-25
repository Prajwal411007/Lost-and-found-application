/**
 * Service for querying nearby educational and research institutions via OpenStreetMap (Overpass API)
 * with automatic Nominatim fallback and differentiated cache TTLs.
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
  source?: 'overpass' | 'nominatim';
  isUnnamed?: boolean;
}

interface CacheEntry {
  data: NearbyInstitution[];
  timestamp: number;
}

// Differentiated cache TTLs: 24h for non-empty results, 5m for empty results
const CACHE_TTL_SUCCESS_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_EMPTY_MS = 5 * 60 * 1000;
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

// Mutex queue to serialize requests to Overpass
let queueTail: Promise<any> = Promise.resolve();

function enqueueRequest<T>(task: () => Promise<T>): Promise<T> {
  const result = queueTail.then(task, task);
  queueTail = result.catch(() => { });
  return result;
}

export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export function normalizeType(tags: Record<string, string>): NearbyInstitution['type'] {
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

export function buildAddress(tags: Record<string, string>): string | undefined {
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
 * Resolves institution name across multiple standard OSM tags.
 * Unnamed institutions are never dropped: they receive a descriptive label.
 */
export function extractInstitutionName(tags: Record<string, string>, type: string, lang: string = 'en'): { name: string; isUnnamed: boolean } {
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

/**
 * Executes Overpass query with mirror fallback and timeout handling
 */
async function executeOverpassQuery(query: string): Promise<any> {
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 10000); // 10s per mirror for responsive failover

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

      const json: any = await res.json();

      // Check for Overpass remark errors (timeouts or memory limit errors inside 200 responses)
      if (json?.remark && /runtime error|timed out|quota/i.test(json.remark)) {
        throw new Error(`Overpass query error: ${json.remark}`);
      }

      return json;
    } catch (err: any) {
      lastError = err;
      // Try next mirror
    }
  }

  throw lastError || new Error('All Overpass servers failed or timed out');
}

/**
 * Fallback to OpenStreetMap Nominatim bounded search when Overpass returns 0 results or fails.
 */
export async function queryNominatimFallback(
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

  for (const term of queryTerms) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        term
      )}&viewbox=${viewbox}&bounded=1&limit=25&addressdetails=1`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'FindIt-Global-Platform/1.0 (Lost & Found Non-Profit; contact: info@findit.org)',
          'Accept': 'application/json',
          'Accept-Language': lang,
        },
        signal: controller.signal,
      });

      if (!res.ok) continue;

      const items = await res.json();
      if (!Array.isArray(items)) continue;

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
      // Continue to next term if one fails
    }
  }

  results.sort((a, b) => a.distance - b.distance);
  return results;
}

/**
 * Fetch nearby institutions from Overpass API (with Nominatim fallback and differentiated cache TTL).
 */
export async function getNearbyInstitutions(
  lat: number,
  lng: number,
  radiusMeters: number = 2000,
  typesFilter?: string[],
  lang: string = 'en'
): Promise<NearbyInstitution[]> {
  // Round coordinates to 3 decimals (~110 m) for cache grouping and privacy
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLng = Math.round(lng * 1000) / 1000;
  const sortedTypes = typesFilter ? [...typesFilter].sort().join(',') : 'all';
  const cacheKey = `${lang}_${roundedLat}_${roundedLng}_${radiusMeters}_${sortedTypes}`;

  // Check server-side cache with differentiated TTL (24h for success, 5m for empty)
  const cached = cache.get(cacheKey);
  if (cached) {
    const ttl = cached.data.length > 0 ? CACHE_TTL_SUCCESS_MS : CACHE_TTL_EMPTY_MS;
    if (Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
  }

  // Check in-flight request deduplication
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  const fetchPromise = enqueueRequest(async () => {
    // Construct expanded Overpass QL query searching nodes, ways, and relations
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
    let overpassFailed = false;

    try {
      const result = await executeOverpassQuery(query);
      elements = result.elements || [];
    } catch (err) {
      overpassFailed = true;
    }

    const parsed: NearbyInstitution[] = [];
    const seenKeys = new Set<string>();

    for (const el of elements) {
      const tags = el.tags || {};
      const instType = normalizeType(tags);

      // Filter by types if specified
      if (typesFilter && typesFilter.length > 0 && !typesFilter.includes(instType)) {
        continue;
      }

      const itemLat = el.lat ?? el.center?.lat;
      const itemLng = el.lon ?? el.center?.lon;
      if (itemLat === undefined || itemLng === undefined) continue;

      const { name, isUnnamed } = extractInstitutionName(tags, instType, lang);

      // Deduplicate overlapping nodes, ways, and relations for the same institution
      const dedupKey = `${name.toLowerCase()}_${Math.round(itemLat * 100) / 100}_${Math.round(itemLng * 100) / 100}`;
      if (seenKeys.has(dedupKey)) continue;
      seenKeys.add(dedupKey);

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
        source: 'overpass',
        isUnnamed,
      });
    }

    // Sort nearest first
    parsed.sort((a, b) => a.distance - b.distance);

    // If Overpass returned 0 results or failed, attempt Nominatim bounded fallback
    if (parsed.length === 0) {
      try {
        const nominatimResults = await queryNominatimFallback(lat, lng, radiusMeters, typesFilter, lang);
        if (nominatimResults.length > 0) {
          cache.set(cacheKey, {
            data: nominatimResults,
            timestamp: Date.now(),
          });
          return nominatimResults;
        }
      } catch {
        // Fallback failed
      }

      // If Overpass failed and Nominatim also yielded nothing, throw error (never return fake empty list on outage)
      if (overpassFailed) {
        throw new Error('All OpenStreetMap institution servers failed or timed out. Please try again.');
      }
    }

    // Cache results (differentiated TTL: 24h if non-empty, 5m if genuinely empty)
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
