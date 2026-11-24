import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocationProvider, useGeolocation } from '@/contexts/LocationContext';
import { LocationPermissionDialog } from '@/components/common/LocationPermissionDialog';
import { haversineDistance } from '@/lib/utils';
import { ReportItemPage } from '@/pages/items/ReportItem';
import { useAuth } from '@/contexts/AuthContext';

// Mock Leaflet
vi.mock('@/components/common/LeafletMap', () => ({
  LeafletMap: () => <div data-testid="mock-leaflet-map">Leaflet Map</div>,
}));

// Mock Geocoding
vi.mock('@/services/geocoding', () => ({
  reverseGeocode: vi.fn().mockResolvedValue({
    place_id: 12345,
    lat: '37.775',
    lon: '-122.419',
    display_name: 'San Francisco, California, United States',
    address: {
      city: 'San Francisco',
      state: 'California',
      country: 'United States',
    },
  }),
  searchPlaces: vi.fn().mockResolvedValue([
    {
      place_id: 999,
      lat: '37.7749',
      lon: '-122.4194',
      display_name: 'San Francisco, CA, USA',
      address: { city: 'San Francisco', state: 'California', country: 'United States' },
    },
  ]),
}));

// Mock Auth
vi.mock('@/contexts/AuthContext', async () => {
  const actual = await vi.importActual<any>('@/contexts/AuthContext');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

// Helper component to test useGeolocation hook
const LocationConsumer: React.FC = () => {
  const { coords, status, errorMessage, requestLocation, clearLocation, openPrompt } = useGeolocation();
  return (
    <div>
      <div data-testid="geo-status">{status}</div>
      <div data-testid="geo-coords">
        {coords ? `${coords.latitude},${coords.longitude}` : 'no-coords'}
      </div>
      <div data-testid="geo-error">{errorMessage || 'no-error'}</div>
      <button onClick={() => requestLocation()} data-testid="btn-request">
        Request
      </button>
      <button onClick={() => clearLocation()} data-testid="btn-clear">
        Clear
      </button>
      <button onClick={() => openPrompt()} data-testid="btn-open-prompt">
        Open Prompt
      </button>
    </div>
  );
};

describe('Geolocation & Proximity Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    (useAuth as any).mockReturnValue({
      user: { id: 'u001', email: 'tester@example.com' },
      isConfigured: true,
      isAdmin: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Haversine Distance Calculations', () => {
    it('accurately computes distance between coordinates', () => {
      // New York (40.7128, -74.0060) to Boston (42.3601, -71.0589) ~ 306 km
      const distance = haversineDistance(40.7128, -74.006, 42.3601, -71.0589);
      expect(distance).toBeGreaterThan(300);
      expect(distance).toBeLessThan(315);
    });

    it('returns 0 for identical points', () => {
      const distance = haversineDistance(37.7749, -122.4194, 37.7749, -122.4194);
      expect(distance).toBe(0);
    });
  });

  describe('LocationPermissionDialog', () => {
    it('displays pre-permission dialog on home or browse page when not yet dismissed', async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <LocationProvider>
            <LocationPermissionDialog />
          </LocationProvider>
        </MemoryRouter>
      );

      // Dialog opens after a brief timer
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/Find Items Near You/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Allow Location/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Not Now/i })).toBeInTheDocument();
      });
    });

    it('dismisses dialog and records in sessionStorage when "Not Now" is clicked', async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <LocationProvider>
            <LocationPermissionDialog />
          </LocationProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const notNowBtn = screen.getByRole('button', { name: /Not Now/i });
      fireEvent.click(notNowBtn);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(sessionStorage.getItem('findit_location_prompt_dismissed')).toBe('true');
    });

    it('dismisses dialog when Escape key is pressed', async () => {
      render(
        <MemoryRouter initialEntries={['/browse']}>
          <LocationProvider>
            <LocationPermissionDialog />
          </LocationProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('LocationContext & Geolocation States', () => {
    it('handles successful geolocation permission and saves rounded coords to sessionStorage', async () => {
      const mockGetCurrentPosition = vi.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: 37.7749295,
            longitude: -122.4194155,
            accuracy: 15,
          },
        });
      });

      Object.defineProperty(global.navigator, 'geolocation', {
        value: {
          getCurrentPosition: mockGetCurrentPosition,
          watchPosition: vi.fn(),
          clearWatch: vi.fn(),
        },
        writable: true,
      });

      render(
        <LocationProvider>
          <LocationConsumer />
        </LocationProvider>
      );

      const requestBtn = screen.getByTestId('btn-request');
      fireEvent.click(requestBtn);

      await waitFor(() => {
        expect(screen.getByTestId('geo-status')).toHaveTextContent('granted');
        expect(screen.getByTestId('geo-coords')).toHaveTextContent('37.7749295,-122.4194155');
      });

      // Confirm saved in sessionStorage
      const saved = sessionStorage.getItem('findit_user_location');
      expect(saved).not.toBeNull();
      const parsed = JSON.parse(saved!);
      expect(parsed.latitude).toBeCloseTo(37.775, 2);
    });

    it('handles PERMISSION_DENIED with helpful error guidance', async () => {
      const mockGetCurrentPosition = vi.fn().mockImplementation((_, error) => {
        error({
          code: 1, // PERMISSION_DENIED
          message: 'User denied Geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      });

      Object.defineProperty(global.navigator, 'geolocation', {
        value: {
          getCurrentPosition: mockGetCurrentPosition,
          watchPosition: vi.fn(),
          clearWatch: vi.fn(),
        },
        writable: true,
      });

      render(
        <LocationProvider>
          <LocationConsumer />
        </LocationProvider>
      );

      const requestBtn = screen.getByTestId('btn-request');
      fireEvent.click(requestBtn);

      await waitFor(() => {
        expect(screen.getByTestId('geo-status')).toHaveTextContent('denied');
        expect(screen.getByTestId('geo-error').textContent).toContain('Location permission was denied');
      });
    });

    it('handles TIMEOUT with clear retry instruction', async () => {
      const mockGetCurrentPosition = vi.fn().mockImplementation((_, error) => {
        error({
          code: 3, // TIMEOUT
          message: 'Geolocation timed out',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      });

      Object.defineProperty(global.navigator, 'geolocation', {
        value: {
          getCurrentPosition: mockGetCurrentPosition,
          watchPosition: vi.fn(),
          clearWatch: vi.fn(),
        },
        writable: true,
      });

      render(
        <LocationProvider>
          <LocationConsumer />
        </LocationProvider>
      );

      const requestBtn = screen.getByTestId('btn-request');
      fireEvent.click(requestBtn);

      await waitFor(() => {
        expect(screen.getByTestId('geo-status')).toHaveTextContent('error');
        expect(screen.getByTestId('geo-error').textContent).toContain('timed out');
      });
    });

    it('clears location properly when clearLocation is called', async () => {
      sessionStorage.setItem(
        'findit_user_location',
        JSON.stringify({ latitude: 37.775, longitude: -122.419 })
      );

      render(
        <LocationProvider>
          <LocationConsumer />
        </LocationProvider>
      );

      expect(screen.getByTestId('geo-coords')).toHaveTextContent('37.775,-122.419');

      const clearBtn = screen.getByTestId('btn-clear');
      fireEvent.click(clearBtn);

      await waitFor(() => {
        expect(screen.getByTestId('geo-coords')).toHaveTextContent('no-coords');
        expect(sessionStorage.getItem('findit_user_location')).toBeNull();
      });
    });
  });

  describe('ReportItem "Use My Current Location"', () => {
    it('renders "Use My Current Location" button and triggers location lookup', async () => {
      const mockGetCurrentPosition = vi.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: 37.7749295,
            longitude: -122.4194155,
            accuracy: 10,
          },
        });
      });

      Object.defineProperty(global.navigator, 'geolocation', {
        value: {
          getCurrentPosition: mockGetCurrentPosition,
          watchPosition: vi.fn(),
          clearWatch: vi.fn(),
        },
        writable: true,
      });

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <LocationProvider>
              <ReportItemPage initialType="lost" />
            </LocationProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const useLocationBtn = screen.getByRole('button', { name: /Use my current location/i });
      expect(useLocationBtn).toBeInTheDocument();

      fireEvent.click(useLocationBtn);

      await waitFor(() => {
        expect(mockGetCurrentPosition).toHaveBeenCalled();
        // Check approximate 3-decimal coordinates display
        expect(screen.getByText(/37.775, -122.419 \(Approximate\)/i)).toBeInTheDocument();
      });
    });
  });
});
