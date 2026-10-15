import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { ItemWasteRow } from '../../services/metrics';
import { axisProps, CHART_COLORS, ChartFrame, tooltipStyle } from './ChartFrame';

export function ItemWasteChart({ rows }: { rows: ItemWasteRow[] }) {
  const data = rows.map((r) => ({ name: r.name, leftoverKg: Math.round(r.leftoverKg * 10) / 10 }));
  return (
    <ChartFrame label="Bar chart of total leftover kilograms by food item (synthetic data)" height={Math.max(220, data.length * 32 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 16 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
        <XAxis type="number" {...axisProps} label={{ value: 'Leftover (kg)', position: 'insideBottom', offset: -8, fill: '#6b7280', fontSize: 12 }} />
        <YAxis type="category" dataKey="name" {...axisProps} width={128} />
        <Tooltip {...tooltipStyle} cursor={{ fill: '#f3f4f6' }} />
        <Bar dataKey="leftoverKg" name="Leftover (kg)" fill={CHART_COLORS.brand} radius={[0, 3, 3, 0]} maxBarSize={18} />
      </BarChart>
    </ChartFrame>
  );
}
