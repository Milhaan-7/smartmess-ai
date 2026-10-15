import { describe, expect, it } from 'vitest';
import { createSeedState } from '../data/mockData';
import { computeForecast } from '../services/mockForecastService';
import { trailingBaseline } from '../services/baseline';
import { describeForecastSources, EVALUATION_WINDOW_DAYS, evaluationWindow, forecastErrorStats, inRange } from '../services/metrics';
import { recordFromForecast } from '../services/operationsService';
import { DEMO_TODAY } from '../lib/constants';
import { addDays } from '../lib/dates';

const seed = createSeedState();
const done = seed.records.filter((r) => r.status === 'completed');

describe('shared evaluation window', () => {
  it('is the 14 days ending the day before the planning date', () => {
    expect(evaluationWindow(DEMO_TODAY)).toEqual({ from: addDays(DEMO_TODAY, -EVALUATION_WINDOW_DAYS), to: addDays(DEMO_TODAY, -1) });
    expect(evaluationWindow(DEMO_TODAY)).toEqual({ from: '2026-09-30', to: '2026-10-13' });
  });
  it('every completed meal in the window has a baseline, so nothing is silently dropped', () => {
    const inWin = done.filter((r) => inRange(r, evaluationWindow(DEMO_TODAY)));
    expect(inWin).toHaveLength(42);
    expect(inWin.every((r) => r.baselineDiners !== null)).toBe(true);
    const stats = forecastErrorStats(inWin)!;
    expect(stats.n).toBe(42);
    expect(stats.excluded).toBe(0);
  });
});

describe('one baseline definition', () => {
  it('stored seed baselines equal what the forecaster computes for the same meal', () => {
    const sample = done.filter((r) => r.baselineDiners !== null).filter((_, i) => i % 7 === 0);
    expect(sample.length).toBeGreaterThan(8);
    for (const r of sample) {
      const menu = seed.menus.find((m) => m.date === r.date && m.meal === r.meal)!;
      const fc = computeForecast({ date: r.date, meal: r.meal, menu, history: done, settings: seed.settings, context: 'normal' });
      expect(r.baselineDiners).toBe(fc.baselineDiners);
      expect(Math.round(trailingBaseline(done, r.meal, r.date)!.exact)).toBe(fc.baselineDiners);
    }
  });
  it('is unavailable (null) with fewer than 5 prior meals', () => {
    const earliest = done.filter((r) => r.meal === 'lunch').sort((a, b) => a.date.localeCompare(b.date))[0];
    expect(earliest.baselineDiners).toBeNull();
  });
  it('saved rule-based forecasts carry the same baseline the Forecasts page shows', () => {
    const date = addDays(DEMO_TODAY, 1);
    const menu = seed.menus.find((m) => m.date === date && m.meal === 'lunch')!;
    const fc = computeForecast({ date, meal: 'lunch', menu, history: seed.records, settings: seed.settings, context: 'normal' });
    expect(recordFromForecast(fc).baselineDiners).toBe(fc.baselineDiners);
  });
});

describe('MAE and baseline MAE use the same records', () => {
  it('matches a manual computation over the eligible set', () => {
    const win = done.filter((r) => inRange(r, evaluationWindow(DEMO_TODAY)));
    const stats = forecastErrorStats(win)!;
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(stats.mae).toBeCloseTo(mean(win.map((r) => Math.abs(r.predictedDiners - r.actualDiners!))), 10);
    expect(stats.baselineMae).toBeCloseTo(mean(win.map((r) => Math.abs(r.baselineDiners! - r.actualDiners!))), 10);
  });
  it('meals without a baseline are excluded from every figure and counted', () => {
    const win = done.filter((r) => inRange(r, evaluationWindow(DEMO_TODAY)));
    const withoutBaseline = { ...win[0], id: 'x', baselineDiners: null, actualDiners: 1, predictedDiners: 999 };
    const base = forecastErrorStats(win)!;
    const mixed = forecastErrorStats([...win, withoutBaseline])!;
    expect(mixed.n).toBe(base.n);
    expect(mixed.mae).toBe(base.mae);
    expect(mixed.baselineMae).toBe(base.baselineMae);
    expect(mixed.accuracy).toBe(base.accuracy);
    expect(mixed.excluded).toBe(1);
  });
  it('ignores meals that are not completed', () => {
    const win = done.filter((r) => inRange(r, evaluationWindow(DEMO_TODAY)));
    const open = { ...win[0], id: 'y', status: 'approved' as const, actualDiners: 5 };
    expect(forecastErrorStats([...win, open])!.n).toBe(forecastErrorStats(win)!.n);
  });
});

describe('honest labelling of stored forecasts', () => {
  it('flags seeded forecasts as synthetic and forecaster output as rule-based', () => {
    expect(done.every((r) => r.forecastSource === 'synthetic_seed')).toBe(true);
    const today = seed.records.filter((r) => r.date === DEMO_TODAY && r.status !== 'completed');
    expect(today.every((r) => r.forecastSource === 'rule_based')).toBe(true);
  });
  it('provenance text never implies real-world accuracy or machine learning', () => {
    const synthetic = describeForecastSources({ n: 42, syntheticStored: 42, ruleBased: 0 });
    expect(synthetic).toMatch(/synthetic/);
    expect(synthetic).toMatch(/nothing about real-world accuracy/);
    const mixed = describeForecastSources({ n: 44, syntheticStored: 42, ruleBased: 2 });
    expect(mixed).toMatch(/not machine learning/);
    expect(mixed).toMatch(/real-world accuracy/);
    expect(`${synthetic} ${mixed}`).not.toMatch(/proves|improv/i);
  });
});
