import { scaleBand, scaleLinear } from 'd3-scale';
import { useId, useState, type ReactNode } from 'react';
import { cssVar, identityToken, plotToken } from '@/lib/entityColor';
import { CHART_BAR_ATTR, useChartMount } from '@/lib/motion/chart';
import { CategoryAxis, MeasureAxis } from './Axis';
import { ChartFrame } from './ChartFrame';
import { BarTable } from './ChartTable';
import {
  bandPlotHeight,
  computeMargin,
  measureTickCount,
  mountKey,
  plotArea,
  prefersHorizontalBars,
} from './geometry';
import type { BarDatum, PlotState } from './types';
import { useChartSize } from './useChartSize';

/**
 * **The bar chart** — magnitude, and identity beside it. `DESIGN_SYSTEM.md` §6.1's six steps:
 *
 * 1. **Job**: magnitude, ranked, with identity attached — a records leaderboard, a head-to-head.
 * 2. **Form**: bars. Length is the encoding, which is why **the measure axis always includes zero**
 *    (§6.3): truncating a bar axis lies, and it is the single most common serious chart defect
 *    after the dual axis.
 * 3. **Marks**: 4px rounded data-end on the **far end only**, square against the baseline — a bar
 *    rounded at the axis floats off it. A 2px surface gap between adjacent fills.
 * 4. **Interaction**: per-mark tooltip. The hovered bar keeps full opacity and its siblings drop to
 *    0.4 — **opacity only, never a colour change**, because a changed colour would break the
 *    identity the swatch just promised.
 * 5. **Colour**: from the entity, never from rank. A leaderboard sorted by value must not repaint
 *    when the sort changes, which is exactly what an index-into-a-palette would do.
 * 6. **Accessibility**: every band labelled, a table view, and the labels never rotated.
 *
 * **Orientation is decided, not offered.** §6.3: more than seven categories, or any label over
 * twelve characters, and the chart is horizontal — categories down the left, the measure along the
 * bottom. Angled tick labels are around 20% slower to read, so the chart rotates and the label
 * never does.
 */

export interface BarChartProps {
  data: readonly BarDatum[];
  title: string;
  subtitle?: string;
  ariaLabel: string;
  caption?: ReactNode;
  notes?: readonly ReactNode[];
  state?: PlotState;
  stateCopy?: { title?: string; body: string; action?: ReactNode };
  /** Carries the unit. "Wins", "Points per start", "Gap to teammate (s)". */
  valueTitle: string;
  categoryTitle?: string;
  formatValue?: (value: number) => string;
  /** Override the automatic choice. Only for a caller that knows something §6.3 cannot see. */
  orientation?: 'auto' | 'row' | 'column';
}

const identity = (n: number) => String(n);

