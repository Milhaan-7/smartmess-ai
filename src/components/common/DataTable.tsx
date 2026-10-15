import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
  /** Pin this column while scrolling horizontally. */
  sticky?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  onRowClick?: (row: T) => void;
  footer?: ReactNode;
  empty?: ReactNode;
  dense?: boolean;
  /** Tighter horizontal padding for wide tables. */
  compact?: boolean;
}

export function DataTable<T>({ columns, rows, rowKey, caption, onRowClick, footer, empty, dense, compact }: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const px = compact ? 'px-3' : 'px-4';
  const pad = cx(px, dense ? 'py-2' : 'py-3');
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/70 text-left text-xs font-medium text-gray-600">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cx(px, 'py-2.5 align-bottom font-medium', c.align === 'right' && 'text-right', c.sticky && 'sticky left-0 z-10 bg-gray-50', c.className)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onRowClick(row)) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={cx('bg-white', onRowClick && 'cursor-pointer hover:bg-gray-50')}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cx(pad, 'align-middle tabular-nums', c.align === 'right' && 'text-right', c.sticky && 'sticky left-0 z-10 bg-inherit', c.className)}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot className="border-t border-gray-200 bg-gray-50/70 text-sm font-medium">{footer}</tfoot>}
      </table>
    </div>
  );
}
