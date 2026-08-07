import { scaleBand, scaleLinear } from 'd3-scale';
import { useId, useState, type ReactNode } from 'react';
import { cssVar, identityToken, plotToken } from '@/lib/entityColor';
import { CHART_REVEAL_ATTR, useChartMount } from '@/lib/motion/chart';
import { ChartFrame } from './ChartFrame';
import { SpanTable } from './ChartTable';
import { computeMargin, measureTickCount, mountKey, plotArea, spanPath, withEndpoints } from './geometry';
import type { PlotState } from './types';
import { useChartSize } from './useChartSize';

/**
 * **The span chart** — one row per entity, a sequence of spans along a shared measure axis.
 * `DESIGN_SYSTEM.md` §6.6.1, built for RD-3 (stint reconstruction) and specified through §6.1:
 *
 * 1. **Job**: sequence. When each phase began and ended, per entity — not how big it was.
 * 2. **Form**: spans on a shared axis. It beats a stacked bar because **each span already knows its
 *    own start**, and it beats a line because there is no value here, only extent.
 * 3. **Marks**: full band height, a 2px `--surface-sunken` gap between adjacent spans, and §6.3's
 *    4px radius **on the row's outer ends only** — an interior boundary is square, because a rounded
 *    interior edge implies a gap in the sequence that is not there.
 * 4. **Interaction**: per-span tooltip (§6.5.1's bar/dot/cell rule). The hovered span keeps full
 *    opacity and its siblings drop to 0.4 — opacity only, never a colour change.
 * 5. **Colour**: the entity's plot token for every span in its row. **Spans within a row are not
 *    differentiated by colour**: alternating shades would spend the shade pair, which §3.3a.1
 *    reserves for the teammate case, and alternating opacity would imply a magnitude. The 2px gap and
 *    the in-span label carry it.
 * 6. **Accessibility**: every row labelled in the gutter, a table view with start, end and length,
 *    and no reliance on colour to tell two spans apart.
 *
 * ---
 *
 * **`d3-shape.stack` is NOT used, and §6.6's table said it would be.** That row is corrected in the
 * design system rather than quietly ignored: `stack` sums sequential *values* to derive cumulative
 * positions, and a stint's boundaries are already known — `DATABASE.md` §6.7 derives them as
 * `[1 … pit₁], (pit₁ … pit₂], … (pitₙ … end]`. Feeding spans through lengths, then cumulative sums,
 * then back to positions is a round trip whose only possible contribution is error.
 *
 * **The entrance is G-28's clip wipe, not G-27's bar growth.** A span that begins at lap 30 has no
 * business growing from the plot's left edge — that would animate its *start* moving, which is the
 * one thing a sequence chart must not say. A left-to-right reveal instead uncovers the timeline in
 * the order the race happened, which is what the reader is being shown.
 */

/** One phase of one entity's sequence. `start` and `end` are in measure units, inclusive. */
export interface Span {
  key: string;
  start: number;
  end: number;
  /** Drawn inside the span when it is wide enough to hold it. A stint's lap count, typically. */
  label?: string;
}

export interface SpanRow {
  /** The entity's own reference — the stable identity, used for keys and ordering. */
  reference: string;
  /** The team this entity plots as. For a team row, its own reference. */
  teamReference: string;
  label: string;
  spans: readonly Span[];
}

export interface SpanChartProps {
  rows: readonly SpanRow[];
  title: string;
  subtitle?: string;
  ariaLabel: string;
  caption?: ReactNode;
  notes?: readonly ReactNode[];
  state?: PlotState;
  stateCopy?: { title?: string; body: string; action?: ReactNode };
  /** Carries the unit: "Lap". */
  measureTitle: string;
  formatMeasure?: (value: number) => string;
  /**
   * Pin the measure domain. **Required in practice for a race**: derived from the spans alone, a
   * field that all pitted by lap 50 would produce a 50-lap axis for a 58-lap race, and the reader
   * would not see that everyone ran to the end.
   */
  domain?: readonly [number, number];
}

const identity = (n: number) => String(n);

/** Below this width a span cannot hold its own label without the text overflowing its fill. */
const LABEL_MIN_WIDTH = 28;

