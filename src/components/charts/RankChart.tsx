import { bisector } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import { line as d3line, curveLinear } from 'd3-shape';
import { useId, useRef, useState, type ReactNode } from 'react';
import { assignEntityColours, cssVar, plotToken } from '@/lib/entityColor';
import { chartReadout, CHART_REVEAL_ATTR, fadeTooltipIn, useChartMount } from '@/lib/motion/chart';
import { CategoryAxis, MeasureAxis } from './Axis';
import { ChartFrame } from './ChartFrame';
import { SeriesTable } from './ChartTable';
import {
  clampTooltip,
  computeMargin,
  labelCapacity,
  monoTextWidth,
  mountKey,
  nearestByOffset,
  ISOLATION_THRESHOLD,
  placeDirectLabels,
  plotArea,
  positionTicksWithin,
  shouldDrawMarkers,
  timeTickCount,
  tooltipHeight,
  withEndpoints,
  TICK_LABEL_SIZE,
  TOOLTIP_WIDTH,
} from './geometry';
import { assignLadder, COMPARISON_CAP, DASH_ARRAY, type LadderState } from './ladder';
import { MarkerGlyph } from './MarkerGlyph';
import type { PlotState } from './types';
import { useChartSize } from './useChartSize';

/**
 * **The rank chart** — `DESIGN_SYSTEM.md` §6.5.4a, and the one permitted many-series line.
 *
 * A separate component rather than a mode on `LineChart`, because §6.5.4a defines it as a distinct
 * *form* with five binding conditions and almost none of `LineChart`'s defaults survive: markers are
 * off, labels are at both ends, the field is recessive, and the tooltip does not show every series.
 * Bolting that onto the chart the season hub depends on would have destabilised a shipped surface to
 * save a file.
 *
 * ---
 *
 * ## Three refinements the design system needed at 22 series, all recorded in §6.5.4a
 *
 * **1. The resting state is legible on its own; isolation is an aid, not a prerequisite.** A chart
 * that only resolves when you hover it has failed for anyone reading a screenshot, printing it, or
 * using a keyboard. So the split is *at rest*: the **selected** ≤4 are drawn at full weight with dash
 * patterns, and the **field** is drawn recessive — 1px, `opacity: 0.35`, no dash, no markers. That
 * gives a foreground you can read and a background that shows the race's churn as a shape, which is
 * §6.5.4a's condition 5 made visual rather than merely stated.
 *
 * **2. Both-end labels are capacity-checked, not assumed.** §6.5.4a made them a condition of the
 * exemption; at 22 series the labels are the dense part rather than the lines. `labelCapacity` says a
 * 360px plot holds 23 labels at §6.5.2's 16px pitch, so the full field is labelled at desktop and not
 * at 288px or 240px. Where it does not fit the **selected series are still always labelled**, plus P1
 * and the last classified runner — the two the eye looks for — and the rest are identified by hover,
 * by the table view, and by the position axis, which already states their rank.
 *
 * Labels are the driver's **code** where one exists (`VER`, `HAM`), which is the sport's own timing
 * convention and about a third the width of a surname. `abbreviation` covers only 107 of 881 drivers,
 * so it falls back to the full label rather than assuming the modern era.
 *
 * **3. The tooltip shows the selected series and the hovered one — not all 22.** §6.5.1 says *"every
 * series' value at that x, in ONE tooltip"*, which at 22 series is a tooltip taller than the plot it
 * covers. The rule's purpose is that the reader should not have to chase per-series tooltips; that is
 * satisfied by one tooltip carrying the analysis set. The full field at that lap is in the table.
 */

export interface RankSeries {
  reference: string;
  teamReference: string;
  label: string;
  /** `driver.abbreviation` where one exists. Null before the code era — not `''`. */
  shortLabel?: string | null;
  points: readonly { x: number; y: number | null }[];
}

export interface RankChartProps {
  series: readonly RankSeries[];
  /** The emphasised set, ≤ `COMPARISON_CAP`. Everything else is drawn as recessive context. */
  selected?: readonly string[];
  /**
   * The size of the field, which is the axis. Falls back to the deepest rank present — but a race
   * where nobody ran below 12th still had 20 cars, and the axis should say so.
   */
  fieldSize?: number;
  title: string;
  subtitle?: string;
  ariaLabel: string;
  caption?: ReactNode;
  notes?: readonly ReactNode[];
  state?: PlotState;
  stateCopy?: { title?: string; body: string; action?: ReactNode };
  xTitle?: string;
  formatX?: (x: number) => string;
  formatXLong?: (x: number) => string;
}

