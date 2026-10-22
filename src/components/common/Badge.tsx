import type { ReactNode } from 'react';
import type { DisplayStatus } from '../../types';
import { cx } from '../../lib/cx';

export type Tone = 'neutral' | 'brand' | 'amber' | 'red';

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-800 ring-brand-700/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>
      {children}
    </span>
  );
}

const statusMap: Record<DisplayStatus, { label: string; tone: Tone }> = {
  not_planned: { label: 'No forecast', tone: 'neutral' },
  recommended: { label: 'Awaiting approval', tone: 'amber' },
  approved: { label: 'Approved', tone: 'brand' },
  completed: { label: 'Completed', tone: 'neutral' },
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const s = statusMap[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
