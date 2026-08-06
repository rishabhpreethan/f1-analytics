/**
 * The ONE source for every timing value in the product (`DESIGN_SYSTEM.md` §4.3).
 *
 * Two rules this module exists to enforce, both mechanically checked by
 * `tokens.test.ts` (CT-1 … CT-3):
 *
 *   1. **Every ease is a GSAP named ease string.** No `cubic-bezier()` literal, no
 *      `CustomEase`, no numeric array exists anywhere in this product. `back`,
 *      `elastic`, `bounce`, `rough`, `slow`, `steps` and `expoScale` are **not
 *      adopted** (§4.3): this product decelerates like a mechanism, it does not wobble.
 *   2. **The CSS `--dur-*` tokens and `MOTION.dur` cannot drift.** GSAP takes seconds;
 *      `tokens.css` mirrors the same figures in milliseconds, and CT-3 parses the
 *      stylesheet to prove they agree.
 *
 * `MOTION` is the single frozen namespace; the five slot names (`dur`, `ease`, `m`,
 * `loop`, `stagger`) are also re-exported individually because `DESIGN_SYSTEM.md` §4.3
 * names them that way and a call site reads better as `dur.fast` than
 * `MOTION.dur.fast`.
 *
 * This module imports nothing — not even `gsap` — so it is safe to read from a test,
 * from CSS-generation tooling, or from a component.
 */

/**
 * Seconds, GSAP's own unit.
 *
 * Two budgets, not one (§4.2):
 *   - **Interaction path — 400ms hard ceiling.** `instant` … `chart` all sit inside it.
 *   - **First-paint entrance — 1100ms total, 900ms per tween.** `reveal` is the only
 *     entrance duration and is used once per hard load, by G-16.
 *
 * `pointer` is not a transition duration at all: it is the catch-up constant handed to
 * `gsap.quickTo`, which is why it is the one entry with no `--dur-*` mirror in
 * `tokens.css` (there is no CSS transition it could drive).
 */
const dur = {
  instant: 0.08, // 80ms  — colour or ink change on a control, hover wash
  fast: 0.14, // 140ms — tooltips, chips, small fades, press feedback
  base: 0.2, // 200ms — content entering, popovers, route enter
  slow: 0.32, // 320ms — sheets, trays, the dock rail, the dock indicator
  chart: 0.4, // 400ms — chart mount only, never on data update
  reveal: 0.72, // 720ms — the landing headline characters (entrance budget only)
  pointer: 0.6, // 600ms — quickTo catch-up for pointer-following (G-8, G-9, G-21)
} as const;

/**
 * Durations that are deliberately outside the 400ms interaction ceiling, with the
 * reason each is allowed. CT-1 reads this list rather than hard-coding exceptions, so a
 * new long duration cannot be added silently.
 */
export const DUR_OUTSIDE_INTERACTION_BUDGET = {
  reveal: 'entrance-only (§4.2 first-paint budget: ≤900ms per tween)',
  pointer: 'quickTo catch-up constant, not a transition duration',
} as const;

/** GSAP's named core eases. Seven exist in this product and no others (§4.3). */
const ease = {
  enter: 'power2.out', // anything appearing
  exit: 'power2.in', // anything leaving
  move: 'power2.inOut', // anything repositioning
  mech: 'circ.out', // data marks growing — the one "mechanical" curve
  arrive: 'expo.out', // long decelerations: headline reveal, dock indicator
  drift: 'sine.inOut', // the ONLY ease permitted in a yoyo loop (the atmosphere)
  none: 'none', // scrub-linked progress, and constant-rate loops
} as const;

/**
 * Preset pairs — a duration and an ease, together. This replaces the retired spring token
 * set of the previous animation library, whose duration-plus-bounce API has no GSAP-core
 * equivalent (§4.3).
 */
const m = {
  press: { duration: dur.instant, ease: ease.enter }, // scale 0.985 on press
  control: { duration: dur.fast, ease: ease.enter }, // buttons, chips, rows
  indicator: { duration: dur.slow, ease: ease.arrive }, // dock active-item indicator
  surface: { duration: dur.slow, ease: ease.arrive }, // sheets, trays, rail expand
  reveal: { duration: dur.reveal, ease: ease.arrive }, // headline characters
  pointer: { duration: dur.pointer, ease: 'power3.out' }, // quickTo only
} as const;

/**
 * Loop periods, seconds. **Ambient only, never on an interaction path** — slow reads as
 * alive, fast reads as busy (§4.2). Mirrored as `--anim-*` in `tokens.css` so the CSS
 * `@keyframes` that actually run these loops (MR-1: looping motion is CSS) read the same
 * figures.
 */
const loop = {
  grid: 24, // grid layer drift — 48px per cycle → 2 px/s
  orbA: 18,
  orbB: 24,
  orbC: 30,
  comet: 11, // racing-line pulse, one lap
  skeleton: 1.2, // skeleton pulse
} as const;

/** GSAP's object form, so `from` is always explicit. */
const stagger = {
  char: { each: 0.018, from: 'start' },
  nav: { each: 0.035, from: 'start' },
  row: { each: 0.024, from: 'start' },
  card: { each: 0.045, from: 'start' },
  /**
   * The axis-anchored growth of data marks (§6.1). Its first real instance is the coverage
   * ruler's six bars (Design Spec §3.5), and F2's chart marks inherit it — which is the reason
   * it is a token here rather than a literal at the one call site.
   */
  bar: { each: 0.06, from: 'start' },
  /**
   * Items after the 12th get **zero** delay: a 20-row stagger at 24ms would take 480ms
   * and break the 400ms interaction ceiling.
   */
  cap: 12,
} as const;

/**
 * Distances, px. Small on purpose — every entrance here is a settle, not an arrival
 * from off-screen.
 *
 * **Every entry has a call site.** Two did not and are gone: `hairline` (1), which described the
 * capability card's hover lift — a CSS transition, never a tween, and 1px where Design Spec §3.4
 * says 2, so it lives as `--size-card-lift` in `tokens.css` beside the rule that applies it; and
 * `spotlight` (220), which duplicated `--size-spotlight` for the same reason. Both figures are
 * read by CSS and never by JavaScript, so a copy here could only ever drift out of agreement
 * with the one that renders.
 */
const dist = {
  nudge: 6, // shell mount, dock item entrance
  step: 8, // rows, popover rows
  rise: 10, // route content enter
  section: 16, // G-15 — a section revealing on scroll
  lift: 12, // dock container, sheet panel
  sheet: 24, // the bottom sheet's travel
  parallax: 14, // G-21 clamp
  magnet: 6, // G-9 clamp
} as const;

export const MOTION = { dur, ease, m, loop, stagger, dist } as const;

export { dur, ease, m, loop, stagger, dist };

export type Duration = keyof typeof dur;
export type Ease = keyof typeof ease;
