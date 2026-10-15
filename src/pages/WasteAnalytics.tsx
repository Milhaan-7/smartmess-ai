import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BarChart3, Gauge, PackageMinus, Percent, Soup } from 'lucide-react';
import type { MealRecord } from '../types';
import { useAppStore } from '../store/AppStore';
import { DEMO_TODAY, MEAL_META, MEAL_OPTIONS, MEAL_ORDER } from '../lib/constants';
import { formatDayMonth, formatWeekdayDay, isValidDateString } from '../lib/dates';
import { fmtInt, fmtKg, fmtNum, fmtPct, signed } from '../lib/format';
import { aggregateByItem, dailySeries, describeForecastSources, EVALUATION_WINDOW_DAYS, evaluationWindow, forecastError, forecastErrorStats, recordTotals, type ItemWasteRow, type MealFilter } from '../services/metrics';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Field, TextInput } from '../components/common/Field';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { MetricCard } from '../components/common/MetricCard';
import { DataTable, type Column } from '../components/common/DataTable';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { Notice, SyntheticNote } from '../components/common/Notice';
import { WasteTrendChart } from '../components/charts/WasteTrendChart';
import { DemandTrendChart } from '../components/charts/DemandTrendChart';
import { ItemWasteChart } from '../components/charts/ItemWasteChart';

const FILTERS: { value: MealFilter; label: string }[] = [{ value: 'all', label: 'All meals' }, ...MEAL_OPTIONS];
const PAGE_SIZE = 10;
type SortKey = 'leftoverKg' | 'wasteRate' | 'name' | 'timesServed';
type SortState = { key: SortKey; dir: 'asc' | 'desc' };

/** Module-level (not defined inside the page) so React keeps the same button and its keyboard focus across re-sorts. */
function SortHead({ k, sort, onToggle, children }: { k: SortKey; sort: SortState; onToggle: (k: SortKey) => void; children: string }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(k)}
      className="inline-flex items-center gap-1 font-medium hover:text-gray-900"
      aria-label={`Sort by ${children}`}
    >
      {children}
      {sort.key === k && (sort.dir === 'asc' ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
    </button>
  );
}

