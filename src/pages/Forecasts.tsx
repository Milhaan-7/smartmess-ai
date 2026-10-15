import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarOff, Play, Send, TrendingDown, TrendingUp } from 'lucide-react';
import type { Forecast, ItemForecast, MealType, SpecialDay } from '../types';
import { useAppStore } from '../store/AppStore';
import { useToast } from '../components/common/Toast';
import { DEMO_TODAY, MEAL_META, MEAL_OPTIONS, SPECIAL_DAYS } from '../lib/constants';
import { formatMedium, isValidDateString } from '../lib/dates';
import { fmtInt, fmtNum, signed } from '../lib/format';
import { hrefFor, useRoute } from '../lib/router';
import { runForecast } from '../services/mockForecastService';
import { findMenu } from '../services/menuService';
import { recordFromForecast, recordId } from '../services/operationsService';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Button, ButtonLink } from '../components/common/Button';
import { Field, Select, TextInput } from '../components/common/Field';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { DataTable, type Column } from '../components/common/DataTable';
import { EmptyState } from '../components/common/EmptyState';
import { Notice, SyntheticNote } from '../components/common/Notice';
import { Badge, StatusBadge } from '../components/common/Badge';
import { BaselineComparisonChart } from '../components/charts/BaselineComparisonChart';

interface RunInputs {
  date: string;
  meal: MealType;
  context: SpecialDay;
}

