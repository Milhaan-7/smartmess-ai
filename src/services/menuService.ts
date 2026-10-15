import type { MealRecord, MealType, Menu } from '../types';
import { recordId } from './operationsService';
import { FOOD_CATALOG } from '../data/mockData';
import { isValidDateString } from '../lib/dates';
import { uid } from '../lib/ids';
import { MEAL_ORDER } from '../lib/constants';

export interface MenuDraftItem {
  key: string;
  name: string;
  /** kg per portion, as typed */
  kg: string;
}
export interface MenuDraft {
  date: string;
  meal: MealType | '';
  items: MenuDraftItem[];
}
export interface MenuErrors {
  date?: string;
  meal?: string;
  items?: string;
  item: Record<string, { name?: string; kg?: string }>;
}

export const menuId = (date: string, meal: MealType): string => `menu-${date}-${meal}`;

export const findMenu = (menus: Menu[], date: string, meal: MealType): Menu | undefined =>
  menus.find((m) => m.date === date && m.meal === meal);

export const menusOnDate = (menus: Menu[], date: string): Menu[] =>
  MEAL_ORDER.map((meal) => findMenu(menus, date, meal)).filter((m): m is Menu => m !== undefined);

export function menuSummary(menu: Menu, max = 3): string {
  const names = menu.items.map((i) => i.name);
  return names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')} +${names.length - max} more`;
}

export const emptyDraft = (date: string, meal: MealType | ''): MenuDraft => ({
  date,
  meal,
  items: [{ key: uid('di'), name: '', kg: '' }],
});

export const draftFromMenu = (menu: Menu): MenuDraft => ({
  date: menu.date,
  meal: menu.meal,
  items: menu.items.map((i) => ({ key: i.id, name: i.name, kg: String(i.kgPerPortion) })),
});

/**
 * `lock` is set when editing a menu whose meal already has a forecast or plan: the plan is keyed by
 * date + meal, so moving the menu would orphan it.
 */
export function validateMenuDraft(
  draft: MenuDraft,
  menus: Menu[],
  editingId?: string,
  lock?: { date: string; meal: MealType },
): MenuErrors | null {
  const errors: MenuErrors = { item: {} };
  if (!isValidDateString(draft.date)) errors.date = 'Choose a valid date';
  if (!draft.meal) errors.meal = 'Choose a meal';
  if (lock && !errors.date && (draft.date !== lock.date || draft.meal !== lock.meal)) {
    errors.date = 'Date and meal cannot change while a forecast or plan exists for this meal.';
  }
  if (!errors.date && draft.meal) {
    const clash = findMenu(menus, draft.date, draft.meal);
    if (clash && clash.id !== editingId) errors.date = 'A menu already exists for this date and meal. Edit it instead.';
  }
  if (draft.items.length === 0) errors.items = 'Add at least one food item';
  const seen = new Set<string>();
  for (const it of draft.items) {
    const itemErr: { name?: string; kg?: string } = {};
    const name = it.name.trim();
    if (!name) itemErr.name = 'Enter a name';
    else if (name.length > 60) itemErr.name = 'Keep it under 60 characters';
    else if (seen.has(name.toLowerCase())) itemErr.name = 'Duplicate item';
    seen.add(name.toLowerCase());
    const kg = Number(it.kg);
    if (it.kg.trim() === '' || Number.isNaN(kg)) itemErr.kg = 'Enter weight';
    else if (kg <= 0 || kg > 5) itemErr.kg = 'Between 0 and 5 kg';
    if (itemErr.name || itemErr.kg) errors.item[it.key] = itemErr;
  }
  const hasErrors = errors.date || errors.meal || errors.items || Object.keys(errors.item).length > 0;
  return hasErrors ? errors : null;
}

export function menuFromDraft(draft: MenuDraft): Menu {
  if (!draft.meal) throw new Error('Meal is required');
  // One menu per date + meal (enforced by validateMenuDraft), so the id is derived from them.
  // Re-deriving it on every save keeps ids unique when an edit moves a menu to another date or meal.
  const id = menuId(draft.date, draft.meal);
  const items = draft.items.map((d, idx) => ({
    id: d.key.startsWith('di-') ? `${id}-n${idx}-${d.key.slice(3)}` : d.key,
    name: d.name.trim(),
    kgPerPortion: Number(d.kg),
  }));
  return { id, date: draft.date, meal: draft.meal, items };
}

export type DeletionPolicy =
  | { kind: 'free' }
  | { kind: 'removes-plan'; record: MealRecord }
  | { kind: 'blocked'; record: MealRecord };

/**
 * Deleting a menu must never leave a plan without a menu, and must never destroy an approved or
 * completed plan: those are blocked; an unapproved forecast is removed together with the menu.
 */
export function deletionPolicy(menu: Menu, records: MealRecord[]): DeletionPolicy {
  const record = records.find((r) => r.id === recordId(menu.date, menu.meal));
  if (!record) return { kind: 'free' };
  return record.status === 'recommended' ? { kind: 'removes-plan', record } : { kind: 'blocked', record };
}

/** Name → default portion weight, used for autocomplete in the menu form. */
export const getFoodSuggestions = (): Array<{ name: string; kgPerPortion: number }> =>
  FOOD_CATALOG.map((f) => ({ name: f.name, kgPerPortion: f.kgPerPortion }));
