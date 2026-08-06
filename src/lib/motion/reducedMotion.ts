/**
 * The reduced-motion predicate, pure and GSAP-free (§S.3.7).
 *
 * This module exists so the *question* "has the user asked for less motion?" can be
 * answered — and unit-tested — without loading an animation library. The *mechanism*
 * that acts on the answer is `gsap.matchMedia()` in `useMotion`, not an `if` here
 * (`DESIGN_SYSTEM.md` §4.4).
 *
 * `matchMedia` is absent in a bare jsdom and in some embedded webviews, so it is never
 * assumed. Absent means "no stated preference", which is `false` — the same convention
 * `lib/theme.ts` uses for `prefers-color-scheme`.
 */

export const MOTION_QUERY_REDUCE = '(prefers-reduced-motion: reduce)';

/** The `no-preference` side, which is the branch every tween is created inside. */
export const MOTION_QUERY_ALLOW = '(prefers-reduced-motion: no-preference)';

/**
 * Pointer-following motion is attached **only** where there is a pointer that can hover
 * (§4.6 G-8, G-9, G-21). On a touch screen a `pointermove` arrives only during a drag, so a
 * spotlight would appear under the finger mid-scroll — and the effect is decorative, so there
 * is nothing to substitute.
 */
export const MOTION_QUERY_FINE_POINTER = '(pointer: fine)';

export function prefersReducedMotion(win?: Pick<Window, 'matchMedia'>): boolean {
  const target = win ?? (typeof window === 'undefined' ? undefined : window);
  if (target === undefined || typeof target.matchMedia !== 'function') return false;
  try {
    return target.matchMedia(MOTION_QUERY_REDUCE).matches;
  } catch {
    // A webview that throws on an unknown media feature is telling us nothing, not
    // telling us "reduce".
    return false;
  }
}

/** The same question asked of a `MediaQueryList` we already hold. */
export function matchesReduce(mql: Pick<MediaQueryList, 'matches'> | null | undefined): boolean {
  return mql?.matches === true;
}
