import { Bar, CartesianGrid, ComposedChart, Legend, Line, Tooltip, XAxis, YAxis } from 'recharts';
import type { DailyPoint } from '../../services/metrics';
import { axisProps, CHART_COLORS, ChartFrame, tooltipStyle } from './ChartFrame';

export function WasteTrendChart({ data, height }: { data: DailyPoint[]; height?: number }) {
  return (
    <ChartFrame label="Chart of daily leftover kilograms and waste rate percentage (synthetic data)" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
        <YAxis yAxisId="kg" {...axisProps} width={48} label={{ value: 'Leftover (kg)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 12 }} />
        <YAxis yAxisId="pct" orientation="right" {...axisProps} width={44} unit="%" domain={[0, 'auto']} />
        <Tooltip {...tooltipStyle} />
        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
        <Bar yAxisId="kg" dataKey="leftoverKg" name="Leftover (kg)" fill={CHART_COLORS.brandLight} radius={[3, 3, 0, 0]} maxBarSize={26} />
        <Line yAxisId="pct" type="monotone" dataKey="wasteRatePct" name="Waste rate (%)" stroke={CHART_COLORS.ink} strokeWidth={2} dot={{ r: 2.5 }} />
      </ComposedChart>
    </ChartFrame>
  );
}
