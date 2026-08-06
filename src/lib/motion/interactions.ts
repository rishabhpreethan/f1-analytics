import { gsap } from './gsap';
import { dist, dur, ease, gesture, m } from './tokens';
import { useMotion, type MotionHandle } from './useMotion';
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

/** The subset of DOM handlers a pointer-tracked effect needs. */
export interface PointerHandlers {
  onPointerMove: (event: { clientX: number; clientY: number }) => void;
  onPointerLeave: () => void;
}

export interface PointerMotion<T extends HTMLElement> {
  scope: React.RefObject<T | null>;
  handlers: PointerHandlers;
}

/**
 * **G-25 — the capability card's perspective tilt.**
 *
 * Two `gsap.quickTo` setters drive `rotationY` and `rotationX` toward the pointer at
 * `m.pointer`, and one short tween lifts the card's `scale`. With the CSS elevation step and
 * G-26's traced brackets, the card reads as **a physical object rising and turning to face you.**
 *
 * **It replaces G-8, the pointer spotlight, which is retired from the product.** Rishabh on the
 * cards: *"even the hover effects for these cards … i dont really like them either."* Two
 * independent reasons the spotlight goes rather than gets tuned:
 *
 *   1. With a monochrome accent, a 14%-opacity achromatic radial over a panel is a **smudge** —
 *      the identical failure the atmosphere's three gradient orbs were removed for the same day.
 *   2. It was one of *four* simultaneous polite effects on one element (spotlight, 2px lift,
 *      edge recolour, arrow nudge). One committed gesture beats four polite ones, and politeness
 *      is what Rishabh has now rejected three times.
 *
 * Five properties that are decisions rather than incidentals:
 *
 *   - **`quickTo`, not `gsap.to` per event.** `quickTo` reuses one tween instance and is
 *     GreenSock's documented answer to a high-frequency setter; a tween per `pointermove` would
 *     allocate on every frame of every hover.
 *   - **4° is the whole budget** (`gesture.tilt`). Past roughly 6° a card stops reading as a
 *     plane responding and starts reading as a page rendering incorrectly.
 *   - **`transformPerspective` is set on the element by GSAP, not by a CSS `perspective` on the
 *     grid.** A perspective on the parent would make every card share one vanishing point, so a
 *     card at the edge of a three-column grid would skew rather than tilt.
 *   - **`(pointer: fine)` only.** On a touch screen `pointermove` arrives during a scroll, so a
 *     card would wobble as a finger dragged past it.
 *   - **A no-op under reduced motion**, via `motionSafe`, and the setters are built inside
 *     `animate` so under `reduce` **no tween object and no inline transform ever exists**. That
 *     is why this needs no `transform: none` override the way the retired CSS lift did: there is
 *     no CSS transform to suppress. Toggling the OS preference mid-hover reverts the context and
 *     clears the inline transform with it.
 *
 * The card's non-motion feedback — the surface step, the elevation, the brackets, the index and
 * the arrow — is all CSS keyed on `:hover` **and** `:focus-visible`, so a keyboard user gets
 * everything except the tilt, which is pointer-derived by definition and has nothing to follow.
 */
const TILT_PERSPECTIVE = 900;

/**
 * G-25's arithmetic: the pointer's position within an element, as tilt angles in degrees.
 *
 * Pure and exported **so the geometry is unit-testable without a browser**, which is the lesson
 * of the `%`-vs-px spotlight defect: the part of a pointer effect that decides whether it looks
 * right is arithmetic, and arithmetic that quietly stopped being right would look like nothing
 * in a diff.
 *
 * **The signs are the design.** The edge under the cursor comes *toward* the viewer, so the card
 * leans into the pointer rather than being pressed away from it — which is the reading that pairs
 * with a `scale` up and a deeper shadow. In CSS's coordinate system (x right, y down, z toward
 * the viewer) `rotateY(+θ)` pushes the right edge back and `rotateX(+θ)` brings the bottom
 * forward, hence the negated `x` and the plain `y`.
 *
 * A degenerate rect — zero width or height, which is every rect in jsdom and any element before
 * first layout — yields `0`, never `NaN`. A `NaN` reaching a transform is ignored silently.
 */
export function tiltAngles(
  pointer: { clientX: number; clientY: number },
  rect: { left: number; top: number; width: number; height: number },
): { rotationX: number; rotationY: number } {
  const unit = (position: number, start: number, extent: number) => {
    if (!(extent > 0)) return 0;
    const offset = (position - (start + extent / 2)) / (extent / 2);
    return Math.max(-1, Math.min(1, offset));
  };

  return {
    rotationY: -unit(pointer.clientX, rect.left, rect.width) * gesture.tilt,
    rotationX: unit(pointer.clientY, rect.top, rect.height) * gesture.tilt,
  };
}

