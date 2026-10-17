import { CheckCircle2, ChevronRight, Clock, Utensils, AlertCircle } from 'lucide-react';
import type { UpcomingMeal } from '../../services/planningService';
import type { PlanPreview } from '../../services/planningService';
import { MEAL_META } from '../../lib/constants';
import { formatWeekdayDay, formatMedium } from '../../lib/dates';
import { fmtInt, fmtNum } from '../../lib/format';
import { hrefFor } from '../../lib/router';
import { Button, ButtonLink } from '../common/Button';
import { StatusBadge } from '../common/Badge';

interface NextMealDecisionPanelProps {
  next: UpcomingMeal | null;
  preview: PlanPreview | null;
  onApprove?: (meal: UpcomingMeal) => void;
  isManager: boolean;
  isApproving?: boolean;
}

export function NextMealDecisionPanel({
  next,
  preview,
  onApprove,
  isManager,
  isApproving = false,
}: NextMealDecisionPanelProps) {
  if (!next) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3 text-gray-500">
          <CheckCircle2 size={20} className="text-brand-700" />
          <p className="text-sm font-medium text-gray-900">All upcoming meals in the next 14 days are planned and approved.</p>
        </div>
      </div>
    );
  }

  const mealMeta = MEAL_META[next.meal];
  const isRecommended = next.record?.status === 'recommended';
  const isApproved = next.record?.status === 'approved';
  const isNotPlanned = next.status === 'not_planned';

  // Calculate total kg of suggested food preparation from existing items and portion weights
  const totalSuggestedKg = preview?.items
    ? preview.items.reduce((sum, item) => {
        const menuItem = next.menu.items.find((m) => m.name.toLowerCase() === item.name.toLowerCase());
        const portionKg = menuItem?.kgPerPortion || 0.15;
        return sum + item.suggestedPrep * portionKg;
      }, 0)
    : 0;

  return (
    <div className="rounded-xl border border-brand-200/80 bg-gradient-to-r from-brand-50/70 via-white to-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-700 text-white">
            <Utensils size={15} aria-hidden />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">
                Next Service Decision: {mealMeta.label}
              </h2>
              <StatusBadge status={next.status} />
            </div>
            <p className="text-xs text-gray-500">
              {formatWeekdayDay(next.date)} · Typical service: {mealMeta.time} · {formatMedium(next.date)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock size={14} className="text-gray-400" />
          <span>Planning Date: {formatMedium(next.date)}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-white p-3 border border-gray-100">
          <p className="text-xs font-medium text-gray-500">Predicted Diners</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-gray-900 tabular-nums">
              {next.predictedDiners !== null ? fmtInt(next.predictedDiners) : '—'}
            </span>
            {next.record?.lowerDiners && next.record?.upperDiners && (
              <span className="text-xs text-gray-500 tabular-nums">
                ({fmtInt(next.record.lowerDiners)}–{fmtInt(next.record.upperDiners)})
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {next.record?.baselineDiners ? `Baseline: ${fmtInt(next.record.baselineDiners)} diners` : 'Estimated from menu & history'}
          </p>
        </div>

        <div className="rounded-lg bg-white p-3 border border-gray-100">
          <p className="text-xs font-medium text-gray-500">Suggested Preparation</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-brand-800 tabular-nums">
              {totalSuggestedKg > 0 ? `${fmtNum(totalSuggestedKg, 1)} kg` : '—'}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {preview?.items.length ?? next.menu.items.length} items configured
          </p>
        </div>

        <div className="rounded-lg bg-white p-3 border border-gray-100 sm:col-span-2">
          <p className="text-xs font-medium text-gray-500">Configured Menu Items</p>
          <p className="mt-1 text-xs text-gray-800 truncate" title={next.menu.items.map((i) => i.name).join(', ')}>
            {next.menu.items.map((i) => i.name).join(' · ')}
          </p>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-500">
            {preview?.source === 'saved' ? (
              <span className="text-brand-700 font-medium">✓ Stored plan in database</span>
            ) : (
              <span>Deterministic baseline estimate</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
        <div className="text-xs text-gray-500">
          {isRecommended && (
            <span className="flex items-center gap-1.5 text-amber-700">
              <AlertCircle size={14} />
              Preparation quantities calculated. Manager authorization required before cooking begins.
            </span>
          )}
          {isApproved && (
            <span className="flex items-center gap-1.5 text-brand-700 font-medium">
              <CheckCircle2 size={14} />
              Approved by management. Kitchen staff can log batch servings and plate leftovers.
            </span>
          )}
          {isNotPlanned && (
            <span>No plan saved yet for this menu. Review forecast to calculate portion requirements.</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isManager && isRecommended && onApprove && (
            <Button
              variant="primary"
              size="sm"
              disabled={isApproving}
              onClick={() => onApprove(next)}
            >
              <CheckCircle2 size={14} aria-hidden />
              {isApproving ? 'Approving...' : 'Approve Kitchen Plan'}
            </Button>
          )}

          <ButtonLink
            variant="secondary"
            size="sm"
            href={hrefFor('operations', { date: next.date, meal: next.meal })}
          >
            Open Plan Editor <ChevronRight size={14} aria-hidden />
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
