import { useQuery } from '@tanstack/react-query';
import { queryOverpassDirectly } from '@/services/institutionsClient';

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

export type InstitutionErrorCode =
  | 'SERVICE_UNREACHABLE' // 404 or connection refused (backend down / unconfigured)
  | 'RATE_LIMITED'        // 429
  | 'TIMEOUT'             // 504 or aborted / timeout
  | 'OVERPASS_FAILURE'    // 502
  | 'INVALID_PARAMS'      // 400
  | 'UNKNOWN';

export class InstitutionApiError extends Error {
  code: InstitutionErrorCode;
  status?: number;

  constructor(code: InstitutionErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'InstitutionApiError';
    this.code = code;
    this.status = status;
  }
}

export interface InstitutionErrorInfo {
  code: InstitutionErrorCode;
  title: string;
  message: string;
  hint?: string;
}

/**
 * Maps any error from useNearbyInstitutions into a structured user-facing message with actionable guidance.
 */
export function getInstitutionErrorInfo(err: unknown): InstitutionErrorInfo {
  if (err instanceof InstitutionApiError) {
    switch (err.code) {
      case 'SERVICE_UNREACHABLE':
        return {
          code: 'SERVICE_UNREACHABLE',
          title: 'Nearby Service Not Reachable (HTTP 404)',
          message:
            'The nearby institutions backend route could not be reached.',
          hint:
            'If developing locally, verify the Express backend is running on port 3001 (run "npm run dev"). In production on Vercel, set VITE_API_URL to your backend URL.',
        };
      case 'RATE_LIMITED':
        return {
          code: 'RATE_LIMITED',
          title: 'Search Rate Limit Exceeded (HTTP 429)',
          message:
            'You have made too many institution queries in a short period.',
          hint: 'Please wait a moment before searching again.',
        };
      case 'TIMEOUT':
        return {
          code: 'TIMEOUT',
          title: 'Request Timed Out',
          message:
            'The OpenStreetMap Overpass query took too long to complete.',
          hint: 'Public OpenStreetMap servers may be experiencing high latency. Click Retry to try a mirror.',
        };
      case 'OVERPASS_FAILURE':
        return {
          code: 'OVERPASS_FAILURE',
          title: 'OpenStreetMap Service Busy (HTTP 502)',
          message:
            'The upstream OpenStreetMap institution service is temporarily unavailable.',
          hint: 'The system queries multiple mirror servers automatically. Click Retry to re-query.',
        };
      case 'INVALID_PARAMS':
        return {
          code: 'INVALID_PARAMS',
          title: 'Invalid Search Coordinates',
          message: err.message || 'The specified search coordinates or radius are invalid.',
          hint: 'Try clicking on the map or searching a different city or campus area.',
        };
      default:
        return {
          code: 'UNKNOWN',
          title: 'Unable to Load Nearby Institutions',
          message: err.message || 'An unexpected error occurred while querying nearby institutions.',
        };
    }
  }

  const msg = err instanceof Error ? err.message : String(err || '');
  if (msg.includes('404')) {
    return {
      code: 'SERVICE_UNREACHABLE',
      title: 'Nearby Service Not Reachable (HTTP 404)',
      message: 'The nearby institutions backend route could not be reached.',
      hint:
        'Verify the Express backend is running on port 3001 or check your VITE_API_URL environment variable.',
    };
  }

  return {
    code: 'UNKNOWN',
    title: 'Unable to Load Nearby Institutions',
    message: msg || 'An unexpected network error occurred.',
  };
}

interface UseNearbyInstitutionsOptions {
  lat?: number | null;
  lng?: number | null;
  radius?: number; // in meters
  types?: string[]; // e.g. ['university', 'college']
  enabled?: boolean;
  retry?: boolean | number;
}

