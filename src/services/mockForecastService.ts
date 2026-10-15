/**
 * Mock forecasting service — deterministic, rule-based, NOT machine learning.
 *
 * `runForecast` is the single function to replace when the Python FastAPI service exists:
 * keep its signature (or adapt the call site in pages/Forecasts.tsx) and POST the request to the API.
 * `computeForecast` is the pure calculation used by the mock and by seed-data generation.
 */
import type { Forecast, ForecastFactor, ForecastInput, ItemForecast, MealRecord } from '../types';
import { SPECIAL_DAYS } from '../lib/constants';
import { dayOfWeek } from '../lib/dates';
import { BASELINE_CONFIG, selectHistory } from './baseline';

export const FORECAST_CONFIG = {
  /** Most recent completed meals of the same type used as history. */
  historyWindowRecords: BASELINE_CONFIG.windowRecords,
  minRecords: BASELINE_CONFIG.minRecords,
  /** Every learned adjustment is pulled halfway back toward 1.0 to avoid over-reacting to a few days. */
  shrinkage: 0.5,
  trendRecords: 3,
  /** Diner range = forecast ± bandMultiplier × recent MAE (a heuristic band, not a statistical interval). */
  bandMultiplier: 1.5,
  minBandDiners: 10,
} as const;

export const FORECAST_METHOD =
  'Transparent rule-based estimate: historical average × explainable adjustments. Not machine learning.';

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const shrink = (ratio: number): number => 1 + FORECAST_CONFIG.shrinkage * (ratio - 1);
/** Plural of a meal name for display ("lunch" → "lunches"). */
const pluralMeal = (meal: string): string => (meal === 'lunch' ? 'lunches' : `${meal}s`);
const pct = (ratio: number): string => `${ratio >= 1 ? '+' : '−'}${Math.abs((ratio - 1) * 100).toFixed(1)}%`;

/** Round up to the next multiple of `step` (tolerant of floating-point noise). */
export const ceilToStep = (value: number, step: number): number =>
  Math.ceil(value / step - 1e-9) * step;

function historicalUptake(name: string, recs: MealRecord[]): { uptake: number; samples: number } | null {
  const key = name.toLowerCase();
  let consumed = 0;
  let diners = 0;
  let samples = 0;
  for (const r of recs) {
    const it = r.items.find((i) => i.name.toLowerCase() === key);
    if (it && it.consumed !== null && r.actualDiners !== null) {
      consumed += it.consumed;
      diners += r.actualDiners;
      samples += 1;
    }
  }
  return samples > 0 && diners > 0 ? { uptake: consumed / diners, samples } : null;
}

