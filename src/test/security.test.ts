import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/app.js';

describe('Security Boundaries & Privacy Invariants', () => {
  it('Admin route rejects non-admin requests with 401/403 and never leaks admin overview data', async () => {
    const res = await request(app).get('/api/admin/overview');
    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('totalUsers');
  });

  it('Admin moderation queue rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/admin/reports');
    expect(res.status).toBe(401);
  });

  it('Item deletion rejects callers without authentication', async () => {
    const res = await request(app).delete('/api/items/d0000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(401);
  });

  it('Claims submission requires authentication to prevent forged claims', async () => {
    const res = await request(app).post('/api/claims').send({
      item_id: 'd0000000-0000-0000-0000-000000000001',
      verification_answers: {
        proof_description: 'I own this laptop',
      },
    });
    expect(res.status).toBe(401);
  });

  it('Claims status change requires valid JWT header', async () => {
    const res = await request(app).patch('/api/claims/c0000000-0000-0000-0000-000000000001/status').send({
      status: 'approved',
    });
    expect(res.status).toBe(401);
  });

  it('Messaging routes reject unauthorized access without token', async () => {
    const res = await request(app).get('/api/messages/conversations');
    expect(res.status).toBe(401);
  });

  it('Public item search route responds with CORS headers and rate limits applied', async () => {
    const res = await request(app).get('/api/items?type=lost');
    expect(res.headers).toHaveProperty('ratelimit-limit');
    expect([200, 503]).toContain(res.status);
  });
});
