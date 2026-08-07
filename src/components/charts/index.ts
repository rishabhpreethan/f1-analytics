/**
 * The chart kit's public surface (`ARCHITECTURE.md` §4, `DESIGN_SYSTEM.md` §6).
 *
 * A barrel so a feature imports `@/components/charts` and gets the frame, the two chart forms and
 * the types — and so the internals (`geometry`, `ladder`, `Axis`) stay internals. A feature that
 * reaches for `geometry.ts` directly is laying a chart out by hand, which is the thing this kit
 * exists to make unnecessary.
 */

export { BarChart, type BarChartProps } from './BarChart';
export { ChartFrame, type ChartFrameProps } from './ChartFrame';
export { ChartLegend } from './ChartLegend';
export { BarTable, SeriesTable, SpanTable } from './ChartTable';
export { LineChart, type LineChartProps } from './LineChart';
export { SpanChart, type Span, type SpanChartProps, type SpanRow } from './SpanChart';
export { COMPARISON_CAP } from './ladder';
export type { BarDatum, PlotState, SeriesInput, SeriesPoint } from './types';
