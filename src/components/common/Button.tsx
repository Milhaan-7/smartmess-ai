import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:cursor-not-allowed whitespace-nowrap focus-visible:outline-2 focus-visible:outline-brand-600 focus-visible:outline-offset-2';
const variants: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white shadow-xs hover:bg-brand-800 active:bg-brand-900 disabled:bg-slate-300 disabled:text-slate-500',
  secondary: 'border border-slate-300/80 bg-white text-slate-800 shadow-xs hover:bg-slate-50 active:bg-slate-100 disabled:text-slate-400 disabled:bg-slate-50',
  ghost: 'text-slate-700 hover:bg-slate-100/80 active:bg-slate-200/60 disabled:text-slate-400',
  danger: 'bg-red-600 text-white shadow-xs hover:bg-red-700 active:bg-red-800 disabled:bg-slate-300',
};
const sizes: Record<Size, string> = { sm: 'h-8 px-3 text-[13px]', md: 'h-9 px-4 text-sm' };

export const buttonClass = (variant: Variant = 'secondary', size: Size = 'md', extra?: string) =>
  cx(base, variants[variant], sizes[size], extra);

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: Size }) {
  return <a className={buttonClass(variant, size, className)} {...props} />;
}
