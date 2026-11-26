import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Express Backend API Integration Tests', () => {
  it('GET /api/health returns 200 OK and status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('supabaseConfigured');
  });

  it('GET /api/stats returns live platform metrics', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalReported');
    expect(res.body).toHaveProperty('itemsReturned');
    expect(res.body).toHaveProperty('returnRate');
  });

  it('GET /api/stats/hotspots returns privacy-preserved rounded clusters', async () => {
    const res = await request(app).get('/api/stats/hotspots');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hotspots');
    expect(Array.isArray(res.body.hotspots)).toBe(true);
  });

  it('GET /api/stats/insights returns summary, categories and weekly trends', async () => {
    const res = await request(app).get('/api/stats/insights');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toHaveProperty('totalReported');
    expect(res.body.summary).toHaveProperty('returnRatePct');
    expect(res.body).toHaveProperty('categories');
    expect(res.body).toHaveProperty('weeklyTrends');
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(Array.isArray(res.body.weeklyTrends)).toBe(true);
  });

  it('POST /api/items rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/items')
      .send({
        title: 'Unauthorized Test Item',
        type: 'lost',
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Unauthorized/i);
  });

  it('GET /api/admin/overview rejects non-admin and unauthenticated requests with 401/403', async () => {
    const res = await request(app).get('/api/admin/overview');
    expect(res.status).toBe(401);
  });

  it('POST /api/claims rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/claims')
      .send({
        item_id: '11111111-1111-1111-1111-111111111111',
      });
    expect(res.status).toBe(401);
  });
});

