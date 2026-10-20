import { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, CalendarCheck, Check, CheckCircle2, ChefHat, Clock, Coffee, LineChart, Scale, Target, Users, Utensils, UtensilsCrossed } from 'lucide-react';
import { useAppStore } from '../store/AppStore';
import { useToast } from '../components/common/Toast';
import { DEMO_TODAY, MEAL_META, MEAL_OPTIONS, MEAL_ORDER } from '../lib/constants';
import { formatDateTime, formatDayMonth, formatLong, formatWeekdayDay } from '../lib/dates';
import { fmtInt, fmtKg, fmtNum, fmtPct } from '../lib/format';
import { hrefFor } from '../lib/router';
import { approvedKg, dailySeries, describeForecastSources, evaluationWindow, forecastErrorStats, inRange, type MealFilter } from '../services/metrics';
import { getNextMealToReview, getPlanPreview, getTodaySummary, getUpcomingMeals } from '../services/planningService';
import { approvePlan, recordFromForecast } from '../services/operationsService';
import { computeForecast } from '../services/mockForecastService';
import { findMenu } from '../services/menuService';
import { PageHeader } from '../components/common/PageHeader';
import { MetricCard } from '../components/common/MetricCard';
import { Card } from '../components/common/Card';
import { ButtonLink } from '../components/common/Button';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { EmptyState } from '../components/common/EmptyState';
import { Badge, StatusBadge } from '../components/common/Badge';
import { UpcomingMealsTable } from '../components/dashboard/UpcomingMealsTable';
import { NextMealDecisionPanel } from '../components/dashboard/NextMealDecisionPanel';
import { DemandTrendChart } from '../components/charts/DemandTrendChart';
import { WasteTrendChart } from '../components/charts/WasteTrendChart';

const FILTERS: { value: MealFilter; label: string }[] = [{ value: 'all', label: 'All meals' }, ...MEAL_OPTIONS];

