import { ClipboardList } from 'lucide-react';
import type { MealType } from '../../types';
import type { PlanPreview } from '../../services/planningService';
import { MEAL_META } from '../../lib/constants';
import { formatWeekdayDay } from '../../lib/dates';
import { fmtInt } from '../../lib/format';
import { hrefFor } from '../../lib/router';
import { Card } from '../common/Card';
import { DataTable, type Column } from '../common/DataTable';
import { EmptyState } from '../common/EmptyState';
import { ButtonLink } from '../common/Button';
import { Badge } from '../common/Badge';

type Row = PlanPreview['items'][number];

export function RecommendationsPanel({ date, meal, preview }: { date: string; meal: MealType; preview: PlanPreview | null }) {
  const columns: Column<Row>[] = [
    { key: 'name', header: 'Food item', cell: (r) => <span className="font-medium text-gray-900">{r.name}</span> },
    { key: 'demand', header: 'Est. demand', align: 'right', cell: (r) => fmtInt(r.predictedDemand) },
    { key: 'range', header: 'Range', align: 'right', cell: (r) => <span className="text-gray-500">{fmtInt(r.lowerDemand)}–{fmtInt(r.upperDemand)}</span> },
    { key: 'prep', header: 'Suggested prep', align: 'right', cell: (r) => <span className="font-semibold text-brand-800">{fmtInt(r.suggestedPrep)}</span> },
  ];
  return (
    <Card
      title="Preparation recommendations"
      description={`${MEAL_META[meal].label} · ${formatWeekdayDay(date)} · portions`}
      actions={preview && <Badge tone={preview.source === 'saved' ? 'brand' : 'neutral'}>{preview.source === 'saved' ? 'Saved forecast' : 'Fresh estimate'}</Badge>}
      flush
    >
      {preview ? (
        <>
          <DataTable caption="Suggested preparation quantities for the next meal to review" columns={columns} rows={preview.items} rowKey={(r) => r.name} dense />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
            <span>Range = uncertainty band around estimated demand. Suggested prep includes the configured buffer.</span>
            <ButtonLink size="sm" variant="secondary" href={hrefFor('operations', { date, meal })}>Open plan</ButtonLink>
          </div>
        </>
      ) : (
        <div className="p-5">
          <EmptyState icon={ClipboardList} title="No recommendations yet" description="A forecast needs a menu and enough completed meals of history." />
        </div>
      )}
    </Card>
  );
}
