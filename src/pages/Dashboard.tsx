import { useMemo, useState } from 'react';
import { ArrowRight, CalendarCheck, LineChart, Scale, Target, Users } from 'lucide-react';
import { useAppStore } from '../store/AppStore';
import { DEMO_TODAY, MEAL_META, MEAL_OPTIONS } from '../lib/constants';
import { formatDayMonth, formatLong } from '../lib/dates';
import { fmtInt, fmtKg, fmtNum, fmtPct } from '../lib/format';
import { hrefFor } from '../lib/router';
import { dailySeries, describeForecastSources, evaluationWindow, forecastErrorStats, inRange, type MealFilter } from '../services/metrics';
import { getNextMealToReview, getPlanPreview, getTodaySummary, getUpcomingMeals } from '../services/planningService';
import { PageHeader } from '../components/common/PageHeader';
import { MetricCard } from '../components/common/MetricCard';
import { Card } from '../components/common/Card';
import { ButtonLink } from '../components/common/Button';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { EmptyState } from '../components/common/EmptyState';
import { SyntheticNote } from '../components/common/Notice';
import { UpcomingMealsTable } from '../components/dashboard/UpcomingMealsTable';
import { RecommendationsPanel } from '../components/dashboard/RecommendationsPanel';
import { DemandTrendChart } from '../components/charts/DemandTrendChart';
import { WasteTrendChart } from '../components/charts/WasteTrendChart';

const FILTERS: { value: MealFilter; label: string }[] = [{ value: 'all', label: 'All meals' }, ...MEAL_OPTIONS];

export default function Dashboard() {
  const { state } = useAppStore();
  const { settings, records } = state;
  const [mealFilter, setMealFilter] = useState<MealFilter>('all');

  const upcoming = useMemo(() => getUpcomingMeals(state, DEMO_TODAY, settings.upcomingHorizonDays), [state, settings.upcomingHorizonDays]);
  const today = useMemo(() => getTodaySummary(state, DEMO_TODAY), [state]);
  const next = useMemo(() => getNextMealToReview(state, DEMO_TODAY), [state]);
  const preview = useMemo(() => (next ? getPlanPreview(state, next.date, next.meal) : null), [state, next]);

  // One shared evaluation window for the accuracy card and both charts (same as Waste Analytics' default range).
  const win = evaluationWindow(DEMO_TODAY);
  const windowRecords = useMemo(() => records.filter((r) => inRange(r, evaluationWindow(DEMO_TODAY))), [records]);
  const stats = useMemo(() => forecastErrorStats(windowRecords), [windowRecords]);
  const trend = useMemo(() => dailySeries(windowRecords, mealFilter), [windowRecords, mealFilter]);
  const allMealsTrend = useMemo(() => dailySeries(windowRecords, 'all'), [windowRecords]);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${settings.messManager.split(' ')[0]}`}
        description={`Planning date: ${formatLong(DEMO_TODAY)}. Review today's forecasts, confirm preparation plans and track leftovers.`}
        actions={
          <ButtonLink variant="primary" href={next ? hrefFor('forecasts', { date: next.date, meal: next.meal }) : hrefFor('forecasts')}>
            Review next forecast
            {next && <span className="font-normal opacity-80">· {MEAL_META[next.meal].label}</span>}
            <ArrowRight size={16} aria-hidden />
          </ButtonLink>
        }
      />

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

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7" title="Upcoming meals" description={`Next ${settings.upcomingHorizonDays} days, meals not yet completed`} flush>
          <UpcomingMealsTable meals={upcoming} />
        </Card>
        <div className="xl:col-span-5">
          {next ? (
            <RecommendationsPanel date={next.date} meal={next.meal} preview={preview} />
          ) : (
            <Card title="Preparation recommendations">
              <EmptyState icon={LineChart} title="Nothing waiting for review" description="Every upcoming meal in the next two weeks has an approved plan." />
            </Card>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card
          title="Predicted vs actual diners"
          description={`${formatDayMonth(win.from)} – ${formatDayMonth(win.to)} · stored forecasts (synthetic)`}
          actions={<SegmentedControl size="sm" label="Meal filter" options={FILTERS} value={mealFilter} onChange={setMealFilter} />}
        >
          {trend.length ? <DemandTrendChart data={trend} /> : <EmptyState icon={LineChart} title="No completed days to chart" />}
        </Card>
        <Card title="Food-waste trend" description={`${formatDayMonth(win.from)} – ${formatDayMonth(win.to)} · daily leftover (kg) and waste rate, all meals (synthetic)`}>
          {allMealsTrend.length ? <WasteTrendChart data={allMealsTrend} /> : <EmptyState icon={LineChart} title="No recorded leftovers yet" />}
        </Card>
      </div>

      <SyntheticNote className="mt-4" />
    </>
  );
}
