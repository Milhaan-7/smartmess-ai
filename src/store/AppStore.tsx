import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import type { AppNotification, MealRecord, Menu, Settings } from '../types';
import { createSeedState, DEFAULT_SETTINGS, type SeedState } from '../data/mockData';
import { DEMO_TODAY } from '../lib/constants';
import { deletionPolicy } from '../services/menuService';
import { computeForecast } from '../services/mockForecastService';
import { recordFromForecast } from '../services/operationsService';
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
  | {
      type: 'notification/add';
      notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'> & { id?: string; timestamp?: string };
    }
  | { type: 'notification/markRead'; id: string }
  | { type: 'notification/markAllRead' }
  | { type: 'notification/clearAll' }
  | { type: 'init'; data: { settings: Settings; menus: Menu[]; records: MealRecord[]; notifications?: AppNotification[] } }
  | { type: 'reset' };

export const STORAGE_KEY = 'smartmess_app_state_v1';

function isValidMenu(m: unknown): m is Menu {
  if (!m || typeof m !== 'object') return false;
  const candidate = m as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.date === 'string' &&
    typeof candidate.meal === 'string' &&
    Array.isArray(candidate.items) &&
    candidate.items.every(
      (it) =>
        Boolean(it) &&
        typeof it === 'object' &&
        typeof (it as Record<string, unknown>).id === 'string' &&
        typeof (it as Record<string, unknown>).name === 'string' &&
        typeof (it as Record<string, unknown>).kgPerPortion === 'number' &&
        !Number.isNaN((it as Record<string, unknown>).kgPerPortion as number),
    )
  );
}

function isValidRecord(r: unknown): r is MealRecord {
  if (!r || typeof r !== 'object') return false;
  const candidate = r as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.date === 'string' &&
    typeof candidate.meal === 'string' &&
    typeof candidate.status === 'string' &&
    Array.isArray(candidate.items)
  );
}

function isValidNotification(n: unknown): n is AppNotification {
  if (!n || typeof n !== 'object') return false;
  const candidate = n as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.date === 'string' &&
    typeof candidate.meal === 'string' &&
    typeof candidate.timestamp === 'string' &&
    typeof candidate.read === 'boolean' &&
    typeof candidate.linkHash === 'string'
  );
}

export function sanitizeStoredState(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const parsed = raw as Record<string, unknown>;

  const hasKnownKey =
    Array.isArray(parsed.menus) ||
    Array.isArray(parsed.records) ||
    (Boolean(parsed.settings) && typeof parsed.settings === 'object') ||
    Array.isArray(parsed.notifications);

  if (!hasKnownKey) return null;

  const seed = createSeedState();

  const validMenus = Array.isArray(parsed.menus) ? parsed.menus.filter(isValidMenu) : [];
  const validRecords = Array.isArray(parsed.records) ? parsed.records.filter(isValidRecord) : [];

  const rawSettings =
    parsed.settings && typeof parsed.settings === 'object' && !Array.isArray(parsed.settings)
      ? (parsed.settings as Partial<Settings>)
      : null;

  const settings: Settings =
    rawSettings && typeof rawSettings.institutionName === 'string' && rawSettings.institutionName.trim()
      ? {
          ...DEFAULT_SETTINGS,
          ...rawSettings,
        }
      : seed.settings;

  const notifications: AppNotification[] = Array.isArray(parsed.notifications)
    ? parsed.notifications.filter(isValidNotification)
    : seed.notifications;

  if (validMenus.length === 0 && validRecords.length === 0 && !rawSettings && !Array.isArray(parsed.notifications)) {
    return null;
  }

  return {
    settings,
    menus: validMenus.length > 0 ? validMenus : seed.menus,
    records: validRecords.length > 0 ? validRecords : seed.records,
    notifications,
  };
}

export function readStoredState(): AppState | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return sanitizeStoredState(parsed);
    } catch {
      return null;
    }
  }
  return null;
}

