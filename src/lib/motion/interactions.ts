import { gsap } from './gsap';
import { m } from './tokens';
import { useMotion } from './useMotion';

/**
 * The pointer-driven named motions, as hooks — because a tween must be *created* by GSAP
 * and `gsap` may only be imported inside `src/lib/motion/` (`ARCHITECTURE.md` §10 #21).
 * A component asks for a behaviour and gets DOM handlers back; it never writes a duration
 * or an ease.
 *
 * Everything here is created through `motionSafe`, so it is context-safe (R-G4: a handler
 * runs after the effect, so a tween it creates would otherwise escape the cleanup) **and
 * a no-op under reduced motion**. The non-motion half of each affordance — the surface
 * step, the ink change — is a CSS transition on the same element, so a reduced-motion user
 * still gets feedback; they just do not get movement.
 */

/** The subset of DOM handlers G-7's press feedback needs. */
export interface PressHandlers {
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
}

export interface PressMotion<T extends HTMLElement> {
  scope: React.RefObject<T | null>;
  press: PressHandlers;
}

/**
 * **G-7, press half.** `scale: 0.985` on `pointerdown`, released on `pointerup`, on
 * `pointerleave` and on `pointercancel` — the last two because a pointer that leaves or is
 * interrupted mid-press must not leave the control visually held down.
 *
 * `overwrite: 'auto'` (set once in `gsap.ts`) is what makes a rapid press/release land on
 * a correct final value instead of racing.
 */
export function usePressMotion<T extends HTMLElement = HTMLButtonElement>(): PressMotion<T> {
  const { scope, motionSafe } = useMotion<T>({});

  const to = (scale: number, preset: { duration: number; ease: string }) =>
    motionSafe(() => {
      const el = scope.current;
      if (el === null) return;
      gsap.to(el, { scale, ...preset });
    });

  const down = to(0.985, m.press);
  const release = to(1, m.control);

  return {
    scope,
    press: {
      onPointerDown: down,
      onPointerUp: release,
      onPointerLeave: release,
      onPointerCancel: release,
    },
  };
}
