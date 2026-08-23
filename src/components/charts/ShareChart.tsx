import { scaleBand, scaleLinear } from 'd3-scale';
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { assignEntityColours, cssVar, identityToken } from '@/lib/entityColor';
import { CHART_REVEAL_ATTR, useChartMount } from '@/lib/motion/chart';
import { ChartFrame } from './ChartFrame';
import { ShareTable } from './ChartTable';
import {
  bandPlotHeight,
  computeMargin,
  mountKey,
  normaliseShareRow,
  plotArea,
  spanPath,
} from './geometry';
import { OUTCOME_TONES, type OutcomeTone, type PlotState } from './types';
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
 *    group. On a team page the group is that season's team-mates, so under §6.4a they share the
 *    car's colour and the seat is carried by rung 4's hatch.
 * 6. **Accessibility**: every row labelled in the gutter, every segment directly labelled where it
 *    fits and named in its tooltip, and a table view carrying entity, raw value and share.
 *
 * ---
 *
 * ## Two modes, and the data decides which — §6.3a, added 2026-08-23
 *
 * | | Segments are… | Colour | Second channel |
 * |---|---|---|---|
 * | **entity** (the original) | different people | one plot token per car | the seat's hatch |
 * | **outcome** | different *results* for one person | ONE plot token, four ordinal tones | the hatch on step 4 |
 *
 * The second exists because the result mix — won / podium / finished / not classified — is a
 * composition whose parts are not entities, and colouring them as entities would say four drivers
 * were on that row. **The mode is read from the data** (`ShareSegment.tone` on every segment of
 * every row) rather than passed as a flag, so a row cannot claim one encoding while its neighbour
 * claims the other.
 *
 * Three things follow, and each is enforced here rather than left to the caller: the hatch keys on
 * the **tone** and not on the seat, because every segment of an outcome row is the same person; the
 * hatch steps up to `--border-strong`, because on step 4's `--surface-raised` fill it is the only
 * thing separating the segment from the panel; and **no text is drawn inside a toned segment at
 * all** — V-38 measured every ink against all 44 fills and neither clears the 4.5:1 text floor.
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
  /**
   * §6.3a. **Present on every segment of every row, or on none of them.** A chart in which some
   * rows are outcomes and others are entities would be two encodings on one axis, so the mode is
   * decided chart-wide from the data and a partially-toned chart falls back to entity colour
   * rather than mixing the two.
   */
  tone?: OutcomeTone;
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
  /**
   * §6.3a. The legend's four names, in ramp order, when the chart is in outcome mode. The tones
   * themselves are the design system's; **what a tone is called belongs to the surface** — "Won"
   * on a driver's result mix, and something else the first time this ramp is used for anything
   * that is not a race result.
   */
  toneLabels?: Readonly<Record<OutcomeTone, string>>;
}