export function saveStateToStorage(nextState: AppState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    let menusToSave = nextState.menus;
    let recordsToSave = nextState.records;

    if (menusToSave.length === 0 || recordsToSave.length === 0) {
      const existing = readStoredState();
      if (existing) {
        if (menusToSave.length === 0) menusToSave = existing.menus;
        if (recordsToSave.length === 0) recordsToSave = existing.records;
      }
    }

    if (menusToSave.length === 0 && recordsToSave.length === 0) return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        settings: nextState.settings,
        menus: menusToSave,
        records: recordsToSave,
        notifications: nextState.notifications || [],
      }),
    );
  } catch {
    // Ignore quota/access errors
  }
}

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'init':
      return {
        settings: action.data.settings || state.settings,
        menus: action.data.menus.length > 0 ? action.data.menus : state.menus,
        records: action.data.records.length > 0 ? action.data.records : state.records,
        notifications: action.data.notifications ?? state.notifications ?? [],
      };
    case 'menu/add':
      return state.menus.some((m) => m.id === action.menu.id)
        ? state
        : { ...state, menus: [...state.menus, action.menu] };
    case 'menu/update': {
      if (state.menus.some((m) => m.id === action.menu.id && m.id !== action.previousId)) return state;
      const updatedMenus = state.menus.map((m) => (m.id === action.previousId ? action.menu : m));
      const existingRecord = state.records.find(
        (r) => r.date === action.menu.date && r.meal === action.menu.meal,
      );
      if (!existingRecord) {
        return {
          ...state,
          menus: updatedMenus,
        };
      }

      let updatedRecords = state.records;
      try {
        const fc = computeForecast({
          date: action.menu.date,
          meal: action.menu.meal,
          menu: action.menu,
          history: state.records,
          settings: state.settings,
          context: existingRecord.context,
        });
        const freshRecord = recordFromForecast(fc);
        if (existingRecord.status === 'recommended') {
          updatedRecords = state.records.map((r) => (r.id === existingRecord.id ? freshRecord : r));
        } else {
          const syncedItems = freshRecord.items.map((fcItem) => {
            const prevItem = existingRecord.items.find(
              (pi) => pi.itemId === fcItem.itemId || pi.name.toLowerCase() === fcItem.name.toLowerCase(),
            );
            if (prevItem) {
              return {
                ...fcItem,
                itemId: fcItem.itemId,
                name: fcItem.name,
                kgPerPortion: fcItem.kgPerPortion,
                approvedPrep: prevItem.approvedPrep ?? fcItem.suggestedPrep,
                prepared: prevItem.prepared,
                consumed: prevItem.consumed,
              };
            }
            return {
              ...fcItem,
              approvedPrep: existingRecord.status === 'approved' ? fcItem.suggestedPrep : null,
              prepared: null,
              consumed: null,
            };
          });
          updatedRecords = state.records.map((r) =>
            r.id === existingRecord.id ? { ...existingRecord, items: syncedItems } : r,
          );
        }
      } catch {
        // Preserve existing records if forecast recomputation is not applicable
      }

      return {
        ...state,
        menus: updatedMenus,
        records: updatedRecords,
      };
    }
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
    case 'notification/add': {
      const now = action.notification.timestamp || new Date().toISOString();
      const existingIndex = (state.notifications || []).findIndex(
        (n) =>
          n.title === action.notification.title ||
          (n.date === action.notification.date && n.meal === action.notification.meal && n.type === action.notification.type)
      );
      if (existingIndex >= 0) {
        const updated = [...(state.notifications || [])];
        updated[existingIndex] = {
          ...updated[existingIndex],
          message: action.notification.message,
          timestamp: now,
          read: false,
        };
        return { ...state, notifications: updated };
      }
      const newNotif: AppNotification = {
        ...action.notification,
        id: action.notification.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: now,
        read: false,
      };
      return { ...state, notifications: [newNotif, ...(state.notifications || [])] };
    }
    case 'notification/markRead':
      return {
        ...state,
        notifications: (state.notifications || []).map((n) => (n.id === action.id ? { ...n, read: true } : n)),
      };
    case 'notification/markAllRead':
      return {
        ...state,
        notifications: (state.notifications || []).map((n) => ({ ...n, read: true })),
      };
    case 'notification/clearAll':
      return { ...state, notifications: [] };
    case 'reset': {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Ignore storage errors
        }
      }
      return createSeedState();
    }
  }
}

export function getInitialState(): AppState {
  const stored = readStoredState();
  if (stored) {
    return stored;
  }
  return createSeedState();
}

export interface StoreValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  currentUser: CurrentUser | null;
  switchRole: (role: UserRole) => Promise<void>;
  logout: () => void;
  refreshData: () => Promise<void>;
}


const StoreContext = createContext<StoreValue | null>(null);

