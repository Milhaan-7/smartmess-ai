import type { MealRecord, MealType, RecordItem } from '../types';
import { MEAL_ORDER } from '../lib/constants';
import { addDays, formatDayMonth } from '../lib/dates';

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]): number => (xs.length ? sum(xs) / xs.length : 0);

/** Forecast error = predicted − actual (positive = over-forecast). */
export const forecastError = (predicted: number, actual: number): number => predicted - actual;

/**
 * Shared evaluation window: the EVALUATION_WINDOW_DAYS service days ending the day before the planning date.
 * The Dashboard accuracy card, the Dashboard trend charts and the default Waste Analytics range all use it,
 * so the same meals produce the same numbers everywhere.
 */
export const EVALUATION_WINDOW_DAYS = 14;
export interface DateRange {
  from: string;
  to: string;
}
export const evaluationWindow = (today: string): DateRange => ({
  from: addDays(today, -EVALUATION_WINDOW_DAYS),
  to: addDays(today, -1),
});
export const inRange = (r: { date: string }, range: DateRange): boolean => r.date >= range.from && r.date <= range.to;

export interface ErrorStats {
  /** Meals used for EVERY figure below: completed, with an actual diner count and a baseline. */
  n: number;
  /** Mean absolute error in diners. */
  mae: number;
  /** Mean signed error in diners (positive = tends to over-forecast). */
  bias: number;
  /** Weighted absolute percentage error = Σ|error| ÷ Σ actual. */
  wape: number;
  /** 1 − WAPE. Only meaningful alongside the definition above. */
  accuracy: number;
  /** MAE of the trailing-mean baseline (services/baseline.ts) on exactly the same meals. */
  baselineMae: number;
  /** Completed meals with an actual count that were left out because no baseline was available. */
  excluded: number;
  /** How many of the n stored forecasts are synthetic demo values vs rule-based forecaster output. */
  syntheticStored: number;
  ruleBased: number;
}

type Eligible = MealRecord & { actualDiners: number; baselineDiners: number };

/** The one place forecast error, baseline error and accuracy are computed. */
export function forecastErrorStats(records: MealRecord[]): ErrorStats | null {
  const completed = records.filter((r) => r.status === 'completed' && r.actualDiners !== null);
  const eligible = completed.filter((r): r is Eligible => r.baselineDiners !== null);
  if (eligible.length === 0) return null;
  const errors = eligible.map((r) => forecastError(r.predictedDiners, r.actualDiners));
  const sumAbs = sum(errors.map(Math.abs));
  const sumActual = sum(eligible.map((r) => r.actualDiners));
  return {
    n: eligible.length,
    mae: sumAbs / eligible.length,
    bias: mean(errors),
    wape: sumActual > 0 ? sumAbs / sumActual : 0,
    accuracy: sumActual > 0 ? 1 - sumAbs / sumActual : 0,
    baselineMae: mean(eligible.map((r) => Math.abs(forecastError(r.baselineDiners, r.actualDiners)))),
    excluded: completed.length - eligible.length,
    syntheticStored: eligible.filter((r) => r.forecastSource === 'synthetic_seed').length,
    ruleBased: eligible.filter((r) => r.forecastSource === 'rule_based').length,
  };
}

/** Plain-language provenance of the forecasts behind a set of metrics. */
export function describeForecastSources(stats: Pick<ErrorStats, 'n' | 'syntheticStored' | 'ruleBased'>): string {
  if (stats.ruleBased === 0) {
    return 'The stored forecasts in this demo are synthetic values generated with the dataset, not model output, so this illustrates the calculation only and says nothing about real-world accuracy.';
  }
  return `${stats.syntheticStored} of ${stats.n} stored forecasts are synthetic demo values and ${stats.ruleBased} came from the rule-based forecaster (not machine learning). Synthetic data says nothing about real-world accuracy.`;
}

/** Leftover = prepared − consumed (same unit: portions). Null until both are recorded. */
export const itemLeftover = (i: RecordItem): number | null =>
  i.prepared !== null && i.consumed !== null ? i.prepared - i.consumed : null;

export interface RecordTotals {
  preparedKg: number;
  consumedKg: number;
  leftoverKg: number;
  /** Leftover kg ÷ prepared kg, or null when nothing was measured. */
  wasteRate: number | null;
  measured: boolean;
}

