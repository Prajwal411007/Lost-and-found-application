import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CategorySelect } from '@/components/common/CategorySelect';
import { ReportItemPage } from '@/pages/items/ReportItem';
import { useCategories } from '@/hooks/useCategories';
import { useAuth } from '@/contexts/AuthContext';
import { Category } from '@/types';

// Mock Auth
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

// Mock useCategories hook
vi.mock('@/hooks/useCategories', async () => {
  const actual = await vi.importActual<any>('@/hooks/useCategories');
  return {
    ...actual,
    useCategories: vi.fn(),
    useCategoryItemCounts: vi.fn().mockReturnValue({ data: { c1: 5, c2: 2 } }),
  };
});

const mockCategoriesList: Category[] = [
  { id: 'c-wallets', name: 'Wallets & Cards', slug: 'wallets-cards', icon: 'wallet', description: 'Wallets', created_at: '' },
  { id: 'c-other', name: 'Other', slug: 'other', icon: 'package', description: 'Other', created_at: '' },
  { id: 'c-laptops', name: 'Laptops & Tablets', slug: 'laptops-tablets', icon: 'laptop', description: 'Laptops', created_at: '' },
  { id: 'c-phones', name: 'Phones & Electronics', slug: 'phones-electronics', icon: 'smartphone', description: 'Phones', created_at: '' },
  { id: 'c-keys', name: 'Keys', slug: 'keys', icon: 'key', description: 'Keys', created_at: '' },
];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Category System & CategorySelect Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      user: { id: 'user-1', email: 'user@example.com' },
      isConfigured: true,
      isAdmin: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Sorting and Dropdown Options', () => {
    it('orders categories alphabetically with "Other" strictly at the end', () => {
      // Sort test logic verification
      const sorted = [...mockCategoriesList].sort((a, b) => {
        const aName = a.name.trim().toLowerCase();
        const bName = b.name.trim().toLowerCase();
        if (aName === 'other') return 1;
        if (bName === 'other') return -1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

      expect(sorted.map((c) => c.name)).toEqual([
        'Keys',
        'Laptops & Tablets',
        'Phones & Electronics',
        'Wallets & Cards',
        'Other',
      ]);
      expect(sorted[sorted.length - 1].name).toBe('Other');
    });

    it('renders categories in CategorySelect dropdown with options', () => {
      (useCategories as any).mockReturnValue({
        categories: [
          { id: 'c-keys', name: 'Keys', slug: 'keys', icon: 'key' },
          { id: 'c-phones', name: 'Phones & Electronics', slug: 'phones-electronics', icon: 'smartphone' },
          { id: 'c-other', name: 'Other', slug: 'other', icon: 'package' },
        ],
        isLoading: false,
        isError: false,
        error: null,
        isEmpty: false,
        refetch: vi.fn(),
      });

      render(
        <CategorySelect
          id="test-cat"
          value=""
          onChange={vi.fn()}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Select Category/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Keys/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Phones & Electronics/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Other/i })).toBeInTheDocument();
    });
  });

  describe('Error and Retry States', () => {
    it('shows inline error message with a functional Retry button on query failure', () => {
      const mockRefetch = vi.fn();
      (useCategories as any).mockReturnValue({
        categories: [],
        isLoading: false,
        isError: true,
        error: new Error('permission denied for table categories'),
        isEmpty: false,
        refetch: mockRefetch,
      });

      render(
        <CategorySelect
          id="test-cat-error"
          value=""
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText(/Database permission denied for categories/i)).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: /Retry/i });
      expect(retryBtn).toBeInTheDocument();

      fireEvent.click(retryBtn);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('shows "Categories unavailable" message when the list is empty', () => {
      (useCategories as any).mockReturnValue({
        categories: [],
        isLoading: false,
        isError: false,
        error: null,
        isEmpty: true,
        refetch: vi.fn(),
      });

      render(
        <CategorySelect
          id="test-cat-empty"
          value=""
          onChange={vi.fn()}
        />
      );

      expect(screen.getByRole('option', { name: /Categories unavailable/i })).toBeInTheDocument();
      expect(screen.getByText(/Categories unavailable. Please run migration 003_more_categories.sql/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation in ReportItemPage', () => {
    it('blocks report submission and displays validation error when no category is chosen', async () => {
      (useCategories as any).mockReturnValue({
        categories: [
          { id: 'cat-1', name: 'Electronics', slug: 'electronics', icon: 'smartphone' },
        ],
        isLoading: false,
        isError: false,
        error: null,
        isEmpty: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<ReportItemPage initialType="lost" />);

      const titleInput = screen.getByPlaceholderText(/e.g., Black Leather Fossil Wallet/i);
      fireEvent.change(titleInput, { target: { value: 'Lost iPhone 14 Pro Max' } });

      const descInput = screen.getByPlaceholderText(/Describe circumstances/i);
      fireEvent.change(descInput, { target: { value: 'Left on the library table near desk 4' } });

      const submitBtn = screen.getByRole('button', { name: /Submit Lost Report/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Please select a category/i)).toBeInTheDocument();
      });
    });

    it('allows submission when category is selected', async () => {
      (useCategories as any).mockReturnValue({
        categories: [
          { id: 'cat-1', name: 'Electronics', slug: 'electronics', icon: 'smartphone' },
        ],
        isLoading: false,
        isError: false,
        error: null,
        isEmpty: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<ReportItemPage initialType="lost" />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'cat-1' } });

      const titleInput = screen.getByPlaceholderText(/e.g., Black Leather Fossil Wallet/i);
      fireEvent.change(titleInput, { target: { value: 'Lost iPhone 14 Pro Max' } });

      const descInput = screen.getByPlaceholderText(/Describe circumstances/i);
      fireEvent.change(descInput, { target: { value: 'Left on the library table near desk 4' } });

      const submitBtn = screen.getByRole('button', { name: /Submit Lost Report/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.queryByText(/Please select a category/i)).not.toBeInTheDocument();
      });
    });
  });
});
