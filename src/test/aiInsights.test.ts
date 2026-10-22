import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { apiRouter } from '../api/routes.ts';

const app = express();
app.use(express.json());
app.use('/api/v1', apiRouter);

describe('AI Insights Endpoint Fallback', () => {
  const origKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (origKey !== undefined) {
      process.env.GEMINI_API_KEY = origKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  });

  it('rejects unauthenticated requests and non-manager roles on POST /api/v1/forecast/ai-insights', async () => {
    const unauth = await request(app)
      .post('/api/v1/forecast/ai-insights')
      .send({ date: '2029-11-20', meal: 'lunch', predictedDiners: 450 });
    expect(unauth.status).toBe(401);

    const studentRes = await request(app)
      .post('/api/v1/forecast/ai-insights')
      .set('Authorization', 'Bearer demo-token-student')
      .send({ date: '2029-11-20', meal: 'lunch', predictedDiners: 450 });
    expect(studentRes.status).toBe(403);

    const staffRes = await request(app)
      .post('/api/v1/forecast/ai-insights')
      .set('Authorization', 'Bearer demo-token-kitchen_staff')
      .send({ date: '2029-11-20', meal: 'lunch', predictedDiners: 450 });
    expect(staffRes.status).toBe(403);
  });

  it('forbids kitchen staff from creating an already-approved record via POST /api/v1/records', async () => {
    const res = await request(app)
      .post('/api/v1/records')
      .set('Authorization', 'Bearer demo-token-kitchen_staff')
      .send({
        id: 'rec-2026-10-18-dinner',
        date: '2026-10-18',
        meal: 'dinner',
        status: 'approved',
        predictedDiners: 500,
        items: [],
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Only management can approve/i);
  });

  it('returns safe rule-based insights when GEMINI_API_KEY is missing', async () => {
    const res = await request(app)
      .post('/api/v1/forecast/ai-insights')
      .set('Authorization', 'Bearer demo-token-manager')
      .send({
        date: '2029-11-20',
        meal: 'lunch',
        predictedDiners: 450,
        baselineDiners: 440,
        context: 'normal',
        items: [{ name: 'Rice', suggestedPrep: 300 }]
      });

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).not.toMatch(/\{|RESOURCE_EXHAUSTED|stack/i);
    expect(res.body.insights).toBeDefined();
    expect(Array.isArray(res.body.insights)).toBe(true);
    expect(res.body.insights.length).toBeGreaterThan(0);
  });

  it('returns safe rule-based insights without raw API error dumps when GEMINI_API_KEY is invalid', async () => {
    process.env.GEMINI_API_KEY = 'invalid-key-for-testing';

    const res = await request(app)
      .post('/api/v1/forecast/ai-insights')
      .set('Authorization', 'Bearer demo-token-manager')
      .send({
        date: '2029-11-20',
        meal: 'lunch',
        predictedDiners: 450,
        baselineDiners: 440,
        context: 'normal',
        items: [{ name: 'Rice', suggestedPrep: 300 }]
      });

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).not.toMatch(/\{|API_KEY_INVALID|stack/i);
    expect(res.body.insights).toBeDefined();
    expect(Array.isArray(res.body.insights)).toBe(true);
    expect(res.body.insights.length).toBeGreaterThan(0);
  });
});
