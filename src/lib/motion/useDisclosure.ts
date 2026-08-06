import { useCallback, useState } from 'react';
import { useMotion, type MotionCtx } from './useMotion';

/**
 * A mounted/unmounted surface that animates on the way in **and** on the way out —
 * popovers (G-6) and the dock's overflow sheet (G-5).
 *
 * **Why this exists.** The retired animation library shipped a presence wrapper that
 * delayed an unmount until an exit animation had finished. GSAP has no equivalent and this
 * product deliberately does not install one, so the three-phase machine below is the whole
 * replacement:
 * `closed → open → closing → closed`, where `closing` is the window in which the element
 * is still in the DOM purely so its exit tween can play.
 *
 * It lives in `src/lib/motion/` rather than in each popover because an exit tween has to
 * be *created* by GSAP, and `gsap` may only be imported here (`ARCHITECTURE.md` §10 #21).
 * Three call sites share it, so it is also the difference between one state machine and
 * three subtly different ones.
 *
 * Two behaviours that are decisions, not incidentals:
 *
 *   - **Focus never waits for a tween.** `close()` returns immediately and the caller
 *     restores focus synchronously; only the pixels linger. A keyboard user must not be
 *     made to wait 80ms for their focus to come back.
 *   - **Under reduced motion the element unmounts at once.** `animate` is never called
 *     there — that is the whole point of `useMotion` — so a `closing` phase would never
 *     be completed by anything and the panel would stay on screen forever. The same
 *     guard covers "no exit builder was supplied".
 */

export type DisclosurePhase = 'closed' | 'open' | 'closing';

export interface DisclosureSpec<T extends HTMLElement> {
  /** Authored as `from`/`fromTo` (MR-2): the resting CSS is the open, readable state. */
  enter?: (ctx: MotionCtx<T> & { tl: gsap.core.Timeline }) => void;
  /** Whatever this timeline does, the element unmounts when it completes. */
  exit?: (ctx: MotionCtx<T> & { tl: gsap.core.Timeline }) => void;
}

export interface DisclosureHandle<T extends HTMLElement> {
  scope: React.RefObject<T | null>;
  /** `true` while the element must be in the DOM — open **or** closing. */
  mounted: boolean;
  /** `true` only while open. This is the value `aria-expanded` reflects. */
  isOpen: boolean;
  reduced: boolean;
  motionSafe: <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => void;
  open: () => void;
  /** Idempotent, and safe to call while already closing. */
  close: () => void;
}

export function useDisclosure<T extends HTMLElement = HTMLDivElement>(
  spec: DisclosureSpec<T>,
): DisclosureHandle<T> {
  const [phase, setPhase] = useState<DisclosurePhase>('closed');

  const { scope, reduced, motionSafe } = useMotion<T>({
    animate: (ctx) => {
      if (phase === 'open') {
        spec.enter?.(ctx);
        return;
      }
      if (phase !== 'closing') return;

      spec.exit?.(ctx);
      // Registered after the caller has built the timeline, so it fires once everything
      // the caller added has finished. An empty timeline completes on the next tick,
      // which is the correct behaviour for "no exit animation specified".
      ctx.tl.eventCallback('onComplete', () => {
        setPhase('closed');
      });
    },
    deps: [phase],
  });

  const open = useCallback(() => {
    setPhase('open');
  }, []);

  // Memoised because a caller registers `close` in an effect — an outside-click listener
  // — and an identity that changed every render would tear that listener down and rebuild
  // it on every render of the open popover.
  const close = useCallback(() => {
    // No tween will ever be created under `reduce`, and none is wanted; unmount now
    // rather than entering a `closing` phase nothing can complete.
    setPhase(reduced || spec.exit === undefined ? 'closed' : 'closing');
  }, [reduced, spec.exit]);

  return {
    scope,
    mounted: phase !== 'closed',
    isOpen: phase === 'open',
    reduced,
    motionSafe,
    open,
    close,
  };
}
