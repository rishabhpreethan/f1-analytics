/**
 * **Chart geometry — the arithmetic behind `DESIGN_SYSTEM.md` §6.3's furniture.**
 *
 * Every figure a chart lays out is computed here, in one place, and unit-tested. That is not
 * tidiness: the one chart defect this project has already shipped was a plot axis given
 * `grid-column` inside a flex parent, which silently did nothing and left the axis 130px out of
 * line. jsdom performs no layout, so a geometry bug is invisible to every test that renders a
 * component — the only way to catch one is to make the arithmetic a pure function and assert it.
 *
 * Nothing here imports React, d3 or GSAP. It is numbers in, numbers out.
 */

/**
 * Chivo Mono's advance width, in em. **Measured, not assumed**: read from the `hmtx` table of the
 * shipped `public/fonts/chivo-mono-latin.woff2` — every one of the first 40 glyphs advances 600
 * against a `unitsPerEm` of 1000. `OS/2.xAvgCharWidth` agrees at 599.
 *
 * Stated limitation: Chivo Mono is a variable font and carries an `HVAR` table, so an instance at a
 * non-default weight could in principle advance differently. Every tick label in this product is
 * `--text-2xs` at weight 500 (§6.3), and no browser measurement is available in this pipeline, so
 * the default-instance figure is what is used. `advanceWidthMax` is 762, which is a real glyph
 * somewhere in the font — Chivo Mono has a known non-monospaced `fi` ligature — and no tick label
 * in this product contains one.
 */
export const MONO_ADVANCE_EM = 0.6;

/** `--text-2xs`: 11px with a 14px line-height (§2.3). Tick labels, everywhere, without exception. */
export const TICK_LABEL_SIZE = 11;
export const TICK_LABEL_LINE = 14;

/** `--text-xs`: 12px / 16px. The axis title, which carries the unit (§6.3). */
export const AXIS_TITLE_SIZE = 12;
export const AXIS_TITLE_LINE = 16;

/** Spacing step `2`. The gap between an axis line and its labels, and between a label and a title. */
export const AXIS_GAP = 8;

/** The width of a mono string at a given size. Exact for this font, because it is monospaced. */
export function monoTextWidth(text: string, fontSize = TICK_LABEL_SIZE): number {
  return text.length * fontSize * MONO_ADVANCE_EM;
}

/**
 * §6.3 — **tick density is a rule, not a judgement.** The measure axis (usually y) takes
 * `max(3, min(6, round(px / 56)))`.
 *
 * 56px is comfortably more than `--text-2xs`'s 14px line-height plus breathing room; 6 is where a
 * value axis stops reading as a scale and starts reading as a ruler.
 */
export function measureTickCount(lengthPx: number): number {
  return Math.max(3, Math.min(6, Math.round(lengthPx / 56)));
}

/**
 * §6.3 — the time / round axis (usually x) takes `max(2, min(12, round(px / 72)))`.
 *
 * This is the count handed to `scale.ticks(n)`; d3 treats it as a hint and returns a "nice" count
 * near it, which is the whole reason the tick step algorithm is a dependency rather than ours.
 */
export function timeTickCount(lengthPx: number): number {
  return Math.max(2, Math.min(12, Math.round(lengthPx / 72)));
}

/**
 * §6.3 — **drop labels, never ticks.** A dropped tick loses the position; a dropped label loses
 * only the reading.
 *
 * Returns the stride: label every `n`th tick. A stride rather than an ad-hoc "hide the ones that
 * overlap", because an irregular gap between labels reads as missing data — the eye takes the
 * rhythm of an axis as information. The first tick always keeps its label, so the stride is
 * anchored at the left edge and does not shift as the chart resizes.
 */
export function labelStride(
  positions: readonly number[],
  labelWidths: readonly number[],
  minGap = AXIS_GAP,
): number {
  if (positions.length < 2) return 1;
  for (let stride = 1; stride <= positions.length; stride += 1) {
    let fits = true;
    for (let i = 0; i + stride < positions.length; i += stride) {
      const a = positions[i];
      const b = positions[i + stride];
      if (a === undefined || b === undefined) continue;
      const halfA = (labelWidths[i] ?? 0) / 2;
      const halfB = (labelWidths[i + stride] ?? 0) / 2;
      if (Math.abs(b - a) < halfA + halfB + minGap) {
        fits = false;
        break;
      }
    }
    if (fits) return stride;
  }
  return positions.length;
}

/**
 * §6.3 — **a category axis that does not fit rotates the chart, it never rotates the label.**
 *
 * Angled tick labels are around 20% slower to read and force a taller axis gutter. More than 7
 * categories, or any label over 12 characters, and the bar chart is horizontal instead:
 * categories run down the left in `--text-xs`, the measure runs along the bottom.
 */
export const CATEGORY_COUNT_LIMIT = 7;
export const CATEGORY_LABEL_LIMIT = 12;

export function prefersHorizontalBars(labels: readonly string[]): boolean {
  return (
    labels.length > CATEGORY_COUNT_LIMIT ||
    labels.some((label) => label.length > CATEGORY_LABEL_LIMIT)
  );
}

/** §6.3 — a position axis is inverted, P1 at the top, ticks at 1, 5, 10, 15, 20. */
export const POSITION_TICKS = [1, 5, 10, 15, 20] as const;

export interface PlotMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PlotArea extends PlotMargin {
  /** The full SVG box. */
  width: number;
  height: number;
  /** The plot area itself — where marks may be drawn, and what G-28's clip rect covers. */
  innerWidth: number;
  innerHeight: number;
}