export function computeForecast(input: ForecastInput): Forecast {
  const { date, meal, menu, history, settings, context } = input;
  const cfg = FORECAST_CONFIG;

  // Same-meal completed history strictly before the target date (no look-ahead), newest first.
  const recs = selectHistory(history, meal, date);

  if (recs.length < cfg.minRecords) {
    throw new Error(
      `Not enough completed ${meal} history before ${date}: need at least ${cfg.minRecords} meals, found ${recs.length}.`,
    );
  }

  const actual = (r: MealRecord): number => r.actualDiners ?? 0;
  const baselineExact = mean(recs.map(actual));

  // 1. Day-of-week pattern
  const sameDow = recs.filter((r) => dayOfWeek(r.date) === dayOfWeek(date));
  const dowRatio = sameDow.length ? mean(sameDow.map(actual)) / baselineExact : 1;

  // 2. Recent trend (last few meals vs window average)
  const trendRatio = mean(recs.slice(0, cfg.trendRecords).map(actual)) / baselineExact;

  // 3. Menu effect: attendance on past days when these dishes were served
  const itemRatios: number[] = [];
  for (const item of menu.items) {
    const served = recs.filter((r) => r.items.some((i) => i.name.toLowerCase() === item.name.toLowerCase()));
    if (served.length) itemRatios.push(mean(served.map(actual)) / baselineExact);
  }
  const menuRatio = itemRatios.length ? mean(itemRatios) : 1;

  const ctx = SPECIAL_DAYS[context];

  const steps: Array<Omit<ForecastFactor, 'impactDiners'>> = [
    {
      id: 'weekday',
      label: 'Day of week',
      multiplier: shrink(dowRatio),
      description: sameDow.length
        ? `Past ${sameDow.length} ${new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'long' })} ${pluralMeal(meal)} ran ${pct(dowRatio)} vs the ${recs.length}-meal average; half the gap is applied.`
        : 'No same-weekday history, so no adjustment.',
    },
    {
      id: 'trend',
      label: 'Recent trend',
      multiplier: shrink(trendRatio),
      description: `The last ${cfg.trendRecords} ${pluralMeal(meal)} ran ${pct(trendRatio)} vs the ${recs.length}-meal average; half the gap is applied.`,
    },
    {
      id: 'menu',
      label: 'Menu effect',
      multiplier: shrink(menuRatio),
      description: itemRatios.length
        ? `Attendance on past days serving these dishes was ${pct(menuRatio)} vs average; half the gap is applied.`
        : 'None of these dishes appear in recent history, so no adjustment.',
    },
    {
      id: 'context',
      label: `Planning context: ${ctx.label}`,
      multiplier: ctx.multiplier,
      description: ctx.description,
    },
  ];

  // Telescoping rounding: impacts always sum to round(forecast) − round(baseline).
  let running = baselineExact;
  const factors: ForecastFactor[] = steps.map((s) => {
    const next = running * s.multiplier;
    const impactDiners = Math.round(next) - Math.round(running);
    running = next;
    return { ...s, impactDiners };
  });

  const unconstrained = Math.round(running);
  const predictedDiners = Math.min(unconstrained, settings.serviceCapacity);
  if (predictedDiners < unconstrained) {
    factors.push({
      id: 'capacity',
      label: 'Service capacity cap',
      multiplier: predictedDiners / unconstrained,
      impactDiners: predictedDiners - unconstrained,
      description: `Limited to the configured capacity of ${settings.serviceCapacity} diners per meal.`,
    });
  }

  const maeMeal = mean(recs.map((r) => Math.abs(r.predictedDiners - actual(r))));
  const band = Math.max(cfg.minBandDiners, Math.round(cfg.bandMultiplier * maeMeal));
  const lowerDiners = Math.max(0, predictedDiners - band);
  const upperDiners = Math.min(settings.serviceCapacity, predictedDiners + band);
  const baselineDiners = Math.round(baselineExact);

  const items: ItemForecast[] = menu.items.map((item) => {
    const hist = historicalUptake(item.name, recs);
    const uptake = hist ? hist.uptake : settings.defaultUptake;
    const predictedDemand = Math.round(predictedDiners * uptake);
    return {
      itemId: item.id,
      name: item.name,
      kgPerPortion: item.kgPerPortion,
      uptake,
      uptakeSource: hist ? 'history' : 'default',
      predictedDemand,
      lowerDemand: Math.round(lowerDiners * uptake),
      upperDemand: Math.round(upperDiners * uptake),
      baselineDemand: Math.round(baselineDiners * uptake),
      suggestedPrep:
        predictedDemand === 0 ? 0 : ceilToStep(predictedDemand * (1 + settings.prepBufferPct / 100), settings.roundingStep),
    };
  });

  return {
    date,
    meal,
    context,
    predictedDiners,
    lowerDiners,
    upperDiners,
    baselineDiners,
    historyRecordsUsed: recs.length,
    factors,
    items,
    assumptions: {
      prepBufferPct: settings.prepBufferPct,
      roundingStep: settings.roundingStep,
      serviceCapacity: settings.serviceCapacity,
      bandDiners: band,
    },
    method: FORECAST_METHOD,
  };
}

/**
 * Async boundary that mirrors a real API call.
 * TODO(backend): replace the body with
 *   const res = await fetch('/api/v1/forecasts', { method: 'POST', body: JSON.stringify(request) });
 *   return (await res.json()) as Forecast;
 */
export async function runForecast(input: ForecastInput): Promise<Forecast> {
  return computeForecast(input);
}
