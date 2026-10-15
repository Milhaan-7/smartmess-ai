import type { ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';

export const CHART_COLORS = {
  brand: '#1f583c',
  brandLight: '#8dc0a1',
  gray: '#9ca3af',
  grid: '#e5e7eb',
  ink: '#374151',
};

export const axisProps = {
  tick: { fill: '#6b7280', fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: '#e5e7eb' },
} as const;

export const tooltipStyle = {
  contentStyle: { borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.08)' },
  labelStyle: { fontWeight: 600, color: '#111827' },
} as const;

export function ChartFrame({ label, height = 260, children }: { label: string; height?: number; children: ReactElement }) {
  return (
    <div role="img" aria-label={label} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
