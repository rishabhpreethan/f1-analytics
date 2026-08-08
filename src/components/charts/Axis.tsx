import {
  AXIS_GAP,
  AXIS_TITLE_LINE,
  dedupeTickLabels,
  labelStride,
  monoTextWidth,
  TICK_LABEL_SIZE,
  type PlotArea,
} from './geometry';

/**
 * **The chart furniture** — `DESIGN_SYSTEM.md` §6.3, and every figure in it is a token.
 *
 * The rule that does the most work here is **one axis line, not two**. The category axis gets no
 * line: the marks already sit on it, and a second rule is a box drawn around the data. That is the
 * single most common way a competent chart still looks like a spreadsheet.
 *
 * These components take **positions**, not scales. d3 owns the tick *values* (its step selection
 * across day/month/year boundaries is the subtle part and is why it is a dependency); this file
 * owns where they are drawn. That split is also what keeps the axis testable: `geometry.ts` is
 * pure arithmetic, and jsdom would tell us nothing about a rendered one.
 */

export interface AxisTick {
  /** Where the tick sits, in plot-area coordinates. */
  offset: number;
  /** The formatted label. Formatting is `src/lib/format.ts`'s job, never a chart's. */
  label: string;
}

export interface MeasureAxisProps {
  plot: PlotArea;
  ticks: readonly AxisTick[];
  /**
   * Carries the unit, always — and states a non-zero baseline out loud, e.g.
   * `"Gap to leader (s) — axis does not start at 0"`. A line axis is allowed not to start at zero
   * because position is the encoding; being quiet about it is what makes that a lie (§6.3).
   */
  title?: string;
  /** Gridlines are perpendicular to the measure axis, and only to it. */
  grid?: boolean;
  /**
   * Draw the tick *text*. Gridlines are unaffected.
   *
   * `false` for exactly one case, §6.5.4a's rank chart: its driver labels at both ends **enumerate
   * the scale in order**, top to bottom, so `P1 … P20` on the axis restates what the label columns
   * already say — and it restates it *in the same gutter*, which is how five ticks came to overlap
   * five driver labels. Deleting the duplication is the fix; making room for both would have kept it.
   */
  labels?: boolean;
}

export function MeasureAxis({
  plot,
  ticks: given,
  title,
  grid = true,
  labels = true,
}: MeasureAxisProps) {
  /*
   * **A measure axis may not draw two ticks with the same label** — see `dedupeTickLabels`. It is
   * enforced here rather than left to each caller because every caller formats its own ticks through
   * a function of its own, and nothing constrains one to be injective: a lap-time axis over a
   * four-hundredth-of-a-second domain formatted to one decimal is the same defect the span chart
   * shipped, and the only reason it would not announce itself is that this axis is keyed by index.
   *
   * **Not applied to `CategoryAxis`.** There a label is a *name*, two categories may honestly share
   * one, and dropping a band would delete a real reading. Here a label is a *value*, and the same
   * value at two positions is a false statement about the scale.
   */
  const ticks = dedupeTickLabels(given);

  return (
    <g aria-hidden="true">
      {grid &&
        ticks.map((tick, i) => (
          <line
            key={`grid-${String(i)}`}
            className="chart-grid-line"
            x1={plot.left}
            x2={plot.left + plot.innerWidth}
            y1={round(plot.top + tick.offset)}
            y2={round(plot.top + tick.offset)}
          />
        ))}

      <line
        className="chart-axis-line"
        x1={round(plot.left)}
        x2={round(plot.left)}
        y1={plot.top}
        y2={plot.top + plot.innerHeight}
      />

      {labels &&
        ticks.map((tick, i) => (
          <text
            key={`tick-${String(i)}`}
            className="chart-tick"
            x={plot.left - AXIS_GAP}
            y={round(plot.top + tick.offset)}
            textAnchor="end"
            dominantBaseline="middle"
          >
            {tick.label}
          </text>
        ))}

      {title !== undefined && (
        <text
          className="chart-axis-title"
          /* Rotated about its own centre on the left edge. `transform` rather than `writing-mode`,
           * because `writing-mode: vertical-rl` rotates the glyphs of a title that contains
           * numerals and parentheses — "(s)" comes out lying on its side. */
          /* Centred in the band `computeMargin` reserves for it — `AXIS_TITLE_LINE / 2`, not a
           * literal 12, so the reservation and the glyphs cannot disagree. */
          transform={`translate(${String(AXIS_TITLE_LINE / 2)} ${round(plot.top + plot.innerHeight / 2)}) rotate(-90)`}
          textAnchor="middle"
        >
          {title}
        </text>
      )}
    </g>
  );
}

export interface CategoryAxisProps {
  plot: PlotArea;
  ticks: readonly AxisTick[];
  title?: string;
  /**
   * §6.3 — **drop labels, never ticks.** A dropped tick loses the position; a dropped label loses
   * only the reading. Pass `false` for a band axis, where §6.3 requires every band to be labelled
   * and the answer to labels that do not fit is a horizontal chart, not a thinner axis.
   */
  allowStride?: boolean;
}

export function CategoryAxis({ plot, ticks, title, allowStride = true }: CategoryAxisProps) {
  const widths = ticks.map((tick) => monoTextWidth(tick.label, TICK_LABEL_SIZE));
  const stride = allowStride
    ? labelStride(
        ticks.map((tick) => tick.offset),
        widths,
      )
    : 1;

  const baseline = plot.top + plot.innerHeight;

  return (
    <g aria-hidden="true">
      {/*
       * No axis line here, and that is deliberate rather than an omission (§6.3). The marks sit on
       * this edge already; drawing a second rule under them closes a box around the data.
       */}
      {ticks.map((tick, i) =>
        i % stride === 0 ? (
          <text
            key={`ctick-${String(i)}`}
            className="chart-tick"
            x={round(plot.left + tick.offset)}
            y={round(baseline + AXIS_GAP)}
            textAnchor="middle"
            dominantBaseline="hanging"
          >
            {tick.label}
          </text>
        ) : null,
      )}

      {title !== undefined && (
        <text
          className="chart-axis-title"
          x={round(plot.left + plot.innerWidth / 2)}
          y={plot.height - 2}
          textAnchor="middle"
        >
          {title}
        </text>
      )}
    </g>
  );
}

/**
 * §6.3 — a reference line, e.g. a personal best: 1px `--border-strong`, dashed `4 4`, labelled at
 * the right end in `--ink-tertiary`. Horizontal only, because a reference line marks a *value*.
 */
export function ReferenceLine({
  plot,
  offset,
  label,
}: {
  plot: PlotArea;
  offset: number;
  label?: string;
}) {
  const y = round(plot.top + offset);
  return (
    <g aria-hidden="true">
      <line
        className="chart-reference-line"
        x1={plot.left}
        x2={plot.left + plot.innerWidth}
        y1={y}
        y2={y}
      />
      {label !== undefined && (
        <text
          className="chart-tick"
          x={plot.left + plot.innerWidth}
          y={y - 4}
          textAnchor="end"
          dominantBaseline="auto"
        >
          {label}
        </text>
      )}
    </g>
  );
}

/**
 * Half-pixel snapping for 1px strokes. An SVG line at an integer coordinate straddles the pixel
 * boundary and renders as two half-intensity rows, which is why a "1px" gridline can look like a
 * 2px grey smear. Nothing in this project can see that happen — jsdom does no rasterisation — so
 * it is applied by rule rather than discovered by looking.
 */
function round(value: number): number {
  return Math.round(value) + 0.5;
}
