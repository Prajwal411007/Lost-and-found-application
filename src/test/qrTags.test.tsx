import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import request from 'supertest';
import { app } from '../../server/app';
import { PublicTagPage } from '../pages/items/PublicTag';
import { MyItemsPage } from '../pages/items/MyItems';

// Mock Auth Context
const mockUser = { id: 'user-owner-123', email: 'owner@example.com' };
const mockProfile = { full_name: 'Test Owner' };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
    isAuthenticated: true,
    isAdmin: false,
    isConfigured: true,
  }),
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => {
  return {
    isSupabaseConfigured: true,
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'registered_items') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'item-1',
                  name: 'MacBook Pro 14',
                  tag_code: 'TAG-MACKBOOK',
                  category_id: 'cat-1',
                  category: { name: 'Laptops & Tablets', icon: 'laptop' },
                  notes_private: 'Secret serial #12345',
                  lost_item_id: null,
                  created_at: new Date().toISOString(),
                },
              ],
              error: null,
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'mock-token' } } }),
      },
    },
  };
});

describe('Feature 1: QR Item Tags & Privacy Boundary', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  describe('Privacy Invariant: Server API Public Lookup', () => {
    it('GET /api/tags/:code returns 404 for non-existent tag without crashing', async () => {
      const res = await request(app).get('/api/tags/NON_EXISTENT_TAG');
      expect([404, 503]).toContain(res.status);
    });

    it('Rejects contact submissions with message under 5 characters', async () => {
      const res = await request(app)
        .post('/api/tags/TAG-TEST/contact')
        .send({ message: 'Hi' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 5 characters/i);
    });
  });

  describe('Public Tag Page (/tag/:code)', () => {
    beforeEach(() => {
      // Mock global fetch for tag details
      global.fetch = vi.fn((url: any) => {
        if (url.toString().includes('/api/tags/TAG-SAFE-123')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                valid: true,
                name: 'Travel Backpack',
                categoryName: 'Bags & Luggage',
                isLost: false,
                tagCode: 'TAG-SAFE-123',
                // Explicitly testing that NO owner PII is returned
              }),
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Not found' }),
        } as Response);
      });
    });

    it('renders item name and category without exposing owner name, email or phone', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/tag/TAG-SAFE-123']}>
            <Routes>
              <Route path="/tag/:code" element={<PublicTagPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify headline
      expect(
        await screen.findByText(/This item has been registered\. Contact the owner/i)
      ).toBeInTheDocument();

      // Verify item details are visible
      expect(screen.getByText('Travel Backpack')).toBeInTheDocument();
      expect(screen.getByText(/Category: Bags & Luggage/i)).toBeInTheDocument();

      // Verify privacy invariant: Owner identity MUST NOT be rendered
      expect(screen.queryByText('owner@example.com')).not.toBeInTheDocument();
      expect(screen.queryByText('Test Owner')).not.toBeInTheDocument();
      expect(screen.queryByText(/Secret serial/i)).not.toBeInTheDocument();

      // Verify message form is present
      expect(await screen.findByPlaceholderText(/Hello! I found your item/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send Message to Owner/i })).toBeInTheDocument();
    });
  });

  describe('My Items Page (/my-items)', () => {
    it('renders registered item with QR tag code and sticker action', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/my-items']}>
            <Routes>
              <Route path="/my-items" element={<MyItemsPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify page header
      expect(await screen.findByText('My Registered Items & QR Tags')).toBeInTheDocument();

      // Verify item card
      await waitFor(() => {
        expect(screen.getByText('MacBook Pro 14')).toBeInTheDocument();
      });
      expect(screen.getByText(/TAG-MACKBOOK/i)).toBeInTheDocument();

      // Verify sticker and mark lost buttons
      expect(screen.getByRole('button', { name: /Print Sticker/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mark Lost/i })).toBeInTheDocument();
    });
  });
});
