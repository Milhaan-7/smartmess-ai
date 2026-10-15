import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Remove body padding (for tables that run edge to edge). */
  flush?: boolean;
}

export function Card({ title, description, actions, children, className, flush }: CardProps) {
  return (
    <section className={cx('rounded-xl border border-gray-200 bg-white shadow-sm', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-gray-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  );
}
