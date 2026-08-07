import { bisector } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import { line as d3line, curveLinear } from 'd3-shape';
import { useId, useRef, useState, type ReactNode } from 'react';
import { assignEntityColours, cssVar } from '@/lib/entityColor';
import { chartReadout, CHART_REVEAL_ATTR, fadeTooltipIn, useChartMount } from '@/lib/motion/chart';
import { CategoryAxis, MeasureAxis } from './Axis';
import { ChartFrame } from './ChartFrame';
import { ChartLegend } from './ChartLegend';
import { SeriesTable } from './ChartTable';
import {
  clampTooltip,
  computeMargin,
  shouldDrawMarkers,
  measureTickCount,
  monoTextWidth,
  mountKey,
  placeDirectLabels,
  plotArea,
  fmtCoord,
  offScalePath,
  timeTickCount,
  withEndpoints,
  TICK_LABEL_SIZE,
  tooltipHeight,
  TOOLTIP_WIDTH,
} from './geometry';
import { assignLadder, DASH_ARRAY, type LadderState } from './ladder';
import { MarkerGlyph } from './MarkerGlyph';
import type { PlotState, ResolvedSeries, SeriesInput } from './types';
import { useChartSize } from './useChartSize';

/**
 * **The comparison line chart** — `DESIGN_SYSTEM.md` §6, specified through §6.1's six steps and
 * built here.
 *
 * 1. **Job**: change over time, for up to four entities.
 * 2. **Form**: a per-round / per-season line. It beats a bar chart because the reader's question is
 *    the *shape* of a season rather than the size of one round, and it beats a slope chart because
 *    the intermediate rounds are where the story is.
 * 3. **Marks**: 2px lines, ≥8px markers with a 1.5px surface ring, no fill under the line unless a
 *    single series is shown.
 * 4. **Interaction**: **one crosshair, one tooltip, all series** — snapped to the nearest x by
 *    `d3-array`'s bisector. Per-series hover tooltips on a multi-series chart are the defect this
 *    replaces: they make the reader chase.
 * 5. **Colour**: last, and never alone. `assignEntityColours` then `assignLadder`.
 * 6. **Accessibility**: legend at ≥2, direct labels at ≤4, a table view, an `aria-live` readout,
 *    and the plot as a single tab stop with arrow-key stepping.
 *
 * **`y === null` is drawn as a gap, never as zero.** A driver who did not start a round has no
 * value; a line that dips to the axis says he scored nothing, which is a different claim.
 */