export function useNearbyInstitutions({
  lat,
  lng,
  radius = 2000,
  types,
  enabled = true,
  retry = process.env.NODE_ENV === 'test' ? false : 1,
}: UseNearbyInstitutionsOptions) {
  const roundedLat = lat != null ? Math.round(lat * 1000) / 1000 : null;
  const roundedLng = lng != null ? Math.round(lng * 1000) / 1000 : null;
  const typesParam = types && types.length > 0 ? types.join(',') : '';

  // In development, empty string uses relative /api which Vite proxies to port 3001.
  // In production (e.g. Vercel), VITE_API_URL points to the deployed Express backend.
  const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

  return useQuery<NearbyInstitutionsResponse, InstitutionApiError | Error>({
    queryKey: ['nearby-institutions', roundedLat, roundedLng, radius, typesParam, apiBaseUrl],
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

      const targetUrl = `${apiBaseUrl}/api/nearby-institutions?${params.toString()}`;

      let res: Response;
      try {
        res = await fetch(targetUrl);
      } catch (networkErr: any) {
        if (networkErr.name === 'AbortError') {
          throw new InstitutionApiError(
            'TIMEOUT',
            'Request timed out while connecting to the institution service. Please retry.'
          );
        }

        // On network failure to backend, try direct client Overpass fallback
        try {
          const directData = await queryOverpassDirectly(roundedLat, roundedLng, radius, types);
          return {
            institutions: directData,
            count: directData.length,
            centre: { lat: roundedLat, lng: roundedLng },
            radius,
            attribution: '© OpenStreetMap contributors',
          };
        } catch {
          throw new InstitutionApiError(
            'SERVICE_UNREACHABLE',
            'Failed to connect to the backend API. Please ensure the backend server is running on port 3001 or check VITE_API_URL.'
          );
        }
      }

      // Check Content-Type BEFORE calling res.json() to prevent "Unexpected token '<', <!doctype" syntax errors
      const contentType = res.headers?.get ? (res.headers.get('content-type') || '') : '';
      const isHtml =
        contentType.includes('text/html') ||
        contentType.includes('application/xhtml+xml');

      if (isHtml) {
        // Received HTML (e.g. Vercel SPA rewrite to index.html or 404 page).
        // Fall back gracefully to direct OpenStreetMap query:
        try {
          const directData = await queryOverpassDirectly(roundedLat, roundedLng, radius, types);
          if (directData && directData.length > 0) {
            return {
              institutions: directData,
              count: directData.length,
              centre: { lat: roundedLat, lng: roundedLng },
              radius,
              attribution: '© OpenStreetMap contributors',
            };
          }
        } catch {
          // Fall through to error
        }

        throw new InstitutionApiError(
          'SERVICE_UNREACHABLE',
          'Nearby institutions endpoint returned an HTML page and the direct fallback could not complete. Please retry.',
          res.status || 404
        );
      }

      // Safely parse JSON
      let data: any;
      try {
        data = await res.json();
      } catch (parseErr: any) {
        // Parsing failed (e.g. unformatted body or HTML without proper Content-Type header): fall back to direct query
        try {
          const directData = await queryOverpassDirectly(roundedLat, roundedLng, radius, types);
          return {
            institutions: directData,
            count: directData.length,
            centre: { lat: roundedLat, lng: roundedLng },
            radius,
            attribution: '© OpenStreetMap contributors',
          };
        } catch {
          throw new InstitutionApiError(
            'SERVICE_UNREACHABLE',
            `Failed to parse server response as JSON: ${parseErr.message}`,
            res.status
          );
        }
      }

      if (!res.ok) {
        const serverMessage = data.error || data.details || data.message;

        if (res.status === 404) {
          try {
            const directData = await queryOverpassDirectly(roundedLat, roundedLng, radius, types);
            if (directData && directData.length > 0) {
              return {
                institutions: directData,
                count: directData.length,
                centre: { lat: roundedLat, lng: roundedLng },
                radius,
                attribution: '© OpenStreetMap contributors',
              };
            }
          } catch {
            // Fall through to error
          }

          throw new InstitutionApiError(
            'SERVICE_UNREACHABLE',
            'Nearby institutions service is not reachable (HTTP 404). If running locally, please ensure the backend server is running on port 3001. In production on Vercel, set the VITE_API_URL environment variable.',
            404
          );
        }

        if (res.status === 429) {
          throw new InstitutionApiError(
            'RATE_LIMITED',
            serverMessage || 'Rate limit reached for institution searches. Please wait a few seconds before trying again.',
            429
          );
        }

        if (res.status === 504) {
          throw new InstitutionApiError(
            'TIMEOUT',
            serverMessage || 'OpenStreetMap institution query timed out. Please retry in a few moments.',
            504
          );
        }

        if (res.status === 502) {
          throw new InstitutionApiError(
            'OVERPASS_FAILURE',
            serverMessage || 'OpenStreetMap data service is currently unavailable or busy. Automatic mirror fallback will be re-attempted on retry.',
            502
          );
        }

        if (res.status === 400) {
          throw new InstitutionApiError(
            'INVALID_PARAMS',
            serverMessage || 'Invalid search coordinates or radius provided.',
            400
          );
        }

        throw new InstitutionApiError(
          'UNKNOWN',
          serverMessage || `Failed to fetch nearby institutions (HTTP ${res.status}).`,
          res.status
        );
      }

      return data;
    },
    enabled: enabled && roundedLat != null && roundedLng != null,
    staleTime: 1000 * 60 * 5, // 5 minutes client cache
    gcTime: 1000 * 60 * 30, // 30 minutes in memory
    retry,
  });
}
