export * from './database';

export interface SearchFilters {
  query?: string;
  type?: 'all' | 'lost' | 'found';
  categoryId?: string;
  country?: string;
  state?: string;
  city?: string;
  landmark?: string;
  dateFrom?: string;
  dateTo?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  sortBy?: 'newest' | 'oldest' | 'proximity';
  page?: number;
  pageSize?: number;
}

export interface NominatimPlace {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    province?: string;
    municipality?: string;
    state?: string;
    country?: string;
    postcode?: string;
    [key: string]: string | undefined;
  };
}

export interface WalkingRoute {
  coordinates: [number, number][]; // [lat, lng]
  distanceMeters: number;
  durationSeconds: number;
  steps?: {
    instruction: string;
    distanceMeters: number;
  }[];
  isFallback?: boolean;
}

