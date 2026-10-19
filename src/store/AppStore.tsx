import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import type { MealRecord, Menu, Settings } from '../types';
import { createSeedState, type SeedState } from '../data/mockData';
import { DEMO_TODAY } from '../lib/constants';
import { deletionPolicy } from '../services/menuService';
import { api, setAuthToken, getAuthToken } from '../services/apiClient';

export type UserRole = 'manager' | 'kitchen_staff' | 'student';

export interface CurrentUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
}

export type AppState = SeedState;

export type AppAction =
  | { type: 'menu/add'; menu: Menu }
  | { type: 'menu/update'; previousId: string; menu: Menu }
  | { type: 'menu/delete'; id: string }
  | { type: 'record/upsert'; record: MealRecord }
  | { type: 'settings/update'; settings: Settings }
  | { type: 'init'; data: { settings: Settings; menus: Menu[]; records: MealRecord[] } }
  | { type: 'reset' };

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'init':
      return {
        settings: action.data.settings,
        menus: action.data.menus,
        records: action.data.records,
      };
    case 'menu/add':
      return state.menus.some((m) => m.id === action.menu.id)
        ? state
        : { ...state, menus: [...state.menus, action.menu] };
    case 'menu/update':
      if (state.menus.some((m) => m.id === action.menu.id && m.id !== action.previousId)) return state;
      return {
        ...state,
        menus: state.menus.map((m) => (m.id === action.previousId ? action.menu : m)),
      };
    case 'menu/delete': {
      const menu = state.menus.find((m) => m.id === action.id);
      if (!menu) return state;
      const policy = deletionPolicy(menu, state.records);
      if (policy.kind === 'blocked') return state;
      return {
        ...state,
        menus: state.menus.filter((m) => m.id !== action.id),
        records: policy.kind === 'removes-plan' ? state.records.filter((r) => r.id !== policy.record.id) : state.records,
      };
    }
    case 'record/upsert': {
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

export interface StoreValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  currentUser: CurrentUser | null;
  switchRole: (role: UserRole) => Promise<void>;
  refreshData: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function getDemoUserForToken(token: string | null): CurrentUser {
  if (token && (token.endsWith('kitchen_staff') || token.endsWith('staff'))) {
    return {
      uid: 'demo-staff-uid',
      email: 'staff@smartmess.internal',
      name: 'Ramesh Chef (Kitchen Staff)',
      role: 'kitchen_staff',
    };
  }
  if (token && token.endsWith('student')) {
    return {
      uid: 'demo-student-uid',
      email: 'student@smartmess.internal',
      name: 'Aarav Student (Diner)',
      role: 'student',
    };
  }
  return {
    uid: 'demo-manager-uid',
    email: 'manager@smartmess.internal',
    name: 'Meera Krishnan (Manager)',
    role: 'manager',
  };
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, createSeedState);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => getDemoUserForToken(getAuthToken()));
  const isMountedRef = useRef(true);

  const loadData = async () => {
    try {
      if (!isMountedRef.current) return;
      setSyncing(true);
      setError(null);

      // Verify or establish session
      let token = getAuthToken();
      let resolvedUser: CurrentUser;
      if (!token) {
        token = 'demo-token-manager';
        setAuthToken(token);
        resolvedUser = getDemoUserForToken(token);
        setCurrentUser(resolvedUser);
        try {
          const session = await api.loginSession({ demoRole: 'manager' });
          if (!isMountedRef.current) return;
          token = session.token;
          setAuthToken(token);
          resolvedUser = session.user;
          setCurrentUser(resolvedUser);
        } catch {
          // Preserve resolved local demo user when backend is offline
        }
      } else {
        resolvedUser = getDemoUserForToken(token);
        setCurrentUser(resolvedUser);
        try {
          const me = await api.getMe();
          if (!isMountedRef.current) return;
          resolvedUser = me.user;
          setCurrentUser(resolvedUser);
        } catch {
          // Preserve resolved local demo user for the active token when backend is offline
          if (isMountedRef.current) {
            setCurrentUser(resolvedUser);
          }
        }
      }

      if (!isMountedRef.current) return;

      if (resolvedUser.role === 'student') {
        const remoteMenus = await api.getMenus();
        if (!isMountedRef.current) return;
        rawDispatch({
          type: 'init',
          data: {
            settings: state.settings,
            menus: remoteMenus,
            records: [],
          },
        });
        return;
      }

      const [remoteSettings, remoteMenus, remoteRecords] = await Promise.all([
        api.getSettings(),
        api.getMenus(),
        api.getRecords(),
      ]);

      if (!isMountedRef.current) return;

      if (remoteMenus.length > 0 || remoteRecords.length > 0) {
        rawDispatch({
          type: 'init',
          data: {
            settings: remoteSettings,
            menus: remoteMenus,
            records: remoteRecords,
          },
        });
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        console.warn('[AppStore] Sync with backend deferred or using cached state:', err?.message || err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setSyncing(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    void loadData();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const switchRole = async (role: UserRole) => {
    const fallbackToken = `demo-token-${role}`;
    setAuthToken(fallbackToken);
    if (isMountedRef.current) {
      setCurrentUser(getDemoUserForToken(fallbackToken));
    }
    try {
      if (isMountedRef.current) setSyncing(true);
      const session = await api.loginSession({ demoRole: role });
      if (!isMountedRef.current) return;
      setAuthToken(session.token);
      setCurrentUser(session.user);
      await loadData();
    } catch (err: any) {
      if (isMountedRef.current) {
        console.warn('Failed to switch role via API, using demo fallback:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setSyncing(false);
      }
    }
  };

  const dispatch: Dispatch<AppAction> = (action: AppAction) => {
    rawDispatch(action);

    // Persist mutations asynchronously to PostgreSQL
    if (action.type === 'menu/add') {
      api
        .createMenu({
          date: action.menu.date,
          meal: action.menu.meal,
          items: action.menu.items,
        })
        .catch((err) => {
          if (!isMountedRef.current) return;
          console.warn('[API Sync] createMenu note:', err?.message);
          setError(err?.message || 'Failed to persist new menu to database');
        });
    } else if (action.type === 'menu/update') {
      api
        .updateMenu(action.previousId, {
          date: action.menu.date,
          meal: action.menu.meal,
          items: action.menu.items,
        })
        .catch((err) => {
          if (!isMountedRef.current) return;
          console.warn('[API Sync] updateMenu note:', err?.message);
          setError(err?.message || 'Failed to update menu in database');
        });
    } else if (action.type === 'menu/delete') {
      api.deleteMenu(action.id).catch((err) => {
        if (!isMountedRef.current) return;
        console.warn('[API Sync] deleteMenu note:', err?.message);
        setError(err?.message || 'Failed to delete menu in database');
      });
    } else if (action.type === 'record/upsert') {
      // Determine if existing record exists in state
      const existing = state.records.find((r) => r.id === action.record.id);
      if (existing) {
        api.updateRecord(action.record.id, action.record).catch((err) => {
          if (!isMountedRef.current) return;
          console.warn('[API Sync] updateRecord note:', err?.message);
          setError(err?.message || 'Failed to update meal record in database');
        });
      } else {
        api.createRecord(action.record).catch((err) => {
          if (!isMountedRef.current) return;
          console.warn('[API Sync] createRecord note:', err?.message);
          setError(err?.message || 'Failed to create meal record in database');
        });
      }
    } else if (action.type === 'settings/update') {
      api.updateSettings(action.settings).catch((err) => {
        if (!isMountedRef.current) return;
        console.warn('[API Sync] updateSettings note:', err?.message);
        setError(err?.message || 'Failed to save settings to database');
      });
    }
  };

  const value = useMemo(
    () => ({
      state,
      dispatch,
      loading,
      syncing,
      error,
      currentUser,
      switchRole,
      refreshData: loadData,
    }),
    [state, loading, syncing, error, currentUser],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useAppStore must be used inside <AppStoreProvider>');
  return ctx;
}
