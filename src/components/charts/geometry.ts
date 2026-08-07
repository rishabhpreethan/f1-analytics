import type { MarkerShape } from './ladder';

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

/**
 * **The first and last value on a sequence axis are always labelled.** _(added 2026-08-07, F3)_
 *
 * `d3`'s `ticks(n)` picks round numbers inside the domain and has no interest in its endpoints, and
 * on a 1-based sequence that loses the two readings a reader most wants:
 *
 * | Domain | `ticks(11)` | What is missing |
 * |---|---|---|
 * | 22 rounds | `[2, 4, … 22]` | **round 1** — the start of the season |
 * | 58 laps | `[5, 10, … 55]` | **lap 1 and lap 58** — the start and the finish of the race |
 *
 * The 22-round case is **live in the season hub**: it went unnoticed because 2026 has 10 completed
 * rounds and `ticks` on `[1, 10]` happens to include 1. Any completed season starts its axis at
 * round 2.
 *
 * "Where does this start and end" is not a decorative reading on a race or a season — it is the
 * frame for every other value on the axis. So both endpoints are forced in, and any interior tick
 * that would crowd one of them is dropped. **Dropping the interior tick and never the endpoint**:
 * an interior tick is one of eleven equivalent references, an endpoint is the only one of its kind.
 *
 * `minGap` is in **domain units**, not pixels, which is what keeps this function free of scales and
 * therefore testable — the caller converts its pixel gap once, where it already knows the scale.
 */
export function withEndpoints(
  interior: readonly number[],
  min: number,
  max: number,
  minGap: number,
): number[] {
  if (max <= min) return [min];
  const kept = interior.filter(
    (tick) => tick > min && tick < max && tick - min >= minGap && max - tick >= minGap,
  );
  /* Sorted, because the axis renderer assumes ascending order and this function must guarantee its
   * own postcondition rather than inherit it. `d3.ticks` happens to return sorted values today, so
   * nothing depends on the caller staying that way. */
  return [min, ...kept, max].sort((a, b) => a - b);
}

/**
 * **Should this series draw markers?** §6.3 sets a ≥8px marker floor; at some density that floor
 * makes markers collide into a bead chain that hides the line it is meant to annotate.
 *
 * Measured need (F3): a modern race is **58 laps over ~800px of plot — 13.8px between adjacent
 * points**. An 8px marker with its 1.5px surface ring occupies 11px, so at 58 laps the markers
 * nearly touch, and at four series it is 232 of them. The line is the signal at that density and
 * the crosshair is the readout.
 *
 * The rule: markers are drawn only when adjacent points are at least **twice** the marker's full
 * width apart. Twice, not once, because touching markers and *nearly* touching markers are both
 * illegible — the same reasoning §6.4's dash rung uses for its period.
 */
export function shouldDrawMarkers(pointCount: number, axisLengthPx: number): boolean {
  if (pointCount < 2) return true;
  /*
   * **An unmeasured plot draws its markers.** `useChartSize` reports 0 until the `ResizeObserver`
   * fires, and "not yet measured" is not "too dense" — treating it as dense would drop every marker
   * on the first paint and then pop them in, and it would make the whole marker layer absent in
   * jsdom, where no test could then assert that a `null` reading is drawn as a gap. Same convention
   * as everywhere else here: absent means no constraint stated, never the worst case.
   */
  if (axisLengthPx <= 0) return true;
  const spacing = axisLengthPx / (pointCount - 1);
  return spacing >= 2 * (MARKER_SIZE + 2 * MARKER_RING);
}

/** The `--size-mark-ring` figure, needed by `shouldDrawMarkers`'s spacing arithmetic. */
export const MARKER_RING = 1.5;

/*
 * **The lap-time ceiling used to be implemented here and is now `src/features/race/pace.ts`.**
 *
 * The *rule* is this design system's (§6.3): `fastest × 1.5`, off-scale readings carried as a caret
 * plus a counted note, exact values in the table. The *implementation* belongs where the data is —
 * `paceCeilingMs` handles a session with no timed lap (`null`, never 0, which is a lap time) and
 * keys the ceiling to the **session** rather than to the chart's current selection, so toggling a
 * fourth driver cannot move the axis. Mine did neither.
 *
 * Two constants with the same value in two modules is the drift this project has already paid for
 * once (`--size-tooltip` against `TOOLTIP_WIDTH`, tied together by a test only after the fact). So
 * this one is deleted rather than kept "for the kit": a chart takes `yCeiling` as a number and does
 * not care where it came from, which is the correct seam.
 */