const DEFAULT_TONE_LABELS: Readonly<Record<OutcomeTone, string>> = {
  win: 'Won',
  podium: 'Podium, not a win',
  classified: 'Finished, off the podium',
  unclassified: 'Not classified',
};

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
  toneLabels = DEFAULT_TONE_LABELS,
}: ShareChartProps) {
  const clipId = useId().replace(/:/g, '');
  const hatchId = useId().replace(/:/g, '');
  const { ref, width, height } = useChartSize<HTMLDivElement>();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const titleId = useId();

  /*
   * **§6.3a's mode, decided from the data and chart-wide.** All of it or none of it: a chart whose
   * rows disagreed about what a segment means would be two encodings sharing one axis, and the
   * fallback is the shipped entity behaviour rather than a throw — a mis-shaped row should draw
   * something honest, not nothing.
   */
  const outcomeMode =
    rows.length > 0 &&
    rows.every(
      (row) =>
        row.segments.length > 0 && row.segments.every((segment) => segment.tone !== undefined),
    );

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
     * shares a `teamReference`, so under §6.4a (2026-08-23) they all take the **same** colour —
     * one car, one colour — and the seat is what has to be drawn.
     *
     * **A fill has no dash, so the seat is carried by texture here.** Rung 4's 45° hatch is the
     * fill-shaped equivalent of the line chart's dash: seat 0 is a plain fill, every odd seat is
     * hatched. That is a stronger encoding than the shade pair it replaces, not a weaker one —
     * the pair was withheld entirely for Sauber (§9.2.3 G-27d) and capped at two, where the hatch
     * works for every team and alternates for as many seats as a row has.
     */
    const colours = assignEntityColours(row.segments);
    return { row, shares, colours };
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
      /*
       * **One row per season, and Ferrari has 77 of them.** In a 360px plot that is a 4.0px band step:
       * the season labels in the gutter and the driver codes inside the segments both rendered as an
       * illegible stack, and the chart's whole reading — *which driver carried the team, season by
       * season* — was unavailable. It grows to a scrolling timeline instead, which is the same answer
       * §6.3 gives a category axis that does not fit.
       */
      plotHeight={bandPlotHeight(rows.length, margin)}
      legend={outcomeMode ? <OutcomeLegend labels={toneLabels} /> : undefined}
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
              {/*
               * Rung 4's 45° hatch. In entity mode it carries the SEAT within one car (§6.4a); in
               * outcome mode it carries the fourth tone, and it is drawn at `--border-strong`
               * because there it is the *only* thing separating a not-classified segment from the
               * panel it is painted on — `--border-subtle` on `--surface-raised` is 1.24:1 and
               * V-38 G-38d gates that boundary at 1.2 against `--border-strong`'s 1.90:1.
               */}
              <pattern
                id={hatchId}
                width="6"
                height="6"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
              >
                <line
                  className="chart-hatch-line"
                  data-weight={outcomeMode ? 'strong' : undefined}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="6"
                />
                <line
                  className="chart-hatch-line"
                  data-weight={outcomeMode ? 'strong' : undefined}
                  x1="3"
                  y1="0"
                  x2="3"
                  y2="6"
                />
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
              {laid.map(({ row, shares, colours }) => {
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

                /*
                 * ⚠ **A segment worth zero is not drawn at all — no fill, no hatch, no label and
                 * no hit target** _(2026-08-23, measured on the live page)_.
                 *
                 * Jos Verstappen has 0 wins, and the win segment was rendering a **1px** mark: the
                 * fill path is degenerate and paints nothing, but the hit rect floors its width at
                 * 1 for pointer safety, so the row carried a 1px hover target that popped
                 * *"Won — 0 races — 0%"*. On a chart whose whole premise is *no axis, read the
                 * proportions*, a mark for a category the driver never entered is the one thing
                 * that cannot ship: the reader has no axis to check it against. It reaches **702
                 * of 818 drivers** on the win band alone.
                 *
                 * Filtered here rather than by the caller, for the same reason the label rule is:
                 * a caller passing a zero is not doing anything unreasonable, and *"a zero draws
                 * nothing"* belongs to the encoding.
                 */
                const drawable = row.segments
                  .map((segment, index) => ({
                    segment,
                    index,
                    share: shares[index],
                    colour: colours[index],
                  }))
                  .filter(
                    (entry) =>
                      entry.share !== undefined &&
                      entry.colour !== undefined &&
                      entry.share.end > entry.share.start,
                  );

                /*
                 * **The rounded ends belong to the first and last DRAWN segment, not to index 0
                 * and index n−1.** Skipping a zero-width leader without this leaves the row's own
                 * left edge square while its right edge is round — a defect the filter would
                 * otherwise have introduced, and one only a screenshot could find.
                 */
                const firstDrawn = drawable[0]?.index;
                const lastDrawn = drawable.at(-1)?.index;

                return drawable.map(({ segment, index, share, colour }) => {
                  if (share === undefined || colour === undefined) return null;

                  const x = plot.left + measure(share.start);
                  /* The 2px gap comes off the trailing edge, so it is the plot surface showing
                   * through between adjacent fills rather than a drawn line (§6.3). */
                  const raw = measure(share.end) - measure(share.start);
                  /*
                   * **No minimum width here, and that is deliberate** — unlike the rate board's
                   * `min-width: 3px`. On a shared track *length is the encoding* (the same reason
                   * the axis is fixed to `[0, 1]`), so a floor would overstate a small share at
                   * the expense of the neighbour it is measured against. A bar that stands alone
                   * with its figure printed beside it can afford a floor; a segment sharing a
                   * track with three others cannot.
                   */
                  const segWidth = Math.max(0, raw - 2);
                  const key = `${row.key}:${segment.reference}`;

                  return (
                    <g key={key}>
                      <path
                        className="chart-span"
                        data-active={activeKey === key}
                        data-tone={outcomeMode ? segment.tone : undefined}
                        d={spanPath(x, y, segWidth, band.bandwidth(), 4, {
                          leading: index === firstDrawn,
                          trailing: index === lastDrawn,
                        })}
                        style={{ '--series': cssVar(colour.plot) } as CSSProperties}
                      />
                      {/*
                       * §6.4a — every driver of one car shares its colour, so the **seat** is what
                       * the second channel has to carry, and in a fill that channel is rung 4's
                       * hatch. Keyed on `seat` and not on the segment's position, so a row mixing
                       * two teams hatches the second seat of each car rather than every other
                       * segment. Drawn over the fill rather than instead of it, so the car is
                       * still recognisable underneath.
                       *
                       * In outcome mode the seat is meaningless — every segment of a row is the
                       * same person — and the hatch carries the **fourth tone** instead. Keyed on
                       * the tone and not on the index, so a row that ever carries the tones in a
                       * different order still hatches the right one.
                       */}
                      {(outcomeMode ? segment.tone === 'unclassified' : colour.seat % 2 === 1) && (
                        <path
                          d={spanPath(x, y, segWidth, band.bandwidth(), 4, {
                            leading: index === firstDrawn,
                            trailing: index === lastDrawn,
                          })}
                          fill={`url(#${hatchId})`}
                        />
                      )}

                      {/*
                       * **No text is ever drawn on an outcome tone, and that is measured rather
                       * than tasteful** (V-38). The ramp sweeps from a mid-lightness entity colour
                       * to the plot surface, so it passes through every lightness on the way and
                       * neither ink clears 4.5:1 across all 44 fills: `--ink-inverse` bottoms out
                       * at 3.40:1 and `--ink-primary` at 4.23:1. Enforced here rather than left to
                       * the caller, because a caller who passes a `shortLabel` is not doing
                       * anything unreasonable — the rule belongs to the encoding.
                       */}
                      {!outcomeMode &&
                        segment.shortLabel !== undefined &&
                        segWidth >= LABEL_MIN_WIDTH && (
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

/**
 * **The outcome legend** — §6.3a rule 4, and the reason the bar needs no text on it.
 *
 * Four keys in ramp order, drawn with the **same CSS rules the bars use** rather than a second set
 * of background declarations: each key is a 16×10 `.chart-span` in its own tiny `<svg>`, so a
 * change to a mix ratio moves the legend and the marks together and cannot move only one.
 *
 * `--series` is `--ink-secondary`, so the keys show the *shape* of the ramp — strongest to
 * faintest to hatched — in a neutral rather than claiming any driver's colour. Every row on the
 * chart applies the same ramp to its own colour, so what the reader has to learn is the order, and
 * the order is what a neutral ramp teaches. Painting the keys in the first driver's colour would
 * teach the order and imply the legend was about him.
 */
function OutcomeLegend({ labels }: { labels: Readonly<Record<OutcomeTone, string>> }) {
  const hatchId = useId().replace(/:/g, '');
  return (
    <ul className="chart-legend chart-tone-legend">
      {OUTCOME_TONES.map((tone) => (
        <li className="chart-legend-item" key={tone}>
          <svg
            className="chart-tone-key"
            width={16}
            height={10}
            aria-hidden="true"
            focusable="false"
          >
            {tone === 'unclassified' && (
              <defs>
                <pattern
                  id={hatchId}
                  width="6"
                  height="6"
                  patternTransform="rotate(45)"
                  patternUnits="userSpaceOnUse"
                >
                  <line
                    className="chart-hatch-line"
                    data-weight="strong"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="6"
                  />
                  <line
                    className="chart-hatch-line"
                    data-weight="strong"
                    x1="3"
                    y1="0"
                    x2="3"
                    y2="6"
                  />
                </pattern>
              </defs>
            )}
            <rect className="chart-span" data-tone={tone} width={16} height={10} rx={2} />
            {tone === 'unclassified' && (
              <rect width={16} height={10} rx={2} fill={`url(#${hatchId})`} />
            )}
          </svg>
          <span>{labels[tone]}</span>
        </li>
      ))}
    </ul>
  );
}
