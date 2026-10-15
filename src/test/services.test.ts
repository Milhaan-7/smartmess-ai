import { describe, expect, it } from 'vitest';
import { createSeedState } from '../data/mockData';
import { computeForecast } from '../services/mockForecastService';
import { forecastErrorStats, itemLeftover, recordTotals } from '../services/metrics';
import { approvePlan, parseQuantity, recordFromForecast, saveActuals } from '../services/operationsService';
import { validateMenuDraft } from '../services/menuService';
import { DEMO_TODAY } from '../lib/constants';
import { addDays } from '../lib/dates';

const seed = createSeedState();
const menu = seed.menus.find((m) => m.date === addDays(DEMO_TODAY, 1) && m.meal === 'lunch')!;
const input = { date: menu.date, meal: menu.meal, menu, history: seed.records, settings: seed.settings, context: 'normal' as const };

describe('seed data', () => {
  it('is deterministic', () => {
    expect(JSON.stringify(createSeedState())).toBe(JSON.stringify(createSeedState()));
  });
  it('keeps leftover = prepared − consumed and never negative', () => {
    for (const r of seed.records.filter((x) => x.status === 'completed')) {
      for (const i of r.items) {
        expect(i.prepared).not.toBeNull();
        expect(i.consumed).not.toBeNull();
        expect(itemLeftover(i)).toBe(i.prepared! - i.consumed!);
        expect(itemLeftover(i)!).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('has plausible aggregate waste rate', () => {
    const rates = seed.records.filter((r) => r.status === 'completed').map((r) => recordTotals(r).wasteRate!);
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    expect(mean).toBeGreaterThan(0.03);
    expect(mean).toBeLessThan(0.3);
  });
  it('seeds today with one completed, one approved, one awaiting plan', () => {
    const today = seed.records.filter((r) => r.date === DEMO_TODAY).map((r) => `${r.meal}:${r.status}`).sort();
    expect(today).toEqual(['breakfast:completed', 'dinner:recommended', 'lunch:approved']);
  });
});

describe('forecast', () => {
  it('returns identical output for identical input', () => {
    expect(computeForecast(input)).toEqual(computeForecast(input));
  });
  it('factor impacts sum to forecast − baseline', () => {
    const f = computeForecast(input);
    const total = f.factors.reduce((s, x) => s + x.impactDiners, 0);
    expect(total).toBe(f.predictedDiners - f.baselineDiners);
  });
  it('responds to planning context', () => {
    const normal = computeForecast(input).predictedDiners;
    const holiday = computeForecast({ ...input, context: 'festival_holiday' }).predictedDiners;
    expect(holiday).toBeLessThan(normal);
  });
  it('respects service capacity and keeps range ordered', () => {
    const f = computeForecast({ ...input, settings: { ...seed.settings, serviceCapacity: 300 } });
    expect(f.predictedDiners).toBe(300);
    expect(f.lowerDiners).toBeLessThanOrEqual(f.predictedDiners);
    expect(f.upperDiners).toBeLessThanOrEqual(300);
  });
  it('separates predicted demand from recommended prep', () => {
    for (const i of computeForecast(input).items) {
      expect(i.suggestedPrep).toBeGreaterThanOrEqual(i.predictedDemand);
      expect(i.suggestedPrep % 5).toBe(0);
    }
  });
  it('rejects when history is insufficient', () => {
    expect(() => computeForecast({ ...input, history: [] })).toThrow(/Not enough/);
  });
  it('error stats follow the documented definitions', () => {
    const s = forecastErrorStats(seed.records)!;
    expect(s.accuracy).toBeCloseTo(1 - s.wape, 10);
    expect(s.mae).toBeGreaterThan(0);
  });
});

describe('operations', () => {
  it('validates quantities', () => {
    expect(parseQuantity('')).toMatchObject({ ok: false });
    expect(parseQuantity('-3')).toMatchObject({ ok: false });
    expect(parseQuantity('2.5')).toMatchObject({ ok: false });
    expect(parseQuantity('abc')).toMatchObject({ ok: false });
    expect(parseQuantity(' 40 ')).toEqual({ ok: true, value: 40 });
  });
  it('never auto-approves and enforces consumed ≤ prepared', () => {
    const rec = recordFromForecast(computeForecast(input));
    expect(rec.status).toBe('recommended');
    expect(rec.items.every((i) => i.approvedPrep === null)).toBe(true);
    const q = Object.fromEntries(rec.items.map((i) => [i.itemId, i.suggestedPrep]));
    const approved = approvePlan(rec, q, '2026-10-14T09:00:00');
    expect(approved.status).toBe('approved');
    // consumed > prepared is rejected (use today's approved lunch so the date rule is not what throws)
    const todayLunch = seed.records.find((r) => r.date === DEMO_TODAY && r.meal === 'lunch')!;
    const bad = { actualDiners: 100, items: Object.fromEntries(todayLunch.items.map((i) => [i.itemId, { prepared: 10, consumed: 20 }])) };
    expect(() => saveActuals(todayLunch, bad, 'x', DEMO_TODAY)).toThrow(/Consumed cannot exceed prepared/);
    expect(() => saveActuals(rec, { actualDiners: 1, items: {} }, 'x', DEMO_TODAY)).toThrow(/Approve/);
  });
});

describe('menu validation', () => {
  it('flags empty, duplicate and clashing entries', () => {
    expect(validateMenuDraft({ date: '', meal: '', items: [] }, seed.menus)).toMatchObject({ date: expect.any(String), meal: expect.any(String), items: expect.any(String) });
    const dup = validateMenuDraft({ date: '2030-01-01', meal: 'lunch', items: [{ key: 'a', name: 'Rice', kg: '0.3' }, { key: 'b', name: 'rice', kg: '0.3' }] }, seed.menus);
    expect(dup?.item.b?.name).toBe('Duplicate item');
    expect(validateMenuDraft({ date: menu.date, meal: menu.meal, items: [{ key: 'a', name: 'Rice', kg: '0.3' }] }, seed.menus)?.date).toMatch(/already exists/);
    expect(validateMenuDraft({ date: '2030-01-01', meal: 'lunch', items: [{ key: 'a', name: 'Rice', kg: '0.3' }] }, seed.menus)).toBeNull();
  });
});
