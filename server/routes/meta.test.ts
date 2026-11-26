import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Share Cards & Open Graph Crawler Previews API', () => {
  it('GET /api/items/:id/meta returns structured Open Graph and Twitter Card metadata', async () => {
    const res = await request(app).get('/api/items/11111111-1111-1111-1111-111111111111/meta');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('og');
    expect(res.body.og).toHaveProperty('title');
    expect(res.body.og).toHaveProperty('description');
    expect(res.body.og).toHaveProperty('image');
    expect(res.body.og).toHaveProperty('url');
    expect(res.body).toHaveProperty('twitter');
    expect(res.body.twitter.card).toBe('summary_large_image');
    expect(res.body).toHaveProperty('shareText');
  });

  it('GET /api/items/:id/preview returns prerendered HTML with og meta tags', async () => {
    const res = await request(app).get('/api/items/11111111-1111-1111-1111-111111111111/preview');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('property="og:title"');
    expect(res.text).toContain('property="og:description"');
    expect(res.text).toContain('property="og:image"');
    expect(res.text).toContain('name="twitter:card"');
    expect(res.text).toContain('summary_large_image');
  });

  it('GET /items/:id with WhatsApp User-Agent intercepts crawler and serves rich preview HTML', async () => {
    const res = await request(app)
      .get('/items/11111111-1111-1111-1111-111111111111')
      .set('User-Agent', 'WhatsApp/2.21.11.17 A');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<meta property="og:title"');
    expect(res.text).toContain('<meta property="og:image"');
  });

  it('GET /items/:id with Twitterbot User-Agent intercepts crawler and serves rich preview HTML', async () => {
    const res = await request(app)
      .get('/items/11111111-1111-1111-1111-111111111111')
      .set('User-Agent', 'Twitterbot/1.0');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('name="twitter:card" content="summary_large_image"');
  });

  it('GET /items/:id?preview=true serves preview HTML for human testing', async () => {
    const res = await request(app).get('/items/11111111-1111-1111-1111-111111111111?preview=true');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('property="og:site_name"');
  });
});
