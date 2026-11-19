import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ReportItemPage } from '@/pages/items/ReportItem';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/contexts/AuthContext', async () => {
  const actual = await vi.importActual<any>('@/contexts/AuthContext');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

// Mock Leaflet
vi.mock('@/components/common/LeafletMap', () => ({
  LeafletMap: () => <div data-testid="mock-leaflet-map">Leaflet Map</div>,
}));

describe('Report Item Page - Creation and Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      user: { id: 'u001', email: 'tester@example.com' },
      isConfigured: true,
      isAdmin: false,
    });
  });

  it('renders report form with proper title and privacy warning when reporting found item', () => {
    render(
      <MemoryRouter>
        <ReportItemPage initialType="found" />
      </MemoryRouter>
    );

    expect(screen.getByText(/Report a Found Item/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacy & Security Warning:/i)).toBeInTheDocument();
    expect(screen.getByText(/post full credit card numbers/i)).toBeInTheDocument();
  });

  it('validates required fields on submission', async () => {
    render(
      <MemoryRouter>
        <ReportItemPage initialType="lost" />
      </MemoryRouter>
    );

    const submitBtn = screen.getByRole('button', { name: /Submit Lost Report/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Title must be at least 3 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/Please provide at least 10 characters of description/i)).toBeInTheDocument();
      expect(screen.getByText(/Please select a category/i)).toBeInTheDocument();
    });
  });

  it('switches between Lost and Found mode dynamically', () => {
    render(
      <MemoryRouter>
        <ReportItemPage initialType="lost" />
      </MemoryRouter>
    );

    expect(screen.getByText(/Report a Lost Item/i)).toBeInTheDocument();
    expect(screen.queryByText(/Privacy & Security Warning:/i)).not.toBeInTheDocument();

    const foundTab = screen.getByRole('button', { name: /Found by Me/i });
    fireEvent.click(foundTab);

    expect(screen.getByText(/Report a Found Item/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacy & Security Warning:/i)).toBeInTheDocument();
    expect(screen.getByText(/post full credit card numbers/i)).toBeInTheDocument();
  });
});
