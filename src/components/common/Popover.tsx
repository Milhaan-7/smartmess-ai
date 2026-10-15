import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx';

interface PopoverProps {
  trigger: ReactNode;
  ariaLabel: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'left' | 'right';
  triggerClassName?: string;
  panelClassName?: string;
}

export function Popover({ trigger, ariaLabel, children, align = 'right', triggerClassName, panelClassName }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div className={cx('absolute z-40 mt-2 rounded-xl border border-gray-200 bg-white shadow-lg', align === 'right' ? 'right-0' : 'left-0', panelClassName)}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}
