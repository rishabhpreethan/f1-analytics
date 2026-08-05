import type { Transition, Variants } from 'framer-motion';

/**
 * Motion tokens and the F0 variants, copied from `docs/DESIGN_SYSTEM.md` §4.3–§4.5.
 *
 * Two rules this file exists to enforce:
 *   1. **No duration, easing or spring value is written by hand in a component.** An
 *      ad-hoc number here is the same class of failure as an off-scale font size.
 *   2. **No cubic-bézier literal exists anywhere in this product.** Easings are
 *      Framer Motion's own string presets; springs use Motion's documented
 *      duration-based API (`visualDuration` + `bounce`), not hand-tuned
 *      stiffness/damping.
 *
 * F0 lands only the tokens the shell and route motions consume. F1 completes the set
 * (M-9 stagger, M-10 scroll reveal, chart entry).
 *
 * Framer Motion takes seconds; `DESIGN_SYSTEM.md` §4.3 states milliseconds. The
 * comments carry the millisecond figure so the two can be compared at a glance.
 */

export const dur = {
  instant: 0.08, // 80ms — colour/ink change on a control
  fast: 0.14, // 140ms — tooltips, chips, small fades, crossfades
  base: 0.2, // 200ms — content entering, popovers, tab rules
  slow: 0.32, // 320ms — sheets, trays, shared-element transitions
  chart: 0.4, // 400ms — chart mount only, never on data update
} as const;

export const ease = {
  enter: 'easeOut', // anything appearing
  exit: 'easeIn', // anything leaving
  move: 'easeInOut', // anything repositioning without a spring
  mech: 'circOut', // data marks growing — the one "mechanical" curve
} as const;

/** Bounce stays ≤0.16 throughout: this product decelerates like a mechanism. */
export const spring = {
  control: { type: 'spring', visualDuration: 0.18, bounce: 0.08 },
  layout: { type: 'spring', visualDuration: 0.3, bounce: 0.12 },
  surface: { type: 'spring', visualDuration: 0.36, bounce: 0.16 },
} as const satisfies Record<string, Transition>;

const enterTransition: Transition = { duration: dur.base, ease: ease.enter };
const fastEnterTransition: Transition = { duration: dur.fast, ease: ease.enter };
const fastExitTransition: Transition = { duration: dur.fast, ease: ease.exit };

/** M-1 — app shell mount. Once per hard load, never per route. */
export const shellMount: Variants = {
  hidden: { opacity: 0, y: -4 },
  visible: { opacity: 1, y: 0, transition: enterTransition },
};

/** M-1 reduced variant: opacity only, `dur.fast`, no `y`. */
export const shellMountReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: fastEnterTransition },
};

/**
 * M-2 — route content enter, keyed on `location.pathname`.
 *
 * There is deliberately **no exit variant**: `mode="wait"` would add the exit
 * duration to every perceived navigation, so a route change must never hold the
 * outgoing view.
 */
export const routeEnter: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: enterTransition },
};

/**
 * M-2 reduced variant: opacity only at `dur.fast`.
 *
 * `MotionConfig reducedMotion="user"` already drops the `y`, but it keeps the *duration*
 * — and §4.4 specifies `dur.fast`, not `dur.base`, for the reduced form. The explicit
 * variant is the difference between honouring the specification and approximating it.
 */
export const routeEnterReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: fastEnterTransition },
};

/** M-5 — popover / menu open. `transform-origin` is set by the component. */
export const popover: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: fastEnterTransition },
  exit: { opacity: 0, scale: 0.98, transition: fastExitTransition },
};

/** M-4 — mobile nav sheet panel. */
export const sheet: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: spring.surface },
  exit: { opacity: 0, y: -8, transition: fastExitTransition },
};

/**
 * M-4 reduced variant: opacity only at `dur.fast` on the panel too.
 *
 * `MotionConfig` drops the `y`, but the panel's spring would still govern the opacity,
 * and §4.4 specifies a `dur.fast` tween for the reduced form.
 */
export const sheetReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: fastEnterTransition },
  exit: { opacity: 0, transition: fastExitTransition },
};

/** M-4 — the scrim behind the sheet. Opacity only, in both directions. */
export const scrim: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: fastEnterTransition },
  exit: { opacity: 0, transition: fastExitTransition },
};

/**
 * M-6 — control gesture feedback. `whileFocus` is **not** used: the focus ring is CSS
 * `:focus-visible` (§3.5.1) and motion is never a focus indicator.
 */
export const control = {
  whileTap: { scale: 0.985 },
  transition: spring.control,
} as const;

/**
 * M-7 — skeleton pulse. Opacity only; never `background-position`, never a transform
 * loop. `MotionConfig reducedMotion="user"` does **not** stop an opacity loop, so the
 * caller must branch on `useReducedMotion()` and use `skeletonPulseReduced`.
 */
export const skeletonPulse = {
  animate: { opacity: [0.55, 1, 0.55] },
  transition: { duration: 1.2, ease: 'linear', repeat: Infinity },
} as const;

/** M-7 reduced variant: static, not merely slower. */
export const skeletonPulseReduced = {
  animate: { opacity: 0.7 },
} as const;

/**
 * M-8 — skeleton → content crossfade. The container holds its height so nothing
 * jumps. Identical under reduced motion, because it is opacity only.
 */
export const crossfade = {
  skeletonExit: { opacity: 0, transition: fastExitTransition },
  contentEnter: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: enterTransition },
  },
} as const;
