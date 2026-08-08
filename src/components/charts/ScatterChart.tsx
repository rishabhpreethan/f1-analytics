import { scaleLinear } from 'd3-scale';
import { useId, useState, type ReactNode } from 'react';
import { assignEntityColours, cssVar } from '@/lib/entityColor';
import { CHART_REVEAL_ATTR, useChartMount } from '@/lib/motion/chart';
import { CategoryAxis, MeasureAxis } from './Axis';
import { ChartFrame } from './ChartFrame';
import { ScatterTable } from './ChartTable';
import {
  computeMargin,
  measureTickCount,
  monoTextWidth,
  mountKey,
  plotArea,
  timeTickCount,
  withEndpoints,
} from './geometry';
import { assignLadder, type LadderState } from './ladder';
import { MarkerGlyph } from './MarkerGlyph';
import type { PlotState } from './types';
import { useChartSize } from './useChartSize';

/**
 * **The scatter chart, with fitted trends** — RD-4, `DESIGN_SYSTEM.md` §6.6.1, specified through §6.1:
 *
 * 1. **Job**: change over time within a phase — does a car slow as a stint goes on?
 * 2. **Form**: a scatter, one group per stint, with a least-squares trend per group. Not a line chart:
 *    consecutive laps are not a continuous quantity to interpolate between, and joining them would
 *    assert a path through laps the fit deliberately excluded.
 * 3. **Marks**: the group's marker glyph at ≥8px. **The trend is a 2px dashed line in the same
 *    token** — see below, this is the rule the whole form turns on.
 * 4. **Interaction**: per-point tooltip; siblings dim on hover, opacity only.
 * 5. **Colour**: the entity's, through `assignEntityColours` and the ladder.
 * 6. **Accessibility**: a table view carrying every point and every fit's slope and r², a legend, and
 *    the bands named in words rather than only drawn.
 *
 * ---
 *
 * ## Two rules this form exists to enforce
 *
 * **A model is never drawn like a measurement.** The points are what happened; the trend is a
 * least-squares line through them, which is a *claim*. It is **dashed** where the data is solid, so the
 * distinction survives being screenshotted, printed and read in greyscale — the same reason §6.4's
 * ladder uses dash as a channel rather than relying on colour. A solid trend line through a scatter is
 * the single most common way a chart launders a model into a fact.
 *
 * **An inferred period is hatched, never filled.** `bands` are laps a heuristic flagged as probably
 * neutralised, and hatch already means *"a different kind of thing"* in this system (rung 4, §6.4), so
 * it costs no new vocabulary. A solid band would read as recorded data. The copy that goes with it is
 * §6.6.1's, and it must say **"likely safety car or red flag"** — never "safety car", because the data
 * carries no flag to distinguish them.
 */

export interface ScatterPoint {
  x: number;
  y: number;
}

/** A least-squares trend, already computed. The chart draws it; it never fits anything itself. */
export interface ScatterFit {
  slope: number;
  intercept: number;
  /**
   * Coefficient of determination. **Required, not optional** — a slope without a goodness-of-fit is
   * how a straight line through noise becomes a claim about tyre wear, and the caller cannot decide
   * whether to trust the line without it.
   */
  r2: number;
  n: number;
}

export interface ScatterGroup {
  reference: string;
  teamReference: string;
  label: string;
  points: readonly ScatterPoint[];
  /** `null` when no fit is defined — fewer than 3 clean laps, or no variance in the lap numbers. */
  fit?: ScatterFit | null;
}

/** A hatched region of the category axis. Inferred, never recorded. */
export interface ScatterBand {
  key: string;
  from: number;
  to: number;
}

