import { scaleBand, scaleLinear } from 'd3-scale';
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { assignEntityColours, cssVar, identityToken } from '@/lib/entityColor';
import { CHART_REVEAL_ATTR, useChartMount } from '@/lib/motion/chart';
import { ChartFrame } from './ChartFrame';
import { ShareTable } from './ChartTable';
import { computeMargin, mountKey, normaliseShareRow, plotArea, spanPath } from './geometry';
import type { PlotState } from './types';
import { useChartSize } from './useChartSize';

/**
 * **The share chart** — the kit's fourth form. `DESIGN_SYSTEM.md` §6.6.3, built for CN-4 (a team's
 * intra-team points split) and specified through §6.1:
 *
 * 1. **Job**: **composition** — part-to-whole within a category. Not magnitude (a bar), not sequence
 *    (a span), not change over time (a line). "Which driver carried the team, season by season" is a
 *    question about *shares*, and no other form in the kit answers it.
 * 2. **Form**: one row per category, segments laid end to end along a `[0, 1]` axis. It beats a
 *    stacked bar because the kit has no stack and `d3-shape.stack`'s cumulative round trip is the
 *    error source §6.6 already rejected for the span chart; it beats a pie because two slices across
 *    seventy rows is seventy pies; and it beats a grouped bar because a grouped bar encodes
 *    magnitude, which is a different question with a different answer.
 * 3. **Marks**: full band height, a 2px `--surface-sunken` gap between segments, and §6.3's 4px
 *    radius on the **row's outer ends only** — an interior boundary is square, exactly as in the
 *    span chart and for the same reason.
 * 4. **Interaction**: per-segment tooltip (§6.5.1's bar/dot/cell rule); the hovered segment keeps
 *    full opacity and its siblings drop to 0.4, opacity only.
 * 5. **Colour**: `assignEntityColours` **per row**, so the segments of one row are coloured as a
 *    group. On a team page the group is that season's team-mates, which means the §6.4a shade pair
 *    applies without the caller asking for it.
 * 6. **Accessibility**: every row labelled in the gutter, every segment directly labelled where it
 *    fits and named in its tooltip, and a table view carrying entity, raw value and share.
 *
 * ---
 *
 * ## Two invariants this component enforces rather than trusts the caller with
 *
 * **1. Rows are normalised here.** The caller passes raw values; the component divides. §6.6.3 makes
 * this the component's job because normalising is what makes the chart legal at all: raw points are
 * comparable *within* one season and never across eras (`REQUIREMENTS.md` §5.2, `DATABASE.md` trap
 * 4), and a share is a ratio of two figures scored under one system — so a 1961 row and a 2026 row
 * are comparable as shares while their points never are. A caller that pre-normalised would be free
 * to pass rows summing to 0.9 or 1.4, and neither would look wrong on screen.
 *
 * **2. A row whose raw total is zero is a designed state, not a division.** `0 / 0` is `NaN`, an SVG
 * `width="NaN"` paints nothing, and the row would silently vanish — §1.0's exact failure mode, where
 * something absent is given the meaning of something present. Such a row draws as one full-width
 * `--surface-sunken` band carrying `emptyRowLabel`, which states the fact ("No points scored")
 * rather than leaving a hole. Negative totals are impossible for a share and are treated the same
 * way, because a negative share has no meaning either.
 *
 * **The entrance is G-28's clip wipe, not G-27's growth.** A segment beginning at 62% must not grow
 * from the axis: that animates its *start* moving, which is the one thing a composition chart must
 * not say — the same argument the span chart makes about a stint beginning at lap 30.
 */

/** One entity's contribution to one row. `value` is **raw**; the component normalises. */
export interface ShareSegment {
  /** The entity's own stable identifier — `driver.reference`. Used for keys, order and colour. */
  reference: string;
  /** The team this entity plots as. On a team page, every segment shares it — which is the point. */
  teamReference: string;
  label: string;
  /** Drawn inside the segment when it is wide enough. Terse — a code, or a figure. */
  shortLabel?: string;
  value: number;
}

export interface ShareRow {
  /** Stable key — the season year, typically. */
  key: string;
  label: string;
  segments: readonly ShareSegment[];
}

