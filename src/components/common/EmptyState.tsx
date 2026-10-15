import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
        <Icon size={20} aria-hidden />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
