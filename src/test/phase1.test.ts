import { describe, expect, it } from 'vitest';
import { createSeedState } from '../data/mockData';
import { reducer } from '../store/AppStore';
import { deletionPolicy, draftFromMenu, menuFromDraft, menuId, validateMenuDraft } from '../services/menuService';
import { computeForecast } from '../services/mockForecastService';
import { recordFromForecast, saveActuals, approvePlan } from '../services/operationsService';
import { DEMO_TODAY } from '../lib/constants';
import { addDays } from '../lib/dates';

const seed = () => createSeedState();
const lunchToday = (s = seed()) => s.menus.find((m) => m.date === DEMO_TODAY && m.meal === 'lunch')!;

describe('menu id integrity', () => {
  it('re-derives the id when an edit moves the menu, so a later add cannot collide', () => {
    let s = seed();
    const menu = s.menus.find((m) => m.date === addDays(DEMO_TODAY, 3) && m.meal === 'lunch')!; // no plan
    const movedTo = addDays(DEMO_TODAY, 25);
    const edited = menuFromDraft({ ...draftFromMenu(menu), date: movedTo });
    expect(edited.id).toBe(menuId(movedTo, 'lunch'));
    expect(edited.id).not.toBe(menu.id);

    s = reducer(s, { type: 'menu/update', previousId: menu.id, menu: edited });
    const added = menuFromDraft({ date: menu.date, meal: 'lunch', items: [{ key: 'di-x', name: 'Test', kg: '0.1' }] });
    s = reducer(s, { type: 'menu/add', menu: added });

    const ids = s.menus.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(s.menus.find((m) => m.id === added.id)?.items[0].name).toBe('Test');
    expect(s.menus.find((m) => m.id === edited.id)?.date).toBe(movedTo);
  });

  it('the reducer refuses duplicate ids', () => {
    const s = seed();
    const dup = { ...s.menus[0] };
    expect(reducer(s, { type: 'menu/add', menu: dup }).menus).toHaveLength(s.menus.length);
  });

  it('locks date and meal while a plan exists', () => {
    const s = seed();
    const menu = lunchToday(s);
    const lock = { date: menu.date, meal: menu.meal };
    const moved = { ...draftFromMenu(menu), date: addDays(DEMO_TODAY, 30) };
    expect(validateMenuDraft(moved, s.menus, menu.id, lock)?.date).toMatch(/cannot change/);
    expect(validateMenuDraft(draftFromMenu(menu), s.menus, menu.id, lock)).toBeNull();
  });
});

describe('menu deletion policy', () => {
  const find = (s: ReturnType<typeof seed>, meal: 'breakfast' | 'lunch' | 'dinner') => s.menus.find((m) => m.date === DEMO_TODAY && m.meal === meal)!;

  it('blocks approved and completed plans, in the policy and in the reducer', () => {
    const s = seed();
    for (const meal of ['breakfast', 'lunch'] as const) {
      const m = find(s, meal);
      expect(deletionPolicy(m, s.records).kind).toBe('blocked');
      const after = reducer(s, { type: 'menu/delete', id: m.id });
      expect(after.menus).toHaveLength(s.menus.length);
      expect(after.records).toHaveLength(s.records.length);
    }
  });

  it('removes an unapproved forecast together with its menu', () => {
    const s = seed();
    const m = find(s, 'dinner');
    expect(deletionPolicy(m, s.records).kind).toBe('removes-plan');
    const after = reducer(s, { type: 'menu/delete', id: m.id });
    expect(after.menus.some((x) => x.id === m.id)).toBe(false);
    expect(after.records.some((r) => r.date === DEMO_TODAY && r.meal === 'dinner')).toBe(false);
    expect(after.records).toHaveLength(s.records.length - 1);
  });

  it('deletes a menu with no plan without touching records', () => {
    const s = seed();
    const m = s.menus.find((x) => x.date === addDays(DEMO_TODAY, 2) && x.meal === 'dinner')!;
    expect(deletionPolicy(m, s.records).kind).toBe('free');
    const after = reducer(s, { type: 'menu/delete', id: m.id });
    expect(after.menus).toHaveLength(s.menus.length - 1);
    expect(after.records).toHaveLength(s.records.length);
  });
});

describe('future-dated meals', () => {
  const futureApproved = () => {
    const s = seed();
    const date = addDays(DEMO_TODAY, 2);
    const menu = s.menus.find((m) => m.date === date && m.meal === 'lunch')!;
    const rec = recordFromForecast(computeForecast({ date, meal: 'lunch', menu, history: s.records, settings: s.settings, context: 'normal' }));
    const approved = approvePlan(rec, Object.fromEntries(rec.items.map((i) => [i.itemId, i.suggestedPrep])), 'now');
    const input = { actualDiners: 500, items: Object.fromEntries(approved.items.map((i) => [i.itemId, { prepared: i.suggestedPrep, consumed: 1 }])) };
    return { s, approved, input };
  };

  it('cannot be completed by the service', () => {
    const { approved, input } = futureApproved();
    expect(() => saveActuals(approved, input, 'now', DEMO_TODAY)).toThrow(/on or after the service date/);
  });

  it('can be completed once the service date arrives', () => {
    const { approved, input } = futureApproved();
    expect(saveActuals(approved, input, 'now', approved.date).status).toBe('completed');
  });

  it('cannot be stored as completed even if something bypasses the service', () => {
    const { s, approved, input } = futureApproved();
    const forged = { ...approved, status: 'completed' as const, actualDiners: input.actualDiners };
    const after = reducer(s, { type: 'record/upsert', record: forged });
    expect(after.records.find((r) => r.id === forged.id)).toBeUndefined();
  });

  it('only completed records count as forecast history', () => {
    const s = seed();
    const date = addDays(DEMO_TODAY, 2);
    const menu = s.menus.find((m) => m.date === date && m.meal === 'lunch')!;
    const base = computeForecast({ date, meal: 'lunch', menu, history: s.records, settings: s.settings, context: 'normal' });
    const source = s.records.find((r) => r.date === addDays(DEMO_TODAY, -1) && r.meal === 'lunch')!;
    const bogus = { ...source, id: 'bogus', date: DEMO_TODAY, status: 'approved' as const, actualDiners: 99999 };
    const withBogus = computeForecast({ date, meal: 'lunch', menu, history: [...s.records, bogus], settings: s.settings, context: 'normal' });
    expect(withBogus.predictedDiners).toBe(base.predictedDiners);
    expect(withBogus.baselineDiners).toBe(base.baselineDiners);
  });
});
