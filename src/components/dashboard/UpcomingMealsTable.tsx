import { CalendarX } from 'lucide-react';
import type { UpcomingMeal } from '../../services/planningService';
import { MEAL_META } from '../../lib/constants';
import { formatWeekdayDay } from '../../lib/dates';
import { fmtInt } from '../../lib/format';
import { hrefFor } from '../../lib/router';
import { menuSummary } from '../../services/menuService';
import { DataTable, type Column } from '../common/DataTable';
import { EmptyState } from '../common/EmptyState';
import { StatusBadge } from '../common/Badge';
import { ButtonLink } from '../common/Button';

export function UpcomingMealsTable({ meals }: { meals: UpcomingMeal[] }) {
  const columns: Column<UpcomingMeal>[] = [
    {
      key: 'meal',
      header: 'Meal',
      cell: (m) => (
        <a href={hrefFor('forecasts', { date: m.date, meal: m.meal })} className="block hover:underline">
          <span className="font-medium text-gray-900">{MEAL_META[m.meal].label}</span>
          <span className="block text-xs text-gray-500">{formatWeekdayDay(m.date)} · {MEAL_META[m.meal].time}</span>
        </a>
      ),
    },
    { key: 'menu', header: 'Menu', className: 'min-w-[9rem]', cell: (m) => <span className="block max-w-[16rem] text-gray-700" title={m.menu.items.map((i) => i.name).join(', ')}>{menuSummary(m.menu)}</span> },
    { key: 'pred', header: 'Predicted diners', align: 'right', cell: (m) => (m.predictedDiners === null ? '—' : fmtInt(m.predictedDiners)) },
    { key: 'status', header: 'Status', cell: (m) => <StatusBadge status={m.status} /> },
  ];
  return (
    <DataTable
      caption="Upcoming meals with menu, predicted diners and plan status"
      columns={columns}
      rows={meals}
      rowKey={(m) => m.key}
      compact
      empty={
        <div className="p-5">
          <EmptyState icon={CalendarX} title="No upcoming meals in the planning window" description="Add menus for the next few days to see forecasts here." action={<ButtonLink variant="primary" href={hrefFor('menus')}>Open Menus</ButtonLink>} />
        </div>
      }
    />
  );
}
