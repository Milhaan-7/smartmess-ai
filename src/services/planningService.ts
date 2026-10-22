import type { DisplayStatus, MealRecord, MealType, Menu, Settings } from '../types';
import { MEAL_META, MEAL_ORDER } from '../lib/constants';
import { addDays } from '../lib/dates';
import { computeForecast } from './mockForecastService';
import { findMenu } from './menuService';
import { estimateLeftoverKg } from './metrics';
import { recordId } from './operationsService';

export interface PlanningState {
  menus: Menu[];
  records: MealRecord[];
  settings: Settings;
}

export interface UpcomingMeal {
  key: string;
  date: string;
  meal: MealType;
  menu: Menu;
  record: MealRecord | null;
  status: DisplayStatus;
  predictedDiners: number | null;
}

export const findRecord = (records: MealRecord[], date: string, meal: MealType): MealRecord | null =>
  records.find((r) => r.id === recordId(date, meal) || (r.date === date && r.meal === meal)) ?? null;

function tryForecast(state: PlanningState, menu: Menu) {
  try {
    return computeForecast({
      date: menu.date,
      meal: menu.meal,
      menu,
      history: state.records,
      settings: state.settings,
      context: 'normal',
    });
  } catch {
    return null;
  }
}

/** Meals from `today` for `days` days that are not yet completed, in service order. */
export function getUpcomingMeals(state: PlanningState, today: string, days: number, limit = 9): UpcomingMeal[] {
  const out: UpcomingMeal[] = [];
  for (let d = 0; d < days; d++) {
    const date = addDays(today, d);
    for (const meal of MEAL_ORDER) {
      const menu = findMenu(state.menus, date, meal);
      if (!menu) continue;
      const record = findRecord(state.records, date, meal);
      if (record?.status === 'completed') continue;
      out.push({
        key: `${date}-${meal}`,
        date,
        meal,
        menu,
        record,
        status: record?.status ?? 'not_planned',
        predictedDiners: record ? record.predictedDiners : (tryForecast(state, menu)?.predictedDiners ?? null),
      });
    }
  }
  return out.slice(0, limit);
}

/** First upcoming meal whose plan has not been approved yet. */
export function getNextMealToReview(state: PlanningState, today: string, lookaheadDays = 14): UpcomingMeal | null {
  return (
    getUpcomingMeals(state, today, lookaheadDays, 1000).find(
      (m) => m.status === 'not_planned' || m.status === 'recommended',
    ) ?? null
  );
}

export interface PlanPreviewItem {
  name: string;
  predictedDemand: number;
  lowerDemand: number;
  upperDemand: number;
  suggestedPrep: number;
}
export interface PlanPreview {
  predictedDiners: number;
  source: 'saved' | 'estimate';
  items: PlanPreviewItem[];
}

/** Saved plan if one exists, otherwise a fresh deterministic estimate (regular-day context). */
export function getPlanPreview(state: PlanningState, date: string, meal: MealType): PlanPreview | null {
  const saved = findRecord(state.records, date, meal);
  if (saved) return { predictedDiners: saved.predictedDiners, source: 'saved', items: saved.items };
  const menu = findMenu(state.menus, date, meal);
  const fc = menu ? tryForecast(state, menu) : null;
  return fc ? { predictedDiners: fc.predictedDiners, source: 'estimate', items: fc.items } : null;
}

export interface TodaySummary {
  /** Actual diners for meals already recorded today. */
  recordedDiners: number;
  /** Forecast diners for today's meals that are not recorded yet. */
  forecastDiners: number;
  mealsWithMenu: number;
  mealsPlanned: number;
  awaitingApproval: number;
  leftoverKg: number;
}

export function getTodaySummary(state: PlanningState, today: string): TodaySummary {
  let recordedDiners = 0;
  let forecastDiners = 0;
  let mealsWithMenu = 0;
  let mealsPlanned = 0;
  let awaitingApproval = 0;
  for (const meal of MEAL_ORDER) {
    const menu = findMenu(state.menus, today, meal);
    if (!menu) continue;
    mealsWithMenu += 1;
    const rec = findRecord(state.records, today, meal);
    const preview = getPlanPreview(state, today, meal);
    if (rec?.actualDiners != null) recordedDiners += rec.actualDiners;
    else forecastDiners += preview?.predictedDiners ?? 0;
    if (rec?.status === 'approved' || rec?.status === 'completed') mealsPlanned += 1;
    else awaitingApproval += 1;
  }
  const { kg } = estimateLeftoverKg(state.records, today);
  return { recordedDiners, forecastDiners, mealsWithMenu, mealsPlanned, awaitingApproval, leftoverKg: kg };
}

export interface AppNotification {
  id: string;
  tone: 'info' | 'warning';
  title: string;
  detail: string;
  page: 'operations' | 'forecasts' | 'settings';
  params?: Record<string, string>;
}

export function buildNotifications(state: PlanningState, today: string): AppNotification[] {
  const items: AppNotification[] = [];
  for (const meal of MEAL_ORDER) {
    const menu = findMenu(state.menus, today, meal);
    if (!menu) continue;
    const rec = findRecord(state.records, today, meal);
    const label = MEAL_META[meal].label;
    const params = { date: today, meal };
    if (!rec) {
      items.push({ id: `np-${meal}`, tone: 'warning', title: `${label}: no forecast yet`, detail: 'Run a forecast to get preparation suggestions.', page: 'forecasts', params });
    } else if (rec.status === 'recommended') {
      items.push({ id: `rv-${meal}`, tone: 'warning', title: `${label}: plan awaiting approval`, detail: 'Review the suggested quantities and confirm the final plan.', page: 'operations', params });
    } else if (rec.status === 'approved') {
      items.push({ id: `ap-${meal}`, tone: 'info', title: `${label}: results not recorded`, detail: 'Enter prepared and consumed quantities after service.', page: 'operations', params });
    }
  }
  items.push({ id: 'synthetic', tone: 'info', title: 'Synthetic demo data in use', detail: 'Figures are illustrative and not from a real institution.', page: 'settings' });
  return items;
}
