import type { Forecast, MealRecord, MealType } from '../types';

export const recordId = (date: string, meal: MealType): string => `rec-${date}-${meal}`;

/** Turns a forecast into an unapproved plan. Nothing is approved automatically. */
export function recordFromForecast(f: Forecast): MealRecord {
  return {
    id: recordId(f.date, f.meal),
    date: f.date,
    meal: f.meal,
    status: 'recommended',
    context: f.context,
    predictedDiners: f.predictedDiners,
    lowerDiners: f.lowerDiners,
    upperDiners: f.upperDiners,
    baselineDiners: f.baselineDiners,
    forecastSource: 'rule_based',
    actualDiners: null,
    approvedAt: null,
    completedAt: null,
    items: f.items.map((i) => ({
      itemId: i.itemId,
      name: i.name,
      kgPerPortion: i.kgPerPortion,
      predictedDemand: i.predictedDemand,
      lowerDemand: i.lowerDemand,
      upperDemand: i.upperDemand,
      suggestedPrep: i.suggestedPrep,
      approvedPrep: null,
      prepared: null,
      consumed: null,
    })),
  };
}

export type QuantityResult = { ok: true; value: number } | { ok: false; error: string };

/** Validates a quantity typed into a form field (whole, non-negative portions). */
export function parseQuantity(raw: string): QuantityResult {
  const text = raw.trim();
  if (text === '') return { ok: false, error: 'Required' };
  const value = Number(text);
  if (Number.isNaN(value)) return { ok: false, error: 'Enter a number' };
  if (value < 0) return { ok: false, error: 'Cannot be negative' };
  if (!Number.isInteger(value)) return { ok: false, error: 'Whole portions only' };
  if (value > 100_000) return { ok: false, error: 'Too large' };
  return { ok: true, value };
}

export function approvePlan(record: MealRecord, quantities: Record<string, number>, nowIso: string): MealRecord {
  if (record.status !== 'recommended') throw new Error('Only a recommended plan can be approved.');
  const items = record.items.map((it) => {
    const q = quantities[it.itemId];
    if (q === undefined || q < 0) throw new Error(`Missing approved quantity for ${it.name}.`);
    return { ...it, approvedPrep: q };
  });
  return { ...record, items, status: 'approved', approvedAt: nowIso };
}

/** Moves an approved (not yet completed) plan back to review. */
export function reopenPlan(record: MealRecord): MealRecord {
  if (record.status !== 'approved') throw new Error('Only an approved plan can be reopened.');
  return {
    ...record,
    status: 'recommended',
    approvedAt: null,
    items: record.items.map((i) => ({ ...i, approvedPrep: null, prepared: null, consumed: null })),
  };
}

export interface ActualsInput {
  actualDiners: number;
  items: Record<string, { prepared: number; consumed: number }>;
}

export function validateActuals(input: ActualsInput): string | null {
  for (const [id, v] of Object.entries(input.items)) {
    if (v.consumed > v.prepared) return `Consumed cannot exceed prepared (${id}).`;
  }
  return null;
}

/** Actual results can only be entered once the service date has arrived. */
export const canRecordResults = (record: MealRecord, today: string): boolean => record.date <= today;

export function saveActuals(record: MealRecord, input: ActualsInput, nowIso: string, today: string): MealRecord {
  if (record.status === 'recommended') throw new Error('Approve the plan before recording results.');
  if (!canRecordResults(record, today)) {
    throw new Error(`Results can only be recorded on or after the service date (${record.date}).`);
  }
  const problem = validateActuals(input);
  if (problem) throw new Error(problem);
  return {
    ...record,
    status: 'completed',
    actualDiners: input.actualDiners,
    completedAt: nowIso,
    items: record.items.map((it) => {
      const v = input.items[it.itemId];
      return v ? { ...it, prepared: v.prepared, consumed: v.consumed } : it;
    }),
  };
}