export default function WasteAnalytics() {
  const { records } = useAppStore().state;
  // Default range = the shared evaluation window, so default figures match the Dashboard.
  const win = evaluationWindow(DEMO_TODAY);
  const [from, setFrom] = useState(win.from);
  const [to, setTo] = useState(win.to);
  const [meal, setMeal] = useState<MealFilter>('all');
  const [sort, setSort] = useState<SortState>({ key: 'leftoverKg', dir: 'desc' });
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<MealRecord | null>(null);

  const rangeError =
    !isValidDateString(from) || !isValidDateString(to) ? 'Enter valid dates' : from > to ? 'The start date must be on or before the end date' : undefined;

  const filtered = useMemo(
    () =>
      rangeError
        ? []
        : records
            .filter((r) => r.status === 'completed' && r.date >= from && r.date <= to && (meal === 'all' || r.meal === meal))
            // newest first; within a day, latest service first (dinner, lunch, breakfast)
            .sort((a, b) => b.date.localeCompare(a.date) || MEAL_ORDER.indexOf(b.meal) - MEAL_ORDER.indexOf(a.meal)),
    [records, from, to, meal, rangeError],
  );

  const totals = useMemo(() => {
    let preparedKg = 0;
    let leftoverKg = 0;
    for (const r of filtered) {
      const t = recordTotals(r);
      preparedKg += t.preparedKg;
      leftoverKg += t.leftoverKg;
    }
    return { preparedKg, leftoverKg, wasteRate: preparedKg > 0 ? leftoverKg / preparedKg : null };
  }, [filtered]);

  const items = useMemo(() => aggregateByItem(filtered), [filtered]);
  const sortedItems = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name) * dir;
      return ((a[sort.key] ?? 0) - (b[sort.key] ?? 0)) * dir;
    });
  }, [items, sort]);
  const topItems = useMemo(() => [...items].sort((a, b) => b.leftoverKg - a.leftoverKg).slice(0, 8), [items]);

  const stats = useMemo(() => forecastErrorStats(filtered), [filtered]);
  const series = useMemo(() => dailySeries(filtered, meal), [filtered, meal]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const reset = () => {
    setFrom(win.from);
    setTo(win.to);
    setMeal('all');
    setPage(0);
  };
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));

  const itemColumns: Column<ItemWasteRow>[] = [
    { key: 'name', header: <SortHead k="name" sort={sort} onToggle={toggleSort}>Food item</SortHead>, sticky: true, cell: (r) => <span className="font-medium text-gray-900">{r.name}</span> },
    { key: 'served', header: <SortHead k="timesServed" sort={sort} onToggle={toggleSort}>Times served</SortHead>, align: 'right', cell: (r) => r.timesServed },
    { key: 'prep', header: 'Prepared (kg)', align: 'right', cell: (r) => fmtNum(r.preparedKg) },
    { key: 'cons', header: 'Consumed (kg)', align: 'right', cell: (r) => fmtNum(r.consumedKg) },
    { key: 'left', header: <SortHead k="leftoverKg" sort={sort} onToggle={toggleSort}>Leftover (kg)</SortHead>, align: 'right', cell: (r) => <span className="font-semibold">{fmtNum(r.leftoverKg)}</span> },
    { key: 'portions', header: 'Leftover (portions)', align: 'right', cell: (r) => fmtInt(r.leftoverPortions) },
    { key: 'rate', header: <SortHead k="wasteRate" sort={sort} onToggle={toggleSort}>Waste rate</SortHead>, align: 'right', cell: (r) => fmtPct(r.wasteRate) },
  ];

  const recordColumns: Column<MealRecord>[] = [
    { key: 'date', header: 'Date', sticky: true, cell: (r) => formatWeekdayDay(r.date) },
    { key: 'meal', header: 'Meal', cell: (r) => MEAL_META[r.meal].label },
    { key: 'pred', header: 'Stored forecast (diners)', align: 'right', cell: (r) => fmtInt(r.predictedDiners) },
    { key: 'act', header: 'Actual diners', align: 'right', cell: (r) => (r.actualDiners === null ? '—' : fmtInt(r.actualDiners)) },
    { key: 'err', header: 'Error (pred − actual)', align: 'right', cell: (r) => (r.actualDiners === null ? '—' : signed(forecastError(r.predictedDiners, r.actualDiners))) },
    { key: 'prep', header: 'Prepared (kg)', align: 'right', cell: (r) => fmtNum(recordTotals(r).preparedKg) },
    { key: 'left', header: 'Leftover (kg)', align: 'right', cell: (r) => <span className="font-semibold">{fmtNum(recordTotals(r).leftoverKg)}</span> },
    { key: 'rate', header: 'Waste rate', align: 'right', cell: (r) => fmtPct(recordTotals(r).wasteRate) },
  ];

  return (
    <>
      <PageHeader title="Waste Analytics" description="Understand where leftovers come from and how forecasts compared with actual attendance. All records are synthetic." />

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="From" className="w-44" error={rangeError}>
            {(p) => <TextInput type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(0); }} {...p} />}
          </Field>
          <Field label="To" className="w-44">
            {(p) => <TextInput type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(0); }} {...p} />}
          </Field>
          <div>
            <span className="mb-1 block text-[13px] font-medium text-gray-700">Meal</span>
            <SegmentedControl label="Meal filter" options={FILTERS} value={meal} onChange={(m) => { setMeal(m); setPage(0); }} />
          </div>
          <Button variant="ghost" onClick={reset}>Reset filters</Button>
          <p className="ml-auto pb-2 text-xs text-gray-500">{filtered.length} completed meals in view</p>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Default range: the {EVALUATION_WINDOW_DAYS}-day evaluation window ({formatDayMonth(win.from)} – {formatDayMonth(win.to)}), shared with the Dashboard. Set To = {formatDayMonth(DEMO_TODAY)} to include today’s meals.
        </p>
      </Card>

      <div className="mt-4 space-y-4">
        {filtered.length === 0 ? (
          <EmptyState icon={BarChart3} title="No completed meals match these filters" description={rangeError ?? 'Widen the date range, choose another meal, or record results in Kitchen Operations.'} action={<Button onClick={reset}>Reset filters</Button>} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={PackageMinus} label="Total recorded leftover" value={fmtKg(totals.leftoverKg)} sub={`of ${fmtKg(totals.preparedKg)} prepared`} definition="Σ over items and meals of (prepared − consumed) × kg per portion." />
              <MetricCard icon={Percent} label="Estimated waste rate" value={fmtPct(totals.wasteRate)} sub="Leftover kg ÷ prepared kg" definition="Waste rate = total leftover kg ÷ total prepared kg, where leftover = prepared − consumed for each item. It measures leftover food, not cost or avoidable waste." />
              <MetricCard icon={Soup} label="Highest-leftover item" value={<span className="text-xl">{topItems[0]?.name ?? '—'}</span>} sub={topItems[0] ? `${fmtKg(topItems[0].leftoverKg)} · ${fmtPct(topItems[0].wasteRate)} waste rate` : undefined} />
              <MetricCard icon={Gauge} label="Stored-forecast MAE" value={stats ? `${fmtNum(stats.mae)} diners` : '—'} sub={stats ? `Baseline MAE ${fmtNum(stats.baselineMae)} · ${stats.n} meals${stats.excluded ? ` (${stats.excluded} without baseline excluded)` : ''}` : 'No evaluable meals in view'} definition={`Mean absolute error = average of |predicted − actual diners|. Baseline MAE uses the trailing mean of the previous 14 same-meal diner counts, on exactly the same meals. ${stats ? describeForecastSources(stats) : ''}`} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="Historical waste trend" description={meal === 'all' ? 'Days with all three meals recorded' : `${MEAL_META[meal].label} only`}>
                {series.length ? <WasteTrendChart data={series} /> : <EmptyState icon={BarChart3} title="No full days in range" description="The all-meals trend needs breakfast, lunch and dinner recorded on the same day." />}
              </Card>
              <Card title="Predicted vs actual diners" description="Same selection as the filters above">
                {series.length ? <DemandTrendChart data={series} /> : <EmptyState icon={BarChart3} title="No days to compare" />}
                {stats && (
                  <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-gray-100 pt-4 text-center text-xs text-gray-500">
                    <div><dt>MAE</dt><dd className="text-base font-semibold text-gray-900">{fmtNum(stats.mae)}</dd></div>
                    <div><dt>Bias (pred − actual)</dt><dd className="text-base font-semibold text-gray-900">{stats.bias >= 0 ? '+' : '−'}{fmtNum(Math.abs(stats.bias))}</dd></div>
                    <div><dt>WAPE</dt><dd className="text-base font-semibold text-gray-900">{fmtPct(stats.wape)}</dd></div>
                  </dl>
                )}
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-5">
              <Card className="xl:col-span-2" title="Which items leave the most food?" description="Top 8 by total leftover (kg)">
                <ItemWasteChart rows={topItems} />
              </Card>
              <Card className="xl:col-span-3" title="Item-level waste breakdown" description="Select a column heading to sort." flush>
                <div className="max-h-[28rem] overflow-y-auto">
                  <DataTable caption="Item-level prepared, consumed and leftover quantities" columns={itemColumns} rows={sortedItems} rowKey={(r) => r.name} dense />
                </div>
              </Card>
            </div>

            <Card title="Past meal records" description="Select a row to see the item breakdown." flush>
              <DataTable caption="Past meal records with forecast error and waste" columns={recordColumns} rows={pageRows} rowKey={(r) => r.id} onRowClick={setDetail} />
              <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-[13px] text-gray-600">
                <span>Page {safePage + 1} of {pageCount}</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setPage(safePage - 1)} disabled={safePage === 0}>Previous</Button>
                  <Button size="sm" onClick={() => setPage(safePage + 1)} disabled={safePage >= pageCount - 1}>Next</Button>
                </div>
              </div>
            </Card>
          </>
        )}

        <Card title="How these figures are calculated">
          <dl className="grid gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2">
            <div><dt className="font-medium text-gray-900">Leftover</dt><dd className="text-gray-600">Quantity prepared − quantity consumed, per item, in portions. Converted to kg with each item's kg-per-portion.</dd></div>
            <div><dt className="font-medium text-gray-900">Waste rate</dt><dd className="text-gray-600">Total leftover kg ÷ total prepared kg.</dd></div>
            <div><dt className="font-medium text-gray-900">Forecast error</dt><dd className="text-gray-600">Predicted diners − actual diners. Absolute error is its absolute value; MAE averages it across meals with an actual count.</dd></div>
            <div><dt className="font-medium text-gray-900">Evaluation window</dt><dd className="text-gray-600">The {EVALUATION_WINDOW_DAYS} service days before the planning date. Used by the Dashboard accuracy card and as the default range here.</dd></div>
            <div><dt className="font-medium text-gray-900">Baseline</dt><dd className="text-gray-600">Mean of the previous 14 completed diner counts for the same meal type (at least 5 needed). Meals without a baseline are excluded from MAE, baseline MAE and accuracy alike.</dd></div>
            <div><dt className="font-medium text-gray-900">Stored forecasts</dt><dd className="text-gray-600">Past forecasts in this demo dataset are synthetic values, not model output. Results here illustrate the calculations only.</dd></div>
            <div><dt className="font-medium text-gray-900">WAPE</dt><dd className="text-gray-600">Σ|error| ÷ Σ actual diners. The dashboard shows 1 − WAPE as "forecast accuracy".</dd></div>
          </dl>
        </Card>
        <Notice tone="warning" title="No real-world impact is claimed">
          These are synthetic records. They illustrate how the analytics work and do not show that SmartMess AI has reduced food waste anywhere.
        </Notice>
        <SyntheticNote />
      </div>

      {detail && (
        <Modal wide title={`${MEAL_META[detail.meal].label} · ${formatWeekdayDay(detail.date)}`} description={detail.forecastSource === 'synthetic_seed' ? 'Synthetic record with a synthetic stored forecast' : 'Forecast produced by the rule-based forecaster (not machine learning)'} onClose={() => setDetail(null)}>
          <DataTable
            caption="Item breakdown for the selected meal"
            rows={detail.items}
            rowKey={(i) => i.itemId}
            dense
            columns={[
              { key: 'n', header: 'Item', cell: (i) => i.name },
              { key: 's', header: 'Suggested', align: 'right', cell: (i) => fmtInt(i.suggestedPrep) },
              { key: 'a', header: 'Approved', align: 'right', cell: (i) => (i.approvedPrep === null ? '—' : fmtInt(i.approvedPrep)) },
              { key: 'p', header: 'Prepared', align: 'right', cell: (i) => (i.prepared === null ? '—' : fmtInt(i.prepared)) },
              { key: 'c', header: 'Consumed', align: 'right', cell: (i) => (i.consumed === null ? '—' : fmtInt(i.consumed)) },
              { key: 'l', header: 'Left over', align: 'right', cell: (i) => (i.prepared === null || i.consumed === null ? '—' : fmtInt(i.prepared - i.consumed)) },
            ]}
          />
        </Modal>
      )}
    </>
  );
}
