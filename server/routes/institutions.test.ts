import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { clearInstitutionsCache } from '../services/institutionsService.js';

describe('Nearby Institutions API (/api/nearby-institutions)', () => {
  beforeEach(() => {
    clearInstitutionsCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearInstitutionsCache();
  });

  describe('Zod Input Validation', () => {
    it('returns 400 when lat or lng is missing', async () => {
      const res = await request(app).get('/api/nearby-institutions');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid query parameters');
    });

    it('returns 400 when lat is outside valid bounds (-90 to 90)', async () => {
      const res = await request(app).get('/api/nearby-institutions?lat=95&lng=0');
      expect(res.status).toBe(400);
      expect(res.body.details).toEqual(expect.arrayContaining([expect.stringMatching(/latitude/i)]));
    });

    it('returns 400 when lng is outside valid bounds (-180 to 180)', async () => {
      const res = await request(app).get('/api/nearby-institutions?lat=0&lng=200');
      expect(res.status).toBe(400);
      expect(res.body.details).toEqual(expect.arrayContaining([expect.stringMatching(/longitude/i)]));
    });

    it('returns 400 when radius exceeds 10,000 meters (10 km limit)', async () => {
      const res = await request(app).get('/api/nearby-institutions?lat=37.77&lng=-122.41&radius=15000');
      expect(res.status).toBe(400);
      expect(res.body.details).toEqual(expect.arrayContaining([expect.stringMatching(/10,000 meters/i)]));
    });
  });

  describe('Overpass Integration & Fallback Handling', () => {
    it('successfully queries and sorts institutions by distance ascending', async () => {
      const mockOverpassResponse = {
        elements: [
          {
            type: 'node',
            id: 101,
            lat: 37.43,
            lon: -122.17,
            tags: {
              name: 'Far College',
              amenity: 'college',
              'addr:street': 'El Camino Real',
            },
          },
          {
            type: 'node',
            id: 102,
            lat: 37.4276,
            lon: -122.1698,
            tags: {
              name: 'Near University',
              amenity: 'university',
              website: 'https://stanford.edu',
            },
          },
          {
            // Unnamed feature - must be skipped per spec
            type: 'node',
            id: 103,
            lat: 37.427,
            lon: -122.169,
            tags: {
              amenity: 'school',
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOverpassResponse),
      } as any);

      const res = await request(app).get('/api/nearby-institutions?lat=37.4275&lng=-122.1697&radius=2000');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.institutions[0].name).toBe('Near University');
      expect(res.body.institutions[0].type).toBe('university');
      expect(res.body.institutions[0].distance).toBeLessThan(res.body.institutions[1].distance);
      expect(res.body.institutions[1].name).toBe('Far College');
      expect(res.body.attribution).toMatch(/OpenStreetMap/i);
    });

    it('returns empty array when no institutions are found in the radius', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ elements: [] }),
      } as any);

      const res = await request(app).get('/api/nearby-institutions?lat=20.0&lng=20.0&radius=1000');

      expect(res.status).toBe(200);
      expect(res.body.institutions).toEqual([]);
      expect(res.body.count).toBe(0);
    });

    it('falls back to mirror server when primary server fails', async () => {
      const mockSuccessResponse = {
        elements: [
          {
            type: 'node',
            id: 201,
            lat: 51.75,
            lon: -1.25,
            tags: { name: 'Oxford College', amenity: 'college' },
          },
        ],
      };

      // First call (primary) fails with 504 Gateway Timeout, second call (mirror) succeeds
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('Primary Overpass timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSuccessResponse),
        } as any);

      const res = await request(app).get('/api/nearby-institutions?lat=51.75&lng=-1.25&radius=3000');

      expect(res.status).toBe(200);
      expect(res.body.institutions.length).toBe(1);
      expect(res.body.institutions[0].name).toBe('Oxford College');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('returns 502 with friendly error when all Overpass mirrors fail', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const res = await request(app).get('/api/nearby-institutions?lat=37.77&lng=-122.41&radius=2000');

      expect(res.status).toBe(502);
      expect(res.body.error).toMatch(/failed or timed out/i);
    });

    it('serves subsequent identical request from 24-hr cache without calling Overpass again', async () => {
      const mockResponse = {
        elements: [
          {
            type: 'node',
            id: 301,
            lat: 42.36,
            lon: -71.09,
            tags: { name: 'MIT', amenity: 'university' },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      // First call -> calls Overpass
      const res1 = await request(app).get('/api/nearby-institutions?lat=42.3601&lng=-71.0942&radius=2000');
      expect(res1.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call (cache hit) -> does NOT call Overpass again
      const res2 = await request(app).get('/api/nearby-institutions?lat=42.3601&lng=-71.0942&radius=2000');
      expect(res2.status).toBe(200);
      expect(res2.body.institutions[0].name).toBe('MIT');
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1!
    });

    it('allows CORS from Vercel deployment domains (*.vercel.app)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ elements: [] }),
      } as any);

      const res = await request(app)
        .get('/api/nearby-institutions?lat=37.4&lng=-122.1')
        .set('Origin', 'https://lost-and-found-preview.vercel.app');

      expect(res.headers['access-control-allow-origin']).toBe('https://lost-and-found-preview.vercel.app');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });
});
