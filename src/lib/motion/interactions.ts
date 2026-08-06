import { gsap } from './gsap';
import { dist, dur, ease, m } from './tokens';
import { useMotion } from './useMotion';
import { MOTION_QUERY_FINE_POINTER } from './reducedMotion';

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

/** The subset of DOM handlers G-8 needs. */
export interface SpotlightHandlers {
  onPointerMove: (event: { clientX: number; clientY: number }) => void;
  onPointerLeave: () => void;
}

export interface SpotlightMotion<T extends HTMLElement> {
  scope: React.RefObject<T | null>;
  handlers: SpotlightHandlers;
}

/**
 * **G-8 — the pointer spotlight.** Two `gsap.quickTo` setters write `--px` / `--py` in
 * element-relative pixels at `m.pointer`; CSS paints a `radial-gradient` at those coordinates
 * as a `::before` layer under the content. The component never writes a duration, an ease or a
 * colour — it asks for the behaviour and attaches two handlers.
 *
 * ⚠ **The resting values in `index.css` must be declared in `px`, not `%`.** GSAP's CSSPlugin
 * reads the property's current value to learn its unit and appends that unit to an end value
 * that has none — so with a resting `50%` the pixel figures written below rendered as
 * percentages and the highlight landed off the element entirely. `index.css.test.ts` asserts
 * the declaration and `interactions.test.ts` asserts the rendered value.
 *
 * Three properties that are decisions:
 *
 *   - **`quickTo`, not `gsap.to` per event.** `quickTo` reuses one tween instance and is
 *     GreenSock's documented answer to a high-frequency setter; creating a tween per
 *     `pointermove` would allocate on every frame of every hover.
 *   - **`(pointer: fine)` only.** On a touch screen `pointermove` arrives during a drag, so the
 *     spotlight would follow a scrolling finger. Nothing is lost: the affordance G-8 decorates
 *     is also expressed by the flat surface step of G-7, which is a CSS transition.
 *   - **A no-op under reduced motion**, via `motionSafe`. The hover still changes surface and
 *     ink, because that half is CSS.
 *
 * `--spotlight` is toggled to 0 on leave rather than the gradient being removed, so the
 * highlight fades out where it was instead of vanishing.
 */
export function useSpotlight<T extends HTMLElement = HTMLDivElement>(): SpotlightMotion<T> {
  /**
   * The two `quickTo` instances are created in `animate`, not in the handler and not during
   * render. Three reasons, in order of importance: `animate` runs **only** in the
   * `no-preference` branch, so under `reduce` no tween object is ever constructed; it runs in a
   * layout effect, so the element exists; and it means the handler only ever *reads* a ref,
   * which is what `react-hooks/refs` is protecting (a ref written during render is a value React
   * cannot see change).
   */
  const { scope, motionSafe } = useMotion<T>({
    animate: ({ root, gsap: g }) => {
      POINTER_SETTERS.set(root, {
        x: voidSetter(g.quickTo(root, '--px', { ...m.pointer })),
        y: voidSetter(g.quickTo(root, '--py', { ...m.pointer })),
      });
      return () => {
        POINTER_SETTERS.delete(root);
      };
    },
  });

  const fine = matchesFinePointer();

  const onPointerMove = motionSafe((event: { clientX: number; clientY: number }) => {
    const el = scope.current;
    if (el === null || !fine) return;
    const setter = POINTER_SETTERS.get(el);
    if (setter === undefined) return;

    const rect = el.getBoundingClientRect();
    setter.x(event.clientX - rect.left);
    setter.y(event.clientY - rect.top);
    gsap.to(el, { '--spotlight': 1, duration: dur.fast, ease: ease.enter });
  });

  const onPointerLeave = motionSafe(() => {
    const el = scope.current;
    if (el === null || !fine) return;
    gsap.to(el, { '--spotlight': 0, duration: dur.base, ease: ease.exit });
  });

  return { scope, handlers: { onPointerMove, onPointerLeave } };
}

interface PointerSetters {
  x: (value: number) => void;
  y: (value: number) => void;
}

/**
 * Where a pointer-driven element's two `quickTo` setters live, keyed by the element itself.
 *
 * **Not a ref, deliberately.** A `useRef` written from a motion builder and read from a pointer
 * handler is exactly the pattern `react-hooks/refs` refuses to let through, and it is right to:
 * it cannot prove the handler is not called during render, and a ref written during render is a
 * value React cannot see change. A `WeakMap` keyed by the DOM node has no such ambiguity, holds
 * nothing alive after the node is collected, and reads identically from either side.
 */
const POINTER_SETTERS = new WeakMap<HTMLElement, PointerSetters>();

/**
 * `gsap.quickTo` returns a setter that returns the Tween — and a Tween is thenable, so handing
 * one straight to a DOM handler is a promise-returning function where a void one is expected.
 * Swallowing the return is the fix, and it is not a loss: nothing here awaits a tween.
 */
function voidSetter(setter: (value: number) => unknown): (value: number) => void {
  return (value: number) => {
    setter(value);
  };
}

function matchesFinePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia(MOTION_QUERY_FINE_POINTER).matches;
  } catch {
    return false;
  }
}

/**
 * **G-9 — the magnetic CTA.** `quickTo` on `x`/`y` toward the pointer at 0.14 of the offset,
 * clamped to ±`dist.magnet`, returning to 0 on leave at `dur.slow` / `ease.arrive`.
 *
 * **Applied to exactly one element in the product** — the landing hero's primary action. A page
 * of magnetic buttons is a toy, and §4.6 says so; the clamp is what keeps it a suggestion of
 * weight rather than a button that runs away from the cursor.
 */
const MAGNET_RATIO = 0.14;

export function useMagnet<T extends HTMLElement = HTMLAnchorElement>(): SpotlightMotion<T> {
  const { scope, motionSafe } = useMotion<T>({
    animate: ({ root, gsap: g }) => {
      POINTER_SETTERS.set(root, {
        x: voidSetter(g.quickTo(root, 'x', { ...m.pointer })),
        y: voidSetter(g.quickTo(root, 'y', { ...m.pointer })),
      });
      return () => {
        POINTER_SETTERS.delete(root);
      };
    },
  });

  const fine = matchesFinePointer();
  const clamp = (value: number) => Math.max(-dist.magnet, Math.min(dist.magnet, value));

  const onPointerMove = motionSafe((event: { clientX: number; clientY: number }) => {
    const el = scope.current;
    if (el === null || !fine) return;
    const setter = POINTER_SETTERS.get(el);
    if (setter === undefined) return;

    const rect = el.getBoundingClientRect();
    setter.x(clamp((event.clientX - (rect.left + rect.width / 2)) * MAGNET_RATIO));
    setter.y(clamp((event.clientY - (rect.top + rect.height / 2)) * MAGNET_RATIO));
  });

  const onPointerLeave = motionSafe(() => {
    const el = scope.current;
    if (el === null || !fine) return;
    gsap.to(el, { x: 0, y: 0, duration: dur.slow, ease: ease.arrive });
  });

  return { scope, handlers: { onPointerMove, onPointerLeave } };
}
