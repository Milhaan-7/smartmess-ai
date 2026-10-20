export type MealType = 'breakfast' | 'lunch' | 'dinner';
/** Lifecycle of a saved kitchen plan. `not_planned` is display-only (no record exists). */
export type PlanStatus = 'recommended' | 'approved' | 'completed';
export type DisplayStatus = PlanStatus | 'not_planned';
export type SpecialDay = 'normal' | 'exam_week' | 'campus_event' | 'festival_holiday';
export type PageId = 'dashboard' | 'forecasts' | 'menus' | 'operations' | 'waste' | 'settings' | 'login';


export interface MenuItem {
  id: string;
  name: string;
  /** Weight of one portion in kilograms (beverages: 1 L ≈ 1 kg). */
  kgPerPortion: number;
}

export interface Menu {
  id: string;
  /** ISO calendar date, YYYY-MM-DD */
  date: string;
  meal: MealType;
  items: MenuItem[];
}

export interface Settings {
  institutionName: string;
  messName: string;
  location: string;
  messManager: string;
  /** Extra % added on top of predicted demand when suggesting preparation. */
  prepBufferPct: number;
  /** Maximum diners the mess can serve per meal. */
  serviceCapacity: number;
  /** Suggested quantities are rounded up to a multiple of this many portions. */
  roundingStep: number;
  /** Share of diners assumed to take an item that has no history (0–1). */
  defaultUptake: number;
  defaultReviewMeal: MealType;
  upcomingHorizonDays: number;
}

/* ---------- Forecasting ---------- */

export interface ForecastInput {
  date: string;
  meal: MealType;
  menu: Menu;
  /** Saved meal records used as history (only completed records with actual diners are used). */
  history: MealRecord[];
  settings: Settings;
  context: SpecialDay;
}

export interface ForecastFactor {
  id: string;
  label: string;
  description: string;
  multiplier: number;
  /** Change in expected diners attributable to this factor (rounded; impacts sum to forecast − baseline). */
  impactDiners: number;
}

export interface ItemForecast {
  itemId: string;
  name: string;
  kgPerPortion: number;
  uptake: number;
  uptakeSource: 'history' | 'default';
  predictedDemand: number;
  lowerDemand: number;
  upperDemand: number;
  baselineDemand: number;
  suggestedPrep: number;
}

export interface Forecast {
  date: string;
  meal: MealType;
  context: SpecialDay;
  predictedDiners: number;
  lowerDiners: number;
  upperDiners: number;
  baselineDiners: number;
  historyRecordsUsed: number;
  factors: ForecastFactor[];
  items: ItemForecast[];
  assumptions: {
    prepBufferPct: number;
    roundingStep: number;
    serviceCapacity: number;
    bandDiners: number;
  };
  method: string;
}

/* ---------- Kitchen operations ---------- */

export interface RecordItem {
  itemId: string;
  name: string;
  kgPerPortion: number;
  predictedDemand: number;
  lowerDemand: number;
  upperDemand: number;
  suggestedPrep: number;
  /** Set only when the kitchen manager confirms the plan. */
  approvedPrep: number | null;
  prepared: number | null;
  consumed: number | null;
}

export interface MealRecord {
  id: string;
  date: string;
  meal: MealType;
  status: PlanStatus;
  context: SpecialDay;
  predictedDiners: number;
  lowerDiners: number;
  upperDiners: number;
  /** Trailing-mean baseline as of forecast time (see services/baseline.ts); null when there was not enough history. */
  baselineDiners: number | null;
  /** Where the stored forecast came from: generated demo values, or the rule-based forecaster. */
  forecastSource: 'synthetic_seed' | 'rule_based';
  actualDiners: number | null;
  approvedAt: string | null;
  completedAt: string | null;
  items: RecordItem[];
}

/* ---------- Notifications ---------- */

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'daily' | 'weekly';
  date: string;
  meal?: MealType;
  timestamp: string;
  read: boolean;
  linkHash: string;
}

