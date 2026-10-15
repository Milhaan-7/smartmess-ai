import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ title, description, onClose, children, footer, wide }: ModalProps) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-gray-900">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-gray-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}