const identity = (n: number) => String(n);
const formatRank = (value: number) => `P${String(value)}`;

export function RankChart({
  series,
  selected = [],
  fieldSize,
  title,
  subtitle,
  ariaLabel,
  caption,
  notes = [],
  state = 'ready',
  stateCopy,
  xTitle,
  formatX = identity,
  formatXLong,
}: RankChartProps) {
  const clipId = useId().replace(/:/g, '');
  const titleId = useId();
  const { ref, width, height } = useChartSize<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [sticky, setSticky] = useState<LadderState>({
    marker: false,
    dash: false,
    texture: false,
  });

  const labelX = formatXLong ?? formatX;
  const selectedSet = new Set(selected.slice(0, COMPARISON_CAP));

  /*
   * Two colour paths, and the split is the point. The **selection** goes through
   * `assignEntityColours` + `assignLadder`, so two teammates get the shade pair and every member gets
   * a dash rung. The **field** takes `plotToken` directly: it is context, and giving 22 series ladder
   * rungs would spend every channel on lines nobody is reading yet.
   */
  const chosen = series.filter((s) => selectedSet.has(s.reference));
  const coloured = assignEntityColours(
    chosen.map((s) => ({ reference: s.reference, teamReference: s.teamReference })),
  );
  const ladder = assignLadder(coloured, { sticky, patterns: false });
  if (ladder.state.marker !== sticky.marker || ladder.state.dash !== sticky.dash) {
    setSticky({ marker: ladder.state.marker, dash: ladder.state.dash, texture: false });
  }
  const channelsFor = new Map(ladder.series.map((entry) => [entry.reference, entry]));

  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
  const ranks = series.flatMap((s) =>
    s.points.map((p) => p.y).filter((y): y is number => y !== null),
  );
  const deepest = fieldSize ?? Math.max(1, ...ranks);

  const yTicks0 = positionTicksWithin(1, deepest);
  const margin = computeMargin({
    measureLabels: yTicks0.map(formatRank),
    hasCategoryLabels: true,
    hasMeasureTitle: true,
    hasCategoryTitle: xTitle !== undefined,
    /* Both ends carry labels, so the gutter is reserved on the right and the left margin already
     * holds the rank axis. The widest short code decides. */
    directLabelWidth: Math.max(
      0,
      ...series.map((s) => monoTextWidth(s.shortLabel ?? s.label, TICK_LABEL_SIZE)),
    ),
  });
  const plot = plotArea(width, height, margin);

  const xScale = scaleLinear()
    .domain([xs[0] ?? 0, xs[xs.length - 1] ?? 1])
    .range([0, plot.innerWidth]);

  /* §6.3 — inverted, P1 at the top. In F1 up means faster and 1 is the best value. */
  const yScale = scaleLinear().domain([1, deepest]).range([0, plot.innerHeight]);

  const yTicks = yTicks0.map((value) => ({ offset: yScale(value), label: formatRank(value) }));

  const xDomainMin = xs[0] ?? 0;
  const xDomainMax = xs[xs.length - 1] ?? 1;
  const xGap =
    plot.innerWidth > 0
      ? ((monoTextWidth(formatX(xDomainMax)) + TICK_LABEL_SIZE) * (xDomainMax - xDomainMin)) /
        plot.innerWidth
      : 0;
  const xTicks = withEndpoints(
    xScale.ticks(timeTickCount(plot.innerWidth)),
    xDomainMin,
    xDomainMax,
    xGap,
  ).map((value) => ({ offset: xScale(value), label: formatX(value) }));

  const path = d3line<{ x: number; y: number | null }>()
    .defined((p) => p.y !== null)
    .curve(curveLinear)
    .x((p) => xScale(p.x))
    .y((p) => yScale(p.y ?? 1));

  /* ------------------------------------------------------------------ labelling (refinement 2) */

  const firstRank = (s: RankSeries) => s.points.find((p) => p.y !== null)?.y ?? null;
  const lastRank = (s: RankSeries) => [...s.points].reverse().find((p) => p.y !== null)?.y ?? null;

  const capacity = labelCapacity(plot.innerHeight);
  const labelAll = series.length <= capacity;

  /*
   * When the field cannot all be labelled: the selection always is, plus P1 and the deepest finisher
   * — the two positions the eye goes to first. Everything else is identified by hover, by the table,
   * and by the rank axis, which already states its position.
   */
  const finishers = series.filter((s) => lastRank(s) !== null);
  const leader = finishers.reduce<RankSeries | null>(
    (best, s) => (best === null || (lastRank(s) ?? 99) < (lastRank(best) ?? 99) ? s : best),
    null,
  );
  const backmarker = finishers.reduce<RankSeries | null>(
    (worst, s) => (worst === null || (lastRank(s) ?? 0) > (lastRank(worst) ?? 0) ? s : worst),
    null,
  );
  const labelled = new Set<string>(
    labelAll
      ? series.map((s) => s.reference)
      : [
          ...selectedSet,
          ...(leader === null ? [] : [leader.reference]),
          ...(backmarker === null ? [] : [backmarker.reference]),
        ],
  );

  /** One end's labels, de-collided independently — the two ends have different orders. */
  const endLabels = (side: 'left' | 'right') => {
    const shown = series.filter(
      (s) => labelled.has(s.reference) && (side === 'left' ? firstRank(s) : lastRank(s)) !== null,
    );
    const anchors = shown.map((s) => yScale((side === 'left' ? firstRank(s) : lastRank(s)) ?? 1));
    const placements = placeDirectLabels(anchors, { top: 0, bottom: plot.innerHeight });
    return shown.map((s, i) => ({ series: s, placement: placements[i] }));
  };

  /* ------------------------------------------------------------------- interaction (§6.5.1, G-30) */

  const crosshairRef = useRef<SVGLineElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const enteredRef = useRef(false);
  const bisectX = bisector((v: number) => v);

  /* Refinement 3: the selection plus whatever is hovered — never all 22. */
  const readoutSeries = series.filter(
    (s) => selectedSet.has(s.reference) || s.reference === hovered,
  );

  const snapTo = (index: number | null) => {
    setActiveIndex(index);
    if (index === null) return;
    const x = xs[index];
    if (x === undefined) return;
    const readout = chartReadout(crosshairRef.current, tooltipRef.current);
    readout.crosshair(plot.left + xScale(x));
    const placed = clampTooltip(xScale(x), plot, {
      width: TOOLTIP_WIDTH,
      height: tooltipHeight(Math.max(1, readoutSeries.length)),
    });
    readout.tooltip(placed.x, placed.y);
  };

  /*
   * ⚠ **Isolation is driven from the single hit target, not from per-line `pointerenter`.**
   *
   * The first version put `onPointerEnter` on each `<path>`. It passed in jsdom — because a test
   * dispatches the event straight at the element — and **could never have fired in a browser**: the
   * hit rect covers the whole plot area and is painted *after* the lines, so it swallows every
   * pointer event before a line sees one. Hover-isolation would have shipped dead, and the test would
   * have said it worked. Same shape as a coordinate resolved against the wrong origin: the code was
   * right about what it wanted and wrong about where it was.
   *
   * Deriving it from proximity is also better on its own terms — it needs one listener rather than
   * twenty-two, and it costs nothing that a 1px line at 58 laps could not already fail to be hit.
   */
  const nearestAt = (x: number, pointerY: number): string | null =>
    nearestByOffset(
      series.flatMap((s) => {
        const rank = s.points.find((p) => p.x === x)?.y;
        return rank === undefined || rank === null
          ? []
          : [{ reference: s.reference, offset: yScale(rank) }];
      }),
      pointerY,
      ISOLATION_THRESHOLD,
    );

  const onPointerMove = (event: React.PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const value = xScale.invert(event.clientX - box.left);
    const index = bisectX.center(xs, value);
    snapTo(index);

    const x = xs[index];
    setHovered(x === undefined ? null : nearestAt(x, event.clientY - box.top));

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
  const readings =
    activeX === null
      ? []
      : readoutSeries
          .map((s) => ({ series: s, value: s.points.find((p) => p.x === activeX)?.y ?? null }))
          /* Ascending, because on a rank axis a *lower* number is better and a tooltip sorted
           * "descending by value" would put last place at the top. */
          .sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity));

  const { scope: motionScope } = useChartMount<HTMLDivElement>({
    origin: [plot.left, plot.top],
    reveal: { x: plot.left, width: plot.innerWidth },
    deps: [
      mountKey(
        [...series.map((s) => s.reference), ...selectedSet],
        plot.innerWidth,
        plot.innerHeight,
      ),
    ],
  });

  const drawMarkers = shouldDrawMarkers(Math.max(1, ...series.map((s) => s.points.length)), plot.innerWidth);

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
        <SeriesTable
          series={series.map((s) => ({
            reference: s.reference,
            teamReference: s.teamReference,
            label: s.label,
            points: s.points,
            plot: plotToken(s.teamReference),
            identity: plotToken(s.teamReference),
            marker: 'circle' as const,
            dash: 'solid' as const,
            texture: false,
            teammate: false,
            colourExhausted: false,
          }))}
          caption={ariaLabel}
          xLabel={xTitle ?? 'x'}
          formatX={formatX}
          formatY={formatRank}
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

            <MeasureAxis plot={plot} ticks={yTicks} title="Championship position" />
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

            {/*
             * `data-isolated` is what turns the resting texture into one readable line on hover —
             * opacity only, never a colour change (§6.5.1), and it is an *aid*: the resting state
             * already separates the selection from the field, so nothing depends on hovering.
             */}
            <g
              className="chart-marks chart-rank"
              data-isolated={hovered !== null}
              clipPath={`url(#${clipId})`}
            >
              <g transform={`translate(${String(plot.left)} ${String(plot.top)})`}>
                {series.map((s) => {
                  const channels = channelsFor.get(s.reference);
                  const isSelected = channels !== undefined;
                  const token = channels?.plot ?? plotToken(s.teamReference);

                  return (
                    <path
                      key={s.reference}
                      className="chart-rank-line"
                      data-selected={isSelected}
                      data-hovered={hovered === s.reference}
                      d={path(s.points) ?? undefined}
                      {...(isSelected && channels.dash !== 'solid'
                        ? { strokeDasharray: DASH_ARRAY[channels.dash] }
                        : {})}
                      style={{ '--series': cssVar(token) } as React.CSSProperties}
                    />
                  );
                })}

                {/* Markers only on the selection, and only where density allows. The field never
                  * carries them — 22 × 58 is 1,276 marks (§6.5.4a condition 2). */}
                {drawMarkers &&
                  chosen.map((s) => {
                    const channels = channelsFor.get(s.reference);
                    if (channels === undefined) return null;
                    return s.points
                      .filter((p) => p.y !== null)
                      .map((p) => (
                        <MarkerGlyph
                          key={`${s.reference}-${String(p.x)}`}
                          shape={channels.marker}
                          token={channels.plot}
                          x={xScale(p.x)}
                          y={yScale(p.y ?? 1)}
                        />
                      ));
                  })}
              </g>
            </g>

            {/* Both ends, outside the clip so G-28 never wipes them (§6.5.4a condition 3). */}
            <g transform={`translate(${String(plot.left)} ${String(plot.top)})`}>
              {endLabels('left').map(({ series: s, placement }) =>
                placement === undefined ? null : (
                  <text
                    key={`l-${s.reference}`}
                    className="chart-rank-label"
                    data-selected={selectedSet.has(s.reference)}
                    x={-8}
                    y={placement.y}
                    textAnchor="end"
                    dominantBaseline="middle"
                  >
                    {s.shortLabel ?? s.label}
                  </text>
                ),
              )}
            </g>

            <g
              transform={`translate(${String(plot.left + plot.innerWidth)} ${String(plot.top)})`}
            >
              {endLabels('right').map(({ series: s, placement }) =>
                placement === undefined ? null : (
                  <text
                    key={`r-${s.reference}`}
                    className="chart-rank-label"
                    data-selected={selectedSet.has(s.reference)}
                    x={8}
                    y={placement.y}
                    dominantBaseline="middle"
                  >
                    {s.shortLabel ?? s.label}
                  </text>
                ),
              )}
            </g>

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
                setHovered(null);
              }}
              onKeyDown={onKeyDown}
            />
          </svg>

          {activeX !== null && readings.length > 0 && (
            <div className="chart-tooltip" ref={tooltipRef} style={{ left: 0, top: 0 }}>
              <p className="chart-tooltip-title">{labelX(activeX)}</p>
              {readings.map(({ series: s, value }) => (
                <p className="chart-tooltip-row" key={s.reference}>
                  <span
                    className="chart-swatch"
                    aria-hidden="true"
                    style={
                      {
                        '--series': cssVar(
                          channelsFor.get(s.reference)?.plot ?? plotToken(s.teamReference),
                        ),
                      } as React.CSSProperties
                    }
                  />
                  <span>{s.shortLabel ?? s.label}</span>
                  <span className="chart-tooltip-value">
                    {value === null ? '—' : formatRank(value)}
                  </span>
                </p>
              ))}
            </div>
          )}

          <p aria-live="polite" className="sr-only">
            {activeX === null
              ? ''
              : `${labelX(activeX)}: ${readings
                  .map(
                    (r) =>
                      `${r.series.label} ${r.value === null ? 'no position' : formatRank(r.value)}`,
                  )
                  .join(', ')}`}
          </p>
        </div>
      </div>
    </ChartFrame>
  );
}
