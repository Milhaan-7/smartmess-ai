import { useMemo, useState } from 'react';
import { Check, CheckCheck, ClipboardCheck, ClipboardList, RotateCcw, Save, Scale, Users } from 'lucide-react';
import type { MealRecord, RecordItem } from '../../types';
import { fmtInt, fmtKg, fmtNum, fmtPct, signed } from '../../lib/format';
import { formatDateTime, formatMedium } from '../../lib/dates';
import { DEMO_TODAY } from '../../lib/constants';
import { cx } from '../../lib/cx';
import { approvedKg, suggestedKg } from '../../services/metrics';
import { approvePlan, canRecordResults, parseQuantity, reopenPlan, saveActuals } from '../../services/operationsService';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge, StatusBadge } from '../common/Badge';
import { DataTable, type Column } from '../common/DataTable';
import { Field, inputClass, TextInput } from '../common/Field';
import { MetricCard } from '../common/MetricCard';
import { Notice } from '../common/Notice';
import { useToast } from '../common/Toast';

interface PlanEditorProps {
  record: MealRecord;
  onSave: (record: MealRecord) => void;
}

type Draft = Record<string, string>;
const toDraft = (items: RecordItem[], pick: (i: RecordItem) => number | null): Draft =>
  Object.fromEntries(items.map((i) => [i.itemId, pick(i) === null ? '' : String(pick(i))]));

