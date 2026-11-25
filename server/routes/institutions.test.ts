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
    vi.useRealTimers();
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

  describe('Expanded Overpass Query & Name Resolution', () => {
    it('parses way-only college with center coordinates correctly', async () => {
      const mockWayCollege = {
        elements: [
          {
            type: 'way',
            id: 8881,
            center: { lat: 12.972, lon: 77.595 },
            tags: {
              name: 'UVCE Campus',
              amenity: 'college',
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWayCollege),
      } as any);

      const res = await request(app).get('/api/nearby-institutions?lat=12.9716&lng=77.5946&radius=2000');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.institutions[0].name).toBe('UVCE Campus');
      expect(res.body.institutions[0].type).toBe('college');
      expect(res.body.institutions[0].lat).toBe(12.972);
      expect(res.body.institutions[0].lng).toBe(77.595);
      expect(res.body.institutions[0].source).toBe('overpass');
    });

    it('extracts college name when only name:en is present', async () => {
      const mockEnglishNameCollege = {
        elements: [
          {
            type: 'node',
            id: 8882,
            lat: 12.973,
            lon: 77.596,
            tags: {
              'name:en': 'Bengaluru Technical College',
              amenity: 'college',
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEnglishNameCollege),
      } as any);

      const res = await request(app).get('/api/nearby-institutions?lat=12.9716&lng=77.5946&radius=2000');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.institutions[0].name).toBe('Bengaluru Technical College');
      expect(res.body.institutions[0].isUnnamed).toBe(false);
    });

    it('labels unnamed institutions sensibly and includes them in count', async () => {
      const mockUnnamedSchool = {
        elements: [
          {
            type: 'node',
            id: 8883,
            lat: 12.974,
            lon: 77.597,
            tags: {
              amenity: 'school',
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUnnamedSchool),
      } as any);

      const res = await request(app).get('/api/nearby-institutions?lat=12.9716&lng=77.5946&radius=2000');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.unnamedCount).toBe(1);
      expect(res.body.institutions[0].name).toBe('Unnamed School (OpenStreetMap)');
      expect(res.body.institutions[0].isUnnamed).toBe(true);
    });

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
      expect(res.body.count).toBe(3);
      expect(res.body.unnamedCount).toBe(1);
      expect(res.body.institutions[0].name).toBe('Near University');
      expect(res.body.institutions[0].type).toBe('university');
      expect(res.body.institutions[0].distance).toBeLessThan(res.body.institutions[2].distance);
      expect(res.body.attribution).toMatch(/OpenStreetMap/i);
    });

    it('returns empty array when genuinely empty area (both Overpass and Nominatim return empty)', async () => {
      // Overpass returns empty elements, Nominatim returns empty array
      global.fetch = vi.fn((url: any) => {
        if (url.toString().includes('nominatim')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          } as any);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ elements: [] }),
        } as any);
      });

      const res = await request(app).get('/api/nearby-institutions?lat=20.0&lng=20.0&radius=1000');

      expect(res.status).toBe(200);
      expect(res.body.institutions).toEqual([]);
      expect(res.body.count).toBe(0);
      expect(res.body.unnamedCount).toBe(0);
    });

    it('falls back to Nominatim when Overpass returns 0 results', async () => {
      global.fetch = vi.fn((url: any) => {
        if (url.toString().includes('nominatim')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  place_id: 9991,
                  display_name: 'St Josephs College of Commerce, Brigade Road, Bengaluru',
                  type: 'college',
                  lat: '12.9699',
                  lon: '77.6075',
                },
              ]),
          } as any);
        }
        // Overpass returns empty
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ elements: [] }),
        } as any);
      });

      const res = await request(app).get('/api/nearby-institutions?lat=12.9716&lng=77.5946&radius=2000');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.institutions[0].name).toContain('St Josephs College of Commerce');
      expect(res.body.institutions[0].source).toBe('nominatim');
    });

    it('detects Overpass runtime error / timeout remark and does not return fake empty list', async () => {
      // Overpass returns 200 with runtime error remark, Nominatim returns results
      global.fetch = vi.fn((url: any) => {
        if (url.toString().includes('nominatim')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  place_id: 9992,
                  display_name: 'Bengaluru City University, Central College Campus',
                  type: 'university',
                  lat: '12.9749',
                  lon: '77.5829',
                },
              ]),
          } as any);
        }
        // Overpass timeout inside 200 body
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ elements: [], remark: 'runtime error: Query timed out in "query" after 26 seconds.' }),
        } as any);
      });

      const res = await request(app).get('/api/nearby-institutions?lat=12.9716&lng=77.5946&radius=2000');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.institutions[0].name).toContain('Bengaluru City University');
      expect(res.body.institutions[0].source).toBe('nominatim');
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

    it('returns 502 with friendly error when all Overpass mirrors fail and Nominatim fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const res = await request(app).get('/api/nearby-institutions?lat=37.77&lng=-122.41&radius=2000');

      expect(res.status).toBe(502);
      expect(res.body.error).toMatch(/failed or timed out/i);
    });
  });

  describe('Differentiated Caching (24h for success vs 5m for empty)', () => {
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

      // Second call (cache hit within 24h) -> does NOT call Overpass again
      const res2 = await request(app).get('/api/nearby-institutions?lat=42.3601&lng=-71.0942&radius=2000');
      expect(res2.status).toBe(200);
      expect(res2.body.institutions[0].name).toBe('MIT');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('does NOT cache empty results for 24 hours: expires after 5 minutes', async () => {
      let callCount = 0;
      global.fetch = vi.fn((url: any) => {
        callCount++;
        if (url.toString().includes('nominatim')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          } as any);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ elements: [] }),
        } as any);
      });

      // First call -> returns empty
      const res1 = await request(app).get('/api/nearby-institutions?lat=10.0&lng=10.0&radius=1000');
      expect(res1.status).toBe(200);
      expect(res1.body.count).toBe(0);
      const initialFetchCount = callCount;

      // Immediate second call within 5 minutes -> served from 5-min cache
      const res2 = await request(app).get('/api/nearby-institutions?lat=10.0&lng=10.0&radius=1000');
      expect(res2.status).toBe(200);
      expect(callCount).toBe(initialFetchCount);

      // Fast-forward time past 5 minutes (e.g. 6 minutes = 360,000 ms)
      const originalDateNow = Date.now;
      Date.now = vi.fn(() => originalDateNow() + 6 * 60 * 1000);

      // Third call -> 5-min cache expired! Re-fetches from API
      const res3 = await request(app).get('/api/nearby-institutions?lat=10.0&lng=10.0&radius=1000');
      expect(res3.status).toBe(200);
      expect(callCount).toBeGreaterThan(initialFetchCount);

      Date.now = originalDateNow;
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
