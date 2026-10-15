import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type { MealRecord, Menu, Settings } from '../types';
import { createSeedState, type SeedState } from '../data/mockData';
import { DEMO_TODAY } from '../lib/constants';
import { deletionPolicy } from '../services/menuService';

export type AppState = SeedState;

export type AppAction =
  | { type: 'menu/add'; menu: Menu }
  | { type: 'menu/update'; previousId: string; menu: Menu }
  | { type: 'menu/delete'; id: string }
  | { type: 'record/upsert'; record: MealRecord }
  | { type: 'settings/update'; settings: Settings }
  | { type: 'reset' };

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'menu/add':
      // Defensive: ids are derived from date + meal and validated upstream; never create duplicates.
      return state.menus.some((m) => m.id === action.menu.id) ? state : { ...state, menus: [...state.menus, action.menu] };
    case 'menu/update':
      if (state.menus.some((m) => m.id === action.menu.id && m.id !== action.previousId)) return state;
      return { ...state, menus: state.menus.map((m) => (m.id === action.previousId ? action.menu : m)) };
    case 'menu/delete': {
      const menu = state.menus.find((m) => m.id === action.id);
      if (!menu) return state;
      const policy = deletionPolicy(menu, state.records);
      if (policy.kind === 'blocked') return state; // approved/completed plans are never destroyed
      return {
        ...state,
        menus: state.menus.filter((m) => m.id !== action.id),
        records: policy.kind === 'removes-plan' ? state.records.filter((r) => r.id !== policy.record.id) : state.records,
      };
    }
    case 'record/upsert': {
      // A meal cannot be completed (and so cannot become actuals/history) before its service date.
      if (action.record.status === 'completed' && action.record.date > DEMO_TODAY) return state;
      const exists = state.records.some((r) => r.id === action.record.id);
      return {
        ...state,
        records: exists
          ? state.records.map((r) => (r.id === action.record.id ? action.record : r))
          : [...state.records, action.record],
      };
    }
    case 'settings/update':
      return { ...state, settings: action.settings };
    case 'reset':
      return createSeedState();
  }
}

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Session-only state. A page refresh restores the synthetic seed data (nothing is persisted). */
export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createSeedState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useAppStore must be used inside <AppStoreProvider>');
  return ctx;
}
