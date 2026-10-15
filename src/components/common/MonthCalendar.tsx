import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '../../lib/cx';
import { monthGrid, monthLabel, parseDate } from '../../lib/dates';

interface MonthCalendarProps {
  selected: string;
  today: string;
  onSelect: (date: string) => void;
  /** Number of meals with a menu on a date (0–3), shown as dots. */
  mealCount: (date: string) => number;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MonthCalendar({ selected, today, onSelect, mealCount }: MonthCalendarProps) {
  const sel = parseDate(selected);
  const [view, setView] = useState({ year: sel.getUTCFullYear(), month: sel.getUTCMonth() });
  // When the selected date moves to another month (e.g. after saving a menu), show that month.
  useEffect(() => {
    const d = parseDate(selected);
    setView((v) => (v.year === d.getUTCFullYear() && v.month === d.getUTCMonth() ? v : { year: d.getUTCFullYear(), month: d.getUTCMonth() }));
  }, [selected]);
  const weeks = monthGrid(view.year, view.month);
  const shift = (delta: number) =>
    setView((v) => {
      const d = new Date(Date.UTC(v.year, v.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900" aria-live="polite">{monthLabel(view.year, view.month)}</h3>
        <div className="flex gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><ChevronLeft size={16} aria-hidden /></button>
          <button type="button" onClick={() => shift(1)} aria-label="Next month" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><ChevronRight size={16} aria-hidden /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-500">
        {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {weeks.flat().map((date, i) => {
          if (!date) return <div key={`pad-${i}`} />;
          const count = mealCount(date);
          const isSel = date === selected;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-pressed={isSel}
              aria-label={`${date}, ${count} of 3 meals have a menu${date === today ? ', planning date' : ''}`}
              className={cx(
                'flex h-11 flex-col items-center justify-center rounded-lg text-[13px] tabular-nums transition-colors',
                isSel ? 'bg-brand-700 text-white' : 'text-gray-800 hover:bg-gray-100',
                date === today && !isSel && 'ring-1 ring-inset ring-brand-400',
              )}
            >
              <span className="font-medium">{Number(date.slice(8))}</span>
              <span className="mt-0.5 flex h-1.5 gap-0.5" aria-hidden>
                {Array.from({ length: count }, (_, k) => (
                  <span key={k} className={cx('h-1.5 w-1.5 rounded-full', isSel ? 'bg-white/80' : 'bg-brand-500')} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-500">One dot per meal with a menu. The outlined date is the demo planning date.</p>
    </div>
  );
}