export default function Forecasts() {
  const { state, dispatch } = useAppStore();
  const { notify } = useToast();
  const { params } = useRoute();
  const { menus, records, settings } = state;

  const paramDate = params.get('date');
  const paramMeal = params.get('meal');
  const [date, setDate] = useState(isValidDateString(paramDate) ? paramDate : DEMO_TODAY);
  const [meal, setMeal] = useState<MealType>(
    paramMeal === 'breakfast' || paramMeal === 'lunch' || paramMeal === 'dinner' ? paramMeal : settings.defaultReviewMeal,
  );
  const [context, setContext] = useState<SpecialDay>('normal');
  const [result, setResult] = useState<{ forecast: Forecast; inputs: RunInputs } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const menu = isValidDateString(date) ? findMenu(menus, date, meal) : undefined;

  const run = useCallback(async () => {
    if (!menu) return;
    setRunning(true);
    setError(null);
    try {
      const forecast = await runForecast({ date, meal, menu, history: records, settings, context });
      setResult({ forecast, inputs: { date, meal, context } });
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : 'The forecast could not be calculated.');
    } finally {
      setRunning(false);
    }
  }, [menu, date, meal, records, settings, context]);

  // Initial forecast for the opening selection.
  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stale =
    result !== null && (result.inputs.date !== date || result.inputs.meal !== meal || result.inputs.context !== context);

  const forecast = result?.forecast ?? null;
  const existing = forecast ? records.find((r) => r.id === recordId(forecast.date, forecast.meal)) : undefined;
  const locked = existing !== undefined && existing.status !== 'recommended';

  const sendToOperations = () => {
    if (!forecast || locked) return;
    dispatch({ type: 'record/upsert', record: recordFromForecast(forecast) });
    notify(`${MEAL_META[forecast.meal].label} forecast for ${formatMedium(forecast.date)} sent to Kitchen Operations. It is not approved yet.`);
  };

  const itemColumns: Column<ItemForecast>[] = useMemo(
    () => [
      { key: 'name', header: 'Food item', sticky: true, cell: (i) => <span className="font-medium text-gray-900">{i.name}</span> },
      {
        key: 'uptake',
        header: 'Share of diners',
        align: 'right',
        cell: (i) => (
          <span title={i.uptakeSource === 'history' ? 'Learned from past consumption' : 'Default assumption: no history for this item'}>
            {(i.uptake * 100).toFixed(0)}%{i.uptakeSource === 'default' && <span className="ml-1 text-xs text-amber-700">default</span>}
          </span>
        ),
      },
      { key: 'demand', header: 'Predicted demand (portions)', align: 'right', cell: (i) => <span className="font-semibold">{fmtInt(i.predictedDemand)}</span> },
      { key: 'range', header: 'Likely range', align: 'right', cell: (i) => <span className="text-gray-500">{fmtInt(i.lowerDemand)}–{fmtInt(i.upperDemand)}</span> },
      { key: 'base', header: 'Historical avg', align: 'right', cell: (i) => <span className="text-gray-500">{fmtInt(i.baselineDemand)}</span> },
      {
        key: 'prep',
        header: 'Recommended prep (portions)',
        align: 'right',
        className: 'bg-brand-50/60',
        cell: (i) => <span className="font-semibold text-brand-800">{fmtInt(i.suggestedPrep)}</span>,
      },
      { key: 'buf', header: 'Buffer', align: 'right', cell: (i) => <span className="text-gray-500">{signed(i.suggestedPrep - i.predictedDemand)}</span> },
    ],
    [],
  );

  const maxImpact = forecast ? Math.max(1, ...forecast.factors.map((f) => Math.abs(f.impactDiners))) : 1;
  const diffVsBaseline = forecast ? forecast.predictedDiners - forecast.baselineDiners : 0;

  return (
    <>
      <PageHeader
        title="Forecasts"
        description="Estimate diners and item-level demand for a meal, then turn the estimate into a recommended preparation quantity for the kitchen manager to review."
      />

      <Card title="Forecast inputs" description="Changing an input does not change the forecast below until you run it.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[12rem_auto_14rem_auto] xl:items-end">
          <Field label="Forecast date" error={date && !isValidDateString(date) ? 'Choose a valid date' : undefined}>
            {(p) => <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} {...p} />}
          </Field>
          <div>
            <span className="mb-1 block text-[13px] font-medium text-gray-700">Meal</span>
            <SegmentedControl label="Meal" options={MEAL_OPTIONS} value={meal} onChange={setMeal} />
          </div>
          <Field label="Planning context" hint="Manual assumption">
            {(p) => (
              <Select value={context} onChange={(e) => setContext(e.target.value as SpecialDay)} {...p}>
                {Object.entries(SPECIAL_DAYS).map(([id, c]) => (
                  <option key={id} value={id}>{c.label}</option>
                ))}
              </Select>
            )}
          </Field>
          <div className="md:col-span-2 xl:col-span-1 xl:justify-self-end">
            <Button variant="primary" onClick={() => void run()} disabled={!menu || running}>
              <Play size={15} aria-hidden /> {running ? 'Running…' : 'Run Forecast'}
            </Button>
          </div>
        </div>

        <div className="mt-5 border-t border-gray-100 pt-4">
          <h3 className="text-[13px] font-semibold text-gray-900">
            Menu summary · {MEAL_META[meal].label}, {isValidDateString(date) ? formatMedium(date) : '—'}
          </h3>
          {menu ? (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Menu items">
              {menu.items.map((i) => (
                <li key={i.id} className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700">{i.name}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[13px] text-gray-500">No menu is defined for this meal.</p>
          )}
        </div>
      </Card>

      <div className="mt-4 space-y-4">
        {!menu && (
          <EmptyState
            icon={CalendarOff}
            title="No menu for this meal"
            description="A forecast needs the menu so it can estimate demand for each dish. Create the menu first."
            action={<ButtonLink variant="primary" href={hrefFor('menus')}>Go to Menus</ButtonLink>}
          />
        )}

        {error && (
          <Notice tone="error" title="Forecast could not be calculated">
            {error}
          </Notice>
        )}

        {stale && (
          <Notice tone="warning" title="Inputs changed">
            The forecast below was run for {formatMedium(result!.inputs.date)}, {MEAL_META[result!.inputs.meal].label}, {SPECIAL_DAYS[result!.inputs.context].label}. Select Run Forecast to update it.
          </Notice>
        )}

        {forecast && (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[15px] font-semibold text-gray-900">
                    {MEAL_META[forecast.meal].label} · {formatMedium(forecast.date)}
                  </h2>
                  <Badge tone="neutral">{SPECIAL_DAYS[forecast.context].label}</Badge>
                  {existing && <StatusBadge status={existing.status} />}
                </div>
                <div className="mt-4 grid gap-6 sm:grid-cols-3">
                  <div>
                    <p className="text-[13px] text-gray-500">Expected diners</p>
                    <p className="text-4xl font-semibold tabular-nums tracking-tight text-gray-900">{fmtInt(forecast.predictedDiners)}</p>
                    <p className="mt-1 text-xs text-gray-500">Likely range {fmtInt(forecast.lowerDiners)}–{fmtInt(forecast.upperDiners)}</p>
                  </div>
                  <div>
                    <p className="text-[13px] text-gray-500">Historical-average baseline</p>
                    <p className="text-2xl font-semibold tabular-nums text-gray-600">{fmtInt(forecast.baselineDiners)}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                      {diffVsBaseline >= 0 ? <TrendingUp size={13} aria-hidden /> : <TrendingDown size={13} aria-hidden />}
                      Forecast is {signed(diffVsBaseline)} vs baseline
                    </p>
                  </div>
                  <div>
                    <p className="text-[13px] text-gray-500">History used</p>
                    <p className="text-2xl font-semibold tabular-nums text-gray-600">{forecast.historyRecordsUsed}</p>
                    <p className="mt-1 text-xs text-gray-500">completed {MEAL_META[forecast.meal].label.toLowerCase()} meals</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-gray-500">
                  The range is the forecast ± {forecast.assumptions.bandDiners} diners (1.5 × the recent mean absolute error of stored forecasts, which are synthetic in this demo). It is a heuristic band, not a statistical confidence interval.
                </p>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-[15px] font-semibold text-gray-900">Next step</h2>
                  <p className="mt-1 text-[13px] text-gray-600">
                    Send this forecast to Kitchen Operations. Nothing is approved automatically; the manager reviews each quantity.
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  <Button variant="primary" className="w-full" onClick={sendToOperations} disabled={locked || stale}>
                    <Send size={15} aria-hidden /> {existing ? 'Replace saved forecast' : 'Send to Kitchen Operations'}
                  </Button>
                  {locked && <p className="text-xs text-amber-700">A plan for this meal is already {existing?.status}. Open it in Kitchen Operations to change it.</p>}
                  {stale && <p className="text-xs text-amber-700">Run the forecast again before sending.</p>}
                  <ButtonLink className="w-full" href={hrefFor('operations', { date: forecast.date, meal: forecast.meal })}>
                    Open Kitchen Operations <ArrowRight size={15} aria-hidden />
                  </ButtonLink>
                </div>
              </div>
            </div>

            <Card
              title="Item-level demand and recommended preparation"
              description="Predicted demand is what diners are expected to eat. Recommended prep adds a buffer and is rounded up to a serving step."
              flush
            >
              <DataTable caption="Item-level predicted demand and recommended preparation quantity" columns={itemColumns} rows={forecast.items} rowKey={(i) => i.itemId} />
              <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
                Recommended prep = predicted demand × (1 + {forecast.assumptions.prepBufferPct}% buffer), rounded up to a multiple of {forecast.assumptions.roundingStep} portions. Change these in Settings.
              </p>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="What influenced this forecast" description="Each step adjusts the historical-average baseline. Impacts add up to the forecast.">
                <ol className="space-y-4">
                  <li className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-gray-900">Historical-average baseline</span>
                    <span className="tabular-nums font-semibold">{fmtInt(forecast.baselineDiners)}</span>
                  </li>
                  {forecast.factors.map((f) => (
                    <li key={f.id}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-gray-900">{f.label}</span>
                        <span className="tabular-nums">
                          <span className={f.impactDiners < 0 ? 'text-amber-700' : 'text-brand-700'}>{signed(f.impactDiners)} diners</span>
                          <span className="ml-2 text-xs text-gray-400">×{fmtNum(f.multiplier, 3)}</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-gray-100" aria-hidden>
                        <div
                          className={`h-full rounded-full ${f.impactDiners < 0 ? 'bg-amber-500' : 'bg-brand-500'}`}
                          style={{ width: `${Math.max(2, (Math.abs(f.impactDiners) / maxImpact) * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{f.description}</p>
                    </li>
                  ))}
                  <li className="flex items-baseline justify-between gap-3 border-t border-gray-100 pt-3 text-sm">
                    <span className="font-semibold text-gray-900">Forecast diners</span>
                    <span className="tabular-nums text-lg font-semibold text-brand-800">{fmtInt(forecast.predictedDiners)}</span>
                  </li>
                </ol>
              </Card>

              <Card title="Forecast vs historical-average baseline" description="Baseline demand = average diners × each item's historical share of diners.">
                <BaselineComparisonChart items={forecast.items} />
              </Card>
            </div>

            <Notice tone="info" title="How this estimate is produced">
              {forecast.method} The same inputs always give the same result. Predictions are estimates, not guarantees, and the kitchen manager makes the final preparation decision.
            </Notice>
          </>
        )}

        <SyntheticNote />
      </div>
    </>
  );
}
