// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `ScrollTrigger.register()` calls `window.matchMedia` at *module evaluation* of `./gsap`,
 * before any `beforeEach` can run. `vi.hoisted` is the only place a stub lands early enough.
 */
vi.hoisted(() => {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (media: string) => ({
      matches: false,
      media,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

import { gsap } from './gsap';
import { dist } from './tokens';
import { parallaxOffset, useAtmosphereParallax } from './interactions';
import INDEX_CSS from '../../styles/index.css?raw';

/**
 * **The unit rule behind G-8, asserted against GSAP itself rather than against a comment.**
 *
 * `useSpotlight` computes element-relative **pixels** from `getBoundingClientRect()` and hands
 * them to a `quickTo` on `--px` / `--py`. GSAP's CSSPlugin learns the property's unit by reading
 * its current value, and appends that unit to an end value that carries none. So the *resting*
 * declaration in `index.css` decides what unit every subsequent pointer position is rendered in.
 *
 * With the original `--px: 50%`, a pointer at the centre of a 400px card wrote `--px: 200%` —
 * 800px, twice outside the card — and the spotlight was never under the cursor on any capability
 * card or any dock item. Nothing caught it: no test, no type, no lint rule, and it looks
 * plausible in a diff.
 *
 * The two assertions below are the pair that makes it catchable: the *mechanism* (GSAP inherits
 * the start unit, so a percentage rest value poisons every write) and the *fact* (the stylesheet
 * declares px). `index.css.test.ts` asserts the declaration from the CSS side as well; this file
 * is the one that would still fail if GSAP's behaviour were the thing that changed.
 */

function element(rest: string): HTMLElement {
  const el = document.createElement('div');
  el.style.setProperty('--px', rest);
  document.body.append(el);
  return el;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** A `matchMedia` that answers a given pointer capability, and `false` to everything else. */
function stubPointer(fine: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => ({
      matches: media.includes('pointer: fine') ? fine : media === 'all',
      media,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })),
  );
}

function Atmosphere({ enabled }: { enabled: boolean }) {
  const { scope } = useAtmosphereParallax<HTMLDivElement>(enabled);
  return (
    <div ref={scope}>
      <div data-motion="orbs" data-testid="orbs" />
    </div>
  );
}

describe('G-8 — the pointer spotlight is written in pixels', () => {
  it('renders a px value when the resting value is a px length', () => {
    const el = element('0px');
    // `gsap.set` is a zero-duration tween and renders immediately, which is what makes this
    // assertion synchronous and free of the ticker.
    gsap.set(el, { '--px': 123 });
    expect(el.style.getPropertyValue('--px')).toBe('123px');
  });

  it('renders a percentage when the resting value is one — the defect, pinned down', () => {
    // Kept as an executable statement of *why* the rule exists. If a future GSAP stopped
    // inheriting the start unit this would fail, and the comment above would need rewriting
    // rather than quietly becoming untrue.
    const el = element('50%');
    gsap.set(el, { '--px': 123 });
    expect(el.style.getPropertyValue('--px')).toBe('123%');
  });

  it('declares every resting coordinate in index.css as a px length', () => {
    const declarations = [
      ...INDEX_CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/--p([xy]):\s*([^;]+);/g),
    ];
    // Two axes at each of the two G-8 sites: `.dock-list` and `.capability-card`.
    expect(declarations.length).toBeGreaterThanOrEqual(4);
    for (const [, axis, value] of declarations) {
      expect(value, `--p${String(axis)}: ${String(value)}`).toMatch(/^-?\d+(\.\d+)?px$/);
    }
  });
});

/**
 * **G-21 — the atmosphere's pointer parallax.** It was specified in `DESIGN_SYSTEM.md` §4.6 and
 * §7.7 layer 2 and simply never built; the only trace of it in the first CR-007 implementation
 * was an unused token, an unselected `data-motion` hook, and a comment asserting it existed.
 *
 * Two things are worth testing without a browser and are tested here: the arithmetic — the
 * clamp is what keeps this depth rather than a background chasing the cursor — and the three
 * gates that decide whether it exists at all. The *visual* result cannot be confirmed outside a
 * browser and is not claimed to be.
 */
describe('G-21 — parallaxOffset', () => {
  it('divides the offset from the viewport centre by 48', () => {
    // Design Spec §4.6: `(pointer − viewportCentre) / 48`.
    expect(parallaxOffset(720, 1440)).toBe(0);
    expect(parallaxOffset(720 + 480, 1440)).toBeCloseTo(10, 10);
    expect(parallaxOffset(720 - 480, 1440)).toBeCloseTo(-10, 10);
  });

  it('clamps to ±dist.parallax at every viewport width', () => {
    // A 3840px display would otherwise reach ±40px, which is a moving background rather than
    // a suggestion of depth. The clamp is the whole reason the effect is allowed.
    expect(parallaxOffset(3840, 3840)).toBe(dist.parallax);
    expect(parallaxOffset(0, 3840)).toBe(-dist.parallax);
    expect(dist.parallax).toBe(14);
  });

  it('is finite for a degenerate viewport', () => {
    // `innerWidth` is 0 in some embedded webviews before first layout.
    expect(Number.isFinite(parallaxOffset(0, 0))).toBe(true);
  });
});

describe('G-21 — when the listener exists', () => {
  function mount(enabled: boolean) {
    const added: string[] = [];
    const removed: string[] = [];
    vi.spyOn(window, 'addEventListener').mockImplementation((type: string) => {
      added.push(type);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type: string) => {
      removed.push(type);
    });
    const view = render(<Atmosphere enabled={enabled} />);
    return { added, removed, unmount: view.unmount };
  }

  it('attaches a window pointermove on a fine pointer, and releases it on unmount', () => {
    // `window`, not the element: the atmosphere is `pointer-events: none` and can never
    // receive a pointer event of its own. That is also why this is the one motion in the
    // product that returns a `MotionCleanup` — a listener is not a tween, so the GSAP
    // context cannot revert it, and a leak here would outlive every navigation.
    stubPointer(true);
    const view = mount(true);
    expect(view.added).toContain('pointermove');

    view.unmount();
    expect(view.removed).toContain('pointermove');
  });

  it('attaches nothing on a coarse pointer', () => {
    // On a touch screen `pointermove` arrives during a scroll, so the field would lurch as a
    // finger dragged. §4.6 gates G-21 on `(pointer: fine)` for exactly that reason.
    stubPointer(false);
    expect(mount(true).added).not.toContain('pointermove');
  });

  it('attaches nothing when the route has not asked for it', () => {
    // `enabled` is `intensity === 'full'`, which is `/` and nothing else.
    stubPointer(true);
    expect(mount(false).added).not.toContain('pointermove');
  });
});
