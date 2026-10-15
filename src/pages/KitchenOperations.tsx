import { useState } from 'react';
import { CalendarOff, ClipboardX, Loader2 } from 'lucide-react';
import type { MealType } from '../types';
import { useAppStore } from '../store/AppStore';
import { useToast } from '../components/common/Toast';
import { DEMO_TODAY, MEAL_META, MEAL_OPTIONS } from '../lib/constants';
import { formatLong, isValidDateString } from '../lib/dates';
import { hrefFor, useRoute } from '../lib/router';
import { findMenu } from '../services/menuService';
import { runForecast } from '../services/mockForecastService';
import { recordFromForecast, recordId } from '../services/operationsService';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Button, ButtonLink } from '../components/common/Button';
import { Field, TextInput } from '../components/common/Field';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { EmptyState } from '../components/common/EmptyState';
import { Notice, SyntheticNote } from '../components/common/Notice';
import { PlanEditor } from '../components/operations/PlanEditor';

export default function KitchenOperations() {
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
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validDate = isValidDateString(date);
  const menu = validDate ? findMenu(menus, date, meal) : undefined;
  const record = validDate ? records.find((r) => r.id === recordId(date, meal)) : undefined;

  const generate = async () => {
    if (!menu) return;
    setGenerating(true);
    setError(null);
    try {
      const forecast = await runForecast({ date, meal, menu, history: records, settings, context: 'normal' });
      dispatch({ type: 'record/upsert', record: recordFromForecast(forecast) });
      notify('Forecast generated. Review the quantities below.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The forecast could not be calculated.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Kitchen Operations"
        description="Review forecast-based preparation quantities, confirm the final plan, then record what was actually prepared, consumed and left over."
      />

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Service date" error={!validDate ? 'Choose a valid date' : undefined} className="w-48">
            {(p) => <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} {...p} />}
          </Field>
          <div>
            <span className="mb-1 block text-[13px] font-medium text-gray-700">Meal</span>
            <SegmentedControl label="Meal" options={MEAL_OPTIONS} value={meal} onChange={setMeal} />
          </div>
          {validDate && (
            <p className="pb-1.5 text-[13px] text-gray-600">
              <span className="font-medium text-gray-900">{MEAL_META[meal].label}</span> · {MEAL_META[meal].time} · {formatLong(date)}
            </p>
          )}
        </div>
      </Card>

      <div className="mt-4 space-y-4">
        {error && <Notice tone="error" title="Forecast could not be calculated">{error}</Notice>}

        {!menu && validDate && (
          <EmptyState
            icon={CalendarOff}
            title="No menu for this meal"
            description="Create the menu first so the forecast can estimate demand for each dish."
            action={<ButtonLink variant="primary" href={hrefFor('menus')}>Go to Menus</ButtonLink>}
          />
        )}

        {menu && !record && (
          <EmptyState
            icon={ClipboardX}
            title="No forecast for this meal yet"
            description="Generate a forecast to get suggested preparation quantities, or open the Forecasts page to adjust planning context first."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={() => void generate()} disabled={generating}>
                  {generating && <Loader2 size={15} className="animate-spin" aria-hidden />} Generate forecast
                </Button>
                <ButtonLink href={hrefFor('forecasts', { date, meal })}>Open Forecasts</ButtonLink>
              </div>
            }
          />
        )}

        {record && (
          <PlanEditor
            key={`${record.id}-${record.status}-${record.approvedAt ?? ''}-${record.completedAt ?? ''}`}
            record={record}
            onSave={(r) => dispatch({ type: 'record/upsert', record: r })}
          />
        )}

        <SyntheticNote />
      </div>
    </>
  );
}
