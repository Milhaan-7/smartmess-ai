import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed whitespace-nowrap';
const variants: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white shadow-sm hover:bg-brand-800 disabled:bg-gray-300',
  secondary: 'border border-gray-300 bg-white text-gray-800 shadow-sm hover:bg-gray-50 disabled:text-gray-400 disabled:bg-gray-50',
  ghost: 'text-gray-700 hover:bg-gray-100 disabled:text-gray-400',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-gray-300',
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