export interface ShareChartProps {
  rows: readonly ShareRow[];
  title: string;
  subtitle?: string;
  ariaLabel: string;
  caption?: ReactNode;
  notes?: readonly ReactNode[];
  state?: PlotState;
  stateCopy?: { title?: string; body: string; action?: ReactNode };
  /** The measure axis title. **Carries the unit**: "Share of the team's driver points (%)". */
  measureTitle: string;
  /** The raw value's name, for the tooltip and the table: "Points". */
  valueTitle: string;
  /** The entity column's name in the table: "Driver". */
  entityTitle?: string;
  /** The category column's name in the table: "Season". */
  categoryTitle?: string;
  formatValue?: (value: number) => string;
  /** What a zero-total row says about itself. Stated, never blank. */
  emptyRowLabel?: string;
}

const identity = (n: number) => String(n);

/** Below this width a segment cannot carry its own label without the text overflowing its fill. */
const LABEL_MIN_WIDTH = 28;

/** The share axis is always the whole of it: ticks at 0, 25, 50, 75 and 100 per cent. */
const SHARE_TICKS = [0, 0.25, 0.5, 0.75, 1] as const;

const formatShare = (share: number) => `${String(Math.round(share * 100))}%`;

export function ShareChart({
  rows,
  title,
  subtitle,
  ariaLabel,
  caption,
  notes = [],
  state = 'ready',
  stateCopy,
  measureTitle,
  valueTitle,
  entityTitle = 'Entity',
  categoryTitle = 'Category',
  formatValue = identity,
  emptyRowLabel = 'No value recorded',
}: ShareChartProps) {
  const clipId = useId().replace(/:/g, '');
  const hatchId = useId().replace(/:/g, '');
  const { ref, width, height } = useChartSize<HTMLDivElement>();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const titleId = useId();

  /* The gutter holds the row labels, which are the long strings here — the same shape `SpanChart`
   * uses, and the same shape `BarChart` takes when §6.3 rotates it. */
  const margin = computeMargin({
    measureLabels: rows.map((row) => row.label),
    hasCategoryLabels: true,
    hasCategoryTitle: true,
  });
  const plot = plotArea(width, height, margin);

  const band = scaleBand<string>()
    .domain(rows.map((row) => row.key))
    .range([0, plot.innerHeight])
    .paddingInner(0.28)
    .paddingOuter(0.14);

  /* Fixed to the whole share. A composition axis that ended at the largest observed share would
   * make a 60% row look like 100%, which is the truncation §6.3 forbids for exactly this reason:
   * here length **is** the encoding. */
  const measure = scaleLinear().domain([0, 1]).range([0, plot.innerWidth]);

  const laid = rows.map((row) => {
    const shares = normaliseShareRow(row.segments);
    /*
     * Colour is assigned **per row**, over that row's own members. On a team page every member
     * shares a `teamReference`, so `assignEntityColours` sees a team-mate group and hands back the
     * §6.4a shade pair — or reports `colourExhausted` at three or more drivers, which is a real
     * season (a mid-season replacement) and not an edge case.
     */
    const colours = assignEntityColours(row.segments);
    const exhausted = colours.some((colour) => colour.colourExhausted);
    return { row, shares, colours, exhausted };
  });

  const { scope: motionScope } = useChartMount<HTMLDivElement>({
    orientation: 'row',
    origin: [plot.left, plot.top],
    reveal: { x: plot.left, width: plot.innerWidth },
    deps: [
      mountKey(
        rows.flatMap((row) => [row.key, ...row.segments.map((segment) => segment.reference)]),
        plot.innerWidth,
        plot.innerHeight,
      ),
    ],
  });

  const active = laid
    .flatMap(({ row, shares }) =>
      row.segments.map((segment, index) => ({
        row,
        segment,
        share: shares?.[index] ?? null,
        key: `${row.key}:${segment.reference}`,
      })),
    )
    .find((entry) => entry.key === activeKey);

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
        <ShareTable
          rows={rows}
          caption={ariaLabel}
          categoryLabel={categoryTitle}
          entityLabel={entityTitle}
          valueLabel={valueTitle}
          formatValue={formatValue}
          tokenFor={(segment) => identityToken(segment.teamReference)}
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
              {/* G-28: `userSpaceOnUse` so the reveal is exact against the **plot area** rather than
               * against the data's bounding box. */}
              <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
                <rect
                  data-motion={CHART_REVEAL_ATTR}
                  x={plot.left}
                  y={0}
                  width={plot.innerWidth}
                  height={height}
                />
              </clipPath>
              {/* Rung 4's 45° hatch, used here only where colour is exhausted (§6.4a property 4). */}
              <pattern
                id={hatchId}
                width="6"
                height="6"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
              >
                <line className="chart-hatch-line" x1="0" y1="0" x2="0" y2="6" />
                <line className="chart-hatch-line" x1="3" y1="0" x2="3" y2="6" />
              </pattern>
            </defs>

            <g aria-hidden="true">
              {SHARE_TICKS.map((tick) => (
                <line
                  key={`grid-${String(tick)}`}
                  className="chart-grid-line"
                  x1={Math.round(plot.left + measure(tick)) + 0.5}
                  x2={Math.round(plot.left + measure(tick)) + 0.5}
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
              {SHARE_TICKS.map((tick) => (
                <text
                  key={`tick-${String(tick)}`}
                  className="chart-tick"
                  x={Math.round(plot.left + measure(tick))}
                  y={plot.top + plot.innerHeight + 8}
                  textAnchor="middle"
                  dominantBaseline="hanging"
                >
                  {formatShare(tick)}
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
                  key={`label-${row.key}`}
                  className="chart-tick"
                  x={plot.left - 8}
                  y={plot.top + (band(row.key) ?? 0) + band.bandwidth() / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {row.label}
                </text>
              ))}
            </g>

            <g
              className="chart-marks"
              data-dimmed={activeKey !== null}
              clipPath={`url(#${clipId})`}
            >
              {laid.map(({ row, shares, colours, exhausted }) => {
                const y = plot.top + (band(row.key) ?? 0);

                /*
                 * The zero-total row. **One band that says so**, rather than a row of `NaN` widths
                 * that paints nothing and reads as a rendering fault.
                 */
                if (shares === null) {
                  return (
                    <g key={row.key}>
                      <path
                        className="chart-share-empty"
                        d={spanPath(plot.left, y, plot.innerWidth, band.bandwidth(), 4, {
                          leading: true,
                          trailing: true,
                        })}
                      />
                      <text
                        className="chart-share-empty-label"
                        x={plot.left + 8}
                        y={y + band.bandwidth() / 2}
                        dominantBaseline="middle"
                      >
                        {emptyRowLabel}
                      </text>
                    </g>
                  );
                }

                return row.segments.map((segment, index) => {
                  const share = shares[index];
                  const colour = colours[index];
                  if (share === undefined || colour === undefined) return null;

                  const x = plot.left + measure(share.start);
                  /* The 2px gap comes off the trailing edge, so it is the plot surface showing
                   * through between adjacent fills rather than a drawn line (§6.3). */
                  const raw = measure(share.end) - measure(share.start);
                  const segWidth = Math.max(0, raw - 2);
                  const key = `${row.key}:${segment.reference}`;

                  return (
                    <g key={key}>
                      <path
                        className="chart-span"
                        data-active={activeKey === key}
                        d={spanPath(x, y, segWidth, band.bandwidth(), 4, {
                          leading: index === 0,
                          trailing: index === row.segments.length - 1,
                        })}
                        style={{ '--series': cssVar(colour.plot) } as CSSProperties}
                      />
                      {/*
                       * §6.4a property 4 — beyond two drivers of one team colour is exhausted
                       * outright, so the alternating segments take rung 4's hatch. It is drawn over
                       * the fill rather than instead of it, so the team is still recognisable.
                       */}
                      {exhausted && index % 2 === 1 && (
                        <path
                          d={spanPath(x, y, segWidth, band.bandwidth(), 4, {
                            leading: index === 0,
                            trailing: index === row.segments.length - 1,
                          })}
                          fill={`url(#${hatchId})`}
                        />
                      )}

                      {segment.shortLabel !== undefined && segWidth >= LABEL_MIN_WIDTH && (
                        <text
                          className="chart-span-label"
                          x={x + segWidth / 2}
                          y={y + band.bandwidth() / 2}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {segment.shortLabel}
                        </text>
                      )}

                      {/* §6.5.1 — ≥24px hit target on the cross-axis regardless of mark size. */}
                      <rect
                        className="chart-hit"
                        x={x}
                        y={y}
                        width={Math.max(1, segWidth)}
                        height={Math.max(24, band.bandwidth())}
                        onPointerEnter={() => {
                          setActiveKey(key);
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
              <p className="chart-tooltip-title">
                {active.row.label} · {active.segment.label}
              </p>
              <p className="chart-tooltip-row">
                <span>{valueTitle}</span>
                <span className="chart-tooltip-value">{formatValue(active.segment.value)}</span>
              </p>
              {active.share !== null && (
                <p className="chart-tooltip-row">
                  <span>Share</span>
                  <span className="chart-tooltip-value">
                    {formatShare(active.share.end - active.share.start)}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </ChartFrame>
  );
}