export function SpanChart({
  rows,
  title,
  subtitle,
  ariaLabel,
  caption,
  notes = [],
  state = 'ready',
  stateCopy,
  measureTitle,
  formatMeasure = identity,
  domain,
}: SpanChartProps) {
  const clipId = useId().replace(/:/g, '');
  const { ref, width, height } = useChartSize<HTMLDivElement>();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const titleId = useId();

  const starts = rows.flatMap((row) => row.spans.map((span) => span.start));
  const ends = rows.flatMap((row) => row.spans.map((span) => span.end));
  const min = domain?.[0] ?? Math.min(...(starts.length > 0 ? starts : [0]));
  const max = domain?.[1] ?? Math.max(...(ends.length > 0 ? ends : [1]));

  const tickCount = measureTickCount(width > 0 ? width : 320);
  const probe = scaleLinear().domain([min, max]);
  const measureLabels = probe.ticks(tickCount).map(formatMeasure);

  /* The gutter holds the row names, which are the long strings here — the same shape `BarChart`
   * uses when §6.3 rotates it. */
  const margin = computeMargin({
    measureLabels: rows.map((row) => row.label),
    hasCategoryLabels: true,
    hasCategoryTitle: true,
  });
  const plot = plotArea(width, height, margin);

  const band = scaleBand<string>()
    .domain(rows.map((row) => row.reference))
    .range([0, plot.innerHeight])
    .paddingInner(0.28)
    .paddingOuter(0.14);

  const measure = scaleLinear().domain([min, max]).range([0, plot.innerWidth]);

  /* §6.3 — the first and last value are always labelled. On a lap axis that is the start and the
   * finish of the race, and `d3.ticks` omits both. */
  const gapInDomain =
    plot.innerWidth > 0 ? ((measureLabels[0]?.length ?? 2) * 8 * (max - min)) / plot.innerWidth : 0;
  const measureTicks = withEndpoints(measure.ticks(tickCount), min, max, gapInDomain).map(
    (value) => ({ offset: measure(value), label: formatMeasure(value) }),
  );

  const { scope: motionScope } = useChartMount<HTMLDivElement>({
    orientation: 'row',
    origin: [plot.left, plot.top],
    reveal: { x: plot.left, width: plot.innerWidth },
    deps: [
      mountKey(
        rows.flatMap((row) => [row.reference, ...row.spans.map((s) => s.key)]),
        plot.innerWidth,
        plot.innerHeight,
      ),
    ],
  });

  const active = rows
    .flatMap((row) => row.spans.map((span) => ({ row, span })))
    .find(({ span }) => span.key === activeKey);

  return (
    <ChartFrame
      title={title}
      {...(subtitle === undefined ? {} : { subtitle })}
      ariaLabel={ariaLabel}
      {...(caption === undefined ? {} : { caption })}
      notes={notes}
      state={state}
      {...(stateCopy === undefined ? {} : { stateCopy })}
      table={
        <SpanTable
          rows={rows}
          caption={ariaLabel}
          measureLabel={measureTitle}
          formatMeasure={formatMeasure}
          tokenFor={(row) => identityToken(row.teamReference)}
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

            <defs>
              {/* `userSpaceOnUse` for G-28's reason: the default resolves against the data's bounding
               * box, so a field that all pitted early would finish its reveal before the axis ends. */}
              <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
                <rect
                  data-motion={CHART_REVEAL_ATTR}
                  x={plot.left}
                  y={0}
                  width={plot.innerWidth}
                  height={height}
                />
              </clipPath>
            </defs>

            {/* The measure axis runs along the bottom; the category side keeps no line (§6.3). */}
            <g aria-hidden="true">
              {measureTicks.map((tick) => (
                <line
                  key={`grid-${tick.label}`}
                  className="chart-grid-line"
                  x1={Math.round(plot.left + tick.offset) + 0.5}
                  x2={Math.round(plot.left + tick.offset) + 0.5}
                  y1={plot.top}
                  y2={plot.top + plot.innerHeight}
                />
              ))}
              <line
                className="chart-axis-line"
                x1={plot.left}
                x2={plot.left + plot.innerWidth}
                y1={Math.round(plot.top + plot.innerHeight) + 0.5}
                y2={Math.round(plot.top + plot.innerHeight) + 0.5}
              />
              {measureTicks.map((tick) => (
                <text
                  key={`tick-${tick.label}`}
                  className="chart-tick"
                  x={Math.round(plot.left + tick.offset)}
                  y={plot.top + plot.innerHeight + 8}
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
                {measureTitle}
              </text>

              {rows.map((row) => (
                <text
                  key={`label-${row.reference}`}
                  className="chart-tick"
                  x={plot.left - 8}
                  y={plot.top + (band(row.reference) ?? 0) + band.bandwidth() / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {row.label}
                </text>
              ))}
            </g>

            <g className="chart-marks" data-dimmed={activeKey !== null} clipPath={`url(#${clipId})`}>
              {rows.map((row) => {
                const token = plotToken(row.teamReference);
                const y = plot.top + (band(row.reference) ?? 0);

                return row.spans.map((span, index) => {
                  const x = plot.left + measure(span.start);
                  /* The 2px gap is taken off the trailing edge, so it shows the plot surface between
                   * adjacent spans rather than being drawn as a line (§6.3). */
                  const rawWidth = measure(span.end) - measure(span.start);
                  const spanWidth = Math.max(0, rawWidth - 2);

                  return (
                    <g key={span.key}>
                      <path
                        className="chart-span"
                        data-active={activeKey === span.key}
                        d={spanPath(x, y, spanWidth, band.bandwidth(), 4, {
                          leading: index === 0,
                          trailing: index === row.spans.length - 1,
                        })}
                        style={{ '--series': cssVar(token) } as React.CSSProperties}
                      />

                      {span.label !== undefined && spanWidth >= LABEL_MIN_WIDTH && (
                        <text
                          className="chart-span-label"
                          x={x + spanWidth / 2}
                          y={y + band.bandwidth() / 2}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {span.label}
                        </text>
                      )}

                      {/* §6.5.1 — the hit target is ≥24px on the cross-axis regardless of mark size. */}
                      <rect
                        className="chart-hit"
                        x={x}
                        y={y}
                        width={Math.max(1, spanWidth)}
                        height={Math.max(24, band.bandwidth())}
                        onPointerEnter={() => {
                          setActiveKey(span.key);
                        }}
                        onPointerLeave={() => {
                          setActiveKey(null);
                        }}
                      />
                    </g>
                  );
                });
              })}
            </g>
          </svg>

          {active !== undefined && (
            <div
              className="chart-tooltip"
              style={{
                left: 0,
                top: 0,
                transform: `translate(${String(plot.left + 8)}px, ${String(plot.top + 8)}px)`,
              }}
            >
              <p className="chart-tooltip-title">{active.row.label}</p>
              <p className="chart-tooltip-row">
                <span>{measureTitle}</span>
                <span className="chart-tooltip-value">
                  {formatMeasure(active.span.start)}–{formatMeasure(active.span.end)}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </ChartFrame>
  );
}
