import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts';
import type { ItemForecast } from '../../types';
import { axisProps, CHART_COLORS, ChartFrame, tooltipStyle } from './ChartFrame';

export function BaselineComparisonChart({ items }: { items: ItemForecast[] }) {
  const data = items.map((i) => ({ name: i.name, forecast: i.predictedDemand, baseline: i.baselineDemand }));
  return (
    <ChartFrame label="Grouped bar chart comparing forecast demand with the historical-average baseline per item, in portions" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="name" {...axisProps} interval={0} tick={{ fill: '#6b7280', fontSize: 11 }} height={44} />
        <YAxis {...axisProps} width={48} label={{ value: 'Portions', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 12 }} />
        <Tooltip {...tooltipStyle} cursor={{ fill: '#f3f4f6' }} />
        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
        <Bar dataKey="baseline" name="Historical average" fill={CHART_COLORS.gray} radius={[3, 3, 0, 0]} maxBarSize={22} />
        <Bar dataKey="forecast" name="Forecast demand" fill={CHART_COLORS.brand} radius={[3, 3, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ChartFrame>
  );
}
