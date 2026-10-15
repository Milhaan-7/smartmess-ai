import type { MealType, SpecialDay } from '../types';

/**
 * The demo is anchored to a fixed "planning date" so the synthetic dataset and
 * screenshots are reproducible. Replace with `toDateString(new Date())` when a
 * real backend is connected.
 */
export const DEMO_TODAY = '2026-10-14';

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner'];

export const MEAL_META: Record<MealType, { label: string; time: string }> = {
  breakfast: { label: 'Breakfast', time: '7:30 – 9:30 AM' },
  lunch: { label: 'Lunch', time: '12:30 – 2:30 PM' },
  dinner: { label: 'Dinner', time: '7:30 – 9:30 PM' },
};

export const MEAL_OPTIONS = MEAL_ORDER.map((m) => ({ value: m, label: MEAL_META[m].label }));

/** Manual planning inputs. Multipliers are assumptions, not learned values. */
export const SPECIAL_DAYS: Record<SpecialDay, { label: string; multiplier: number; description: string }> = {
  normal: { label: 'Regular day', multiplier: 1, description: 'No adjustment.' },
  exam_week: {
    label: 'Exam week',
    multiplier: 1.04,
    description: 'Assumed +4%: more students stay in the hostel.',
  },
  campus_event: {
    label: 'Campus event',
    multiplier: 1.07,
    description: 'Assumed +7%: visitors and event volunteers eat at the mess.',
  },
  festival_holiday: {
    label: 'Festival / holiday',
    multiplier: 0.82,
    description: 'Assumed −18%: many students travel home.',
  },
};

export const SYNTHETIC_LABEL = 'Synthetic demonstration data';

export const KG_NOTE =
  'Weights use kilograms per portion defined on each menu item (beverages: 1 L ≈ 1 kg).';
