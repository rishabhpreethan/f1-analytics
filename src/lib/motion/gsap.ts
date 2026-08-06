/**
 * The **only** module in this repository that may import `gsap`, `gsap/*` or
 * `@gsap/react` (`ARCHITECTURE.md` §10 #21). An ESLint `no-restricted-imports` rule
 * enforces that, so this is a boundary rather than a convention.
 *
 * Why one choke point (R-G6): `gsap.registerPlugin` is GreenSock's documented way to
 * bind a plugin to the same core instance, and registering inside a component means
 * registering once per mount. Doing it here means it happens exactly once, at module
 * evaluation, before any component can create a tween.
 *
 * **Plugin allow/denylist** (§10 #21, `DESIGN_SYSTEM.md` §4.1):
 *   - allowed and registered here: `ScrollTrigger` (G-13, G-14, G-15), `SplitText` (G-16)
 *   - deliberately **not** installed: `MotionPathPlugin` (G-20 uses native CSS
 *     `offset-path` instead, 9.7 KB cheaper), `Flip` (deferred to F4, G-24),
 *     `CustomEase`/`CustomBounce`/`CustomWiggle` (they would let a cubic-bézier literal
 *     back in), `GSDevTools`, `Draggable`, `MorphSVG`, `DrawSVG`, `Inertia`
 *   - **never**: `ScrollSmoother`, `normalizeScroll` — they hijack native scrolling,
 *     which is an accessibility and perceived-performance regression on a data product
 *
 * `ScrollTrigger` and `SplitText` are imported statically, not dynamically: the landing
 * page is the eager first paint (§S.6.3), so a dynamic import would buy a waterfall and
 * nothing else.
 */

import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { MOTION } from './tokens';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/**
 * `overwrite: 'auto'` is deliberate: it kills conflicting tweens of the same property on
 * the same target, which is what makes a rapid hover-in / hover-out land on a correct
 * final value instead of racing.
 *
 * The default ease is named rather than inherited — GSAP's own default is `power1.out`,
 * which is not one of the seven eases this product has (§4.3).
 */
gsap.defaults({
  duration: MOTION.dur.base,
  ease: MOTION.ease.enter,
  overwrite: 'auto',
});

/** A scoped selector legitimately matches nothing — that is not a warning-worthy event. */
gsap.config({ nullTargetWarn: false });

export { gsap, useGSAP, ScrollTrigger, SplitText };
