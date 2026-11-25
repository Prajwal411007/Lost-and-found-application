import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CampusPage } from '../pages/campus/Campus';
import { clearInstitutionsClientCache } from '@/services/institutionsClient';

// Mock LeafletMap to render accessible container without real DOM WebGL/Canvas
vi.mock('@/components/common/LeafletMap', () => ({
  LeafletMap: ({ markers, onMapMoveEnd }: any) => (
    <div data-testid="leaflet-map-mock">
      {markers.map((m: any) => (
        <div key={m.id} data-testid={`marker-${m.id}`} data-title={m.title} />
      ))}
      <button
        data-testid="mock-pan-map"
        onClick={() => onMapMoveEnd?.({ lat: 37.45, lng: -122.2 }, 15)}
      >
        Simulate Map Pan
      </button>
    </div>
  ),
}));

// Mock Geolocation Context as denied / no permission
vi.mock('@/contexts/LocationContext', () => ({
  useGeolocation: () => ({
    coords: null,
    status: 'denied',
    generalArea: null,
    requestLocation: vi.fn(),
    clearLocation: vi.fn(),
    openPrompt: vi.fn(),
  }),
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

describe('Campus Mode - Nearby Institutions Feature', () => {
  let queryClient: QueryClient;

  const mockInstitutions = [
    {
      id: 'inst-1',
      name: 'Stanford University',
      type: 'university',
      address: '450 Jane Stanford Way, Stanford',
      lat: 37.4275,
      lng: -122.1697,
      website: 'https://stanford.edu',
      distance: 120,
    },
    {
      id: 'inst-2',
      name: 'Palo Alto High School',
      type: 'school',
      address: '50 Embarcadero Rd, Palo Alto',
      lat: 37.435,
      lng: -122.155,
      website: 'https://paly.net',
      distance: 1450,
    },
    {
      id: 'inst-3',
      name: 'Foothill College Campus',
      type: 'college',
      address: 'El Monte Rd, Los Altos Hills',
      lat: 37.36,
      lng: -122.12,
      website: 'https://foothill.edu',
      distance: 4200,
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
    clearInstitutionsClientCache();

    global.fetch = vi.fn((url: any) => {
      if (url.toString().includes('/api/nearby-institutions')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              institutions: mockInstitutions,
              count: mockInstitutions.length,
              centre: { lat: 37.4275, lng: -122.1697 },
              radius: 2000,
              attribution: '© OpenStreetMap contributors',
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);
    });
  });

  it('renders nearby institutions tab, type filter chips, and radius selector', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CampusPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify Tab Header
    expect(await screen.findByText('Nearby Institutions')).toBeInTheDocument();
    expect(screen.getByText('Campus Directory')).toBeInTheDocument();

    // Verify Filter Chips
    expect(screen.getByRole('button', { name: /Universities/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Colleges/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Schools/i })).toBeInTheDocument();

    // Verify Radius Selector
    expect(screen.getByLabelText(/Search radius/i)).toBeInTheDocument();

    // Verify institutions rendered sorted nearest first
    expect((await screen.findAllByText('Stanford University')).length).toBeGreaterThan(0);
    expect(screen.getByText('Palo Alto High School')).toBeInTheDocument();
    expect(screen.getByText('about 120 m away')).toBeInTheDocument();
    expect(screen.getByText(/about 1\.[45] km away/i)).toBeInTheDocument();
  });

  it('filters institutions in real-time when name filter input is typed', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CampusPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect((await screen.findAllByText('Stanford University')).length).toBeGreaterThan(0);
    expect(screen.getByText('Palo Alto High School')).toBeInTheDocument();

    // Type in filter input
    const filterInput = screen.getByPlaceholderText(/Filter by name/i);
    fireEvent.change(filterInput, { target: { value: 'High School' } });

    // Stanford button in list should be gone, Palo Alto High should remain
    expect(screen.queryByRole('button', { name: 'Stanford University' })).not.toBeInTheDocument();
    expect(screen.getByText('Palo Alto High School')).toBeInTheDocument();
  });

  it('shows "Search This Area" button after user pans the map', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CampusPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Click mock pan map button
    const panBtn = await screen.findByTestId('mock-pan-map');
    fireEvent.click(panBtn);

    // "Search This Area" button should appear
    expect(await screen.findByRole('button', { name: /Search This Area/i })).toBeInTheDocument();
  });

  it('allows manual city or area search without requiring geolocation permission', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CampusPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Check manual place search input
    const searchInput = await screen.findByPlaceholderText(/Search city or area/i);
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Cambridge' } });
    expect(searchInput).toHaveValue('Cambridge');
  });

  it('handles HTML response from Vercel without throwing JSON syntax error and falls back to direct Overpass query', async () => {
    global.fetch = vi.fn((url: any) => {
      if (url.toString().includes('/api/nearby-institutions')) {
        // Simulates Vercel SPA index.html rewrite (status 200 with text/html)
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
          text: () => Promise.resolve('<!doctype html><html><body>Root SPA Fallback</body></html>'),
        } as Response);
      }

      if (url.toString().includes('overpass')) {
        // Direct Overpass query succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () =>
            Promise.resolve({
              elements: [
                {
                  type: 'node',
                  id: 999,
                  lat: 37.428,
                  lon: -122.17,
                  tags: { name: 'Stanford Direct Fallback', amenity: 'university' },
                },
              ],
            }),
        } as Response);
      }

      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as any);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CampusPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify it didn't crash with "Unexpected token '<', <!doctype" and instead rendered fallback institution
    expect(await screen.findByText('Stanford Direct Fallback')).toBeInTheDocument();
  });

  it('displays 404 Service Not Reachable error with hint and Retry button when both API and fallback fail', async () => {
    global.fetch = vi.fn((url: any) => {
      if (url.toString().includes('/api/nearby-institutions')) {
        return Promise.resolve({
          ok: false,
          status: 404,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ error: 'Not Found' }),
        } as Response);
      }
      // Direct Overpass also rejected
      return Promise.reject(new Error('Overpass connection failed'));
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CampusPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Nearby Service Not Reachable \(HTTP 404\)/i)).toBeInTheDocument();
    expect(screen.getByText(/VITE_API_URL/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('displays 429 Rate Limit error with Retry button', async () => {
    global.fetch = vi.fn((url: any) => {
      if (url.toString().includes('/api/nearby-institutions')) {
        return Promise.resolve({
          ok: false,
          status: 429,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ error: 'Too Many Requests' }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as any);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CampusPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Search Rate Limit Exceeded/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('displays 502 OpenStreetMap error with Retry button', async () => {
    global.fetch = vi.fn((url: any) => {
      if (url.toString().includes('/api/nearby-institutions')) {
        return Promise.resolve({
          ok: false,
          status: 502,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ error: 'OpenStreetMap query failed or timed out' }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as any);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CampusPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/OpenStreetMap Service Busy/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('renders "Why no results?" expandable note in the empty state with search parameters', async () => {
    global.fetch = vi.fn((url: any) => {
      if (url.toString().includes('/api/nearby-institutions')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              institutions: [],
              count: 0,
              unnamedCount: 0,
              centre: { lat: 37.4275, lng: -122.1697 },
              radius: 2000,
              attribution: '© OpenStreetMap contributors',
            }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as any);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CampusPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/No institutions found within/i)).toBeInTheDocument();
    expect(screen.getByTestId('why-no-results')).toBeInTheDocument();
    expect(screen.getByText(/Why no results\? View query details/i)).toBeInTheDocument();
    expect(screen.getByText(/OSM Overpass \+ Nominatim/i)).toBeInTheDocument();
  });
});
