import { useState } from 'react';
import { CalendarPlus, Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import type { MealType, Menu } from '../types';
import { useAppStore } from '../store/AppStore';
import { useToast } from '../components/common/Toast';
import { DEMO_TODAY, MEAL_META, MEAL_ORDER } from '../lib/constants';
import { formatLong, isValidDateString } from '../lib/dates';
import { fmtNum } from '../lib/format';
import { useRoute } from '../lib/router';
import { deletionPolicy, findMenu, menusOnDate } from '../services/menuService';
import { recordId } from '../services/operationsService';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/Badge';
import { MonthCalendar } from '../components/common/MonthCalendar';
import { EmptyState } from '../components/common/EmptyState';
import { MenuFormModal } from '../components/common/MenuFormModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import { SyntheticNote } from '../components/common/Notice';

type FormState = { menu?: Menu; presetMeal?: MealType } | null;

export default function Menus() {
  const { state, dispatch, currentUser } = useAppStore();
  const { notify } = useToast();
  const { params } = useRoute();
  const { menus, records } = state;
  const paramDate = params.get('date');
  const [selected, setSelected] = useState(isValidDateString(paramDate) ? paramDate : DEMO_TODAY);
  const [form, setForm] = useState<FormState>(null);
  const [toDelete, setToDelete] = useState<Menu | null>(null);

  const isManager = currentUser?.role === 'manager';
  const isStudent = currentUser?.role === 'student';

  const hasPlan = (date: string, meal: MealType) => records.some((r) => r.id === recordId(date, meal));
  const dayMenus = menusOnDate(menus, selected);

  const save = (menu: Menu, previousId?: string) => {
    if (!isManager) return;
    dispatch(previousId ? { type: 'menu/update', previousId, menu } : { type: 'menu/add', menu });
    setForm(null);
    setSelected(menu.date);
    notify(`${MEAL_META[menu.meal].label} menu ${previousId ? 'updated' : 'added'} for ${formatLong(menu.date)}.`);
  };

  const policy = toDelete ? deletionPolicy(toDelete, records) : null;

  const confirmDelete = () => {
    if (!isManager || !toDelete || !policy || policy.kind === 'blocked') return;
    dispatch({ type: 'menu/delete', id: toDelete.id });
    notify(
      `${MEAL_META[toDelete.meal].label} menu deleted for ${formatLong(toDelete.date)}${policy.kind === 'removes-plan' ? ', together with its unapproved forecast' : ''}.`,
    );
    setToDelete(null);
  };

  return (
    <>
      <PageHeader
        title={isStudent ? 'Weekly Menus' : 'Menus'}
        description={
          isStudent
            ? 'Browse daily breakfast, lunch and dinner menus across the week.'
            : 'Plan what is served each day. Forecasts estimate demand for every item on a menu.'
        }
        actions={
          isManager ? (
            <Button variant="primary" onClick={() => setForm({})}>
              <Plus size={16} aria-hidden /> Add Menu
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card title="Calendar" description="Select a date to view its menus.">
          <MonthCalendar
            selected={selected}
            today={DEMO_TODAY}
            onSelect={setSelected}
            mealCount={(d) => menusOnDate(menus, d).length}
          />
        </Card>

        <div className="space-y-4">
          <h2 className="text-base font-semibold text-gray-900">{formatLong(selected)}</h2>
          {dayMenus.length === 0 && (
            <EmptyState
              icon={UtensilsCrossed}
              title="No menus on this date"
              description={isManager ? 'Add breakfast, lunch or dinner to start forecasting for this day.' : 'No menus have been published for this date yet.'}
              action={
                isManager ? (
                  <Button variant="primary" onClick={() => setForm({})}>
                    <CalendarPlus size={15} aria-hidden /> Add menu for this date
                  </Button>
                ) : undefined
              }
            />
          )}
          {MEAL_ORDER.map((meal) => {
            const menu = findMenu(menus, selected, meal);
            const rec = records.find((r) => r.id === recordId(selected, meal));
            if (!menu && dayMenus.length === 0) return null;
            return (
              <Card
                key={meal}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {MEAL_META[meal].label}
                    <span className="text-[13px] font-normal text-gray-500">{MEAL_META[meal].time}</span>
                    {!isStudent && rec && <StatusBadge status={rec.status} />}
                  </span>
                }
                actions={
                  menu && isManager ? (
                    <>
                      <Button size="sm" onClick={() => setForm({ menu })} aria-label={`Edit ${MEAL_META[meal].label} menu`}><Pencil size={14} aria-hidden /> Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => setToDelete(menu)} aria-label={`Delete ${MEAL_META[meal].label} menu`} className="text-red-600 hover:bg-red-50"><Trash2 size={14} aria-hidden /> Delete</Button>
                    </>
                  ) : undefined
                }
              >
                {menu ? (
                  <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    {menu.items.map((i) => (
                      <li key={i.id} className="flex items-baseline justify-between gap-3 border-b border-gray-100 py-1.5 text-sm last:border-0">
                        <span className="text-gray-900">{i.name}</span>
                        <span className="text-xs tabular-nums text-gray-500">{fmtNum(i.kgPerPortion, 2)} kg / portion</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] text-gray-500">No {MEAL_META[meal].label.toLowerCase()} menu yet.</p>
                    {isManager && (
                      <Button size="sm" onClick={() => setForm({ presetMeal: meal })}><Plus size={14} aria-hidden /> Add {MEAL_META[meal].label.toLowerCase()}</Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <SyntheticNote className="mt-4" />

      {isManager && form && (
        <MenuFormModal
          menu={form.menu}
          presetDate={selected}
          presetMeal={form.presetMeal}
          allMenus={menus}
          hasPlan={hasPlan}
          onClose={() => setForm(null)}
          onSave={save}
        />
      )}
      {toDelete && policy?.kind === 'blocked' && (
        <Modal
          title="This menu can't be deleted"
          onClose={() => setToDelete(null)}
          footer={<Button variant="primary" onClick={() => setToDelete(null)}>Close</Button>}
        >
          <p className="text-sm text-gray-600">
            The {MEAL_META[toDelete.meal].label.toLowerCase()} plan for {formatLong(toDelete.date)} is{' '}
            <strong>{policy.record.status}</strong>. Menus with approved or completed plans are kept so the kitchen’s records stay consistent.
            If the dishes changed, use Edit instead.
          </p>
        </Modal>
      )}
      {toDelete && policy && policy.kind !== 'blocked' && (
        <ConfirmDialog
          title={policy.kind === 'removes-plan' ? 'Delete this menu and its forecast?' : 'Delete this menu?'}
          confirmLabel={policy.kind === 'removes-plan' ? 'Delete menu and forecast' : 'Delete menu'}
          danger
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        >
          <p>
            This removes the {MEAL_META[toDelete.meal].label.toLowerCase()} menu for {formatLong(toDelete.date)} ({toDelete.items.length} items).
            {policy.kind === 'removes-plan' &&
              ' A forecast for this meal is awaiting approval. It will be removed too. Nothing has been approved or recorded for it.'}
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
