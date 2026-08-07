import { gsap } from './gsap';
/**
 * `staggerAmount` is imported rather than re-derived. Duplicating it would be the obvious shortcut
 * and would be exactly the drift a "defined once" token set exists to prevent (§4.3).
 */
import { staggerAmount } from './scroll';
import { dur, ease, stagger } from './tokens';
import { useMotion, type MotionHandle } from './useMotion';

/**
 * **Chart motion — G-27, G-28 and G-30** (`DESIGN_SYSTEM.md` §4.6.2).
 *
 * Here rather than in the chart components because `gsap` may only be imported inside
 * `src/lib/motion/**` (`ARCHITECTURE.md` §10 #21, chokepoint 2). What the components pass in is
 * geometry they already computed; nothing in this file measures the DOM.
 *
 * **G-29 has no code, and that is the point.** A chart does not animate on a data update. Marks
 * are re-rendered at their new positions in one frame, because a chart that re-animates while
 * someone is reading it is a defect (§4.2). The only exception is a deliberate user action that
 * changes the entity set or the scope, which may cross-fade the mark layer — `crossFadeMarks`
 * below — and never re-runs G-27 or G-28.
 */

/** The selector G-27 grows. A bar without it does not animate, which is a correct resting state. */
export const CHART_BAR = '[data-motion="chart-bar"]';

/** The selector G-28 wipes: the `<rect>` inside the mark layer's `<clipPath>`. */
export const CHART_REVEAL = '[data-motion="chart-reveal"]';

export interface ChartMountOptions {
  /**
   * `column` grows from the baseline upward, `row` from the left edge rightward. The origin is
   * **the axis, never the mark's own centre**: a bar that grows from its middle is not reporting a
   * magnitude, it is decorating one.
   */
  orientation?: 'column' | 'row';
  /**
   * The axis anchor in the SVG's own user coordinates — `[x, y]`. For columns, y is the baseline;
   * for rows, x is the category axis. Handed to GSAP as `svgOrigin`, which is exact, rather than
   * letting it derive an origin from `getBBox()` — and `getBBox` does not exist in jsdom at all,
   * so a bbox-derived origin would be untestable as well as approximate.
   */
  origin: readonly [number, number];
  /**
   * The plot area's left edge and width, for G-28's clip rect. The reveal is anchored to the
   * **plot area**, not to the data's bounding box — see the `clipPathUnits` note below.
   */
  reveal?: { x: number; width: number };
  /** Re-runs the mount when this changes. A chart's identity, never its data. */
  deps?: React.DependencyList;
}

/**
 * **G-27 + G-28 — the chart mount, as one timeline.**
 *
 * G-27: each bar `scaleY: 0 → 1` (or `scaleX` for a horizontal bar) anchored at the axis,
 * `dur.chart`, `ease.mech` — `circ.out`, the one "mechanical" curve, and this is what it exists
 * for — staggered `stagger.bar` through `amount` so a long chart stays inside its budget. A
 * 12-bar chart totals 12 × 60 + 400 = **1120ms**, which is outside the 400ms interaction ceiling
 * and legal only because **a chart mount is not an interaction path**.
 *
 * G-28: one tween for the whole mark layer, on the `<rect>` inside its `<clipPath>` —
 * `scaleX: 0 → 1` from the plot area's left edge, `dur.chart`, `ease.none`. Constant rate, because
 * a reveal that eased would imply the *time axis* was accelerating. Markers appear as the edge
 * passes them, for free, with no per-marker tween.
 *
 * **Why not `strokeDashoffset`**, which is the usual way to draw a line: it needs
 * `getTotalLength()` per path and reveals at constant *arc* speed, so a steep segment of a
 * lap-time trace crawls while a flat one races — the reveal would report gradient rather than
 * time. It also animates a non-transform property. The clip rect is a transform, triggers no
 * layout, is exact against the plot area, and one tween covers every mark type at once.
 *
 * Authored as `from`/`fromTo` (MR-2): under reduced motion no tween is created and the chart is
 * simply drawn — bars at full length in the DOM from frame one, the clip rect at `scaleX: 1`.
 */
