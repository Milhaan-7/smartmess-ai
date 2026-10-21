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

  it('returns safe rule-based insights when GEMINI_API_KEY is missing', async () => {
    const res = await request(app)
      .post('/api/v1/forecast/ai-insights')
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
    expect(res.body.insights).toBeDefined();
    expect(Array.isArray(res.body.insights)).toBe(true);
    expect(res.body.insights.length).toBeGreaterThan(0);
  });

  it('returns safe rule-based insights when GEMINI_API_KEY is invalid', async () => {
    process.env.GEMINI_API_KEY = 'invalid-key-for-testing';

    const res = await request(app)
      .post('/api/v1/forecast/ai-insights')
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
    expect(res.body.insights).toBeDefined();
    expect(Array.isArray(res.body.insights)).toBe(true);
    expect(res.body.insights.length).toBeGreaterThan(0);
  });
});
