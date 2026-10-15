import { useEffect, useState } from 'react';
import type { PageId } from '../types';

export const PAGE_PATHS: Record<PageId, string> = {
  dashboard: '/',
  forecasts: '/forecasts',
  menus: '/menus',
  operations: '/kitchen-operations',
  waste: '/waste-analytics',
  settings: '/settings',
};

export interface Route {
  page: PageId;
  params: URLSearchParams;
  /** Raw hash, used as a remount key so pages re-read their URL parameters. */
  raw: string;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const entry = (Object.entries(PAGE_PATHS) as [PageId, string][]).find(([, p]) => p === path);
  return { page: entry ? entry[0] : 'dashboard', params: new URLSearchParams(query), raw };
}

export function hrefFor(page: PageId, params?: Record<string, string>): string {
  const query = params ? new URLSearchParams(params).toString() : '';
  return `#${PAGE_PATHS[page]}${query ? `?${query}` : ''}`;
}

export function navigate(page: PageId, params?: Record<string, string>): void {
  window.location.hash = hrefFor(page, params);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
