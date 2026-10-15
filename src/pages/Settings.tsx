import { useState } from 'react';
import { AlertTriangle, Database, RotateCcw, Save, Server } from 'lucide-react';
import type { MealType, Settings as SettingsType } from '../types';
import { useAppStore } from '../store/AppStore';
import { useToast } from '../components/common/Toast';
import { MEAL_OPTIONS, SPECIAL_DAYS } from '../lib/constants';
import { DEFAULT_SETTINGS } from '../data/mockData';
import { FORECAST_CONFIG, FORECAST_METHOD } from '../services/mockForecastService';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Field, Select, TextInput } from '../components/common/Field';
import { Badge } from '../components/common/Badge';
import { Notice } from '../components/common/Notice';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

type Errors = Partial<Record<keyof SettingsType, string>>;

function validate(s: SettingsType): Errors {
  const e: Errors = {};
  if (!s.institutionName.trim()) e.institutionName = 'Required';
  if (!s.messName.trim()) e.messName = 'Required';
  if (!s.messManager.trim()) e.messManager = 'Required';
  if (!(s.prepBufferPct >= 0 && s.prepBufferPct <= 50)) e.prepBufferPct = 'Enter 0 to 50';
  if (!Number.isInteger(s.serviceCapacity) || s.serviceCapacity < 1 || s.serviceCapacity > 5000) e.serviceCapacity = 'Whole number from 1 to 5000';
  if (![1, 5, 10].includes(s.roundingStep)) e.roundingStep = 'Choose 1, 5 or 10';
  if (!(s.defaultUptake > 0 && s.defaultUptake <= 1)) e.defaultUptake = 'Enter a value above 0 up to 1';
  if (!Number.isInteger(s.upcomingHorizonDays) || s.upcomingHorizonDays < 1 || s.upcomingHorizonDays > 14) e.upcomingHorizonDays = 'Whole number from 1 to 14';
  return e;
}

const API_SKETCH = `POST /api/v1/forecasts
{
  "institution_id": "greenfield-north-mess",
  "service_date": "2026-10-15",
  "meal": "lunch",
  "menu": [{ "item_id": "...", "name": "Steamed Rice", "kg_per_portion": 0.3 }],
  "context": "normal"
}

200 OK
{
  "predicted_diners": 571,
  "interval": { "lower": 551, "upper": 591 },
  "items": [{ "item_id": "...", "predicted_demand": 514, "lower": 497, "upper": 532 }],
  "explanation": [{ "factor": "weekday", "impact_diners": 6 }],
  "model_version": "..."
}`;

