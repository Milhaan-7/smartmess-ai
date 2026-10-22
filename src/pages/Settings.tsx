import { useState } from 'react';
import { Database, RotateCcw, Save, Server } from 'lucide-react';
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
    notify('Preferences saved for this demo session. They apply to forecasts generated from now on.');
  };

  const doReset = () => {
    dispatch({ type: 'reset' });
    setConfirmReset(false);
    setForm(DEFAULT_SETTINGS);
    setErrors({});
    notify('Demo data reset to original baseline dataset.');
  };

  return (
    <>
      <PageHeader title="Settings" description="Institution details, planning preferences and forecast configuration. Saved in browser local storage in demo mode (or PostgreSQL when configured)." />

      <form onSubmit={save} noValidate className="grid gap-4 xl:grid-cols-2">
        <Card title="Institution" description="Institution details for this mess facility.">
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
            <span className="text-xs text-gray-500">Saved in browser localStorage for this demo environment.</span>
          </div>
        </Card>
      </form>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Forecast configuration" description="Read-only. Deterministic baseline forecasting engine.">
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
                <div className="flex-1"><p className="font-medium text-gray-900">Meal and menu data</p><p className="text-gray-600">Synthetic 28-day baseline dataset persisted in browser localStorage in demo mode (with optional PostgreSQL persistence when configured). Local demo storage does not sync across separate devices.</p></div>
                <Badge tone="brand">Synthetic / Local Demo</Badge>
              </li>
              <li className="flex items-start gap-3 py-3 last:pb-0">
                <Server size={18} className="mt-0.5 text-gray-500" aria-hidden />
                <div className="flex-1"><p className="font-medium text-gray-900">Forecasting service</p><p className="text-gray-600">Deterministic rule-based baseline model running over completed meal history (not machine learning).</p></div>
                <Badge tone="neutral">Deterministic Rule Engine</Badge>
              </li>
            </ul>
            <Notice tone="info" className="mt-4" title="Demonstration Environment Disclosure">
              Database persistence is currently unconfigured; menus, approvals, actuals, and settings are shared across roles within this browser via localStorage. Forecasts are calculated using deterministic historical demand averages and configured buffer rules.
            </Notice>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
                <p className="text-[13px] text-gray-600">Restore factory baseline configuration and demo data.</p>
                <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}><RotateCcw size={14} aria-hidden /> Reset demo data</Button>
              </div>
            </Card>

            <Card title="n8n Workflow Automation" description="External webhook automation for plan approval alerts.">
              <ul className="divide-y divide-gray-100 text-[13px]">
                <li className="flex items-start gap-3 py-2">
                  <Server size={18} className="mt-0.5 text-amber-600" aria-hidden />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Plan Approval Webhook</p>
                    <p className="text-gray-600">Triggers external n8n workflows upon plan approval to dispatch kitchen notifications.</p>
                  </div>
                  <Badge tone="amber">NOT CONNECTED</Badge>
                </li>
              </ul>
              <p className="mt-3 text-xs text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <strong>Configuration Status:</strong> <code>N8N_WEBHOOK_URL</code> environment variable is unconfigured in this workspace preview. Integration point is ready for production hookup.
              </p>
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
