import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/app.js';
import { findSimilarOpenItems } from '../../server/services/fraudDetection.js';

describe('Feature 5: Duplicate and Rule-based Fraud Detection', () => {
  it('POST /api/items/check-duplicates returns matching duplicate reports', async () => {
    const res = await request(app)
      .post('/api/items/check-duplicates')
      .send({
        title: 'Lost Blue Leather Wallet',
        type: 'lost',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('duplicates');
    expect(Array.isArray(res.body.duplicates)).toBe(true);
  });

  it('findSimilarOpenItems handles empty titles gracefully', async () => {
    const result = await findSimilarOpenItems({ title: '' });
    expect(result).toEqual([]);
  });

  it('GET /api/admin/fraud-flags rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/admin/fraud-flags');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/admin/fraud-flags/:id rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .patch('/api/admin/fraud-flags/11111111-1111-1111-1111-111111111111')
      .send({ status: 'reviewed' });
    expect(res.status).toBe(401);
  });
});
