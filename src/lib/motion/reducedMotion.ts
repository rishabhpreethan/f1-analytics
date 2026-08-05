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
