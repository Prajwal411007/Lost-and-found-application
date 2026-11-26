import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Vision AI Suggestions API', () => {
  it('POST /api/vision/suggest gracefully skips when VISION_API_KEY is not configured', async () => {
    // In our test environment, VISION_API_KEY is not set
    const res = await request(app)
      .post('/api/vision/suggest')
      .send({
        imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('enabled');
    expect(res.body.enabled).toBe(false);
    expect(res.body.suggestions).toBeNull();
  });

  it('POST /api/vision/suggest handles missing image payload gracefully', async () => {
    const res = await request(app)
      .post('/api/vision/suggest')
      .send({});

    // When VISION_API_KEY is not set, it returns enabled: false without crashing
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
  });
});