/**
 * The off-scale glyph — an upward caret drawn at the ceiling where a reading exceeds it.
 *
 * **Deliberately not one of §6.3's four marker shapes.** Those four carry *identity* — they are
 * rung 2 of the differentiator ladder — and reusing one here would make an off-scale lap look like a
 * different series. A caret carries *direction*, which is a different channel entirely and is the
 * standard convention for a clipped value in scientific charting.
 *
 * An open path, not a closed one: the caret is stroked in the series colour rather than filled, so
 * it reads as an annotation on the line rather than as another datum on it.
 */
export function offScalePath(size = MARKER_SIZE): string {
  const half = size / 2;
  return `M ${fmtCoord(-half)} ${fmtCoord(half / 2)} L 0 ${fmtCoord(-half / 2)} L ${fmtCoord(half)} ${fmtCoord(half / 2)}`;
}

/**
 * **Which series the pointer is nearest, within a threshold.** §6.5.4a's isolation, as arithmetic.
 *
 * Extracted from `RankChart` because the alternative was untestable: the component derives each
 * candidate's offset from a `d3` scale, and in jsdom every scale collapses to 0, so a proximity test
 * written against the component could only ever assert that everything is equidistant from
 * everything. Given offsets, the choice is pure — and the choice is the part with rules in it.
 *
 * `null` past the threshold, deliberately: a pointer in open space between two lines is hovering
 * *neither*, and snapping to the closest one regardless would make isolation fire constantly and
 * mean nothing. Ties go to the earlier candidate, which is the stable entity order.
 */
export function nearestByOffset(
  candidates: readonly { reference: string; offset: number }[],
  pointerOffset: number,
  thresholdPx: number,
): string | null {
  let best: { reference: string; distance: number } | null = null;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate.offset - pointerOffset);
    if (best === null || distance < best.distance) {
      best = { reference: candidate.reference, distance };
    }
  }
  return best !== null && best.distance <= thresholdPx ? best.reference : null;
}

/** §6.5.4a's isolation threshold. A 1px line needs a forgiving target; 14px is half a row at 20 cars. */
export const ISOLATION_THRESHOLD = 14;

/**
 * **How many direct labels an axis of this length can hold**, at §6.5.2's 16px minimum gap.
 *
 * Needed because §6.5.4a's rank chart makes both-end labels a *condition* of plotting the whole
 * field, and at 22 series the labels are the dense part rather than the lines. The arithmetic decides
 * whether that condition is satisfiable rather than leaving it to be discovered on screen:
 *
 * | Plot height | Capacity at 16px | 22 series |
 * |---|---|---|
 * | `--size-plot-lg` 360 | 23 | **fits** |
 * | `--size-plot-md` 288 | 19 | does not fit |
 * | `--size-plot` 240 | 16 | does not fit |
 *
 * So a full field is labelled at desktop and not below it, which is a real breakpoint-dependent
 * answer rather than a hope. `0` for an unmeasured axis is deliberately **not** returned — see §1.0:
 * an unmeasured axis reports its full nominal capacity, because "not yet measured" must not read as
 * "no room".
 */
export function labelCapacity(axisLengthPx: number, minGap = DIRECT_LABEL_MIN_GAP): number {
  if (axisLengthPx <= 0) return Number.POSITIVE_INFINITY;
  return Math.floor(axisLengthPx / minGap) + 1;
}

/**
 * A span's rounded-rectangle path, with **the radius on the row's outer ends only**.
 *
 * §6.3 rounds a bar's data-end and leaves the baseline square, because *"a bar rounded at the axis
 * floats off it"*. A span row is the same argument applied twice: the row's first and last edges are
 * where the sequence begins and ends, so they are rounded; an **interior** boundary between two
 * adjacent spans is square, because a rounded interior edge implies a gap in the sequence that is not
 * there. The 2px `--surface-sunken` gap is what separates them, and it is a gap in the *timeline*,
 * not in the data.
 *
 * `rx` on a `<rect>` cannot express per-corner radii, which is the whole reason this returns a path.
 */
