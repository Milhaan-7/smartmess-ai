import type { MealRecord, Menu, Settings } from '../types/index';

function getBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return `${window.location.origin}/api/v1`;
  }
  return 'http://127.0.0.1:3000/api/v1';
}

let currentAuthToken: string | null = (() => {
  try {
    return sessionStorage.getItem('smartmess_auth_token') || 'demo-token-manager';
  } catch {
    return 'demo-token-manager';
  }
})();

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
  try {
    if (token) {
      sessionStorage.setItem('smartmess_auth_token', token);
    } else {
      sessionStorage.removeItem('smartmess_auth_token');
    }
  } catch {
    // Ignore session storage errors
  }
}

export function getAuthToken(): string | null {
  return currentAuthToken;
}

export interface AuthSessionResponse {
  token: string;
  user: {
    uid: string;
    email: string;
    name: string;
    role: 'manager' | 'kitchen_staff' | 'student';
  };
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (currentAuthToken) {
    headers['Authorization'] = `Bearer ${currentAuthToken}`;
  }

  const res = await fetch(`${getBaseUrl()}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody.error || `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export const api = {
  getHealth: () => request<{ status: string; database: string; engine: string }>('/health'),

  loginSession: (params: { demoRole?: string; token?: string }) =>
    request<AuthSessionResponse>('/auth/session', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getMe: () =>
    request<{
      user: { uid: string; email: string; name: string; role: 'manager' | 'kitchen_staff' | 'student' };
      role: 'manager' | 'kitchen_staff' | 'student';
    }>('/auth/me'),

  getUsers: () =>
    request<
      Array<{
        id: number;
        uid: string;
        email: string;
        role: 'manager' | 'kitchen_staff' | 'student';
        displayName: string | null;
      }>
    >('/users'),

  updateUserRole: (uid: string, role: string) =>
    request<any>(`/users/${uid}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  getMenus: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<Menu[]>(`/menus${qs}`);
  },

  createMenu: (data: { date: string; meal: string; items: Array<{ name: string; kgPerPortion: number }> }) =>
    request<Menu>('/menus', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMenu: (
    id: string,
    data: { date: string; meal: string; items: Array<{ id?: string; name: string; kgPerPortion: number }> },
  ) =>
    request<Menu>(`/menus/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteMenu: (id: string) =>
    request<{ success: boolean; id: string; removedPlan: boolean }>(`/menus/${id}`, {
      method: 'DELETE',
    }),

  getRecords: (filters?: { from?: string; to?: string; status?: string; meal?: string }) => {
    const params = new URLSearchParams();
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.meal) params.set('meal', filters.meal);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<MealRecord[]>(`/records${qs}`);
  },

  getRecord: (date: string, meal: string) => request<MealRecord>(`/records/${date}/${meal}`),

  createRecord: (record: MealRecord) =>
    request<MealRecord>('/records', {
      method: 'POST',
      body: JSON.stringify(record),
    }),

  updateRecord: (id: string, updates: Partial<MealRecord>) =>
    request<MealRecord>(`/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  getSettings: () => request<Settings>('/settings'),

  updateSettings: (settings: Settings) =>
    request<Settings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
};
