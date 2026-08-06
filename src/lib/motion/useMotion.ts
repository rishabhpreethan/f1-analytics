import { useRef } from 'react';
import { gsap, useGSAP } from './gsap';
import { MOTION_QUERY_REDUCE } from './reducedMotion';
import { useReducedMotion } from './useReducedMotion';

/**
 * The one hook that creates an animation. Everything else in `src/` describes *what*
 * should move; this decides *whether* and cleans up after it.
 *
 * Six rules from `ARCHITECTURE.md` §10 #21/#22 are structural here rather than
 * remembered:
 *
 * **R-G1 — built on `useGSAP()`, never `useEffect`.** `@gsap/react` runs its callback in
 * `useLayoutEffect` whenever `document` exists. That is not stylistic: `gsap.from()`
 * applies its start values the moment it is created, so building in a layout effect puts
 * the start state on screen before paint. Building in `useEffect` paints the resting
 * state first and then jumps — a visible flash on every mount.
 *
 * **R-G2 — the hook owns the scope ref.** It creates and returns it, so a caller cannot
 * forget to scope. A selector string handed to `q()` can only match descendants of that
 * container, which is the mechanism that stops a route's animation reaching into the
 * shell or the next route.
 *
 * **R-G3 — `revertOnUpdate: true`, hard-coded, no opt-out.** `useGSAP`'s default is
 * `false`, which reverts only on unmount; with a dependency array a dep change then
 * *adds* new tweens on top of the old ones and their leftover inline transforms fight.
 * That is the classic GSAP-in-React leak, and the components most exposed to it here are
 * the ones that never unmount — the dock, the atmosphere, the route-transition wrapper.
 *
 * **R-G4 — anything created after the hook has run must be context-safe.** Pointer,
 * click and timer handlers execute after the effect, so tweens they create are outside
 * the context and would never be cleaned up. `motionSafe()` wraps `contextSafe()` and
 * additionally returns a **no-op** under reduced motion.
 *
 * **R-G5 — GSAP animates the DOM; React never re-renders on a frame.** No `onUpdate`
 * may call `setState`, and no animated value may be mirrored into React state. Corollary:
 * never put a GSAP-controlled property into a component's `style` prop — React will
 * overwrite it on the next render.
 *
 * **MR-2 — the CSS resting state is always the final, readable state.** Entrance motion
 * is therefore authored as `from`/`fromTo`, never as `to`-from-a-hidden-state. If a tween
 * is never created — reduced motion, a JS error, a stalled chunk — the content is visible
 * and correct. An element whose base CSS is `opacity: 0` is a review failure.
 *
 * **Reduced motion is genuinely stopped, not slowed.** Both builders run inside
 * `gsap.matchMedia()`; `animate` is only reached when `reduce` does not match, so under
 * `reduce` **no tween object exists**. GSAP's global timeline then has no active child and
 * the ticker puts itself to sleep — zero `requestAnimationFrame` callbacks, zero property
 * writes. A `duration: 0` tween, which GSAP's own reduced-motion example uses, would still
 * instantiate, render once and touch the ticker; we do not use it.
 */

export interface MotionCtx<T extends HTMLElement> {
  /** The scoped container. Non-null inside a builder, by construction. */
  root: T;
  /** Scoped query — `gsap.utils.toArray` confined to `root`. */
  q: (selector: string) => HTMLElement[];
  gsap: typeof gsap;
}

/**
 * Returned from `animate` to release anything GSAP does not own — a `pointermove`
 * listener, a `ScrollTrigger` you created by hand, a `matchMedia` of your own. Returning
 * nothing is the common case.
 */
export type MotionCleanup = () => void;

export interface MotionSpec<T extends HTMLElement> {
  /**
   * Runs in **both** modes, first. `gsap.set` only — no tween, no duration. This is
   * where a measured position is applied, so that under reduced motion the thing is in
   * the right place instantly (the dock indicator *snaps*, which is correct and
   * intended).
   */
  settle?: (ctx: MotionCtx<T>) => void;
  /**
   * Runs **only** when motion is allowed. Author as `from()`/`fromTo()` (MR-2). The
   * timeline is created for you and killed on cleanup.
   */
  animate?: (ctx: MotionCtx<T> & { tl: gsap.core.Timeline }) => MotionCleanup | void;
  deps?: React.DependencyList;
}

export interface MotionHandle<T extends HTMLElement> {
  /** Attach to the container. The hook owns it so a selector cannot escape. */
  scope: React.RefObject<T | null>;
  reduced: boolean;
  /**
   * Context-safe, and a **no-op under reduced motion**. For hover, press and pointer
   * tweens created after the effect has run.
   */
  motionSafe: <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => void;
}

export function useMotion<T extends HTMLElement = HTMLDivElement>(
  spec: MotionSpec<T>,
): MotionHandle<T> {
  const scope = useRef<T | null>(null);
  const reduced = useReducedMotion();

  const { contextSafe } = useGSAP(
    () => {
      const root = scope.current;
      if (root === null) return undefined;

      const q = (selector: string): HTMLElement[] =>
        gsap.utils.toArray<HTMLElement>(selector, root);
      const base: MotionCtx<T> = { root, q, gsap };

      let ran = false;
      const run = (isReduced: boolean): MotionCleanup | undefined => {
        ran = true;
        // The builders are read from the closure of the render in which the effect last
        // ran, exactly as they would be in a `useEffect`. `deps` — and nothing else —
        // decides when that is.
        spec.settle?.(base);
        if (isReduced) return undefined;

        const animate = spec.animate;
        if (animate === undefined) return undefined;

        const tl = gsap.timeline();
        const cleanup = animate({ ...base, tl });
        return () => {
          if (typeof cleanup === 'function') cleanup();
          tl.kill();
        };
      };

      // §S.5: `matchMedia` is absent in a bare jsdom and in some embedded webviews.
      // `gsap.matchMedia()` calls `window.matchMedia` unconditionally, so the guard is
      // here rather than inside it. Absent means "no stated preference" — the same
      // convention `prefersReducedMotion()` uses — so the allowed branch runs directly.
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return run(false);
      }

      const mm = gsap.matchMedia();
      // Two keys on purpose. `all` is special-cased by GSAP to match unconditionally, so
      // the handler always runs and `settle` is never skipped; `reduce` carries a real
      // media query, so GSAP attaches a `change` listener to it and re-runs — reverting
      // whatever it created — the moment the OS preference is toggled. A single `reduce`
      // key would mean the handler never runs at all for a user who has no preference set.
      mm.add({ reduce: MOTION_QUERY_REDUCE, all: 'all' }, (ctx) =>
        run(ctx.conditions?.reduce === true),
      );

      // Belt and braces. GSAP only invokes the handler if at least one condition matched;
      // `all` guarantees that in every real browser, but a partial `matchMedia`
      // implementation (or a test stub) that answers `false` to `all` would otherwise
      // leave `settle` unrun — and `settle` is what positions a measured element. Falling
      // through to the permitted branch matches the "absent means no stated preference"
      // convention used everywhere else.
      const fallback = ran ? undefined : run(false);

      return () => {
        fallback?.();
        mm.kill(true);
      };
    },
    // Spread because `React.DependencyList` is readonly and `useGSAP`'s config is not.
    { scope, revertOnUpdate: true, dependencies: [...(spec.deps ?? [])] },
  );

  const motionSafe = <A extends unknown[]>(fn: (...args: A) => void) => {
    if (reduced) return () => undefined;
    return contextSafe(fn as (...args: unknown[]) => void) as (...args: A) => void;
  };

  return { scope, reduced, motionSafe };
}
