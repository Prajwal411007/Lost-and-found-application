import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Community Thank-You Reviews API', () => {
  it('GET /api/reviews/user/:userId returns default structure without error', async () => {
    const res = await request(app).get('/api/reviews/user/11111111-1111-1111-1111-111111111111');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reviews');
    expect(res.body).toHaveProperty('averageRating');
    expect(res.body).toHaveProperty('totalReviews');
  });

  it('GET /api/reviews/item/:itemId returns reviews array without error', async () => {
    const res = await request(app).get('/api/reviews/item/11111111-1111-1111-1111-111111111111');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reviews');
    expect(Array.isArray(res.body.reviews)).toBe(true);
  });

  it('POST /api/reviews rejects unauthenticated submission with 401', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .send({
        item_id: '11111111-1111-1111-1111-111111111111',
        reviewee_id: '22222222-2222-2222-2222-222222222222',
        rating: 5,
        note: 'Thank you so much!',
      });
    expect(res.status).toBe(401);
  });

  it('PATCH /api/reviews/:id/moderate rejects unauthenticated moderation with 401', async () => {
    const res = await request(app)
      .patch('/api/reviews/11111111-1111-1111-1111-111111111111/moderate')
      .send({
        is_hidden: true,
      });
    expect(res.status).toBe(401);
  });
});
