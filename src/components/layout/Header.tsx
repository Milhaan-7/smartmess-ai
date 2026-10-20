import { Bell, Building2, Check, ChevronDown, Menu as MenuIcon, Settings as SettingsIcon } from 'lucide-react';
import type { PageId } from '../../types';
import { useAppStore } from '../../store/AppStore';
import { DEMO_TODAY } from '../../lib/constants';
import { formatMedium } from '../../lib/dates';
import { hrefFor } from '../../lib/router';
import { buildNotifications } from '../../services/planningService';
import { Popover } from '../common/Popover';
import { Badge } from '../common/Badge';
import { NAV_ITEMS } from './Sidebar';

export function Header({ page, onMenu }: { page: PageId; onMenu: () => void }) {
  const { state, currentUser, switchRole } = useAppStore();
  const { settings } = state;
  const roleTitle =
    page === 'dashboard'
      ? currentUser?.role === 'student'
        ? "Today's Menu"
        : currentUser?.role === 'kitchen_staff'
          ? 'Kitchen Board'
          : 'Dashboard'
      : NAV_ITEMS.find((n) => n.id === page)?.label ?? 'Dashboard';
  const notifications = buildNotifications(state, DEMO_TODAY);
  const actionable = notifications.filter((n) => n.tone === 'warning').length;
  const displayName = currentUser?.name || settings.messManager;
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <button type="button" onClick={onMenu} aria-label="Open navigation" className="rounded-md p-2 text-gray-600 hover:bg-gray-100 lg:hidden">
        <MenuIcon size={20} aria-hidden />
      </button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-sm">
          <li className="hidden text-gray-500 sm:block">SmartMess AI</li>
          <li className="hidden text-gray-300 sm:block" aria-hidden>/</li>
          <li className="truncate font-semibold text-gray-900" aria-current="page">{roleTitle}</li>
        </ol>
      </nav>

      <Popover
        ariaLabel="Institution"
        align="right"
        triggerClassName="hidden items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-left text-[13px] hover:bg-gray-50 md:flex"
        panelClassName="w-80 p-2"
        trigger={
          <>
            <Building2 size={16} className="text-brand-700" aria-hidden />
            <span className="max-w-[16rem] truncate">
              <span className="font-medium text-gray-900">{settings.institutionName}</span>
              <span className="text-gray-500"> · {settings.messName}</span>
            </span>
            <ChevronDown size={14} className="text-gray-400" aria-hidden />
          </>
        }
      >
        <div role="group" aria-label="Institutions">
          <div className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2">
            <Check size={16} className="mt-0.5 text-brand-700" aria-hidden />
            <div>
              <p className="text-sm font-medium text-gray-900">{settings.institutionName}</p>
              <p className="text-xs text-gray-500">{settings.messName}</p>
            </div>
          </div>
          <p className="px-3 py-2 text-xs text-gray-500">Fictional institution. Switching between multiple institutions is not implemented in this demo.</p>
        </div>
      </Popover>

      <div className="hidden text-right text-xs leading-tight text-gray-500 xl:block">
        <p className="font-medium text-gray-800">{formatMedium(DEMO_TODAY)}</p>
        <p>Demo planning date</p>
      </div>

      <Popover
        ariaLabel={`Notifications, ${actionable} need attention`}
        triggerClassName="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        panelClassName="w-80 max-w-[calc(100vw-2rem)]"
        trigger={
          <>
            <Bell size={19} aria-hidden />
            {actionable > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                {actionable}
              </span>
            )}
          </>
        }
      >
        {(close) => (
          <div>
            <p className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Notifications</p>
            <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  <a href={hrefFor(n.page, n.params)} onClick={close} className="block px-4 py-3 hover:bg-gray-50">
                    <p className="flex items-center gap-2 text-[13px] font-medium text-gray-900">
                      {n.title}
                      {n.tone === 'warning' && <Badge tone="amber">Action</Badge>}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{n.detail}</p>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Popover>

      <Popover
        ariaLabel="User menu"
        triggerClassName="flex items-center gap-2 rounded-lg p-1 hover:bg-gray-100"
        panelClassName="w-72 p-2"
        trigger={
          <>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
              {currentUser?.name ? currentUser.name.split(' ').map((p) => p[0]).slice(0, 2).join('') : initials}
            </span>
            <span className="hidden text-left text-xs sm:block">
              <span className="block font-medium text-gray-900">{currentUser?.name || settings.messManager}</span>
              <span className="capitalize text-gray-500">
                {currentUser?.role === 'kitchen_staff' ? 'Kitchen Staff' : currentUser?.role || 'Manager'}
              </span>
            </span>
            <ChevronDown size={14} className="hidden text-gray-400 sm:block" aria-hidden />
          </>
        }
      >
        {(close) => (
          <div className="space-y-2">
            <div className="border-b border-gray-100 pb-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{currentUser?.name || settings.messManager}</p>
                <Badge
                  tone={
                    currentUser?.role === 'manager'
                      ? 'brand'
                      : currentUser?.role === 'kitchen_staff'
                        ? 'amber'
                        : 'neutral'
                  }
                >
                  {currentUser?.role === 'kitchen_staff' ? 'Staff' : currentUser?.role || 'Manager'}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">{currentUser?.email || 'manager@smartmess.internal'}</p>
              <p className="mt-1 text-[11px] text-brand-700 font-medium">✓ Role-Based Access Enforced</p>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Switch Demo Role (Server-Enforced)</p>
              <button
                type="button"
                onClick={() => {
                  switchRole('manager');
                  close();
                }}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-left ${
                  currentUser?.role === 'manager' ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>Manager (Full Access)</span>
                {currentUser?.role === 'manager' && <Check size={14} className="text-brand-700" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  switchRole('kitchen_staff');
                  close();
                }}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-left ${
                  currentUser?.role === 'kitchen_staff' ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>Kitchen Staff (Prep/Leftovers)</span>
                {currentUser?.role === 'kitchen_staff' && <Check size={14} className="text-brand-700" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  switchRole('student');
                  close();
                }}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-left ${
                  currentUser?.role === 'student' ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>Student (View Menus Only)</span>
                {currentUser?.role === 'student' && <Check size={14} className="text-brand-700" />}
              </button>
            </div>

            {currentUser?.role === 'manager' && (
              <div className="border-t border-gray-100 pt-2">
                <a
                  href={hrefFor('settings')}
                  onClick={close}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <SettingsIcon size={14} aria-hidden /> Institutional Settings
                </a>
              </div>
            )}
          </div>
        )}
      </Popover>
    </header>
  );
}