function QtyInput({ value, onChange, label, error, disabled }: { value: string; onChange: (v: string) => void; label: string; error?: string; disabled?: boolean }) {
  return (
    <div className="inline-block text-right">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value)}
        className={cx(inputClass(Boolean(error)), 'w-20 text-right tabular-nums')}
      />
      {error && <p role="alert" className="mt-0.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function PlanEditor({ record, onSave }: PlanEditorProps) {
  const { notify } = useToast();
  const isRecommended = record.status === 'recommended';
  // Results can only be entered once the service date has arrived (relative to the demo planning date).
  const resultsAllowed = canRecordResults(record, DEMO_TODAY);

  const [final, setFinal] = useState<Draft>(() => toDraft(record.items, (i) => i.approvedPrep ?? i.suggestedPrep));
  const [reviewed, setReviewed] = useState<Record<string, boolean>>(() => Object.fromEntries(record.items.map((i) => [i.itemId, !isRecommended])));
  const [prepared, setPrepared] = useState<Draft>(() => toDraft(record.items, (i) => i.prepared));
  const [consumed, setConsumed] = useState<Draft>(() => toDraft(record.items, (i) => i.consumed));
  const [diners, setDiners] = useState(record.actualDiners === null ? '' : String(record.actualDiners));
  const [showResultErrors, setShowResultErrors] = useState(false);

  const setOne = (setter: (fn: (d: Draft) => Draft) => void, id: string, v: string) => setter((d) => ({ ...d, [id]: v }));

  const accept = (item: RecordItem) => {
    setOne(setFinal, item.itemId, String(item.suggestedPrep));
    setReviewed((r) => ({ ...r, [item.itemId]: true }));
  };
  const acceptAll = () => {
    setFinal(Object.fromEntries(record.items.map((i) => [i.itemId, String(i.suggestedPrep)])));
    setReviewed(Object.fromEntries(record.items.map((i) => [i.itemId, true])));
  };
  const edit = (id: string, v: string) => {
    setOne(setFinal, id, v);
    setReviewed((r) => ({ ...r, [id]: true }));
  };

  const planErrors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const i of record.items) {
      const r = parseQuantity(final[i.itemId] ?? '');
      if (!r.ok) out[i.itemId] = r.error;
    }
    return out;
  }, [final, record.items]);

  const unreviewed = record.items.filter((i) => !reviewed[i.itemId]).length;
  const modifiedCount = record.items.filter((i) => {
    const r = parseQuantity(final[i.itemId] ?? '');
    return r.ok && r.value !== i.suggestedPrep;
  }).length;

  const confirmPlan = () => {
    if (Object.keys(planErrors).length > 0) {
      notify('Fix the highlighted quantities before confirming.', 'error');
      return;
    }
    const quantities = Object.fromEntries(record.items.map((i) => [i.itemId, Number(final[i.itemId])]));
    onSave(approvePlan(record, quantities, new Date().toISOString()));
    notify(`Plan confirmed${modifiedCount ? ` with ${modifiedCount} modified ${modifiedCount === 1 ? 'quantity' : 'quantities'}` : ''}. You can now record actual results.`);
  };

  const revise = () => {
    onSave(reopenPlan(record));
    notify('Plan reopened for review. Previously entered results were cleared.');
  };

  const resultErrors = useMemo(() => {
    const out: Record<string, { prepared?: string; consumed?: string }> = {};
    for (const i of record.items) {
      const p = parseQuantity(prepared[i.itemId] ?? '');
      const c = parseQuantity(consumed[i.itemId] ?? '');
      const e: { prepared?: string; consumed?: string } = {};
      if (!p.ok) e.prepared = p.error;
      if (!c.ok) e.consumed = c.error;
      else if (p.ok && c.value > p.value) e.consumed = 'More than prepared';
      if (e.prepared || e.consumed) out[i.itemId] = e;
    }
    return out;
  }, [prepared, consumed, record.items]);
  const dinersParsed = parseQuantity(diners);
  const dinersError = dinersParsed.ok ? (dinersParsed.value > 5000 ? 'Too large' : undefined) : dinersParsed.error;

  const saveResults = () => {
    setShowResultErrors(true);
    if (dinersError || Object.keys(resultErrors).length > 0) {
      notify('Fix the highlighted values before saving results.', 'error');
      return;
    }
    const items = Object.fromEntries(
      record.items.map((i) => [i.itemId, { prepared: Number(prepared[i.itemId]), consumed: Number(consumed[i.itemId]) }]),
    );
    onSave(saveActuals(record, { actualDiners: Number(diners), items }, new Date().toISOString(), DEMO_TODAY));
    notify(
      record.date >= DEMO_TODAY
        ? 'Results saved. Today’s summary is updated. Accuracy, trend charts and the default Waste Analytics range cover days before the planning date, so this meal appears there from the next day or when the range is extended.'
        : 'Results saved. This meal is included in Waste Analytics and the accuracy metrics for its date range.',
    );
  };

  const fillPrepared = () => {
    setPrepared(Object.fromEntries(record.items.map((i) => [i.itemId, String(i.approvedPrep ?? '')])));
  };

  const leftoverFor = (i: RecordItem): number | null => {
    const p = parseQuantity(prepared[i.itemId] ?? '');
    const c = parseQuantity(consumed[i.itemId] ?? '');
    return p.ok && c.ok ? p.value - c.value : null;
  };

  // Totals in kg from the current drafts
  const n = record.items.length;
  const qtyOf = (d: Draft, id: string): number | null => {
    const r = parseQuantity(d[id] ?? '');
    return r.ok ? r.value : null;
  };
  // Σ quantity × kg per portion over the items that have a valid quantity, plus how many that is.
  const sumKg = (pick: (i: RecordItem) => number | null) => {
    let kg = 0;
    let entered = 0;
    for (const i of record.items) {
      const q = pick(i);
      if (q !== null) {
        kg += q * i.kgPerPortion;
        entered += 1;
      }
    }
    return { kg, entered };
  };
  const finalTot = sumKg((i) => qtyOf(final, i.itemId));
  const prepTot = sumKg((i) => qtyOf(prepared, i.itemId));
  const consTot = sumKg((i) => qtyOf(consumed, i.itemId));
  const leftTot = sumKg((i) => leftoverFor(i));
  const predictedTotKg = record.items.reduce((t, i) => t + i.predictedDemand * i.kgPerPortion, 0);
  const planComplete = finalTot.entered === n;
  const resultsComplete = prepTot.entered === n && consTot.entered === n;
  const invalidCount = n - finalTot.entered;
  const showResults = !isRecommended && resultsAllowed;

  const head = (label: string, unit: string) => (
    <span className="inline-block leading-tight">
      {label}
      <span className="block text-[11px] font-normal text-gray-400">{unit}</span>
    </span>
  );

  const columns: Column<RecordItem>[] = [
    {
      key: 'name',
      header: head('Food item', 'weight per portion'),
      sticky: true,
      cell: (i) => (
        <div>
          <p className="font-medium text-gray-900">{i.name}</p>
          <p className="text-xs text-gray-500">{fmtNum(i.kgPerPortion, 2)} kg / portion</p>
        </div>
      ),
    },
    {
      key: 'demand',
      header: head('Predicted demand', 'portions'),
      align: 'right',
      cell: (i) => (
        <div>
          <p className="font-medium">{fmtInt(i.predictedDemand)}</p>
          <p className="text-xs text-gray-500">{fmtInt(i.lowerDemand)}–{fmtInt(i.upperDemand)}</p>
        </div>
      ),
    },
    { key: 'sugg', header: head('Suggested prep', 'portions'), align: 'right', cell: (i) => <span className="font-semibold text-brand-800">{fmtInt(i.suggestedPrep)}</span> },
    {
      key: 'final',
      header: head('Final approved prep', 'portions'),
      align: 'right',
      cell: (i) =>
        isRecommended ? (
          <div className="flex items-start justify-end gap-2">
            <QtyInput
              value={final[i.itemId] ?? ''}
              onChange={(v) => edit(i.itemId, v)}
              label={`${i.name} final approved quantity`}
              error={planErrors[i.itemId]}
            />
            <div className="flex h-9 items-center">
              {reviewed[i.itemId] ? (
                parseQuantity(final[i.itemId] ?? '').ok && Number(final[i.itemId]) !== i.suggestedPrep ? (
                  <Badge tone="amber">Modified</Badge>
                ) : (
                  <Badge tone="brand"><Check size={12} aria-hidden /> Accepted</Badge>
                )
              ) : (
                <Button size="sm" onClick={() => accept(i)} aria-label={`Accept suggested quantity for ${i.name}`}>Accept</Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <span className="font-semibold">{fmtInt(i.approvedPrep ?? 0)}</span>
            {i.approvedPrep !== i.suggestedPrep && <Badge tone="amber">Modified</Badge>}
          </div>
        ),
    },
    {
      key: 'prepared',
      header: head('Actually prepared', 'portions'),
      align: 'right',
      cell: (i) =>
        showResults ? (
          <QtyInput value={prepared[i.itemId] ?? ''} onChange={(v) => setOne(setPrepared, i.itemId, v)} label={`${i.name} quantity prepared`} error={showResultErrors ? resultErrors[i.itemId]?.prepared : undefined} />
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'consumed',
      header: head('Consumed', 'portions'),
      align: 'right',
      cell: (i) =>
        showResults ? (
          <QtyInput value={consumed[i.itemId] ?? ''} onChange={(v) => setOne(setConsumed, i.itemId, v)} label={`${i.name} quantity consumed`} error={showResultErrors || (consumed[i.itemId] ?? '') !== '' ? resultErrors[i.itemId]?.consumed : undefined} />
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'left',
      header: head('Left over', 'portions'),
      align: 'right',
      cell: (i) => {
        const l = leftoverFor(i);
        if (!showResults || l === null) return <span className="text-gray-300">—</span>;
        return <span className={cx('font-semibold', l < 0 ? 'text-red-600' : 'text-gray-900')}>{fmtInt(l)}</span>;
      },
    },
  ];

  const pendingResult = !isRecommended && record.status !== 'completed';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label="Predicted diners" value={fmtInt(record.predictedDiners)} sub={`Likely range ${fmtInt(record.lowerDiners)}–${fmtInt(record.upperDiners)}`} />
        <MetricCard icon={ClipboardList} label="Suggested prep" value={fmtKg(suggestedKg(record))} sub="Total across items, from the forecast" />
        <MetricCard
          icon={ClipboardCheck}
          label={isRecommended ? 'Plan as currently entered' : 'Final approved prep'}
          value={isRecommended ? (planComplete ? fmtKg(finalTot.kg) : 'Incomplete') : fmtKg(approvedKg(record))}
          sub={
            isRecommended
              ? planComplete
                ? `${modifiedCount} modified · ${unreviewed} not yet reviewed`
                : `${finalTot.entered} of ${n} quantities valid · ${unreviewed} not yet reviewed`
              : `Approved ${formatDateTime(record.approvedAt)}`
          }
        />
        <MetricCard
          icon={Scale}
          label="Recorded leftover"
          value={showResults ? (resultsComplete ? fmtKg(leftTot.kg) : 'Incomplete') : '—'}
          sub={
            showResults
              ? resultsComplete
                ? prepTot.kg > 0
                  ? `Waste rate ${fmtPct(leftTot.kg / prepTot.kg)}`
                  : 'Nothing prepared'
                : `${leftTot.entered} of ${n} items entered`
              : 'Available after results are saved'
          }
          definition="Leftover = prepared − consumed, per item, converted to kg. Waste rate = leftover kg ÷ prepared kg."
        />
      </div>

      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            Preparation plan <StatusBadge status={record.status} />
          </span>
        }
        description={
          isRecommended
            ? 'Review each recommendation: accept it or enter your own quantity. Then confirm the final plan.'
            : record.status === 'approved'
              ? resultsAllowed
                ? `Plan confirmed ${formatDateTime(record.approvedAt)}. Enter what was actually prepared and consumed after service.`
                : `Plan confirmed ${formatDateTime(record.approvedAt)}. Actual results can be recorded on or after the service date.`
              : `Results recorded ${formatDateTime(record.completedAt)}. You can correct them and save again.`
        }
        actions={
          isRecommended ? (
            <>
              <Button onClick={acceptAll}><CheckCheck size={15} aria-hidden /> Accept all recommendations</Button>
              <Button variant="primary" onClick={confirmPlan} disabled={unreviewed > 0 || invalidCount > 0}>
                <ClipboardCheck size={15} aria-hidden />{' '}
                {unreviewed > 0
                  ? `Review ${unreviewed} more to confirm`
                  : invalidCount > 0
                    ? `Fix ${invalidCount} ${invalidCount === 1 ? 'quantity' : 'quantities'} to confirm`
                    : 'Confirm final plan'}
              </Button>
            </>
          ) : (
            <>
              {record.status === 'approved' && <Button onClick={revise}><RotateCcw size={15} aria-hidden /> Revise plan</Button>}
              {showResults && (
                <>
                  <Button onClick={fillPrepared}>Fill prepared = approved</Button>
                  <Button variant="primary" onClick={saveResults}><Save size={15} aria-hidden /> {record.status === 'completed' ? 'Update results' : 'Save results'}</Button>
                </>
              )}
            </>
          )
        }
        flush
      >
        {isRecommended && (
          <div className="border-b border-gray-100 px-5 py-3">
            <Notice tone="info">
              Suggestions are estimates. Nothing is approved until you select Confirm final plan. Quantities are whole portions and cannot be negative.
            </Notice>
            {invalidCount > 0 && (
              <Notice tone="warning" title="Plan incomplete" className="mt-2">
                {invalidCount} {invalidCount === 1 ? 'item has' : 'items have'} a missing or invalid quantity. Totals are not shown until every quantity is valid; a missing quantity is never counted as zero.
              </Notice>
            )}
          </div>
        )}
        {!isRecommended && !resultsAllowed && (
          <div className="border-b border-gray-100 px-5 py-3">
            <Notice tone="info" title="Results can’t be recorded yet">
              The service date ({formatMedium(record.date)}) is after the demo planning date ({formatMedium(DEMO_TODAY)}). Prepared and consumed quantities and actual diners can be entered on or after the service date.
            </Notice>
          </div>
        )}
        {showResults && (
          <div className="grid gap-4 border-b border-gray-100 px-5 py-4 sm:grid-cols-[14rem_1fr] sm:items-end">
            <Field label="Actual diners served" error={showResultErrors ? dinersError : undefined} hint={dinersParsed.ok && !dinersError ? `Forecast error: ${signed(record.predictedDiners - dinersParsed.value)} (predicted − actual)` : 'Whole number of diners'}>
              {(p) => <TextInput type="number" inputMode="numeric" min={0} step={1} value={diners} onChange={(e) => setDiners(e.target.value)} {...p} />}
            </Field>
            {pendingResult && <p className="text-xs text-gray-500">Leftover is calculated as prepared − consumed and cannot be negative. Consumed cannot exceed prepared.</p>}
          </div>
        )}
        <DataTable
          caption="Preparation plan with predicted demand, suggested, approved, prepared, consumed and leftover quantities"
          columns={columns}
          rows={record.items}
          rowKey={(i) => i.itemId}
          compact
          footer={
            <tr>
              <th scope="row" className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5 text-left font-medium">Total (kg)</th>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(predictedTotKg)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(suggestedKg(record))}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{isRecommended ? (planComplete ? fmtNum(finalTot.kg) : 'Incomplete') : fmtNum(approvedKg(record))}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{showResults ? (prepTot.entered === n ? fmtNum(prepTot.kg) : 'Incomplete') : '—'}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{showResults ? (consTot.entered === n ? fmtNum(consTot.kg) : 'Incomplete') : '—'}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{showResults ? (resultsComplete ? fmtNum(leftTot.kg) : 'Incomplete') : '—'}</td>
            </tr>
          }
        />
        <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">Item rows are in portions; the Total row and the cards above are in kg (portions × kg per portion, one decimal). Leftover = prepared − consumed.</p>
      </Card>
    </div>
  );
}
