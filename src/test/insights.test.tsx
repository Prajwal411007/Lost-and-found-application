import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocationProvider } from '@/contexts/LocationContext';
import { InsightsPage } from '@/pages/info/Insights';

// Mock LeafletMap
vi.mock('@/components/common/LeafletMap', () => ({
  LeafletMap: () => <div data-testid="mock-leaflet-map">Mock Leaflet Hotspots Map</div>,
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocationProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </LocationProvider>
    </QueryClientProvider>
  );
}

describe('Insights & Hotspot Analytics Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/stats/insights')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              summary: {
                totalReported: 142,
                totalLost: 90,
                totalFound: 52,
                itemsReturned: 68,
                returnRatePct: 48,
                avgTimeToReturnHours: 36,
              },
              categories: [
                {
                  category_id: 'cat-1',
                  category_name: 'Phones & Electronics',
                  total_items: 64,
                  lost_count: 40,
                  found_count: 24,
                  returned_count: 32,
                  return_rate_pct: 50,
                  avg_return_time_hours: 24,
                },
                {
                  category_id: 'cat-2',
                  category_name: 'Wallets & Cards',
                  total_items: 45,
                  lost_count: 30,
                  found_count: 15,
                  returned_count: 22,
                  return_rate_pct: 49,
                  avg_return_time_hours: 18,
                },
              ],
              weeklyTrends: [
                {
                  week_start: '2026-11-20',
                  total_items: 28,
                  lost_count: 18,
                  found_count: 10,
                  returned_count: 14,
                },
              ],
            }),
        } as Response);
      }

      if (urlStr.includes('/api/stats/hotspots')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              hotspots: [
                {
                  lat_rounded: 12.97,
                  lng_rounded: 77.59,
                  total_items: 42,
                  lost_count: 26,
                  found_count: 16,
                  returned_count: 18,
                  city: 'Bengaluru',
                  state: 'Karnataka',
                },
              ],
            }),
        } as Response);
      }

      return Promise.reject(new Error('Unknown url'));
    });
  });

  it('renders platform analytics summary KPIs accurately', async () => {
    renderWithProviders(<InsightsPage />);

    await waitFor(() => {
      // KPI values
      expect(screen.getByText('142')).toBeInTheDocument();
      expect(screen.getByText('68')).toBeInTheDocument();
      expect(screen.getByText('48%')).toBeInTheDocument();
    });

    // Subtitles and labels
    expect(screen.getByText(/Total Reports Logged/i)).toBeInTheDocument();
    expect(screen.getByText(/Successfully Reunited/i)).toBeInTheDocument();
    expect(screen.getByText(/Overall Recovery Rate/i)).toBeInTheDocument();
  });

  it('renders hotspot map with privacy guarantee callout', async () => {
    renderWithProviders(<InsightsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-leaflet-map')).toBeInTheDocument();
    });

    expect(screen.getByText(/Community Activity Hotspots/i)).toBeInTheDocument();
    expect(screen.getByText(/Exact coordinates are never displayed/i)).toBeInTheDocument();
    expect(screen.getByText('Bengaluru')).toBeInTheDocument();
  });

  it('renders category breakdown and weekly trend charts', async () => {
    renderWithProviders(<InsightsPage />);

    await waitFor(() => {
      expect(screen.getByText('Phones & Electronics')).toBeInTheDocument();
      expect(screen.getByText('Wallets & Cards')).toBeInTheDocument();
      expect(screen.getByText('50% returned')).toBeInTheDocument();
    });

    expect(screen.getByText(/Category Recovery Performance/i)).toBeInTheDocument();
    expect(screen.getByText(/Weekly Activity & Resolution Trends/i)).toBeInTheDocument();
  });
});