export function useTilt<T extends HTMLElement = HTMLDivElement>(): PointerMotion<T> {
  /**
   * The `quickTo` instances are created in `animate`, not in the handler and not during render.
   * Three reasons, in order of importance: `animate` runs **only** in the `no-preference` branch,
   * so under `reduce` no tween object is ever constructed; it runs in a layout effect, so the
   * element exists; and it means the handler only ever *reads* a ref, which is what
   * `react-hooks/refs` is protecting.
   */
  const { scope, motionSafe } = useMotion<T>({
    animate: ({ root, gsap: g }) => {
      // Applied here rather than in CSS so it exists only where a tilt exists. `force3D` keeps
      // the element on its own compositor layer for the life of the hover instead of promoting
      // and demoting it per tween.
      g.set(root, { transformPerspective: TILT_PERSPECTIVE, transformOrigin: '50% 50%' });
      POINTER_SETTERS.set(root, {
        x: voidSetter(g.quickTo(root, 'rotationY', { ...m.pointer })),
        y: voidSetter(g.quickTo(root, 'rotationX', { ...m.pointer })),
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

    const { rotationX, rotationY } = tiltAngles(event, el.getBoundingClientRect());
    setter.x(rotationY);
    setter.y(rotationX);
    gsap.to(el, { scale: gesture.lift, duration: dur.fast, ease: ease.enter });
  });

  const onPointerLeave = motionSafe(() => {
    const el = scope.current;
    if (el === null || !fine) return;
    // Everything settles together, at `dur.slow` / `ease.arrive` — the long deceleration §4.3
    // calls "weight transfer". A card that snapped flat would undo the physicality the tilt buys.
    gsap.to(el, { rotationX: 0, rotationY: 0, scale: 1, duration: dur.slow, ease: ease.arrive });
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
 *
 * `enabled` exists because `ButtonLink` renders one component for every link and only one link
 * is magnetic. Hooks cannot be called conditionally, so the *behaviour* is gated instead: with
 * `enabled: false` no `quickTo` is constructed and no entry is put in `POINTER_SETTERS`, which
 * matters because every `ButtonLink` in the product calls this.
 */
const MAGNET_RATIO = 0.14;

export function useMagnet<T extends HTMLElement = HTMLAnchorElement>(
  enabled = true,
): PointerMotion<T> {
  const { scope, motionSafe } = useMotion<T>({
    animate: ({ root, gsap: g }) => {
      if (!enabled) return undefined;
      POINTER_SETTERS.set(root, {
        x: voidSetter(g.quickTo(root, 'x', { ...m.pointer })),
        y: voidSetter(g.quickTo(root, 'y', { ...m.pointer })),
      });
      return () => {
        POINTER_SETTERS.delete(root);
      };
    },
    deps: [enabled],
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

/**
 * **G-21 — the atmosphere's pointer lamp.** Three `quickTo` setters write `--px`, `--py` and
 * `--lamp` on the atmosphere root at `m.pointer`; `backdrop.css` uses the first two as the centre
 * of a `mask-image` circle over a copy of the dot lattice drawn at three times its resting alpha,
 * and the third as the fade-in. **The dots under the cursor harden. Nothing moves toward it.**
 *
 * **This replaces the orb parallax of the same ID.** That motion translated three blurred gradient
 * ellipses by ±14px; with an 80–100px blur on a 720px element the eye could not resolve it, and
 * once the accent went monochrome the thing being moved was a grey smudge. The lamp is the same
 * idea — *the background responds to you* — expressed on marks that have an edge, so the response
 * is actually visible. §7.7 records the removal.
 *
 * Six things about it are decisions rather than incidentals:
 *
 *   - **The listener is on `window`, and it has to be.** The atmosphere is `pointer-events: none`
 *     (it must be — it covers the whole viewport), so it can never receive a `pointermove` of its
 *     own. That is also why this is the one motion in the product that returns a `MotionCleanup`:
 *     the listener is not a tween, so the GSAP context cannot revert it.
 *   - **The coordinates are element-relative, from `getBoundingClientRect()`**, not raw
 *     `clientX`/`clientY`. The atmosphere is `position: fixed; inset: 0`, so the two are equal
 *     today — and reading the rect is what keeps them equal if that ever changes. The root carries
 *     no CSS animation of its own (the drift is on its children), so the read cannot force a
 *     style flush for an in-flight animation.
 *   - **No clamp, and none is wanted.** The lamp is an absolute position, not an offset from a
 *     centre; the thing that bounds it is `--size-lamp`, in CSS, beside the gradient that uses it.
 *   - **Every route except `off`.** The caller enables it from the backdrop intensity, and
 *     `--bg-lamp-max` is what keeps it from competing on a data surface — 1 on the hero, 0.45
 *     elsewhere (§7.7.2). A background that only responds on the landing page reads as a landing
 *     page trick; Rishabh asked for *the application* to feel alive.
 *   - **`(pointer: fine)` only.** On a touch screen `pointermove` arrives during a scroll, so the
 *     lamp would smear across the field as a finger dragged.
 *   - **Not created under reduced motion.** It is built in `animate`, so under `reduce` no setter,
 *     no listener and no tween exists, `--lamp` stays at its authored `0`, and the field rests as
 *     the composed still image §7.7.3 requires.
 */
export function useAtmosphereLamp<T extends HTMLElement = HTMLDivElement>(
  enabled: boolean,
): MotionHandle<T> {
  return useMotion<T>({
    animate: ({ root, gsap: g }) => {
      if (!enabled || !matchesFinePointer()) return undefined;

      const setX = voidSetter(g.quickTo(root, '--px', { ...m.pointer }));
      const setY = voidSetter(g.quickTo(root, '--py', { ...m.pointer }));
      const setLamp = voidSetter(g.quickTo(root, '--lamp', { ...m.pointer }));

      const onPointerMove = (event: PointerEvent) => {
        const rect = root.getBoundingClientRect();
        setX(event.clientX - rect.left);
        setY(event.clientY - rect.top);
        setLamp(1);
      };

      // The lamp goes out when the pointer leaves the document rather than staying lit at the
      // last position — a light with nobody holding it is a decoration, which is the thing this
      // field was rebuilt to stop being.
      const onPointerLeave = () => {
        setLamp(0);
      };

      // `passive` because nothing here calls `preventDefault`, and a non-passive `pointermove` on
      // `window` is a scroll-performance cost for no reason.
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onPointerLeave);
      return () => {
        window.removeEventListener('pointermove', onPointerMove);
        document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      };
    },
    deps: [enabled],
  });
}
