import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { DailyPoint } from '../../services/metrics';
import { axisProps, CHART_COLORS, ChartFrame, tooltipStyle } from './ChartFrame';

export function DemandTrendChart({ data, height }: { data: DailyPoint[]; height?: number }) {
  return (
    <ChartFrame label="Line chart of predicted versus actual diners per day (synthetic data)" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axisProps} width={48} domain={['auto', 'auto']} label={{ value: 'Diners', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 12 }} />
        <Tooltip {...tooltipStyle} />
        <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
        <Line type="monotone" dataKey="actual" name="Actual diners" stroke={CHART_COLORS.brand} strokeWidth={2.25} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="predicted" name="Predicted diners" stroke={CHART_COLORS.brandLight} strokeWidth={2} strokeDasharray="5 4" dot={false} />
      </LineChart>
    </ChartFrame>
  );
}
