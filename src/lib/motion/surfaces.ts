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
