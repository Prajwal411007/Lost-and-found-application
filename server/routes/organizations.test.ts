import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Verified Drop-off Desks & Organizations API', () => {
  it('GET /api/organizations returns list of drop-off desks without authentication', async () => {
    const res = await request(app).get('/api/organizations');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('organizations');
    expect(Array.isArray(res.body.organizations)).toBe(true);
  });

  it('GET /api/organizations/:id returns 404 for non-existent desk', async () => {
    const res = await request(app).get('/api/organizations/11111111-1111-1111-1111-111111111111');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('POST /api/organizations rejects unauthenticated creation with 401', async () => {
    const res = await request(app)
      .post('/api/organizations')
      .send({
        name: 'Central Metro Lost Desk',
        type: 'transit',
        address: 'MG Road Metro Concourse',
      });
    expect(res.status).toBe(401);
  });

  it('PATCH /api/organizations/:id/verify rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .patch('/api/organizations/11111111-1111-1111-1111-111111111111/verify')
      .send({ verified: true });
    expect(res.status).toBe(401);
  });

  it('PATCH /api/items/:id/held-at rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .patch('/api/items/11111111-1111-1111-1111-111111111111/held-at')
      .send({
        held_at_desk: true,
        organization_id: '11111111-1111-1111-1111-111111111111',
      });
    expect(res.status).toBe(401);
  });
});
