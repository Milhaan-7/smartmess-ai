import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { InfoTip } from './InfoTip';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: LucideIcon;
  /** Definition shown in a tooltip. */
  definition?: string;
}

export function MetricCard({ label, value, sub, icon: Icon, definition }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
          {label}
          {definition && <InfoTip text={definition} />}
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-700/10">
          <Icon size={16} aria-hidden />
        </span>
      </div>
      <div className="mt-2 text-[26px] font-semibold leading-8 tracking-tight font-mono tabular-nums text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