export default function Settings() {
  const { state, dispatch } = useAppStore();
  const { notify } = useToast();
  const [form, setForm] = useState<SettingsType>(state.settings);
  const [errors, setErrors] = useState<Errors>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(state.settings);

  const set = <K extends keyof SettingsType>(key: K, value: SettingsType[K]) => setForm((f) => ({ ...f, [key]: value }));
  const num = (v: string) => (v === '' ? NaN : Number(v));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      notify('Fix the highlighted fields to save.', 'error');
      return;
    }
    dispatch({ type: 'settings/update', settings: form });
    notify('Preferences saved for this session. They apply to forecasts you run from now on.');
  };

  const doReset = () => {
    dispatch({ type: 'reset' });
    setConfirmReset(false);
    setForm(DEFAULT_SETTINGS);
    setErrors({});
    notify('Demo data reset to the original synthetic dataset.');
  };

  return (
    <>
      <PageHeader title="Settings" description="Institution details, planning preferences and forecast configuration. Changes are kept in this browser session only." />

      <form onSubmit={save} noValidate className="grid gap-4 xl:grid-cols-2">
        <Card title="Institution" description="Fictional institution used for the demo.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Institution name" error={errors.institutionName}>{(p) => <TextInput value={form.institutionName} onChange={(e) => set('institutionName', e.target.value)} {...p} />}</Field>
            <Field label="Mess / kitchen" error={errors.messName}>{(p) => <TextInput value={form.messName} onChange={(e) => set('messName', e.target.value)} {...p} />}</Field>
            <Field label="Location" className="sm:col-span-2">{(p) => <TextInput value={form.location} onChange={(e) => set('location', e.target.value)} {...p} />}</Field>
            <Field label="Mess manager (demo user)" error={errors.messManager}>{(p) => <TextInput value={form.messManager} onChange={(e) => set('messManager', e.target.value)} {...p} />}</Field>
          </div>
        </Card>

        <Card title="Planning preferences" description="Used when a forecast is generated.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default preparation buffer (%)" error={errors.prepBufferPct} hint="Added on top of predicted demand">
              {(p) => <TextInput type="number" step="1" min="0" max="50" value={Number.isNaN(form.prepBufferPct) ? '' : form.prepBufferPct} onChange={(e) => set('prepBufferPct', num(e.target.value))} {...p} />}
            </Field>
            <Field label="Expected service capacity (diners per meal)" error={errors.serviceCapacity} hint="Forecasts are capped at this number">
              {(p) => <TextInput type="number" step="1" min="1" value={Number.isNaN(form.serviceCapacity) ? '' : form.serviceCapacity} onChange={(e) => set('serviceCapacity', num(e.target.value))} {...p} />}
            </Field>
            <Field label="Round suggested quantities up to" error={errors.roundingStep}>
              {(p) => (
                <Select value={form.roundingStep} onChange={(e) => set('roundingStep', Number(e.target.value))} {...p}>
                  <option value={1}>1 portion</option>
                  <option value={5}>5 portions</option>
                  <option value={10}>10 portions</option>
                </Select>
              )}
            </Field>
            <Field label="Default share of diners for new items" error={errors.defaultUptake} hint="0–1, used when an item has no history">
              {(p) => <TextInput type="number" step="0.05" min="0" max="1" value={Number.isNaN(form.defaultUptake) ? '' : form.defaultUptake} onChange={(e) => set('defaultUptake', num(e.target.value))} {...p} />}
            </Field>
            <Field label="Default meal to review">
              {(p) => (
                <Select value={form.defaultReviewMeal} onChange={(e) => set('defaultReviewMeal', e.target.value as MealType)} {...p}>
                  {MEAL_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Upcoming meals window (days)" error={errors.upcomingHorizonDays} hint="Shown on the dashboard">
              {(p) => <TextInput type="number" step="1" min="1" max="14" value={Number.isNaN(form.upcomingHorizonDays) ? '' : form.upcomingHorizonDays} onChange={(e) => set('upcomingHorizonDays', num(e.target.value))} {...p} />}
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            <Button variant="primary" type="submit" disabled={!dirty}><Save size={15} aria-hidden /> Save preferences</Button>
            <Button onClick={() => { setForm(state.settings); setErrors({}); }} disabled={!dirty}>Discard changes</Button>
            <span className="text-xs text-gray-500">Saved in this session only. Refreshing the page restores defaults.</span>
          </div>
        </Card>
      </form>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Forecast configuration" description="Read-only. This is how the demo forecast works.">
          <p className="text-[13px] text-gray-600">{FORECAST_METHOD}</p>
          <dl className="mt-4 divide-y divide-gray-100 text-[13px]">
            {[
              ['History window', `Latest ${FORECAST_CONFIG.historyWindowRecords} completed meals of the same type (minimum ${FORECAST_CONFIG.minRecords})`],
              ['Baseline', 'Mean of the latest 14 completed same-meal diner counts before the service date (at least 5 needed). The same definition is used for stored baselines and for evaluation.'],
              ['Learned adjustments', `Day of week, recent trend (last ${FORECAST_CONFIG.trendRecords} meals), menu effect; each pulled ${FORECAST_CONFIG.shrinkage * 100}% of the way back toward no change`],
              ['Likely range', `Forecast ± ${FORECAST_CONFIG.bandMultiplier} × recent mean absolute error (minimum ±${FORECAST_CONFIG.minBandDiners} diners). Heuristic, not a statistical interval`],
              ['Item demand', 'Predicted diners × the share of diners who historically took the item'],
              ['Recommended prep', 'Item demand × (1 + buffer), rounded up to the chosen step'],
            ].map(([k, v]) => (
              <div key={k} className="grid gap-1 py-2 sm:grid-cols-[10rem_1fr]"><dt className="font-medium text-gray-900">{k}</dt><dd className="text-gray-600">{v}</dd></div>
            ))}
          </dl>
          <h3 className="mt-4 text-[13px] font-semibold text-gray-900">Planning context assumptions</h3>
          <ul className="mt-1 text-[13px] text-gray-600">
            {Object.values(SPECIAL_DAYS).map((c) => (
              <li key={c.label} className="flex justify-between gap-3 border-b border-gray-100 py-1.5 last:border-0"><span>{c.label}</span><span className="tabular-nums">×{c.multiplier.toFixed(2)}</span></li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card title="Data sources" description="Where the numbers on every page come from.">
            <ul className="divide-y divide-gray-100 text-[13px]">
              <li className="flex items-start gap-3 py-3 first:pt-0">
                <Database size={18} className="mt-0.5 text-brand-700" aria-hidden />
                <div className="flex-1"><p className="font-medium text-gray-900">Meal and menu data</p><p className="text-gray-600">Synthetic demonstration dataset generated in the browser: 28 days of history (including synthetic stored forecasts, which are not model output) plus a week of menus.</p></div>
                <Badge tone="brand">Synthetic</Badge>
              </li>
              <li className="flex items-start gap-3 py-3 last:pb-0">
                <Server size={18} className="mt-0.5 text-gray-500" aria-hidden />
                <div className="flex-1"><p className="font-medium text-gray-900">Forecasting service</p><p className="text-gray-600">Not connected. A deterministic rule-based function runs in the browser instead.</p></div>
                <Badge tone="amber">Not connected</Badge>
              </li>
            </ul>
            <Notice tone="warning" className="mt-4" title="Real model integration is not connected yet">
              No machine-learning model is running and no real institutional data is used. To connect a backend, replace <code className="rounded bg-white/60 px-1">runForecast</code> in <code className="rounded bg-white/60 px-1">services/mockForecastService.ts</code> with a call to the FastAPI service.
            </Notice>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <p className="text-[13px] text-gray-600">Discard menus, plans and results you entered and reload the original dataset.</p>
              <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}><RotateCcw size={14} aria-hidden /> Reset demo data</Button>
            </div>
          </Card>

          <Card title="Planned API contract" description="A sketch for the backend team; not implemented.">
            <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100"><code>{API_SKETCH}</code></pre>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-500"><AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden /> Illustrative only. The real schema is decided when the service is built.</p>
          </Card>
        </div>
      </div>

      {confirmReset && (
        <ConfirmDialog title="Reset demo data?" confirmLabel="Reset data" danger onConfirm={doReset} onCancel={() => setConfirmReset(false)}>
          This replaces all menus, plans, results and settings with the original synthetic dataset and restores the default settings.
        </ConfirmDialog>
      )}
    </>
  );
}