export interface MarginInput {
  /** Every tick label that will appear on the measure axis, already formatted. */
  measureLabels: readonly string[];
  /** `true` when the category / time axis renders labels along the bottom. */
  hasCategoryLabels?: boolean;
  /** `true` when the measure axis carries a title, which it should: the title carries the unit. */
  hasMeasureTitle?: boolean;
  /** `true` when the category axis carries a title. */
  hasCategoryTitle?: boolean;
  /**
   * The widest direct label placed at the end of a line (§6.5.2), in px. Reserved on the right so
   * a label is never clipped by the SVG edge — the failure that turns a direct-labelled chart back
   * into a legend-only one.
   */
  directLabelWidth?: number;
}

/**
 * The margins a chart needs, **computed from what it will actually draw** rather than guessed.
 *
 * A fixed left gutter is the standard way a chart ends up either wasting 60px or clipping a
 * five-digit tick label, and neither is visible in any test this project can run. So the gutter is
 * the widest measure label plus the axis gap, and nothing else.
 *
 * The right margin is `AXIS_GAP` when there are no direct labels: enough that the last gridline and
 * a mark sitting on the domain maximum are not flush against the edge.
 */
export function computeMargin(input: MarginInput): PlotMargin {
  const widest = input.measureLabels.reduce((max, label) => Math.max(max, monoTextWidth(label)), 0);

  const left =
    Math.ceil(widest) + AXIS_GAP + (input.hasMeasureTitle === true ? AXIS_TITLE_LINE + 4 : 0);

  const bottom =
    (input.hasCategoryLabels === true ? TICK_LABEL_LINE + AXIS_GAP : 0) +
    (input.hasCategoryTitle === true ? AXIS_TITLE_LINE + 4 : 0);

  return {
    /* Half a tick label, so a value sitting on the domain maximum is not clipped by the SVG box. */
    top: Math.ceil(TICK_LABEL_LINE / 2),
    right: Math.max(AXIS_GAP, Math.ceil(input.directLabelWidth ?? 0) + AXIS_GAP),
    bottom,
    left,
  };
}

/**
 * Resolve the plot area. **`innerWidth` and `innerHeight` are clamped at 0**, because a chart in a
 * collapsed container would otherwise produce a negative `<rect width>`, which is an SVG error the
 * browser reports and jsdom does not.
 */
export function plotArea(width: number, height: number, margin: PlotMargin): PlotArea {
  return {
    ...margin,
    width,
    height,
    innerWidth: Math.max(0, width - margin.left - margin.right),
    innerHeight: Math.max(0, height - margin.top - margin.bottom),
  };
}

/** §6.5.2 — direct labels are pushed apart to a 16px minimum gap. */
export const DIRECT_LABEL_MIN_GAP = 16;

/** §6.5.2 — a leader line is drawn where de-collision moved a label more than 8px. */
export const DIRECT_LABEL_LEADER_THRESHOLD = 8;

export interface DirectLabelPlacement {
  /** The y the label's mark actually sits at. */
  anchor: number;
  /** Where the label is drawn after de-collision. */
  y: number;
  /** `true` when the label moved far enough to need a 12px leader line in the entity colour. */
  leader: boolean;
}

/**
 * §6.5.2 — place direct labels at the end of their lines, pushed apart to a minimum gap.
 *
 * Two passes, which is what makes this correct rather than merely non-overlapping. The forward pass
 * separates from the top; if that pushes the last label past `bottom`, the whole run is pushed back
 * up from the bottom. A single forward pass is the common implementation and it silently drops the
 * last label off the bottom of the chart when the lines converge — which is exactly when a
 * comparison chart is at its most interesting.
 *
 * Order in equals order out, so a caller can zip the result back onto its series.
 */
export function placeDirectLabels(
  anchors: readonly number[],
  bounds: { top: number; bottom: number },
  minGap = DIRECT_LABEL_MIN_GAP,
): DirectLabelPlacement[] {
  const order = anchors.map((anchor, i) => ({ i, anchor })).sort((a, b) => a.anchor - b.anchor);

  const placed = order.map((entry) => entry.anchor);
  if (placed.length === 0) return [];

  /* Forward: nothing starts above the plot, and nothing sits closer than `minGap` to the one above. */
  placed[0] = Math.max(placed[0] ?? bounds.top, bounds.top);
  for (let k = 1; k < placed.length; k += 1) {
    placed[k] = Math.max(placed[k] ?? 0, (placed[k - 1] ?? bounds.top) + minGap);
  }

  /*
   * Backward, only if the forward pass ran out of room at the bottom. Without this the last label
   * of a converging comparison is pushed off the chart — and lines converge exactly when the
   * comparison is at its most interesting. If the labels cannot fit at all, the run overflows the
   * TOP, where the caller's own top margin gives it somewhere to go.
   */
  if ((placed[placed.length - 1] ?? bounds.bottom) > bounds.bottom) {
    placed[placed.length - 1] = bounds.bottom;
    for (let k = placed.length - 2; k >= 0; k -= 1) {
      placed[k] = Math.min(placed[k] ?? 0, (placed[k + 1] ?? bounds.bottom) - minGap);
    }
  }

  const out: DirectLabelPlacement[] = new Array<DirectLabelPlacement>(anchors.length);
  order.forEach((entry, k) => {
    const y = placed[k] ?? entry.anchor;
    out[entry.i] = {
      anchor: entry.anchor,
      y,
      leader: Math.abs(y - entry.anchor) > DIRECT_LABEL_LEADER_THRESHOLD,
    };
  });
  return out;
}
