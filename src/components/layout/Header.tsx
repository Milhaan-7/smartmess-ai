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
  const { state } = useAppStore();
  const { settings } = state;
  const title = NAV_ITEMS.find((n) => n.id === page)?.label ?? 'Dashboard';
  const notifications = buildNotifications(state, DEMO_TODAY);
  const actionable = notifications.filter((n) => n.tone === 'warning').length;
  const initials = settings.messManager.split(' ').map((p) => p[0]).slice(0, 2).join('');

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <button type="button" onClick={onMenu} aria-label="Open navigation" className="rounded-md p-2 text-gray-600 hover:bg-gray-100 lg:hidden">
        <MenuIcon size={20} aria-hidden />
      </button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-sm">
          <li className="hidden text-gray-500 sm:block">SmartMess AI</li>
          <li className="hidden text-gray-300 sm:block" aria-hidden>/</li>
          <li className="truncate font-semibold text-gray-900" aria-current="page">{title}</li>
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
        panelClassName="w-64 p-1"
        trigger={
          <>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">{initials}</span>
            <ChevronDown size={14} className="hidden text-gray-400 sm:block" aria-hidden />
          </>
        }
      >
        {(close) => (
          <div>
            <div className="px-3 py-2.5">
              <p className="text-sm font-medium text-gray-900">{settings.messManager}</p>
              <p className="text-xs text-gray-500">Mess manager (demo user)</p>
            </div>
            <a href={hrefFor('settings')} onClick={close} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <SettingsIcon size={15} aria-hidden /> Settings
            </a>
            <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">Demo session: there is no sign-in or account system.</p>
          </div>
        )}
      </Popover>
    </header>
  );
}
