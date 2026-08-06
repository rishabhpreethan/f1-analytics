import { dist, dur, ease, m, stagger } from './tokens';
import type { MotionCtx } from './useMotion';

/**
 * The reusable **builders** for the named surface motions — the ones that appear on more
 * than one component and must therefore look identical on all of them.
 *
 * They are plain functions over a `MotionCtx`, not hooks: a builder is handed the
 * timeline `useMotion` already created, so it needs no state, no ref and no GSAP import of
 * its own. That also makes each one readable as a single statement of what the motion *is*
 * — which is the whole reason `DESIGN_SYSTEM.md` §4.6 numbers them.
 *
 * Every builder is authored as `from`/`fromTo` (MR-2): the resting CSS is the final,
 * readable state, so an element is correct even if its tween never runs.
 */

type Ctx<T extends HTMLElement> = MotionCtx<T> & { tl: gsap.core.Timeline };

/**
 * **G-1 — the shell mount, header half.** `opacity 0→1`, `y −6→0`, `dur.base`,
 * `ease.enter`. Once per hard load, never per route: the route-level motion is G-2.
 *
 * G-1's dock half lives in `dockMount` and is built by the dock's own `useMotion`, not
 * appended to this timeline. Two reasons: the dock's entrance axis depends on its
 * orientation, which only the dock knows; and a shell-level selector reaching into another
 * component's subtree is the cross-component reach R-G2's scoping exists to prevent. The
 * two are sequenced by `DOCK_MOUNT_DELAY`, which reproduces G-1's `-=0.10` overlap.
 */
export function shellMount<T extends HTMLElement>({ tl, root }: Ctx<T>): void {
  tl.from(root, { opacity: 0, y: -dist.nudge, duration: dur.base, ease: ease.enter });
}

/** G-1's `-=0.10`, expressed as a delay because the dock owns its own timeline. */
export const DOCK_MOUNT_DELAY = dur.base - 0.1;

/**
 * **G-1 — the shell mount, dock half.** The container arrives, then its items stagger in.
 *
 * The axis is the caller's, because only the dock knows its orientation: the rail comes in from
 * the left (`x −12→0`), the bottom dock rises (`y 12→0`). §4.6 specifies both.
 *
 * `DOCK_MOUNT_DELAY` reproduces the `-=0.10` overlap with the header's half. Total sequence
 * stays inside G-1's 460ms: 100ms in, 320ms for the container, items overlapping it.
 */
export function dockMount<T extends HTMLElement>({ tl, root, q }: Ctx<T>, isRail: boolean): void {
  tl.from(
    root,
    {
      opacity: 0,
      ...(isRail ? { x: -dist.lift } : { y: dist.lift }),
      duration: dur.slow,
      ease: ease.arrive,
      delay: DOCK_MOUNT_DELAY,
    },
    0,
  ).from(
    q('[data-motion="dock-item"]'),
    {
      opacity: 0,
      ...(isRail ? { x: -dist.nudge } : { y: dist.nudge }),
      duration: dur.fast,
      ease: ease.enter,
      stagger: stagger.nav,
    },
    '-=0.18',
  );
}

/**
 * **G-3 — the dock indicator's travel.** The half of G-3 that is a *tween*, as opposed to the
 * half that is a measured `gsap.set`.
 *
 * Two tweens at position 0: the bar travels from where it was to where `settle` has already
 * put it, at `m.indicator` (`dur.slow` / `ease.arrive`), and the 2px rule grows `0.4→1` along
 * its own length at `dur.fast`. §4.6 G-3 specifies both figures.
 *
 * **A `from` tween rather than the `quickTo` §4.6 names, and that is a mechanism deviation
 * with a reason.** `quickTo` reuses one tween instance across many calls, which is what a
 * *pointer* setter needs; the indicator moves in response to a React dependency change, and
 * under R-G3 (`revertOnUpdate: true`) every such change tears the context down and rebuilds
 * it, so no setter survives to be reused. The remembered previous offset makes the same
 * motion expressible as `from` — identical duration, identical ease, and authored `from`, so
 * MR-2 holds: if the tween never runs the bar is already in the right place.
 *
 * `travel.from === null` is first paint: there is nowhere to travel from, so only the rule
 * grows. The caller does not call this at all when the offset has not changed, which is what
 * stops a rail hover from replaying the flourish.
 */
export function indicatorTravel<T extends HTMLElement>(
  { tl, root }: Ctx<T>,
  travel: { from: number | null; to: number },
  isRail: boolean,
): void {
  if (travel.from !== null) {
    tl.from(root, { [isRail ? 'y' : 'x']: travel.from, ...m.indicator }, 0);
  }
  tl.from(root, { [isRail ? 'scaleY' : 'scaleX']: 0.4, duration: dur.fast, ease: ease.enter }, 0);
}

/**
 * **G-12, content half** — the tween vars only, because the target differs at every call
 * site and the builders above all own their own selector. Opacity only, so it is identical
 * under reduced motion by §4.4 rule 1 — and it is still authored `from` (MR-2), so the
 * resting state is the resolved content.
 */
export const contentEnter = { duration: dur.base, ease: ease.enter } as const;

/**
 * **G-6 — popover open.** `opacity 0→1`, `scale 0.96→1`, `dur.fast`, `ease.enter`.
 * `transform-origin` is the trigger corner and is set in CSS by `.popover-panel`, not
 * here: it is a property of where the panel is anchored, not of the animation.
 */
export function popoverEnter<T extends HTMLElement>({ tl, root }: Ctx<T>): void {
  tl.fromTo(
    root,
    { opacity: 0, scale: 0.96 },
    { opacity: 1, scale: 1, duration: dur.fast, ease: ease.enter },
  );
}

/** **G-6 — popover close.** `opacity→0`, `scale→0.98`, `dur.instant`, `ease.exit`. */
export function popoverExit<T extends HTMLElement>({ tl, root }: Ctx<T>): void {
  tl.to(root, { opacity: 0, scale: 0.98, duration: dur.instant, ease: ease.exit });
}

/**
 * **G-5 — the dock's overflow sheet.** Scrim first, then the panel rising, then the rows.
 * Selectors are `data-motion` attributes rather than class names: a class is for styling
 * and may legitimately change, whereas this is a contract between the markup and the
 * motion.
 */
export function sheetEnter<T extends HTMLElement>({ tl, q }: Ctx<T>): void {
  tl.fromTo(
    q('[data-motion="scrim"]'),
    { opacity: 0 },
    { opacity: 1, duration: dur.fast, ease: ease.enter },
  )
    .fromTo(
      q('[data-motion="sheet-panel"]'),
      { opacity: 0, y: dist.sheet },
      { opacity: 1, y: 0, ...m.surface },
      0,
    )
    .fromTo(
      q('[data-motion="sheet-row"]'),
      { opacity: 0, y: dist.step },
      { opacity: 1, y: 0, duration: dur.fast, ease: ease.enter, stagger: stagger.nav },
      '-=0.16',
    );
}

/** **G-5, reversed** at `dur.base` / `ease.exit`. The rows do not stagger out. */
export function sheetExit<T extends HTMLElement>({ tl, q }: Ctx<T>): void {
  tl.to(q('[data-motion="sheet-panel"]'), {
    opacity: 0,
    y: dist.lift,
    duration: dur.base,
    ease: ease.exit,
  }).to(q('[data-motion="scrim"]'), { opacity: 0, duration: dur.fast, ease: ease.exit }, 0);
}