export default function Dashboard() {
  const { state, dispatch, currentUser } = useAppStore();
  const { notify } = useToast();
  const { settings, records, menus } = state;
  const [mealFilter, setMealFilter] = useState<MealFilter>('all');
  const [isApproving, setIsApproving] = useState(false);

  const isManager = currentUser?.role === 'manager';
  const isKitchenStaff = currentUser?.role === 'kitchen_staff';
  const isStudent = currentUser?.role === 'student';

  const upcoming = useMemo(
    () => getUpcomingMeals(state, DEMO_TODAY, settings.upcomingHorizonDays),
    [state, settings.upcomingHorizonDays],
  );
  const today = useMemo(() => getTodaySummary(state, DEMO_TODAY), [state]);
  const next = useMemo(() => getNextMealToReview(state, DEMO_TODAY), [state]);
  const preview = useMemo(() => (next ? getPlanPreview(state, next.date, next.meal) : null), [state, next]);

  // Today's meals for the daily status pipeline
  const todayMeals = useMemo(() => {
    return MEAL_ORDER.map((meal) => {
      const menu = findMenu(menus, DEMO_TODAY, meal);
      const record = records.find((r) => r.date === DEMO_TODAY && r.meal === meal);
      return {
        meal,
        menu,
        record,
        status: (record?.status ?? 'not_planned') as import('../types').DisplayStatus,
      };
    });
  }, [menus, records]);

  // Evaluation window for accuracy and trend charts
  const win = evaluationWindow(DEMO_TODAY);
  const windowRecords = useMemo(() => records.filter((r) => inRange(r, evaluationWindow(DEMO_TODAY))), [records]);
  const stats = useMemo(() => forecastErrorStats(windowRecords), [windowRecords]);
  const trend = useMemo(() => dailySeries(windowRecords, mealFilter), [windowRecords, mealFilter]);
  const allMealsTrend = useMemo(() => dailySeries(windowRecords, 'all'), [windowRecords]);

  const handleApprove = (mealToApprove: typeof next) => {
    if (!mealToApprove) return;
    try {
      setIsApproving(true);
      let targetRecord = mealToApprove.record;
      if (!targetRecord && mealToApprove.menu) {
        try {
          const fc = computeForecast({
            date: mealToApprove.date,
            meal: mealToApprove.meal,
            menu: mealToApprove.menu,
            history: records,
            settings,
            context: 'normal',
          });
          targetRecord = recordFromForecast(fc);
        } catch {
          targetRecord = null;
        }
      }
      if (!targetRecord || targetRecord.status !== 'recommended') return;
      const quantities: Record<string, number> = {};
      for (const it of targetRecord.items) {
        quantities[it.itemId] = it.suggestedPrep;
      }
      const approved = approvePlan(targetRecord, quantities, new Date().toISOString());
      dispatch({ type: 'record/upsert', record: approved });
      dispatch({
        type: 'notification/add',
        notification: {
          title: `Today's ${MEAL_META[mealToApprove.meal].label} menu approved`,
          message: `The manager has authorized the ${MEAL_META[mealToApprove.meal].label} menu for ${formatLong(mealToApprove.date)}. View portion weights and service hours.`,
          type: 'daily',
          date: mealToApprove.date,
          meal: mealToApprove.meal,
          linkHash: `#/menus?date=${mealToApprove.date}`,
        },
      });
      notify(`Preparation plan approved for ${MEAL_META[mealToApprove.meal].label}. Kitchen notified.`);
    } catch (err: any) {
      notify(err?.message || 'Failed to approve plan', 'error');
    } finally {
      setIsApproving(false);
    }

  };

  const displayName = currentUser?.name || settings.messManager;

  // Student specific view: Focused on daily dining menu and service timings
  if (isStudent) {
    return (
      <>
        <PageHeader
          title={`Today's Dining Service · ${formatWeekdayDay(DEMO_TODAY)}`}
          description={`Welcome to ${settings.messName} at ${settings.institutionName}. Real-time published meal menus and dining hall schedules.`}
        />

        {/* Informational Dining Hall Briefing */}
        <div className="mb-6 rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-700/10">
                <UtensilsCrossed size={18} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{settings.messName} · Student Dining</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Service Schedules: <span className="font-medium text-slate-700">Breakfast 07:30–09:30</span> · <span className="font-medium text-slate-700">Lunch 12:30–14:30</span> · <span className="font-medium text-slate-700">Dinner 19:30–21:30</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden />
              <span>Portions prepared fresh daily using predictive demand modeling</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {todayMeals.map(({ meal, menu }) => {
            const meta = MEAL_META[meal];
            const hasItems = menu && menu.items.length > 0;
            const MealIcon = meal === 'breakfast' ? Coffee : meal === 'lunch' ? Utensils : UtensilsCrossed;

            return (
              <div
                key={meal}
                className="flex flex-col rounded-xl border border-slate-200/90 bg-white shadow-xs transition-shadow hover:shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-slate-100 p-4.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <MealIcon size={16} aria-hidden />
                    </span>
                    <div>
                      <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{meta.label}</h2>
                      <p className="text-xs text-slate-500">{meta.time}</p>
                    </div>
                  </div>
                  {hasItems ? (
                    <Badge tone="brand">
                      {menu.items.length} {menu.items.length === 1 ? 'Dish' : 'Dishes'}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Unscheduled</Badge>
                  )}
                </div>

                <div className="flex-1 p-4.5">
                  {hasItems ? (
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Published Dishes</p>
                      <ul className="divide-y divide-slate-100 text-sm">
                        {menu.items.map((item) => (
                          <li key={item.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                            <span className="font-medium text-slate-900">{item.name}</span>
                            <span className="text-xs text-slate-500 font-mono tabular-nums">
                              {item.kgPerPortion < 0.1 ? `${Math.round(item.kgPerPortion * 1000)}g` : `${item.kgPerPortion} kg`} / portion
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <EmptyState
                      icon={Utensils}
                      title="No menu published"
                      description="The kitchen has not yet posted the items for this meal service."
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-slate-200/80 pt-4">
          <p className="text-xs text-slate-500">
            Menus are managed and published by institutional culinary staff.
          </p>
          <ButtonLink variant="secondary" href={hrefFor('menus')}>
            View Full Weekly Menu Calendar <ArrowRight size={14} aria-hidden />
          </ButtonLink>
        </div>
      </>
    );
  }

  // Kitchen Staff specific view: Today's Kitchen Work
  if (isKitchenStaff) {
    const activeApprovedMeal = todayMeals.find((m) => m.status === 'approved');
    const totalApprovedKgToday = todayMeals.reduce((sum, m) => {
      if (m.record && (m.record.status === 'approved' || m.record.status === 'completed')) {
        return sum + approvedKg(m.record);
      }
      return sum;
    }, 0);

    return (
      <>
        <PageHeader
          title={`Today's Kitchen Work · ${settings.messName}`}
          description={`Operational shift board for ${formatWeekdayDay(DEMO_TODAY)}, ${formatLong(DEMO_TODAY)}. Track manager-authorized preparation quantities, cooking progress, and log actual servings.`}
          actions={
            activeApprovedMeal ? (
              <ButtonLink
                variant="primary"
                href={hrefFor('operations', { date: DEMO_TODAY, meal: activeApprovedMeal.meal })}
              >
                Log Active Prep · {MEAL_META[activeApprovedMeal.meal].label}
                <ArrowRight size={16} aria-hidden />
              </ButtonLink>
            ) : (
              <ButtonLink
                variant="secondary"
                href={hrefFor('operations', { date: DEMO_TODAY })}
              >
                Open Kitchen Operations
                <ArrowRight size={16} aria-hidden />
              </ButtonLink>
            )
          }
        />

        {/* Prominent Active Service Notification Banner */}
        <div className="mb-6 rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${
                activeApprovedMeal
                  ? 'bg-brand-50 text-brand-700 ring-brand-700/10'
                  : 'bg-amber-50 text-amber-800 ring-amber-700/10'
              }`}>
                <ChefHat size={20} aria-hidden />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">
                    {activeApprovedMeal
                      ? `Active Prep Service: ${MEAL_META[activeApprovedMeal.meal].label}`
                      : 'Today’s Kitchen Shift Status'}
                  </h2>
                  {activeApprovedMeal && <StatusBadge status="approved" />}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {activeApprovedMeal
                    ? `Manager confirmed targets at ${activeApprovedMeal.record?.approvedAt ? formatDateTime(activeApprovedMeal.record.approvedAt) : 'shift start'}. Service window: ${MEAL_META[activeApprovedMeal.meal].time}.`
                    : 'Check the meal schedule below. Preparation may begin only when the manager confirms the plan.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeApprovedMeal && (
                <ButtonLink
                  variant="primary"
                  size="md"
                  href={hrefFor('operations', { date: DEMO_TODAY, meal: activeApprovedMeal.meal })}
                >
                  <Utensils size={15} aria-hidden /> Open Prep & Log Servings
                </ButtonLink>
              )}
            </div>
          </div>
        </div>

        {/* Operational Shift KPI Strip */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={CalendarCheck}
            label="Meals ready for prep"
            value={`${todayMeals.filter((m) => m.status === 'approved' || m.status === 'completed').length} of ${todayMeals.filter((m) => m.menu).length}`}
            sub={activeApprovedMeal ? `${MEAL_META[activeApprovedMeal.meal].label} authorized to cook` : 'All scheduled plans reviewed'}
            definition="Number of today’s meals that have manager-confirmed preparation plans authorized for cooking."
          />
          <MetricCard
            icon={Users}
            label="Diners expected today"
            value={fmtInt(today.recordedDiners + today.forecastDiners)}
            sub={`${fmtInt(today.recordedDiners)} served + ${fmtInt(today.forecastDiners)} upcoming`}
            definition="Recorded actual diners for completed meals plus estimated diner turnout for remaining shifts."
          />
          <MetricCard
            icon={Scale}
            label="Approved food target"
            value={totalApprovedKgToday > 0 ? fmtKg(totalApprovedKgToday) : '—'}
            sub="Authorized batch prep weight"
            definition="Total food weight (in kg) authorized across confirmed meal preparation plans for today’s service."
          />
          <MetricCard
            icon={UtensilsCrossed}
            label="Recorded leftovers today"
            value={fmtKg(today.leftoverKg)}
            sub={today.mealsPlanned > 0 ? 'Residual surplus post-service' : 'No service completed yet'}
            definition="Actual food remaining after service: (prepared − consumed) in kg for recorded meals."
          />
        </div>

        {/* Today's Kitchen Work: Daily Progression Cards */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Today’s Meal Service Progression · {formatWeekdayDay(DEMO_TODAY)}
            </h3>
            <span className="text-xs text-slate-400">Kitchen Operations Pipeline</span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {todayMeals.map(({ meal, menu, record, status }) => {
              const meta = MEAL_META[meal];
              const MealIcon = meal === 'breakfast' ? Coffee : meal === 'lunch' ? Utensils : UtensilsCrossed;
              const isMealApproved = status === 'approved';
              const isMealCompleted = status === 'completed';
              const isMealRecommended = status === 'recommended';

              return (
                <div
                  key={meal}
                  className={`flex flex-col justify-between rounded-xl border bg-white p-5 shadow-xs transition-shadow hover:shadow-sm ${
                    isMealApproved
                      ? 'border-brand-300 ring-2 ring-brand-700/10'
                      : isMealRecommended
                        ? 'border-amber-200/80 bg-amber-50/20'
                        : 'border-slate-200/90'
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          isMealApproved
                            ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-700/20'
                            : isMealCompleted
                              ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-700/20'
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          <MealIcon size={18} aria-hidden />
                        </span>
                        <div>
                          <h4 className="text-base font-semibold text-slate-900">{meta.label}</h4>
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock size={11} className="text-slate-400" /> {meta.time}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={status} />
                    </div>

                    {/* Operational Status Guidance Banner */}
                    <div className="my-3.5">
                      {isMealApproved ? (
                        <div className="rounded-lg border border-brand-200/90 bg-brand-50/60 p-2.5 text-xs text-brand-900">
                          <p className="flex items-center gap-1.5 font-semibold text-brand-800">
                            <CheckCircle2 size={14} className="shrink-0 text-brand-700" />
                            Plan Approved — Authorized to Prepare
                          </p>
                          <p className="mt-1 text-[11px] text-brand-700">
                            Manager approved preparation targets. Log actual prepared, consumed, and leftover portions.
                          </p>
                        </div>
                      ) : isMealCompleted ? (
                        <div className="rounded-lg border border-sky-200/90 bg-sky-50/60 p-2.5 text-xs text-sky-900">
                          <p className="flex items-center gap-1.5 font-semibold text-sky-800">
                            <Check size={14} className="shrink-0 text-sky-700" />
                            Service Completed & Logged
                          </p>
                          <p className="mt-1 text-[11px] text-sky-700">
                            {record && record.actualDiners !== null ? `${fmtInt(record.actualDiners)} diners served.` : ''} Results saved in system.
                          </p>
                        </div>
                      ) : isMealRecommended ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-900">
                          <p className="flex items-center gap-1.5 font-semibold text-amber-800">
                            <AlertCircle size={14} className="shrink-0 text-amber-700" />
                            Awaiting Manager Confirmation
                          </p>
                          <p className="mt-1 text-[11px] text-amber-700">
                            Do not begin cooking from draft targets until the manager confirms the plan.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
                          <p className="font-medium">No menu or plan entered yet.</p>
                        </div>
                      )}
                    </div>

                    {/* Published Dishes & Portions */}
                    <div className="space-y-1.5 text-xs">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {isMealApproved ? 'Approved Portions' : 'Dishes Configured'}
                      </p>
                      {menu ? (
                        <ul className="divide-y divide-slate-100">
                          {menu.items.map((item) => {
                            const recItem = record?.items.find((ri) => ri.itemId === item.id);
                            return (
                              <li key={item.id} className="flex items-center justify-between py-1.5 text-slate-700">
                                <span className="font-medium text-slate-900">{item.name}</span>
                                <span className="font-mono tabular-nums text-slate-500">
                                  {isMealApproved && recItem?.approvedPrep !== null && recItem?.approvedPrep !== undefined ? (
                                    <strong className="font-semibold text-brand-800">{fmtInt(recItem.approvedPrep)} portions</strong>
                                  ) : isMealCompleted && recItem && recItem.prepared !== null ? (
                                    <span>{fmtInt(recItem.prepared)} prep / {fmtInt(recItem.consumed ?? 0)} consumed</span>
                                  ) : (
                                    <span>{item.kgPerPortion < 0.1 ? `${Math.round(item.kgPerPortion * 1000)}g` : `${item.kgPerPortion} kg`}</span>
                                  )}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="italic text-slate-400">No dishes entered</p>
                      )}
                    </div>
                  </div>

                  {/* Card Action */}
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-[11px] font-mono text-slate-500">
                      {record?.predictedDiners ? `${fmtInt(record.predictedDiners)} predicted diners` : '—'}
                    </span>
                    <ButtonLink
                      size="sm"
                      variant={isMealApproved ? 'primary' : 'secondary'}
                      href={hrefFor('operations', { date: DEMO_TODAY, meal })}
                    >
                      {isMealApproved ? 'Log Preparation' : isMealCompleted ? 'View Service Log' : 'View Details'}
                      <ArrowRight size={13} aria-hidden />
                    </ButtonLink>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Meal Detailed Cooking Target Checklist */}
        {activeApprovedMeal && activeApprovedMeal.record && (
          <div className="mt-6 rounded-xl border border-brand-200/90 bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Utensils size={17} aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Active Kitchen Target Checklist · {MEAL_META[activeApprovedMeal.meal].label}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Authorized for culinary batch cooking. Prepared portions and residual leftovers are recorded in Kitchen Operations.
                  </p>
                </div>
              </div>

              <ButtonLink
                variant="primary"
                size="md"
                href={hrefFor('operations', { date: DEMO_TODAY, meal: activeApprovedMeal.meal })}
              >
                Open Kitchen Operations <ArrowRight size={14} aria-hidden />
              </ButtonLink>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {activeApprovedMeal.record.items.map((item) => {
                const prepPortions = item.approvedPrep ?? item.suggestedPrep;
                const batchKg = prepPortions * item.kgPerPortion;
                return (
                  <div
                    key={item.itemId}
                    className="flex flex-col justify-between rounded-lg border border-slate-200/90 bg-slate-50/50 p-3.5"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-0.5 text-xs font-mono text-slate-500">
                        Portion weight: {item.kgPerPortion < 0.1 ? `${Math.round(item.kgPerPortion * 1000)}g` : `${item.kgPerPortion} kg`}
                      </p>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between border-t border-slate-200/60 pt-2">
                      <span className="text-xs text-slate-500">Batch Target:</span>
                      <div className="text-right">
                        <span className="text-base font-bold font-mono text-brand-800 tabular-nums">
                          {fmtInt(prepPortions)}
                        </span>{' '}
                        <span className="text-xs font-medium text-slate-600">portions</span>
                        <span className="block text-[11px] font-mono text-slate-500 tabular-nums">
                          ({fmtNum(batchKg, 1)} kg)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Operational Guidance Footnote */}
        <div className="mt-6 border-t border-slate-200/80 pt-4 text-center text-xs text-slate-400">
          Kitchen Staff Portal · Preparation targets are read-only until confirmed by mess management. Actual servings and leftovers can be recorded on service date.
        </div>
      </>
    );
  }

  // Manager View
  return (
    <>
      <PageHeader
        title={`Welcome back, ${displayName.split(' ')[0]}`}
        description={`Planning date: ${formatLong(DEMO_TODAY)}. Review today's forecasts, confirm preparation plans and track leftovers.`}
        actions={
          next ? (
            <ButtonLink
              variant="primary"
              href={hrefFor('forecasts', { date: next.date, meal: next.meal })}
            >
              Review next forecast
              <span className="font-normal opacity-80">· {MEAL_META[next.meal].label}</span>
              <ArrowRight size={16} aria-hidden />
            </ButtonLink>
          ) : undefined
        }
      />

      {/* Prominent Next-Meal Decision Panel */}
      <div className="mb-6">
        <NextMealDecisionPanel
          next={next}
          preview={preview}
          onApprove={handleApprove}
          isManager={isManager}
          isApproving={isApproving}
        />
      </div>

      {/* Operational KPI Metric Strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Diners today"
          value={fmtInt(today.recordedDiners + today.forecastDiners)}
          sub={`${fmtInt(today.recordedDiners)} recorded + ${fmtInt(today.forecastDiners)} forecast`}
          definition="Recorded = actual diners for meals already served and saved today. Forecast = predicted diners for today's meals not yet recorded. The total mixes the two, so it is neither a pure forecast nor a final count. Synthetic data."
        />
        <MetricCard
          icon={CalendarCheck}
          label="Meals planned"
          value={`${today.mealsPlanned} of ${today.mealsWithMenu}`}
          sub={today.awaitingApproval > 0 ? `${today.awaitingApproval} awaiting your approval` : 'All of today’s plans approved'}
          definition="A meal counts as planned once the kitchen manager has confirmed its final preparation plan."
        />
        <MetricCard
          icon={Scale}
          label="Estimated leftover today"
          value={fmtKg(today.leftoverKg)}
          sub="Plan minus expected demand"
          definition="Per item: (prepared, else approved, else suggested quantity) − (consumed, else predicted demand), floored at zero, converted to kg using each item's portion weight."
        />
        <MetricCard
          icon={Target}
          label="Stored-forecast accuracy"
          value={stats ? fmtPct(stats.accuracy) : '—'}
          sub={stats ? `MAE ${fmtNum(stats.mae)} · baseline MAE ${fmtNum(stats.baselineMae)} · ${stats.n} meals` : 'No evaluable meals yet'}
          definition={`Accuracy = 1 − WAPE, where WAPE = Σ|predicted − actual diners| ÷ Σ actual diners, over the ${stats?.n ?? 0} completed meals from ${formatDayMonth(win.from)} to ${formatDayMonth(win.to)} that have a baseline. MAE and baseline MAE use the same meals. ${stats ? describeForecastSources(stats) : ''}`}
        />
      </div>

      {/* Daily Meal Status Pipeline & Upcoming Schedule */}
      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card
          className="xl:col-span-7"
          title="Today's Meal Pipeline"
          description={`${formatLong(DEMO_TODAY)} service progression`}
        >
          <div className="divide-y divide-gray-100">
            {todayMeals.map(({ meal, menu, record, status }) => {
              const meta = MEAL_META[meal];
              const MealIcon = meal === 'breakfast' ? Coffee : meal === 'lunch' ? Utensils : UtensilsCrossed;
              return (
                <div key={meal} className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 ring-1 ring-slate-200/60">
                      <MealIcon size={17} aria-hidden />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{meta.label}</span>
                        <StatusBadge status={status} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {meta.time} · {menu ? (
                          <span>
                            <strong className="font-medium text-slate-700">{menu.items.length} dishes</strong> ({menu.items.map((i) => i.name).slice(0, 3).join(', ')}{menu.items.length > 3 ? '…' : ''})
                          </span>
                        ) : (
                          'No menu entered'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <span className="block font-semibold font-mono text-slate-900 tabular-nums">
                        {record?.actualDiners !== null && record?.actualDiners !== undefined
                          ? `${fmtInt(record.actualDiners)} actual diners`
                          : record?.predictedDiners
                            ? `${fmtInt(record.predictedDiners)} forecast diners`
                            : '—'}
                      </span>
                      <span className="text-slate-500">
                        {record?.status === 'completed'
                          ? 'Service completed'
                          : record?.status === 'approved'
                            ? 'Approved by manager'
                            : 'Awaiting confirmation'}
                      </span>
                    </div>

                    <ButtonLink
                      size="sm"
                      variant={record?.status === 'recommended' && isManager ? 'primary' : 'secondary'}
                      href={hrefFor('operations', { date: DEMO_TODAY, meal })}
                    >
                      {isKitchenStaff ? 'Log Servings' : record?.status === 'recommended' ? 'Approve Plan' : 'Open'}
                    </ButtonLink>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card
          className="xl:col-span-5"
          title="Upcoming meals"
          description={`Next ${settings.upcomingHorizonDays} days schedule`}
          flush
        >
          <UpcomingMealsTable meals={upcoming.slice(0, 5)} />
        </Card>
      </div>

      {/* Operational Trends: Demand & Food Waste */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card
          title="Predicted vs actual diners"
          description={`${formatDayMonth(win.from)} – ${formatDayMonth(win.to)} · stored forecasts in PostgreSQL`}
          actions={<SegmentedControl size="sm" label="Meal filter" options={FILTERS} value={mealFilter} onChange={setMealFilter} />}
        >
          {trend.length ? <DemandTrendChart data={trend} /> : <EmptyState icon={LineChart} title="No completed days to chart" />}
        </Card>
        <Card
          title="Food-waste trend"
          description={`${formatDayMonth(win.from)} – ${formatDayMonth(win.to)} · daily leftover (kg) and waste rate, all meals`}
        >
          {allMealsTrend.length ? <WasteTrendChart data={allMealsTrend} /> : <EmptyState icon={LineChart} title="No recorded leftovers yet" />}
        </Card>
      </div>

      {/* Unobtrusive Demonstration Data Disclosure */}
      <div className="mt-6 border-t border-gray-100 pt-3 text-center text-xs text-gray-400">
        Demonstration environment connected to Cloud SQL PostgreSQL. Synthetic attendance and waste baseline data derived from reproducible models.
      </div>
    </>
  );
}
