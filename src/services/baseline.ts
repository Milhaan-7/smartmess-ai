/**
 * The single definition of "history" and "baseline" for the whole app.
 *
 * Baseline = mean of the latest `windowRecords` completed diner counts for the SAME meal type,
 * strictly before the service date; unavailable (null) with fewer than `minRecords`.
 * The forecaster, the stored baselines in saved records, the evaluation metrics and the Settings text
 * all use this, so the baseline can never mean different things on different pages.
 */
import type { MealRecord, MealType } from '../types';

export const BASELINE_CONFIG = { windowRecords: 14, minRecords: 5 } as const;

export function selectHistory(records: MealRecord[], meal: MealType, date: string): MealRecord[] {
  return records
    .filter((r) => r.status === 'completed' && r.meal === meal && r.actualDiners !== null && r.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, BASELINE_CONFIG.windowRecords);
}

export function trailingBaseline(records: MealRecord[], meal: MealType, date: string): { exact: number; n: number } | null {
  const recs = selectHistory(records, meal, date);
  if (recs.length < BASELINE_CONFIG.minRecords) return null;
  return { exact: recs.reduce((s, r) => s + (r.actualDiners ?? 0), 0) / recs.length, n: recs.length };
}
