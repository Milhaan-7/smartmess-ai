import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { MealType, Menu } from '../../types';
import { MEAL_OPTIONS } from '../../lib/constants';
import { uid } from '../../lib/ids';
import {
  draftFromMenu,
  emptyDraft,
  getFoodSuggestions,
  menuFromDraft,
  validateMenuDraft,
  type MenuDraft,
  type MenuErrors,
} from '../../services/menuService';
import { Modal } from './Modal';
import { Button } from './Button';
import { Field, Select, TextInput } from './Field';
import { Notice } from './Notice';

interface MenuFormModalProps {
  /** Menu being edited; omit to create. */
  menu?: Menu;
  presetDate: string;
  presetMeal?: MealType;
  allMenus: Menu[];
  hasPlan: (date: string, meal: MealType) => boolean;
  onClose: () => void;
  /** `previousId` is set when an existing menu was edited. */
  onSave: (menu: Menu, previousId?: string) => void;
}

const suggestions = getFoodSuggestions();

export function MenuFormModal({ menu, presetDate, presetMeal, allMenus, hasPlan, onClose, onSave }: MenuFormModalProps) {
  const isEdit = Boolean(menu);
  const [draft, setDraft] = useState<MenuDraft>(() => (menu ? draftFromMenu(menu) : emptyDraft(presetDate, presetMeal ?? '')));
  const [errors, setErrors] = useState<MenuErrors | null>(null);
  // A plan is keyed by date + meal, so the original date and meal are locked while one exists.
  const lock = menu && hasPlan(menu.date, menu.meal) ? { date: menu.date, meal: menu.meal } : undefined;
  const listId = 'food-suggestions';

  const update = (next: MenuDraft) => {
    setDraft(next);
    if (errors) setErrors(validateMenuDraft(next, allMenus, menu?.id, lock));
  };
  const setItem = (key: string, patch: Partial<MenuDraft['items'][number]>) =>
    update({ ...draft, items: draft.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) });

  const onNameChange = (key: string, name: string) => {
    const match = suggestions.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
    const current = draft.items.find((i) => i.key === key);
    // Pre-fill the portion weight from the catalogue only if the user has not typed one.
    setItem(key, { name, ...(match && current && current.kg === '' ? { kg: String(match.kgPerPortion) } : {}) });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateMenuDraft(draft, allMenus, menu?.id, lock);
    setErrors(found);
    if (found) return;
    onSave(menuFromDraft(draft), menu?.id);
  };

  const planWarning = !lock && draft.meal && draft.date && hasPlan(draft.date, draft.meal as MealType);

  return (
    <Modal
      wide
      title={isEdit ? 'Edit menu' : 'Add menu'}
      description="Each item needs a name and the weight of one portion, used to convert portions to kilograms."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="menu-form">{isEdit ? 'Save changes' : 'Add menu'}</Button>
        </>
      }
    >
      <form id="menu-form" onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" error={errors?.date} hint={lock ? 'Locked: a forecast or plan exists for this meal.' : undefined}>
            {(p) => <TextInput type="date" value={draft.date} disabled={Boolean(lock)} onChange={(e) => update({ ...draft, date: e.target.value })} {...p} />}
          </Field>
          <Field label="Meal" error={errors?.meal}>
            {(p) => (
              <Select value={draft.meal} disabled={Boolean(lock)} onChange={(e) => update({ ...draft, meal: e.target.value as MealType | '' })} {...p}>
                <option value="">Select a meal</option>
                {MEAL_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            )}
          </Field>
        </div>

        {planWarning && (
          <Notice tone="warning">
            A forecast or plan already exists for this meal. Changing the menu does not update it; run the forecast again afterwards.
          </Notice>
        )}

        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-gray-700">Food items</legend>
          <datalist id={listId}>
            {suggestions.map((s) => <option key={s.name} value={s.name} />)}
          </datalist>
          <ul className="space-y-2">
            {draft.items.map((it, idx) => (
              <li key={it.key} className="grid grid-cols-[1fr_6.5rem_auto] items-start gap-2">
                <div>
                  <TextInput
                    list={listId}
                    placeholder="e.g. Steamed Rice"
                    aria-label={`Food item ${idx + 1} name`}
                    value={it.name}
                    invalid={Boolean(errors?.item[it.key]?.name)}
                    onChange={(e) => onNameChange(it.key, e.target.value)}
                  />
                  {errors?.item[it.key]?.name && <p className="mt-1 text-xs text-red-600">{errors.item[it.key].name}</p>}
                </div>
                <div>
                  <TextInput
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="kg"
                    aria-label={`Food item ${idx + 1} kilograms per portion`}
                    value={it.kg}
                    invalid={Boolean(errors?.item[it.key]?.kg)}
                    onChange={(e) => setItem(it.key, { kg: e.target.value })}
                  />
                  {errors?.item[it.key]?.kg && <p className="mt-1 text-xs text-red-600">{errors.item[it.key].kg}</p>}
                </div>
                <button
                  type="button"
                  aria-label={`Remove food item ${idx + 1}`}
                  onClick={() => update({ ...draft, items: draft.items.filter((i) => i.key !== it.key) })}
                  className="mt-1 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                >
                  <X size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          {errors?.items && <p role="alert" className="mt-2 text-xs text-red-600">{errors.items}</p>}
          <Button size="sm" className="mt-3" onClick={() => update({ ...draft, items: [...draft.items, { key: uid('di'), name: '', kg: '' }] })}>
            <Plus size={14} aria-hidden /> Add food item
          </Button>
        </fieldset>
      </form>
    </Modal>
  );
}
