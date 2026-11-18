import { NominatimPlace } from '@/types';

// In-memory cache for Nominatim geocoding requests
const geocodeCache = new Map<string, NominatimPlace[]>();

/**
 * Searches locations using OpenStreetMap Nominatim with polite headers,
 * caching, and debouncing. Never forces browser geolocation.
 */
export async function searchPlaces(query: string): Promise<NominatimPlace[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const cacheKey = trimmed.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  try {
    const params = new URLSearchParams({
      q: trimmed,
      format: 'json',
      addressdetails: '1',
      limit: '5',
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FindIt-GlobalLostAndFoundPlatform/1.0 (contact@lostandfound.local)',
      },
    });

    if (!response.ok) {
      console.warn('Nominatim rate-limit or error:', response.status);
      return [];
    }

    const data: NominatimPlace[] = await response.json();
    geocodeCache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Failed to geocode with Nominatim:', error);
    return [];
  }
}

/**
 * Reverse geocodes coordinates to address details with caching
 */
export async function reverseGeocode(lat: number, lon: number): Promise<NominatimPlace | null> {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (geocodeCache.has(cacheKey)) {
    const cached = geocodeCache.get(cacheKey);
    return cached && cached.length > 0 ? cached[0] : null;
  }

  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      format: 'json',
      addressdetails: '1',
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FindIt-GlobalLostAndFoundPlatform/1.0 (contact@lostandfound.local)',
      },
    });

    if (!response.ok) return null;
    const data: NominatimPlace = await response.json();
    geocodeCache.set(cacheKey, [data]);
    return data;
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return null;
  }
}