export function recordTotals(record: MealRecord): RecordTotals {
  let preparedKg = 0;
  let consumedKg = 0;
  let measured = false;
  for (const it of record.items) {
    if (it.prepared !== null && it.consumed !== null) {
      preparedKg += it.prepared * it.kgPerPortion;
      consumedKg += it.consumed * it.kgPerPortion;
      measured = true;
    }
  }
  const leftoverKg = preparedKg - consumedKg;
  return { preparedKg, consumedKg, leftoverKg, wasteRate: preparedKg > 0 ? leftoverKg / preparedKg : null, measured };
}

export const suggestedKg = (r: MealRecord): number =>
  r.items.reduce((s, i) => s + i.suggestedPrep * i.kgPerPortion, 0);
export const approvedKg = (r: MealRecord): number =>
  r.items.reduce((s, i) => s + (i.approvedPrep ?? 0) * i.kgPerPortion, 0);

export interface ItemWasteRow {
  name: string;
  timesServed: number;
  preparedPortions: number;
  consumedPortions: number;
  leftoverPortions: number;
  preparedKg: number;
  consumedKg: number;
  leftoverKg: number;
  wasteRate: number | null;
}

export function aggregateByItem(records: MealRecord[]): ItemWasteRow[] {
  const map = new Map<string, ItemWasteRow>();
  for (const r of records) {
    for (const it of r.items) {
      if (it.prepared === null || it.consumed === null) continue;
      const row =
        map.get(it.name) ??
        ({
          name: it.name,
          timesServed: 0,
          preparedPortions: 0,
          consumedPortions: 0,
          leftoverPortions: 0,
          preparedKg: 0,
          consumedKg: 0,
          leftoverKg: 0,
          wasteRate: null,
        } satisfies ItemWasteRow);
      row.timesServed += 1;
      row.preparedPortions += it.prepared;
      row.consumedPortions += it.consumed;
      row.leftoverPortions += it.prepared - it.consumed;
      row.preparedKg += it.prepared * it.kgPerPortion;
      row.consumedKg += it.consumed * it.kgPerPortion;
      map.set(it.name, row);
    }
  }
  return [...map.values()].map((row) => {
    const leftoverKg = row.preparedKg - row.consumedKg;
    return { ...row, leftoverKg, wasteRate: row.preparedKg > 0 ? leftoverKg / row.preparedKg : null };
  });
}

export interface DailyPoint {
  date: string;
  label: string;
  predicted: number;
  actual: number;
  preparedKg: number;
  leftoverKg: number;
  wasteRatePct: number;
}

export type MealFilter = MealType | 'all';

/**
 * Aggregates completed records per day. With the "all meals" filter a day is only
 * included once every meal has been recorded, so partial days never distort trends.
 */
export function dailySeries(records: MealRecord[], meal: MealFilter): DailyPoint[] {
  const byDate = new Map<string, MealRecord[]>();
  for (const r of records) {
    if (r.actualDiners === null) continue;
    if (meal !== 'all' && r.meal !== meal) continue;
    byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
  }
  const needed = meal === 'all' ? MEAL_ORDER.length : 1;
  return [...byDate.entries()]
    .filter(([, rs]) => new Set(rs.map((r) => r.meal)).size === needed)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rs]) => {
      const totals = rs.map(recordTotals);
      const preparedKg = sum(totals.map((t) => t.preparedKg));
      const leftoverKg = sum(totals.map((t) => t.leftoverKg));
      return {
        date,
        label: formatDayMonth(date),
        predicted: sum(rs.map((r) => r.predictedDiners)),
        actual: sum(rs.map((r) => r.actualDiners ?? 0)),
        preparedKg: Math.round(preparedKg * 10) / 10,
        leftoverKg: Math.round(leftoverKg * 10) / 10,
        wasteRatePct: preparedKg > 0 ? Math.round((leftoverKg / preparedKg) * 1000) / 10 : 0,
      };
    });
}

/**
 * Estimated leftover for one date: (prepared | approved | suggested) − (consumed | predicted demand),
 * floored at zero per item, in kg. Uses recorded values where they exist.
 */
export function estimateLeftoverKg(records: MealRecord[], date: string): { kg: number; meals: number } {
  let kg = 0;
  let meals = 0;
  for (const r of records.filter((x) => x.date === date)) {
    meals += 1;
    for (const it of r.items) {
      const planned = it.prepared ?? it.approvedPrep ?? it.suggestedPrep;
      const used = it.consumed ?? it.predictedDemand;
      kg += Math.max(0, planned - used) * it.kgPerPortion;
    }
  }
  return { kg, meals };
}
