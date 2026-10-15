const MS_DAY = 86_400_000;

export const parseDate = (d: string): Date => new Date(`${d}T00:00:00Z`);
export const toDateString = (dt: Date): string => dt.toISOString().slice(0, 10);
export const addDays = (d: string, n: number): string =>
  toDateString(new Date(parseDate(d).getTime() + n * MS_DAY));
/** 0 = Sunday … 6 = Saturday */
export const dayOfWeek = (d: string): number => parseDate(d).getUTCDay();
export const diffDays = (a: string, b: string): number =>
  Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / MS_DAY);

export function isValidDateString(d: string | null | undefined): d is string {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const parsed = parseDate(d);
  return !Number.isNaN(parsed.getTime()) && toDateString(parsed) === d;
}

const fmt =
  (opts: Intl.DateTimeFormatOptions) =>
  (d: string): string =>
    parseDate(d).toLocaleDateString('en-IN', { timeZone: 'UTC', ...opts });

export const formatLong = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const formatMedium = fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const formatDayMonth = fmt({ day: 'numeric', month: 'short' });
export const formatWeekdayDay = fmt({ weekday: 'short', day: 'numeric', month: 'short' });

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });
}

/** Monday-first month grid; `null` cells pad the first and last weeks. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= days; d++) cells.push(toDateString(new Date(Date.UTC(year, month, d))));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