export function spanPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  ends: { leading: boolean; trailing: boolean },
): string {
  /* A span narrower than two radii cannot carry them without the curves meeting and inverting. */
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const rl = ends.leading ? r : 0;
  const rt = ends.trailing ? r : 0;
  const c = fmtCoord;

  return [
    `M ${c(x + rl)} ${c(y)}`,
    `H ${c(x + width - rt)}`,
    rt > 0 ? `A ${c(rt)} ${c(rt)} 0 0 1 ${c(x + width)} ${c(y + rt)}` : '',
    `V ${c(y + height - rt)}`,
    rt > 0 ? `A ${c(rt)} ${c(rt)} 0 0 1 ${c(x + width - rt)} ${c(y + height)}` : '',
    `H ${c(x + rl)}`,
    rl > 0 ? `A ${c(rl)} ${c(rl)} 0 0 1 ${c(x)} ${c(y + height - rl)}` : '',
    `V ${c(y + rl)}`,
    rl > 0 ? `A ${c(rl)} ${c(rl)} 0 0 1 ${c(x + rl)} ${c(y)}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * §6.5.1's tooltip width, in px, and **it must equal `--size-tooltip` in `tokens.css`** —
 * `tokens.css.test.ts` asserts that, because nothing else could.
 *
 * The tooltip flips side at the axis midpoint so it never covers the mark it describes, and the flip
 * is `x - TOOLTIP_WIDTH`. So this is not a hint: if the rendered box is wider than the constant, the
 * flipped tooltip overhangs the plot's right edge by the difference. It was a `min-width: 8rem`
 * (128px) against a box that rendered 193px wide with four driver names in it.
 */
export const TOOLTIP_WIDTH = 200;

/** How far the tooltip sits from the crosshair on the un-flipped side. */
export const TOOLTIP_OFFSET = 12;

/**
 * The tooltip's position, **clamped inside the plot area on both axes** — not merely flipped
 * horizontally at the midpoint.
 *
 * §6.5.1 asks for a tooltip that "never covers the mark it describes", and the flip alone delivers
 * that. What the flip does *not* deliver is containment: at the extreme left the flipped box starts
 * at a negative x, and at the extreme right the un-flipped box runs past the plot's edge. Both
 * overflow the panel, which is what a chart's tooltip must never do — it is the one element that
 * appears over the data and it has to stay on the data.
 *
 * Pure, and tested, because this is precisely the arithmetic jsdom **can** decide: no layout is
 * needed to know whether a computed left edge is inside a known rectangle. The rendered box's
 * height is not knowable here, so `height` is passed in as the caller's reserved figure.
 */
export function clampTooltip(
  x: number,
  plot: { left: number; top: number; innerWidth: number; innerHeight: number },
  size: { width: number; height: number },
): { x: number; y: number } {
  /* Flip at the midpoint so the box never covers the mark, then clamp — in that order. Clamping
   * first would let the clamp undo the flip at the edges, which is where the flip matters most. */
  const flipped = x > plot.innerWidth / 2;
  const wanted = plot.left + x + (flipped ? -size.width - TOOLTIP_OFFSET : TOOLTIP_OFFSET);

  const minX = plot.left;
  const maxX = Math.max(minX, plot.left + plot.innerWidth - size.width);

  const minY = plot.top;
  const maxY = Math.max(minY, plot.top + plot.innerHeight - size.height);

  return {
    x: Math.min(Math.max(wanted, minX), maxX),
    y: Math.min(Math.max(plot.top + TOOLTIP_OFFSET, minY), maxY),
  };
}

/**
 * The tooltip's reserved height: a title line plus one row per series, padded.
 *
 * An estimate, and it is only ever used to keep the box inside the plot — so it is deliberately
 * generous. Under-reserving would let a four-series tooltip hang out of the panel, which is the
 * defect this exists to prevent; over-reserving only nudges it upward.
 */
export function tooltipHeight(rows: number): number {
  const PADDING = 16;
  const TITLE = 14;
  const ROW = 20;
  return PADDING + TITLE + rows * ROW;
}

/**
 * §6.3's position ticks, clipped to the axis the chart actually has.
 *
 * **This exists because `scale.ticks()` cannot express a position axis and quietly produces a wrong
 * one.** On a domain of `[1, 22]`, `scaleLinear().nice(4).ticks(4)` extends the domain outward to a
 * round boundary and emits `0` — so the axis draws a **"P0" tick**, which is not a championship
 * position and never was. A position axis is a fixed, editorial set of gridlines, not a computed
 * one, and §6.3 has always said so; the kit simply had no way to say it.
 *
 * `1` is always included when it is in range, because P1 is the line the whole chart is read
 * against. The rest are kept only if the field actually reaches them — a nine-car grid gets ticks
 * at 1 and 5, not a gridline at P20 nobody occupies.
 */
export function positionTicksWithin(min: number, max: number): number[] {
  const ticks = POSITION_TICKS.filter((tick) => tick >= min && tick <= max);
  return [...ticks];
}

/**
 * **A value-stable identity for a chart's mount animation.**
 *
 * `useMotion` hard-codes `revertOnUpdate: true` and `useGSAP` compares its dependency array by
 * **identity**. So a dependency that is a freshly-built array or object — `resolved`, `data`,
 * `plot` — changes on every render, and G-27/G-28 are torn down and re-created every time. That is
 * not a theoretical concern: `LineChart` sets state on `pointermove`, so **dragging the pointer
 * across the plot restarted the left-to-right reveal continuously.**
 *
 * Neither existing chart test could see it, because both force `matchMedia` to answer `reduce`, so
 * no tween is ever created. A chart test suite that never creates a tween is not testing the
 * charts' motion at all — which is the more important half of the finding.
 *
 * The fix is a **string**, compared by value, built from the things that legitimately re-mount a
 * chart: which entities are plotted, and the plot area's measured size. `ChartMountOptions.deps`
 * already documented the rule this violated — *"a chart's identity, never its data"*.
 */
export function mountKey(references: readonly string[], width: number, height: number): string {
  /* `Math.round` so a sub-pixel `ResizeObserver` jitter of 0.5px does not re-run the mount. The
   * reveal is a whole-plot wipe; it does not need sub-pixel fidelity to start from. */
  return `${references.join('|')}@${String(Math.round(width))}x${String(Math.round(height))}`;
}

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

/* ------------------------------------------------------------------ marker geometry (§6.4 rung 2)
 *
 * The four shapes are sized to **equal visual area**, not to an equal bounding box. A square and a
 * circle of the same width are not the same size to the eye — the square is about 27% heavier — and
 * a marker set where one shape reads as "more" is encoding magnitude by accident, on a channel that
 * carries identity only. The circle is the reference; every other radius is derived so all four
 * enclose the same area.
 */

/** §6.3's floor. Never smaller — a marker under 8px is not a hit target and barely a shape. */
export const MARKER_SIZE = 8;

const AREA = (size: number) => Math.PI * (size / 2) ** 2;

/** The path for one shape, centred on the origin, at equal area to a circle of `size` across. */
export function markerPath(shape: MarkerShape, size = MARKER_SIZE): string {
  const area = AREA(size);
  switch (shape) {
    case 'square': {
      const half = Math.sqrt(area) / 2;
      /* Explicit L commands rather than the shorter H/V form: a path that is a plain list of
       * (x, y) pairs is one a test can measure the area of, and equal area is the property that
       * matters here. */
      return `M${fmtCoord(-half)} ${fmtCoord(-half)}L${fmtCoord(half)} ${fmtCoord(-half)}L${fmtCoord(half)} ${fmtCoord(half)}L${fmtCoord(-half)} ${fmtCoord(half)}Z`;
    }
    case 'triangle': {
      /* Equilateral, area = (√3/4)·s². Centred on its centroid rather than on its bounding box,
       * or a triangle sits visibly low against a circle on the same baseline. */
      const side = Math.sqrt((4 * area) / Math.sqrt(3));
      const height = (Math.sqrt(3) / 2) * side;
      const top = -(2 / 3) * height;
      const bottom = height / 3;
      return `M0 ${fmtCoord(top)}L${fmtCoord(side / 2)} ${fmtCoord(bottom)}L${fmtCoord(-side / 2)} ${fmtCoord(bottom)}Z`;
    }
    case 'diamond': {
      const half = Math.sqrt(2 * area) / 2;
      return `M0 ${fmtCoord(-half)}L${fmtCoord(half)} 0L0 ${fmtCoord(half)}L${fmtCoord(-half)} 0Z`;
    }
    case 'circle':
    default: {
      const r = size / 2;
      return `M${fmtCoord(-r)} 0a${fmtCoord(r)} ${fmtCoord(r)} 0 1 0 ${fmtCoord(size)} 0a${fmtCoord(r)} ${fmtCoord(r)} 0 1 0 ${fmtCoord(-size)} 0Z`;
    }
  }
}

/** Two decimals. SVG path data with 15 significant figures is unreadable and gains nothing. */
export function fmtCoord(n: number): string {
  return String(Math.round(n * 100) / 100);
}
