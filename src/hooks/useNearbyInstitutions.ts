import { useQuery } from '@tanstack/react-query';

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

export interface NearbyInstitutionsResponse {
  institutions: NearbyInstitution[];
  count: number;
  centre: { lat: number; lng: number };
  radius: number;
  attribution: string;
}

interface UseNearbyInstitutionsOptions {
  lat?: number | null;
  lng?: number | null;
  radius?: number; // in meters
  types?: string[]; // e.g. ['university', 'college']
  enabled?: boolean;
}

export function useNearbyInstitutions({
  lat,
  lng,
  radius = 2000,
  types,
  enabled = true,
}: UseNearbyInstitutionsOptions) {
  const roundedLat = lat != null ? Math.round(lat * 1000) / 1000 : null;
  const roundedLng = lng != null ? Math.round(lng * 1000) / 1000 : null;
  const typesParam = types && types.length > 0 ? types.join(',') : '';

  return useQuery<NearbyInstitutionsResponse, Error>({
    queryKey: ['nearby-institutions', roundedLat, roundedLng, radius, typesParam],
    queryFn: async () => {
      if (roundedLat == null || roundedLng == null) {
        return {
          institutions: [],
          count: 0,
          centre: { lat: 0, lng: 0 },
          radius,
          attribution: '© OpenStreetMap contributors',
        };
      }

      const params = new URLSearchParams({
        lat: String(roundedLat),
        lng: String(roundedLng),
        radius: String(radius),
      });

      if (typesParam) {
        params.set('types', typesParam);
      }

      const res = await fetch(`/api/nearby-institutions?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch nearby institutions (HTTP ${res.status})`);
      }

      return res.json();
    },
    enabled: enabled && roundedLat != null && roundedLng != null,
    staleTime: 1000 * 60 * 5, // 5 minutes client cache
    gcTime: 1000 * 60 * 30, // 30 minutes in memory
    retry: 1,
  });
}
