import type { ComponentType } from 'react';
import type { PageId } from './types';
import { useRoute } from './lib/router';
import { AppShell } from './components/layout/AppShell';
import { AppStoreProvider } from './store/AppStore';
import { ToastProvider } from './components/common/Toast';
import Dashboard from './pages/Dashboard';
import Forecasts from './pages/Forecasts';
import Menus from './pages/Menus';
import KitchenOperations from './pages/KitchenOperations';
import WasteAnalytics from './pages/WasteAnalytics';
import Settings from './pages/Settings';

const PAGES: Record<PageId, ComponentType> = {
  dashboard: Dashboard,
  forecasts: Forecasts,
  menus: Menus,
  operations: KitchenOperations,
  waste: WasteAnalytics,
  settings: Settings,
};

function Routes() {
  const route = useRoute();
  const Page = PAGES[route.page];
  return (
    <AppShell page={route.page}>
      {/* Keyed by the full hash so a page re-reads its URL parameters when they change. */}
      <Page key={route.raw} />
    </AppShell>
  );
}

export default function App() {
  return (
    <AppStoreProvider>
      <ToastProvider>
        <Routes />
      </ToastProvider>
    </AppStoreProvider>
  );
}