export function getDemoUserForToken(token: string | null): CurrentUser | null {
  if (!token) return null;
  if (token.endsWith('kitchen_staff') || token.endsWith('staff')) {
    return {
      uid: 'demo-staff-uid',
      email: 'staff@smartmess.internal',
      name: 'Ramesh Chef (Kitchen Staff)',
      role: 'kitchen_staff',
    };
  }
  if (token.endsWith('student')) {
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
  const [state, rawDispatch] = useReducer(reducer, undefined, getInitialState);
  const stateRef = useRef<AppState>(state);
  stateRef.current = state;

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => getDemoUserForToken(getAuthToken()));
  const isMountedRef = useRef(true);

  useEffect(() => {
    stateRef.current = state;
    saveStateToStorage(state);
  }, [state]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const synced = readStoredState();
        if (synced) {
          stateRef.current = synced;
          rawDispatch({ type: 'init', data: synced });
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const syncFromLocalStorageIfAvailable = () => {
    const stored = readStoredState();
    if (stored) {
      stateRef.current = stored;
      rawDispatch({
        type: 'init',
        data: stored,
      });
    }
  };

  const loadData = async () => {
    try {
      if (!isMountedRef.current) return;
      setSyncing(true);
      setError(null);

      // Verify or establish session
      const token = getAuthToken();
      if (!token) {
        if (isMountedRef.current) {
          setCurrentUser(null);
          setLoading(false);
          setSyncing(false);
        }
        return;
      }

      let resolvedUser = getDemoUserForToken(token)!;
      setCurrentUser(resolvedUser);
      try {
        const me = await api.getMe();
        if (!isMountedRef.current) return;
        resolvedUser = me.user;
        setCurrentUser(resolvedUser);
      } catch {
        // Preserve resolved local demo user for the active token when backend is offline
      }

      if (!isMountedRef.current) return;

      if (resolvedUser.role === 'student') {
        const remoteMenus = await api.getMenus();
        if (!isMountedRef.current) return;
        // Only apply remote menus when database persistence actually returned menus.
        // In unconfigured DB / demo mode, GET /menus returns [], so preserve shared localStorage state.
        if (Array.isArray(remoteMenus) && remoteMenus.length > 0) {
          const nextData = {
            settings: stateRef.current.settings,
            menus: remoteMenus,
            records: stateRef.current.records,
            notifications: stateRef.current.notifications,
          };
          stateRef.current = nextData;
          saveStateToStorage(nextData);
          rawDispatch({
            type: 'init',
            data: nextData,
          });
        }
        return;
      }

      const [remoteSettings, remoteMenus, remoteRecords] = await Promise.all([
        api.getSettings(),
        api.getMenus(),
        api.getRecords(),
      ]);

      if (!isMountedRef.current) return;

      if (remoteMenus.length > 0 || remoteRecords.length > 0) {
        const nextData = {
          settings: remoteSettings || stateRef.current.settings,
          menus: remoteMenus.length > 0 ? remoteMenus : stateRef.current.menus,
          records: remoteRecords.length > 0 ? remoteRecords : stateRef.current.records,
          notifications: stateRef.current.notifications,
        };
        stateRef.current = nextData;
        saveStateToStorage(nextData);
        rawDispatch({
          type: 'init',
          data: nextData,
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
    syncFromLocalStorageIfAvailable();
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
    const normalizedAction: AppAction =
      action.type === 'notification/add'
        ? {
            ...action,
            notification: {
              ...action.notification,
              id: action.notification.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              timestamp: action.notification.timestamp || new Date().toISOString(),
            },
          }
        : action;

    const existingRecordBeforeUpsert =
      normalizedAction.type === 'record/upsert'
        ? stateRef.current.records.find((r) => r.id === normalizedAction.record.id)
        : undefined;

    const nextState = reducer(stateRef.current, normalizedAction);
    stateRef.current = nextState;
    if (normalizedAction.type !== 'reset') {
      saveStateToStorage(nextState);
    }

    rawDispatch(normalizedAction);

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
      // Determine if existing record existed before upsert
      if (existingRecordBeforeUpsert) {
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

  const logout = () => {
    setAuthToken(null);
    if (isMountedRef.current) {
      setCurrentUser(null);
    }
    if (typeof window !== 'undefined') {
      window.location.hash = '#/login';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
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
      logout,
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