export function useChartMount<T extends HTMLElement = HTMLDivElement>(
  options: ChartMountOptions,
): MotionHandle<T> {
  const { orientation = 'column', origin, reveal, deps } = options;

  return useMotion<T>({
    ...(deps === undefined ? {} : { deps }),
    animate: ({ q, tl }) => {
      const bars = q(CHART_BAR);
      if (bars.length > 0) {
        tl.from(
          bars,
          {
            ...(orientation === 'column' ? { scaleY: 0 } : { scaleX: 0 }),
            svgOrigin: `${String(origin[0])} ${String(origin[1])}`,
            duration: dur.chart,
            ease: ease.mech,
            stagger: {
              each: stagger.bar.each,
              from: stagger.bar.from,
              amount: staggerAmount(bars.length, stagger.bar.each),
            },
          },
          0,
        );
      }

      const revealRect = q(CHART_REVEAL);
      if (revealRect.length > 0 && reveal !== undefined) {
        tl.fromTo(
          revealRect,
          { scaleX: 0 },
          {
            scaleX: 1,
            svgOrigin: `${String(reveal.x)} 0`,
            duration: dur.chart,
            ease: ease.none,
          },
          0,
        );
      }

      return undefined;
    },
  });
}

export interface ChartReadout {
  /** Move the crosshair. **No tween** — see below. */
  crosshair: (x: number) => void;
  /** Move the tooltip. Also untweened. */
  tooltip: (x: number, y: number) => void;
}

/**
 * **G-30 — the crosshair and tooltip readout snap; they never follow.**
 *
 * `quickSetter` writes the transform with **no tween at all**. `m.pointer`'s 600ms catch-up exists
 * for decoration — the magnetic CTA, the atmosphere lamp, the card tilt — and a *value readout*
 * that lagged behind the cursor would be misreporting which lap the reader is pointing at. That is
 * not a stylistic preference; it is the difference between a chart and a toy.
 *
 * Created outside `useMotion`'s reduced-motion gate on purpose: position was never tweened, so
 * there is nothing here for `reduce` to stop. `fadeTooltipIn` is likewise opacity-only, and §4.4
 * rule 1 keeps a 140ms crossfade outside the guard.
 */
export function chartReadout(
  crosshair: SVGElement | null,
  tooltip: HTMLElement | null,
): ChartReadout {
  const setCrosshair = crosshair === null ? null : gsap.quickSetter(crosshair, 'x', 'px');
  const setTooltipX = tooltip === null ? null : gsap.quickSetter(tooltip, 'x', 'px');
  const setTooltipY = tooltip === null ? null : gsap.quickSetter(tooltip, 'y', 'px');

  return {
    crosshair: (x) => {
      setCrosshair?.(x);
    },
    tooltip: (x, y) => {
      setTooltipX?.(x);
      setTooltipY?.(y);
    },
  };
}

/**
 * G-30's only motion: the tooltip's **arrival**, once per entry into the plot area — not per
 * pointer move. Opacity only.
 */
export function fadeTooltipIn(tooltip: HTMLElement): gsap.core.Tween {
  return gsap.fromTo(
    tooltip,
    { opacity: 0 },
    { opacity: 1, duration: dur.fast, ease: ease.enter, overwrite: 'auto' },
  );
}

/**
 * **G-29's single exception.** A deliberate user action — changing the entity set, changing the
 * scope — may cross-fade the mark layer. Never a re-run of G-27 or G-28, and never on a query
 * result arriving on its own.
 */
export function crossFadeMarks(layer: SVGElement): gsap.core.Tween {
  return gsap.fromTo(
    layer,
    { opacity: 0 },
    { opacity: 1, duration: dur.fast, ease: ease.enter, overwrite: 'auto' },
  );
}