export interface LineChartProps {
  series: readonly SeriesInput[];
  title: string;
  subtitle?: string;
  ariaLabel: string;
  caption?: ReactNode;
  notes?: readonly ReactNode[];
  state?: PlotState;
  stateCopy?: { title?: string; body: string; action?: ReactNode };
  /** The x axis title. Carries the unit: "Round", "Season". */
  xTitle?: string;
  /**
   * The y axis title. **Carries the unit, and states a non-zero baseline out loud** — a line axis
   * may start away from zero because position is the encoding, and being quiet about it is what
   * turns that into a lie (§6.3).
   */
  yTitle?: string;
  /** The axis tick label. Terse — it has to fit a `--text-2xs` gutter. */
  formatX?: (x: number) => string;
  /**
   * The **tooltip and live-region** label for the same x. Falls back to `formatX`.
   *
   * Added in F2 (§6.5.1) because one formatter cannot serve both. The axis needs `R7`; the reader at
   * a crosshair is asking *which race*, and `R7 · Belgian Grand Prix` is the answer — but putting
   * that on the ticks would collide every label on the axis. Two questions, two formatters.
   */
  formatXLong?: (x: number) => string;
  formatY?: (y: number) => string;
  /**
   * §6.3 — a **position** axis (P1 … P20) is inverted, P1 at the top. In F1 up means faster and 1
   * is the best value; a position axis pointed the ordinary way reads backwards to every fan.
   */
  invertY?: boolean;
  /** Force the measure axis through zero. Required for an area, optional for a line. */
  zeroBaseline?: boolean;
  /**
   * Pin the measure domain instead of deriving it from the data.
   *
   * Added in F2 for the position axis, which is the case that makes it necessary rather than
   * convenient: the axis of a championship position chart is **the size of the field**, not the
   * range the four selected drivers happened to occupy. Four drivers who ran 1st–6th all season
   * must not get an axis that stops at P6, because the reader's question is how close to the front
   * they were.
   */
  yDomain?: readonly [number, number];
  /**
   * Draw exactly these measure ticks. **`.nice()` is skipped when this is set**, which is the point:
   * on a `[1, 22]` position domain `.nice()` extends outward and emits a **`P0` tick**, and there
   * is no such championship position. §6.3 has always specified 1/5/10/15/20 for a position axis;
   * the kit had no way to say it until now. Use `positionTicksWithin`.
   */
  yTickValues?: readonly number[];
  /**
   * §6.3 — clip the measure axis at this value, and mark every reading above it.
   *
   * Built for the lap-time trace, where it is **mandatory rather than optional**: 2026 R1's slowest
   * lap is 1,168s against a fastest of 82s, so an unclipped axis compresses every racing lap into 7%
   * of the plot. Readings above the ceiling are drawn at the ceiling with an off-scale caret, counted
   * in a note the frame renders, and left exact in the table view — which is what makes the clipping
   * honest rather than lossy.
   */
  yCeiling?: number;
  /** Formats the ceiling for the off-scale note. Defaults to `formatY`. */
  formatCeiling?: (value: number) => string;
}

const identity = (n: number) => String(n);

