import { WalkingRoute } from '@/types';
import { haversineDistance } from '@/lib/utils';

const routeCache = new Map<string, WalkingRoute>();

/**
 * Calculates walking directions using the Open Source Routing Machine (OSRM) walking profile.
 * Implements polite headers, in-memory caching, and friendly fallback.
 */
export async function getWalkingDirections(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<WalkingRoute> {
  const cacheKey = `${startLat.toFixed(5)},${startLng.toFixed(5)};${endLat.toFixed(5)},${endLng.toFixed(5)}`;

  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/walking/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FindIt-GlobalLostAndFoundPlatform/1.0 (contact@lostandfound.local)',
      },
    });

    if (!response.ok) {
      throw new Error(`OSRM status ${response.status}`);
    }

    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      // OSRM coordinates are in [longitude, latitude], Leaflet needs [latitude, longitude]
      const coordinates: [number, number][] = primaryRoute.geometry.coordinates.map(
        (pt: [number, number]) => [pt[1], pt[0]]
      );

      const steps: { instruction: string; distanceMeters: number }[] = [];
      if (primaryRoute.legs && primaryRoute.legs[0]?.steps) {
        for (const s of primaryRoute.legs[0].steps) {
          if (s.maneuver?.type) {
            steps.push({
              instruction: s.name ? `Walk on ${s.name}` : `${s.maneuver.type} ${s.maneuver.modifier || ''}`,
              distanceMeters: Math.round(s.distance),
            });
          }
        }
      }

      const result: WalkingRoute = {
        coordinates,
        distanceMeters: Math.round(primaryRoute.distance),
        durationSeconds: Math.round(primaryRoute.duration),
        steps: steps.slice(0, 8),
        isFallback: false,
      };

      routeCache.set(cacheKey, result);
      return result;
    }

    throw new Error('No OSRM routes found');
  } catch (error) {
    console.warn('OSRM routing unavailable, generating graceful fallback route:', error);

    // Fallback: Great-circle straight line with intermediate waypoints
    const distKm = haversineDistance(startLat, startLng, endLat, endLng);
    const distMeters = Math.round(distKm * 1000);
    const durationSeconds = Math.round(distMeters / 1.35); // ~1.35 m/s walking speed (~5 km/h)

    // Intermediate points for smooth visual line
    const coordinates: [number, number][] = [
      [startLat, startLng],
      [
        startLat + (endLat - startLat) * 0.5,
        startLng + (endLng - startLng) * 0.5,
      ],
      [endLat, endLng],
    ];

    const fallbackResult: WalkingRoute = {
      coordinates,
      distanceMeters: distMeters,
      durationSeconds,
      steps: [
        {
          instruction: `Walk straight towards destination (${Math.round(distMeters)} meters)`,
          distanceMeters: distMeters,
        },
      ],
      isFallback: true,
    };

    routeCache.set(cacheKey, fallbackResult);
    return fallbackResult;
  }
}

