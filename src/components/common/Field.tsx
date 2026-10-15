import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

export const inputClass = (invalid?: boolean) =>
  cx(
    'h-9 w-full rounded-lg border bg-white px-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-500',
    invalid ? 'border-red-400 focus-visible:outline-red-500' : 'border-gray-300 hover:border-gray-400',
  );

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
  className?: string;
}

/** Label + control + hint/error wrapper. The control is rendered by a render-prop so ids line up. */
export function Field({ label, error, hint, children, className }: FieldProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-[13px] font-medium text-gray-700">
        {label}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': error || hint ? msgId : undefined })}
      {(error || hint) && (
        <p id={msgId} className={cx('mt-1 text-xs', error ? 'text-red-600' : 'text-gray-500')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function TextInput({ invalid, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cx(inputClass(invalid), className)} {...props} />;
}

export function Select({ invalid, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={cx(inputClass(invalid), 'pr-8', className)} {...props}>
      {children}
    </select>
  );
}
