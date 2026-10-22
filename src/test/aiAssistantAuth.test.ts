import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { apiRouter } from '../api/routes.ts';

const app = express();
app.use(express.json());
app.use('/api/v1', apiRouter);

describe('AI Assistant Authorization & Chat Endpoint', () => {
  it('denies student role with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', 'Bearer demo-token-student')
      .send({ message: 'How many idlis should we prepare?' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('Forbidden');
  });

  it('denies kitchen staff role with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', 'Bearer demo-token-kitchen_staff')
      .send({ message: 'How many idlis should we prepare?' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('Forbidden');
  });

  it('allows manager role and handles idli preparation question with JSON response', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', 'Bearer demo-token-manager')
      .send({ message: 'How many idlis should we prepare for breakfast?' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reply');
    expect(typeof res.body.reply).toBe('string');
    expect(res.body.reply.length).toBeGreaterThan(0);
  });
});