export function BarChart({
  data,
  title,
  subtitle,
  ariaLabel,
  caption,
  notes = [],
  state = 'ready',
  stateCopy,
  valueTitle,
  categoryTitle,
  formatValue = identity,
  orientation = 'auto',
}: BarChartProps) {
  const { ref, width, height } = useChartSize<HTMLDivElement>();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const titleId = useId();

  const labels = data.map((d) => d.label);
  const horizontal = orientation === 'auto' ? prefersHorizontalBars(labels) : orientation === 'row';

  /* §6.3 — a bar measure axis ALWAYS includes zero. This is not a default a caller may turn off. */
  const values = data.map((d) => d.value);
  const vMin = Math.min(0, ...values);
  const vMax = Math.max(0, ...values, 1);

  const tickCount = measureTickCount(horizontal ? width || 320 : height || 240);
  const probe = scaleLinear().domain([vMin, vMax]).nice(tickCount);
  const measureLabels = probe.ticks(tickCount).map(formatValue);

  const margin = horizontal
    ? computeMargin({
        /* The gutter holds the CATEGORY names when the chart is rotated, and they are the long
         * strings that made it rotate in the first place. */
        measureLabels: labels,
        hasCategoryLabels: true,
        hasCategoryTitle: true,
      })
    : computeMargin({
        measureLabels,
        hasCategoryLabels: true,
        hasMeasureTitle: true,
        hasCategoryTitle: categoryTitle !== undefined,
      });

  /*
   * §6.3, completed: a rotated chart whose **row** pitch cannot carry its labels grows instead of
   * crushing them.
   *
   * ⚠ **This used to read the measured height, and that oscillated** _(fixed 2026-08-08)_. It grew
   * only `if (data.length > labelCapacity(measuredHeight))` — and growing satisfies the condition, so
   * the override was withdrawn, the plot fell back to the token, and the condition was true again.
   * `bandPlotHeight` is a function of the row count and the labels, so it has no fixed point to chase;
   * `ChartFrame` applies it as a floor, which is what lets the responsive token still govern the
   * charts that fit. The margins are now counted too — the rows live in `innerHeight`, not in `height`.
   */
  const needed = horizontal ? bandPlotHeight(data.length, margin) : undefined;

  const plot = plotArea(width, height, margin);

  const band = scaleBand<string>()
    .domain(data.map((d) => d.key))
    /* §6.3's 2px surface gap between adjacent fills, expressed as padding on the band rather than
     * as a stroke, so the gap is the plot surface showing through rather than a drawn line. */
    .range([0, horizontal ? plot.innerHeight : plot.innerWidth])
    .paddingInner(0.28)
    .paddingOuter(0.14);

  const measure = scaleLinear()
    .domain([vMin, vMax])
    .nice(tickCount)
    .range(horizontal ? [0, plot.innerWidth] : [plot.innerHeight, 0]);

  const zero = measure(0);

  const measureTicks = measure.ticks(tickCount).map((value) => ({
    offset: measure(value),
    label: formatValue(value),
  }));

  const categoryTicks = data.map((d) => ({
    offset: (band(d.key) ?? 0) + band.bandwidth() / 2,
    label: d.label,
  }));

  /*
   * **`mountKey`, not `data`.** Every real caller builds its `data` array inline, so the array's
   * identity changes on every render and `revertOnUpdate: true` re-ran G-27's bar growth each time.
   * See the note in `LineChart` and `geometry.mountKey`. `horizontal` is folded into the key rather
   * than passed separately, because it is a boolean and stable by value anyway.
   */
  const { scope: motionScope } = useChartMount<HTMLDivElement>({
    orientation: horizontal ? 'row' : 'column',
    origin: horizontal ? [plot.left + zero, plot.top] : [plot.left, plot.top + zero],
    deps: [
      mountKey(
        [...data.map((d) => d.key), horizontal ? 'row' : 'column'],
        plot.innerWidth,
        plot.innerHeight,
      ),
    ],
  });

  const tokenFor = (datum: BarDatum) =>
    datum.teamReference === undefined ? undefined : plotToken(datum.teamReference);

  return (
    <ChartFrame
      title={title}
      {...(subtitle === undefined ? {} : { subtitle })}
      ariaLabel={ariaLabel}
      {...(caption === undefined ? {} : { caption })}
      notes={notes}
      state={state}
      {...(stateCopy === undefined ? {} : { stateCopy })}
      {...(needed === undefined ? {} : { plotHeight: needed })}
      table={
        <BarTable
          data={data}
          caption={ariaLabel}
          categoryLabel={categoryTitle ?? 'Entity'}
          valueLabel={valueTitle}
          formatValue={formatValue}
          tokenFor={(datum) =>
            datum.teamReference === undefined ? undefined : identityToken(datum.teamReference)
          }
        />
      }
    >
      <div ref={motionScope} className="chart-mount">
        <div ref={ref} className="chart-mount">
          <svg
            className="chart-svg"
            viewBox={`0 0 ${String(width)} ${String(height)}`}
            aria-labelledby={titleId}
          >
            <title id={titleId}>{ariaLabel}</title>

            {horizontal ? (
              <>
                <MeasureAxisRow plot={plot} ticks={measureTicks} title={valueTitle} />
                <g aria-hidden="true">
                  {categoryTicks.map((tick) => (
                    <text
                      key={tick.label}
                      className="chart-tick"
                      x={plot.left - 8}
                      y={plot.top + tick.offset}
                      textAnchor="end"
                      dominantBaseline="middle"
                    >
                      {tick.label}
                    </text>
                  ))}
                </g>
              </>
            ) : (
              <>
                <MeasureAxis plot={plot} ticks={measureTicks} title={valueTitle} />
                <CategoryAxis
                  plot={plot}
                  ticks={categoryTicks}
                  {...(categoryTitle === undefined ? {} : { title: categoryTitle })}
                  allowStride={false}
                />
              </>
            )}

            <g className="chart-marks" data-dimmed={activeKey !== null}>
              {data.map((datum) => {
                const start = band(datum.key) ?? 0;
                const token = tokenFor(datum) ?? '--border-strong';
                const length = Math.abs(measure(datum.value) - zero);
                const geometry = horizontal
                  ? {
                      x: plot.left + Math.min(zero, measure(datum.value)),
                      y: plot.top + start,
                      width: length,
                      height: band.bandwidth(),
                    }
                  : {
                      x: plot.left + start,
                      y: plot.top + Math.min(zero, measure(datum.value)),
                      width: band.bandwidth(),
                      height: length,
                    };

                return (
                  <g key={datum.key}>
                    <rect
                      className="chart-bar"
                      data-motion={CHART_BAR_ATTR}
                      data-active={activeKey === datum.key}
                      {...geometry}
                      style={{ '--series': cssVar(token) } as React.CSSProperties}
                    />
                    {/*
                     * §6.5.1 — the hit target is ≥24px on the cross-axis regardless of mark size,
                     * so a thin bar in a long leaderboard is still reachable with a pointer.
                     */}
                    <rect
                      className="chart-hit"
                      x={horizontal ? plot.left : plot.left + start}
                      y={horizontal ? plot.top + start : plot.top}
                      width={horizontal ? plot.innerWidth : Math.max(24, band.bandwidth())}
                      height={horizontal ? Math.max(24, band.bandwidth()) : plot.innerHeight}
                      onPointerEnter={() => {
                        setActiveKey(datum.key);
                      }}
                      onPointerLeave={() => {
                        setActiveKey(null);
                      }}
                    />
                  </g>
                );
              })}
            </g>
          </svg>

          {activeKey !== null && (
            <div
              className="chart-tooltip"
              style={{
                left: 0,
                top: 0,
                transform: `translate(${String(plot.left + 8)}px, ${String(plot.top + 8)}px)`,
              }}
            >
              <p className="chart-tooltip-title">
                {data.find((d) => d.key === activeKey)?.label ?? ''}
              </p>
              <p className="chart-tooltip-row">
                <span>{valueTitle}</span>
                <span className="chart-tooltip-value">
                  {formatValue(data.find((d) => d.key === activeKey)?.value ?? 0)}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </ChartFrame>
  );
}

/**
 * The rotated chart's measure axis: gridlines and the axis line run **vertically**, because the
 * measure axis is the horizontal one and §6.3 puts gridlines perpendicular to the measure axis and
 * an axis line only on it. The category side keeps no line, exactly as in the upright case.
 */
function MeasureAxisRow({
  plot,
  ticks,
  title,
}: {
  plot: ReturnType<typeof plotArea>;
  ticks: readonly { offset: number; label: string }[];
  title: string;
}) {
  const baseline = plot.top + plot.innerHeight;
  return (
    <g aria-hidden="true">
      {ticks.map((tick, i) => (
        <line
          key={`grid-${String(i)}`}
          className="chart-grid-line"
          x1={Math.round(plot.left + tick.offset) + 0.5}
          x2={Math.round(plot.left + tick.offset) + 0.5}
          y1={plot.top}
          y2={baseline}
        />
      ))}
      <line
        className="chart-axis-line"
        x1={plot.left}
        x2={plot.left + plot.innerWidth}
        y1={Math.round(baseline) + 0.5}
        y2={Math.round(baseline) + 0.5}
      />
      {ticks.map((tick, i) => (
        <text
          key={`tick-${String(i)}`}
          className="chart-tick"
          x={Math.round(plot.left + tick.offset)}
          y={baseline + 8}
          textAnchor="middle"
          dominantBaseline="hanging"
        >
          {tick.label}
        </text>
      ))}
      <text
        className="chart-axis-title"
        x={plot.left + plot.innerWidth / 2}
        y={plot.height - 2}
        textAnchor="middle"
      >
        {title}
      </text>
    </g>
  );
}