export interface ScatterChartProps {
  groups: readonly ScatterGroup[];
  bands?: readonly ScatterBand[];
  title: string;
  subtitle?: string;
  ariaLabel: string;
  caption?: ReactNode;
  notes?: readonly ReactNode[];
  state?: PlotState;
  stateCopy?: { title?: string; body: string; action?: ReactNode };
  xTitle?: string;
  yTitle?: string;
  formatX?: (x: number) => string;
  formatY?: (y: number) => string;
  /**
   * Draw a group's trend only when its r² reaches this. Below it the points render **without a
   * line**, and the caller states why.
   *
   * A judgement, not a measurement, and labelled as one: there is no ground truth for tyre
   * degradation in this data either. 0.5 is the conventional weak-but-real threshold, and the reason
   * to have any floor is that a four-lap stint will happily produce a confident-looking slope that
   * explains none of the variation.
   */
  trendFloor?: number;
}

const identity = (n: number) => String(n);

export const TREND_R2_FLOOR = 0.5;

export function ScatterChart({
  groups,
  bands = [],
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
  formatY = identity,
  trendFloor = TREND_R2_FLOOR,
}: ScatterChartProps) {
  const clipId = useId().replace(/:/g, '');
  const hatchId = useId().replace(/:/g, '');
  const titleId = useId();
  const { ref, width, height } = useChartSize<HTMLDivElement>();
  const [active, setActive] = useState<string | null>(null);
  const [sticky, setSticky] = useState<LadderState>({
    marker: false,
    dash: false,
    texture: false,
  });

  const coloured = assignEntityColours(
    groups.map((g) => ({ reference: g.reference, teamReference: g.teamReference })),
  );
  const ladder = assignLadder(coloured, { sticky, patterns: false });
  if (ladder.state.marker !== sticky.marker || ladder.state.dash !== sticky.dash) {
    setSticky({ marker: ladder.state.marker, dash: ladder.state.dash, texture: false });
  }
  const channels = new Map(ladder.series.map((entry) => [entry.reference, entry]));

  const xs = groups.flatMap((g) => g.points.map((p) => p.x));
  const ys = groups.flatMap((g) => g.points.map((p) => p.y));

  /*
   * The x domain includes the bands, so a flagged period at the end of a stint is not clipped off the
   * axis — the note would then count laps the reader cannot see.
   */
  const xMin = Math.min(...(xs.length > 0 ? xs : [0]), ...bands.map((b) => b.from));
  const xMax = Math.max(...(xs.length > 0 ? xs : [1]), ...bands.map((b) => b.to));
  const yMin = Math.min(...(ys.length > 0 ? ys : [0]));
  const yMax = Math.max(...(ys.length > 0 ? ys : [1]));

  const provisional = height > 0 ? height : 240;
  const tickCount = measureTickCount(provisional);
  const measureLabels = scaleLinear()
    .domain([yMin, yMax])
    .nice(tickCount)
    .ticks(tickCount)
    .map(formatY);

  const margin = computeMargin({
    measureLabels,
    hasCategoryLabels: true,
    hasMeasureTitle: yTitle !== undefined,
    hasCategoryTitle: xTitle !== undefined,
  });
  const plot = plotArea(width, height, margin);

  const xScale = scaleLinear().domain([xMin, xMax]).range([0, plot.innerWidth]);
  const yScale = scaleLinear().domain([yMin, yMax]).nice(tickCount).range([plot.innerHeight, 0]);

  const yTicks = yScale.ticks(tickCount).map((value) => ({
    offset: yScale(value),
    label: formatY(value),
  }));

  const xGap =
    plot.innerWidth > 0
      ? ((monoTextWidth(formatX(xMax)) + 11) * (xMax - xMin)) / plot.innerWidth
      : 0;
  const xTicks = withEndpoints(xScale.ticks(timeTickCount(plot.innerWidth)), xMin, xMax, xGap).map(
    (value) => ({ offset: xScale(value), label: formatX(value) }),
  );

  const { scope: motionScope } = useChartMount<HTMLDivElement>({
    origin: [plot.left, plot.top + plot.innerHeight],
    reveal: { x: plot.left, width: plot.innerWidth },
    deps: [
      mountKey(
        groups.map((g) => g.reference),
        plot.innerWidth,
        plot.innerHeight,
      ),
    ],
  });

  const hovered = groups
    .flatMap((g) => g.points.map((p) => ({ group: g, point: p })))
    .find(({ group, point }) => `${group.reference}-${String(point.x)}` === active);

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
        <ScatterTable
          groups={groups}
          caption={ariaLabel}
          xLabel={xTitle ?? 'x'}
          yLabel={yTitle ?? 'y'}
          formatX={formatX}
          formatY={formatY}
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

              {/*
               * Rung 4's 45° hatch, as a pattern rather than per-band strokes: a band can be one lap
               * or fifteen, and a pattern tiles either without the component computing line counts.
               */}
              <pattern
                id={hatchId}
                width="6"
                height="6"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
              >
                <line className="chart-hatch-line" x1="0" y1="0" x2="0" y2="6" />
              </pattern>
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

            {/*
             * **Behind the marks, and hatched rather than filled.** These are laps a heuristic
             * flagged, not laps the data records as neutralised — there is no such flag. Drawing them
             * under the points also means a point is never obscured by an inference about it.
             */}
            <g aria-hidden="true">
              {bands.map((band) => (
                <rect
                  key={band.key}
                  className="chart-band"
                  x={plot.left + xScale(band.from)}
                  y={plot.top}
                  width={Math.max(2, xScale(band.to) - xScale(band.from))}
                  height={plot.innerHeight}
                  fill={`url(#${hatchId})`}
                />
              ))}
            </g>

            <g className="chart-marks" data-dimmed={active !== null} clipPath={`url(#${clipId})`}>
              <g transform={`translate(${String(plot.left)} ${String(plot.top)})`}>
                {groups.map((group) => {
                  const channel = channels.get(group.reference);
                  if (channel === undefined) return null;
                  const drawFit = group.fit != null && group.fit.r2 >= trendFloor;

                  return (
                    <g key={group.reference}>
                      {/*
                       * **The trend, dashed — a model, never drawn like a measurement.** Rendered
                       * before the points so the points sit on top of it: the data is the subject.
                       */}
                      {drawFit && group.fit != null && (
                        <line
                          className="chart-trend"
                          x1={xScale(Math.min(...group.points.map((p) => p.x)))}
                          y1={yScale(
                            group.fit.slope * Math.min(...group.points.map((p) => p.x)) +
                              group.fit.intercept,
                          )}
                          x2={xScale(Math.max(...group.points.map((p) => p.x)))}
                          y2={yScale(
                            group.fit.slope * Math.max(...group.points.map((p) => p.x)) +
                              group.fit.intercept,
                          )}
                          style={{ '--series': cssVar(channel.plot) } as React.CSSProperties}
                        />
                      )}

                      {group.points.map((point) => (
                        <g
                          key={`${group.reference}-${String(point.x)}`}
                          onPointerEnter={() => {
                            setActive(`${group.reference}-${String(point.x)}`);
                          }}
                          onPointerLeave={() => {
                            setActive(null);
                          }}
                        >
                          <MarkerGlyph
                            shape={channel.marker}
                            token={channel.plot}
                            x={xScale(point.x)}
                            y={yScale(point.y)}
                          />
                        </g>
                      ))}
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>

          {hovered !== undefined && (
            <div
              className="chart-tooltip"
              style={{
                left: 0,
                top: 0,
                transform: `translate(${String(plot.left + 8)}px, ${String(plot.top + 8)}px)`,
              }}
            >
              <p className="chart-tooltip-title">{formatX(hovered.point.x)}</p>
              <p className="chart-tooltip-row">
                <span>{hovered.group.label}</span>
                <span className="chart-tooltip-value">{formatY(hovered.point.y)}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </ChartFrame>
  );
}
