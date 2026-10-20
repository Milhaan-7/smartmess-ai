import { useMemo, useState } from 'react';
import { ArrowRight, CalendarCheck, Coffee, LineChart, Scale, Target, Users, Utensils, UtensilsCrossed } from 'lucide-react';
import { useAppStore } from '../store/AppStore';
import { useToast } from '../components/common/Toast';
import { DEMO_TODAY, MEAL_META, MEAL_OPTIONS, MEAL_ORDER } from '../lib/constants';
import { formatDayMonth, formatLong, formatWeekdayDay } from '../lib/dates';
import { fmtInt, fmtKg, fmtNum, fmtPct } from '../lib/format';
import { hrefFor } from '../lib/router';
import { dailySeries, describeForecastSources, evaluationWindow, forecastErrorStats, inRange, type MealFilter } from '../services/metrics';
import { getNextMealToReview, getPlanPreview, getTodaySummary, getUpcomingMeals } from '../services/planningService';
import { approvePlan } from '../services/operationsService';
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
    if (!mealToApprove || !mealToApprove.record || mealToApprove.record.status !== 'recommended') return;
    try {
      setIsApproving(true);
      const quantities: Record<string, number> = {};
      for (const it of mealToApprove.record.items) {
        quantities[it.itemId] = it.suggestedPrep;
      }
      const approved = approvePlan(mealToApprove.record, quantities, new Date().toISOString());
      dispatch({ type: 'record/upsert', record: approved });
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

  // Manager and Kitchen Staff Views
  return (
    <>
      <PageHeader
        title={isKitchenStaff ? `Kitchen Board · ${settings.messName}` : `Welcome back, ${displayName.split(' ')[0]}`}
        description={
          isKitchenStaff
            ? `Preparation targets and food logs for ${formatLong(DEMO_TODAY)}.`
            : `Planning date: ${formatLong(DEMO_TODAY)}. Review today's forecasts, confirm preparation plans and track leftovers.`
        }
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
