import type { ReactNode } from 'react';
import { AlertTriangle, FlaskConical, Info, XCircle } from 'lucide-react';
import { cx } from '../../lib/cx';

type NoticeTone = 'info' | 'synthetic' | 'warning' | 'error';

const styles: Record<NoticeTone, { box: string; icon: typeof Info }> = {
  info: { box: 'border-gray-200 bg-white text-gray-700', icon: Info },
  synthetic: { box: 'border-brand-200 bg-brand-50 text-brand-900', icon: FlaskConical },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertTriangle },
  error: { box: 'border-red-200 bg-red-50 text-red-800', icon: XCircle },
};

export function Notice({ tone = 'info', title, children, action, className }: { tone?: NoticeTone; title?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  const { box, icon: Icon } = styles[tone];
  return (
    <div role={tone === 'error' ? 'alert' : undefined} className={cx('flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] leading-relaxed', box, className)}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
      {action}
    </div>
  );
}

export const SyntheticNote = ({ className }: { className?: string }) => (
  <Notice tone="synthetic" className={className} title="Synthetic demonstration data">
    All figures on this page are generated for the demo and are not from a real institution. Forecasts are estimates, not guarantees; the kitchen manager makes the final preparation decision.
  </Notice>
);
