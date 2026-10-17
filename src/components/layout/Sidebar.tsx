import { BarChart3, ChefHat, CalendarDays, Database, LayoutDashboard, Leaf, Settings as SettingsIcon, TrendingUp, X, type LucideIcon } from 'lucide-react';
import type { PageId } from '../../types';
import { hrefFor } from '../../lib/router';
import { cx } from '../../lib/cx';
import { useAppStore, type UserRole } from '../../store/AppStore';

export const NAV_ITEMS: { id: PageId; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'forecasts', label: 'Forecasts', icon: TrendingUp },
  { id: 'menus', label: 'Menus', icon: CalendarDays },
  { id: 'operations', label: 'Kitchen Operations', icon: ChefHat },
  { id: 'waste', label: 'Waste Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export function getNavItemsForRole(role?: UserRole): { id: PageId; label: string; icon: LucideIcon }[] {
  if (role === 'student') {
    return [
      { id: 'dashboard', label: "Today's Menu", icon: LayoutDashboard },
      { id: 'menus', label: 'Weekly Menus', icon: CalendarDays },
    ];
  }
  if (role === 'kitchen_staff') {
    return [
      { id: 'dashboard', label: 'Kitchen Board', icon: LayoutDashboard },
      { id: 'menus', label: 'Menus', icon: CalendarDays },
      { id: 'operations', label: 'Kitchen Operations', icon: ChefHat },
    ];
  }
  // Manager has full access
  return NAV_ITEMS;
}

export function Sidebar({ active, open, onClose }: { active: PageId; open: boolean; onClose: () => void }) {
  const { currentUser } = useAppStore();
  const navItems = getNavItemsForRole(currentUser?.role);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-gray-900/40 lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        aria-label="Sidebar"
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-100 px-5">
          <a href={hrefFor('dashboard')} className="flex items-center gap-2.5" onClick={onClose}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white">
              <Leaf size={17} aria-hidden />
            </span>
            <span className="text-[17px] font-semibold tracking-tight text-gray-900">
              SmartMess <span className="text-brand-700">AI</span>
            </span>
          </a>
          <button type="button" onClick={onClose} aria-label="Close navigation" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 lg:hidden">
            <X size={18} aria-hidden />
          </button>
        </div>

        <nav aria-label="Primary" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = id === active;
            return (
              <a
                key={id}
                href={hrefFor(id)}
                onClick={onClose}
                aria-current={isActive ? 'page' : undefined}
                className={cx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-50 text-brand-800' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                )}
              >
                <Icon size={18} className={isActive ? 'text-brand-700' : 'text-gray-400'} aria-hidden />
                {label}
              </a>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 text-xs text-gray-600">
            <div className="flex items-center gap-1.5 font-medium text-gray-900">
              <Database size={13} className="text-brand-700 shrink-0" aria-hidden />
              <span>Cloud SQL PostgreSQL</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500 leading-tight">
              Persistent storage · Reproducible baseline forecasts
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