export function LineChart({
  series,
  title,
  subtitle,
  ariaLabel,
  caption,
  notes = [],
  state = 'ready',
  stateCopy,
  xTitle,
  yTitle,
  formatX = identity,
  formatXLong,
  formatY = identity,
  invertY = false,
  zeroBaseline = false,
  yDomain,
  yTickValues,
  yCeiling,
  formatCeiling,
}: LineChartProps) {
  const labelX = formatXLong ?? formatX;
  const clipId = useId().replace(/:/g, '');
  const { ref, width, height } = useChartSize<HTMLDivElement>();
  const [patterns, setPatterns] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  /*
   * §6.4 rule 2 — **a rung is never withdrawn when a collision clears.** Removing the entity that
   * caused a collision must not restore a plain solid line for the survivor; that is the repaint
   * §6.2 forbids. Held as state rather than a ref because the ladder result is *rendered*, and a
   * ref read during render is exactly the thing React's own lint rule forbids. Adjusting state
   * during render is the documented pattern for this: React re-runs the component before painting,
   * so nothing flashes.
   */
  const [sticky, setSticky] = useState<LadderState>({
    marker: false,
    dash: false,
    texture: false,
  });

  const coloured = assignEntityColours(
    series.map((s) => ({ reference: s.reference, teamReference: s.teamReference })),
  );
  const ladder = assignLadder(coloured, { sticky, patterns });
  if (ladder.state.marker !== sticky.marker || ladder.state.dash !== sticky.dash) {
    setSticky({ marker: ladder.state.marker, dash: ladder.state.dash, texture: false });
  }
  const resolved: ResolvedSeries[] = ladder.series.map((channels, i) => ({
    ...channels,
    label: series[i]?.label ?? channels.reference,
    points: series[i]?.points ?? [],
  }));

  /*
   * §6.3's ceiling, applied **before** the domain is derived — which is the whole point. Clipping
   * after the axis had already been sized by a 1,168-second lap would change nothing. A clipped
   * reading keeps its x and is flagged, so the caret is drawn at its own lap rather than the line
   * simply breaking.
   */
  const clipped = resolved.map((s) => ({
    ...s,
    points: s.points.map((p) =>
      yCeiling !== undefined && p.y !== null && p.y > yCeiling
        ? { x: p.x, y: yCeiling, offScale: true }
        : { x: p.x, y: p.y, offScale: false },
    ),
  }));
  const offScaleCount = clipped.reduce(
    (total, s) => total + s.points.filter((p) => p.offScale).length,
    0,
  );

  /* The union of every x any series has a reading for, ascending. A driver who joined at round 5
   * must not truncate the axis to rounds 5+. */
  const xs = [...new Set(clipped.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);

  const ys = clipped.flatMap((s) =>
    s.points.map((p) => p.y).filter((y): y is number => y !== null),
  );

  const yMin =
    yDomain?.[0] ?? (zeroBaseline ? Math.min(0, ...ys) : Math.min(...(ys.length > 0 ? ys : [0])));
  const yMax =
    yDomain?.[1] ?? (zeroBaseline ? Math.max(0, ...ys) : Math.max(...(ys.length > 0 ? ys : [1])));

  /*
   * `.nice()` is applied only when the caller has NOT pinned the ticks. With explicit ticks, nicing
   * is actively wrong: on a `[1, 22]` position domain it widens the domain to a round boundary and
   * `1` — P1, the line the whole chart is read against — stops sitting on the axis edge.
   */
  const nice = yTickValues === undefined;

  /* Measure labels are needed before the margin, and the margin before the scales — so the domain
   * is niced first and the gutter is sized from the labels that will actually be drawn. */
  const provisionalHeight = height > 0 ? height : 240;
  const yTickCount = measureTickCount(provisionalHeight);
  const probe = scaleLinear().domain([yMin, yMax]);
  const yTicksProbe = yTickValues ?? (nice ? probe.nice(yTickCount) : probe).ticks(yTickCount);
  const measureLabels = yTicksProbe.map(formatY);

  const directLabelWidth = Math.max(
    0,
    ...resolved.map((s) => monoTextWidth(s.label, TICK_LABEL_SIZE)),
  );

  const margin = computeMargin({
    measureLabels,
    hasCategoryLabels: true,
    hasMeasureTitle: yTitle !== undefined,
    hasCategoryTitle: xTitle !== undefined,
    directLabelWidth: resolved.length <= 4 ? directLabelWidth : 0,
  });
  const plot = plotArea(width, height, margin);

  const xScale = scaleLinear()
    .domain([xs[0] ?? 0, xs[xs.length - 1] ?? 1])
    .range([0, plot.innerWidth]);

  const yScaleBase = scaleLinear().domain([yMin, yMax]);
  const yScale = (nice ? yScaleBase.nice(yTickCount) : yScaleBase).range(
    invertY ? [0, plot.innerHeight] : [plot.innerHeight, 0],
  );

  const yTicks = (yTickValues ?? yScale.ticks(yTickCount)).map((value) => ({
    offset: yScale(value),
    label: formatY(value),
  }));

  /*
   * §6.3 — **the first and last value are always labelled.** `d3.ticks` picks round numbers inside
   * the domain and ignores its endpoints, which on a 1-based sequence loses the two readings that
   * frame every other one: `[1, 58]` yields `[5, 10 … 55]`, so neither the first lap nor the last
   * appears. `withEndpoints` forces both in and drops any interior tick that would crowd them.
   *
   * The crowding gap is the widest label plus a space, converted from px into domain units here —
   * where the scale is already known — so `geometry` stays free of scales and stays testable.
   */
  const xDomainMin = xs[0] ?? 0;
  const xDomainMax = xs[xs.length - 1] ?? 1;
  const widestXLabel = Math.max(
    monoTextWidth(formatX(xDomainMin)),
    monoTextWidth(formatX(xDomainMax)),
  );
  const xGapInDomain =
    plot.innerWidth > 0
      ? ((widestXLabel + TICK_LABEL_SIZE) * (xDomainMax - xDomainMin)) / plot.innerWidth
      : 0;

  const xTicks = withEndpoints(
    xScale.ticks(timeTickCount(plot.innerWidth)),
    xDomainMin,
    xDomainMax,
    xGapInDomain,
  ).map((value) => ({
    offset: xScale(value),
    label: formatX(value),
  }));

  /* The densest series decides, not the average: one 58-lap series among three short ones still
   * produces the collision. */
  const densestSeries = Math.max(1, ...resolved.map((s) => s.points.length));
  const drawMarkers = shouldDrawMarkers(densestSeries, plot.innerWidth);

  const path = d3line<{ x: number; y: number | null }>()
    .defined((p) => p.y !== null)
    .curve(curveLinear)
    .x((p) => xScale(p.x))
    .y((p) => yScale(p.y ?? 0));

  /* §6.5.2 — direct labels at the end of each line, de-collided to a 16px minimum gap. */
  const anchors = resolved.map((s) => {
    const last = [...s.points].reverse().find((p) => p.y !== null);
    return last === undefined ? plot.innerHeight : yScale(last.y ?? 0);
  });
  const labelPlacements = placeDirectLabels(anchors, { top: 0, bottom: plot.innerHeight });

  /* ---------------------------------------------------------------- interaction (§6.5.1, G-30) */

  const crosshairRef = useRef<SVGLineElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const enteredRef = useRef(false);
  const bisectX = bisector((v: number) => v);

  const snapTo = (index: number | null) => {
    setActiveIndex(index);
    if (index === null) return;
    const x = xs[index];
    if (x === undefined) return;
    const readout = chartReadout(crosshairRef.current, tooltipRef.current);
    readout.crosshair(plot.left + xScale(x));
    /*
     * **Flipped AND clamped, on both axes.** The flip keeps the box off the mark it describes; the
     * clamp keeps it inside the plot. The flip alone was not enough — it left the box overflowing
     * the panel at the extremes, and it said nothing at all about the vertical axis. Rishabh's
     * capture caught the tooltip rendering below the plot and clipped by the panel edge; the origin
     * fix in `charts.css` is what put it back inside, and this is what keeps it there.
     */
    const placed = clampTooltip(xScale(x), plot, {
      width: TOOLTIP_WIDTH,
      height: tooltipHeight(resolved.length),
    });
    readout.tooltip(placed.x, placed.y);
  };

  const onPointerMove = (event: React.PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const value = xScale.invert(event.clientX - box.left);
    const index = bisectX.center(xs, value);
    snapTo(index);
    if (!enteredRef.current && tooltipRef.current !== null) {
      enteredRef.current = true;
      fadeTooltipIn(tooltipRef.current);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<SVGRectElement>) => {
    const current = activeIndex ?? 0;
    const next =
      event.key === 'ArrowRight'
        ? Math.min(xs.length - 1, current + 1)
        : event.key === 'ArrowLeft'
          ? Math.max(0, current - 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? xs.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    snapTo(next);
  };

  const activeX = activeIndex === null ? null : (xs[activeIndex] ?? null);

  /* §6.5.1 — every series' value at that x, in ONE tooltip, **sorted by value descending**. */
  const readings =
    activeX === null
      ? []
      : resolved
          .map((s) => ({ series: s, value: s.points.find((p) => p.x === activeX)?.y ?? null }))
          .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));

  const emptyReferences = resolved
    .filter((s) => s.points.every((p) => p.y === null))
    .map((s) => s.reference);

  /*
   * **`mountKey`, not `resolved`.** `resolved` is rebuilt on every render, `useGSAP` compares deps
   * by identity, and `useMotion` hard-codes `revertOnUpdate: true` — so this used to tear down and
   * re-create G-28 on every render. `onPointerMove` sets state, so **dragging the pointer across
   * the plot restarted the reveal continuously.** `ChartMountOptions.deps` documents the rule that
   * broke: *"a chart's identity, never its data"*. `charts.motion.test.tsx` now asserts it with
   * motion enabled, which is the only condition under which the bug exists.
   */
  const { scope: motionScope } = useChartMount<HTMLDivElement>({
    origin: [plot.left, plot.top + plot.innerHeight],
    reveal: { x: plot.left, width: plot.innerWidth },
    deps: [
      mountKey(
        resolved.map((s) => s.reference),
        plot.innerWidth,
        plot.innerHeight,
      ),
    ],
  });

  return (
    <ChartFrame
      title={title}
      {...(subtitle === undefined ? {} : { subtitle })}
      ariaLabel={ariaLabel}
      {...(caption === undefined ? {} : { caption })}
      notes={notes}
      state={state}
      {...(stateCopy === undefined ? {} : { stateCopy })}
      patterns={patterns}
      onPatternsChange={setPatterns}
      {...(yCeiling === undefined || offScaleCount === 0
        ? {}
        : { offScale: { count: offScaleCount, ceiling: (formatCeiling ?? formatY)(yCeiling) } })}
      legend={<ChartLegend series={resolved} emptyReferences={emptyReferences} />}
      table={
        <SeriesTable
          series={resolved}
          caption={ariaLabel}
          xLabel={xTitle ?? 'x'}
          formatX={formatX}
          formatY={formatY}
        />
      }
    >
      <div ref={motionScope} className="chart-mount">
        <div ref={ref} className="chart-mount">
          <svg className="chart-svg" viewBox={`0 0 ${String(width)} ${String(height)}`}>
            <defs>
              {/*
               * `clipPathUnits="userSpaceOnUse"` is load-bearing. The default resolves against the
               * DATA's bounding box, so a series that stops short of the right edge would finish
               * G-28's reveal early — and in a small-multiples grid one panel would visibly reveal
               * at a different rate from its neighbour.
               */}
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

            <MeasureAxis
              plot={plot}
              ticks={yTicks}
              {...(yTitle === undefined ? {} : { title: yTitle })}
            />
            <CategoryAxis
              plot={plot}
              ticks={xTicks}
              {...(xTitle === undefined ? {} : { title: xTitle })}
            />

            {activeX !== null && (
              <line
                ref={crosshairRef}
                className="chart-crosshair"
                x1={0}
                x2={0}
                y1={plot.top}
                y2={plot.top + plot.innerHeight}
              />
            )}

            <g className="chart-marks" clipPath={`url(#${clipId})`}>
              <g transform={`translate(${String(plot.left)} ${String(plot.top)})`}>
                {clipped.map((s) => (
                  <path
                    key={s.reference}
                    className="chart-line"
                    d={path(s.points) ?? undefined}
                    strokeDasharray={DASH_ARRAY[s.dash]}
                    style={{ '--series': cssVar(s.plot) } as React.CSSProperties}
                  />
                ))}
                {/*
                 * §6.3 — **markers only where they fit.** At race density (58 laps over ~800px,
                 * 13.8px apart against an 11px marker) they collide into a bead chain that hides
                 * the line, and at four series there are 232 of them. Below the spacing floor the
                 * line is the signal and the crosshair is the readout.
                 */}
                {drawMarkers &&
                  resolved.map((s) =>
                    s.points
                      .filter((p) => p.y !== null)
                      .map((p) => (
                        <MarkerGlyph
                          key={`${s.reference}-${String(p.x)}`}
                          shape={s.marker}
                          token={s.plot}
                          x={xScale(p.x)}
                          y={yScale(p.y ?? 0)}
                        />
                      )),
                  )}
                {/*
                 * §6.3's off-scale carets. Drawn **regardless of marker density** — unlike a marker,
                 * a caret is not one of a series of equivalent readings, it is a statement that this
                 * reading is not where it appears. Suppressing it at race density would remove the
                 * only visible sign that the axis is clipped.
                 */}
                {clipped.map((s) =>
                  s.points
                    .filter((p) => p.offScale)
                    .map((p) => (
                      <path
                        key={`${s.reference}-off-${String(p.x)}`}
                        className="chart-offscale"
                        d={offScalePath()}
                        transform={`translate(${fmtCoord(xScale(p.x))} ${fmtCoord(yScale(p.y ?? 0))})`}
                        style={{ '--series': cssVar(s.plot) } as React.CSSProperties}
                      />
                    )),
                )}
              </g>
            </g>

            {/* §6.5.2 — direct labels, outside the clip so they are never wiped by G-28. */}
            {resolved.length <= 4 && (
              <g
                transform={`translate(${String(plot.left + plot.innerWidth)} ${String(plot.top)})`}
              >
                {resolved.map((s, i) => {
                  const placement = labelPlacements[i];
                  if (placement === undefined) return null;
                  return (
                    <g
                      key={s.reference}
                      style={{ '--series': cssVar(s.plot) } as React.CSSProperties}
                    >
                      {placement.leader && (
                        <line
                          className="chart-leader"
                          x1={0}
                          y1={placement.anchor}
                          x2={8}
                          y2={placement.y}
                        />
                      )}
                      <text
                        className="chart-direct-label"
                        x={12}
                        y={placement.y}
                        dominantBaseline="middle"
                      >
                        {s.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/*
             * §6.5.1 — the hit target. One transparent rect over the whole plot, and it is the
             * chart's single tab stop: ←/→ step the crosshair, Home/End jump to the ends. A 2px line
             * is not a hit target and never was.
             */}
            <rect
              className="chart-hit"
              x={plot.left}
              y={plot.top}
              width={plot.innerWidth}
              height={plot.innerHeight}
              tabIndex={0}
              role="application"
              aria-label={`${title}. Use the left and right arrow keys to read each point.`}
              onPointerMove={onPointerMove}
              onPointerLeave={() => {
                enteredRef.current = false;
                setActiveIndex(null);
              }}
              onKeyDown={onKeyDown}
            />
          </svg>

          {activeX !== null && (
            <div
              className="chart-tooltip"
              ref={tooltipRef}
              /*
               * **The transform's origin, declared next to the code that depends on it.**
               * G-30 writes `x`/`y` as a transform via `quickSetter`, and a transform is measured
               * from the element's own box — so without an explicit origin the box sits at its
               * static flow position, after the `<svg>`, and the tooltip renders *below* the plot.
               * That shipped, and Rishabh's capture caught it.
               *
               * Inline rather than left to `charts.css` for two reasons: `BarChart` already does it
               * this way and never had the bug, and an inline style is **assertable in jsdom**
               * whereas `charts.css` is not — the Tailwind Vite plugin claims `?raw` imports of it
               * and returns an empty string, so no CSS-text test could ever have guarded this.
               */
              style={{ left: 0, top: 0 }}
            >
              {/* `labelX`, not `formatX` — the reader at a crosshair is asking which race. */}
              <p className="chart-tooltip-title">{labelX(activeX)}</p>
              {readings.map(({ series: s, value }) => (
                <p className="chart-tooltip-row" key={s.reference}>
                  <span
                    className="chart-swatch"
                    aria-hidden="true"
                    style={{ '--series': cssVar(s.plot) } as React.CSSProperties}
                  />
                  <span>{s.label}</span>
                  <span className="chart-tooltip-value">
                    {value === null ? '—' : formatY(value)}
                  </span>
                </p>
              ))}
            </div>
          )}

          {/*
           * §6.5.1 — the tooltip's content mirrored into a live region, so the reading is announced
           * rather than only drawn. Without this the keyboard path moves a crosshair a screen-reader
           * user cannot read.
           */}
          <p aria-live="polite" className="sr-only">
            {activeX === null
              ? ''
              : `${labelX(activeX)}: ${readings
                  .map(
                    (r) => `${r.series.label} ${r.value === null ? 'no data' : formatY(r.value)}`,
                  )
                  .join(', ')}`}
          </p>
        </div>
      </div>
    </ChartFrame>
  );
}
