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

  // Calculate total kg of suggested food preparation from existing items and portion weights
  const totalSuggestedKg = preview?.items
    ? preview.items.reduce((sum, item) => {
        const menuItem = next.menu.items.find((m) => m.name.toLowerCase() === item.name.toLowerCase());
        const portionKg = menuItem?.kgPerPortion || 0.15;
        return sum + item.suggestedPrep * portionKg;
      }, 0)
    : 0;

  const baselineDiners = next.record?.baselineDiners ?? null;
  const dinerDiff = next.predictedDiners !== null && baselineDiners !== null ? next.predictedDiners - baselineDiners : null;
  const diffPct = dinerDiff !== null && baselineDiners && baselineDiners > 0 ? (dinerDiff / baselineDiners) * 100 : null;

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs transition-shadow">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-700/10">
            <Utensils size={18} aria-hidden />
          </span>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                Next Service Decision: {mealMeta.label}
              </h2>
              <StatusBadge status={next.status} />
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {formatWeekdayDay(next.date)} · Service window: {mealMeta.time} · {formatMedium(next.date)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Clock size={14} className="text-slate-400" />
          <span>Planning horizon: {formatMedium(next.date)}</span>
        </div>
      </div>

      {/* Prominent Next Action Guidance */}
      <div className={`mt-4 rounded-xl border p-4 ${
        isRecommended
          ? 'border-amber-200/80 bg-amber-50/50'
          : isApproved
            ? 'border-brand-200/80 bg-brand-50/50'
            : 'border-slate-200/80 bg-slate-50/70'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            {isRecommended ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800 shrink-0">
                <AlertCircle size={18} aria-hidden />
              </span>
            ) : isApproved ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-800 shrink-0">
                <CheckCircle2 size={18} aria-hidden />
              </span>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shrink-0">
                <Utensils size={18} aria-hidden />
              </span>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {isRecommended
                    ? 'Action Required: Authorize Kitchen Preparation'
                    : isApproved
                      ? 'Status: Preparation Approved & Kitchen Ready'
                      : 'Action Required: Generate Demand Forecast'}
                </p>
                {isRecommended && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                    Decision Pending
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-600 max-w-2xl">
                {isRecommended
                  ? 'Portions have been computed from attendance baselines and historical uptake. Confirm or adjust prep quantities before cooking begins.'
                  : isApproved
                    ? 'Preparation targets are active in kitchen operations. The culinary team can begin prep and log final servings after dining hours.'
                    : 'A menu is configured for this meal. Run the forecasting model to calculate recommended portion targets.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isManager && isRecommended && onApprove && (
              <Button
                variant="primary"
                size="md"
                disabled={isApproving}
                onClick={() => onApprove(next)}
              >
                <CheckCircle2 size={16} aria-hidden />
                {isApproving ? 'Approving...' : 'Approve Kitchen Plan'}
              </Button>
            )}
            <ButtonLink
              variant="secondary"
              size="md"
              href={hrefFor('operations', { date: next.date, meal: next.meal })}
            >
              Open Plan Editor <ChevronRight size={14} aria-hidden />
            </ButtonLink>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
          <p className="text-xs font-medium text-slate-500">Predicted Demand</p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {next.predictedDiners !== null ? fmtInt(next.predictedDiners) : '—'}
            </span>
            <span className="text-xs text-slate-500 font-medium">diners</span>
            {next.record?.lowerDiners && next.record?.upperDiners && (
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                ({fmtInt(next.record.lowerDiners)}–{fmtInt(next.record.upperDiners)})
              </span>
            )}
          </div>
          <div className="mt-2 text-[11px] text-slate-600">
            {baselineDiners !== null ? (
              <span className="inline-flex items-center gap-1">
                <span>Baseline: <strong>{fmtInt(baselineDiners)}</strong></span>
                {dinerDiff !== null && (
                  <span className={dinerDiff >= 0 ? 'text-brand-700 font-medium' : 'text-amber-700 font-medium'}>
                    · {dinerDiff >= 0 ? '+' : ''}{dinerDiff} ({diffPct !== null ? `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%` : ''})
                  </span>
                )}
              </span>
            ) : (
              'Estimated from menu & past attendance'
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
          <p className="text-xs font-medium text-slate-500">Suggested Preparation</p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-brand-800 tabular-nums">
              {totalSuggestedKg > 0 ? `${fmtNum(totalSuggestedKg, 1)} kg` : '—'}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-600">
            {preview?.items.length ?? next.menu.items.length} items configured with safety buffer
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 sm:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Configured Menu Dishes & Portions</p>
            <span className="text-[11px] text-brand-700 font-medium">
              {preview?.source === 'saved' ? '✓ Stored plan in database' : 'Deterministic estimate'}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {next.menu.items.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2.5 py-1 text-xs text-slate-800 font-medium shadow-2xs"
              >
                <span>{item.name}</span>
                <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                  {item.kgPerPortion < 0.1 ? `${Math.round(item.kgPerPortion * 1000)}g` : `${item.kgPerPortion} kg`}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
