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
import { useAtmosphereLamp } from './interactions';
import INDEX_CSS from '../../styles/index.css?raw';
import BACKDROP_CSS from '../../styles/backdrop.css?raw';

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
  const { scope } = useAtmosphereLamp<HTMLDivElement>(enabled);
  return (
    <div ref={scope}>
      <div data-motion="lamp" data-testid="lamp" />
    </div>
  );
}

describe('the pointer-driven custom properties are written in pixels', () => {
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

  it('declares every resting coordinate in the stylesheets as a px length', () => {
    const declarations = [
      ...`${INDEX_CSS}\n${BACKDROP_CSS}`
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .matchAll(/--p([xy]):\s*([^;]+);/g),
    ];
    // Two axes at each pointer-driven site: `.capability-card` in `index.css` and `.atmosphere`
    // in `backdrop.css`.
    expect(declarations.length).toBeGreaterThanOrEqual(4);
    for (const [, axis, value] of declarations) {
      expect(value, `--p${String(axis)}: ${String(value)}`).toMatch(/^-?\d+(\.\d+)?px$/);
    }
  });

  it('declares the lamp fade unitless, which is the opposite requirement', () => {
    // `--lamp` multiplies an opacity. A `px` resting value would make GSAP write `1px`, and
    // `calc(1px * 0.45)` is not a number — the lamp would simply never appear, silently.
    const root = /\.atmosphere\s*\{([^}]*)\}/.exec(BACKDROP_CSS.replace(/\/\*[\s\S]*?\*\//g, ''));
    expect(root?.[1]).toMatch(/--lamp:\s*0;/);
  });
});

/**
 * **G-21 — the atmosphere's pointer lamp**, which replaced the orb parallax of the same ID when the
 * field was rebuilt on 2026-08-06.
 *
 * What is testable here without a browser is **whether the effect exists at all**, and that is not
 * a trivial property: the previous G-21 was specified in two places and simply never built, and its
 * only trace was an unused token, an unselected `data-motion` hook and a comment claiming it
 * existed. So the three gates get assertions, and the listener's release on unmount does too —
 * the atmosphere never unmounts during a session, so a leak here would outlive every navigation.
 *
 * **What is NOT testable and is not claimed:** whether a 340px pool of hardened dots reads as a
 * light following the cursor, and whether the ±11px mask offset that the drift introduces is as
 * imperceptible as the arithmetic says. jsdom performs no layout and no compositing.
 */
describe('G-21 — when the lamp exists', () => {
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
    // On a touch screen `pointermove` arrives during a scroll, so the lamp would smear across the
    // field as a finger dragged. §4.6 gates G-21 on `(pointer: fine)` for exactly that reason.
    stubPointer(false);
    expect(mount(true).added).not.toContain('pointermove');
  });

  it('attaches nothing when the route has not asked for it', () => {
    // `enabled` is `intensity !== 'off'`. `off` is F3's lap-chart surface, where the whole field
    // is removed from the DOM and there is nothing for a lamp to light.
    stubPointer(true);
    expect(mount(false).added).not.toContain('pointermove');
  });

  it('writes the cursor position into --px / --py, in px, on the root it scopes', () => {
    /*
     * The end-to-end property, asserted against GSAP rather than against a comment: a
     * `pointermove` at (300, 200) must leave `--px: 300px` on the atmosphere root, because that is
     * what `backdrop.css` feeds to the lamp's `mask-image` circle.
     *
     * `quickTo` is a tween, so the value arrives over `m.pointer` rather than instantly —
     * `gsap.globalTimeline.progress(1)` fast-forwards it, which keeps this synchronous and free of
     * the ticker. jsdom reports a zero rect for the root, which is correct here: the atmosphere is
     * `inset: 0`, so element-relative and viewport coordinates coincide by design.
     */
    stubPointer(true);
    const view = render(<Atmosphere enabled />);
    const root = view.container.firstElementChild as HTMLElement;

    /*
     * The resting values are applied here because **jsdom loads no stylesheet**, so
     * `getComputedStyle(root).getPropertyValue('--px')` is empty and GSAP has no unit to inherit —
     * it would write a bare `300`, which is a test-environment artefact and not what a browser
     * does. Setting them is what makes this assertion exercise the real path: it reproduces
     * `backdrop.css`'s `.atmosphere { --px: 0px; --py: 0px; --lamp: 0 }`, which
     * `backdrop.css.test.ts` proves is actually declared there.
     */
    root.style.setProperty('--px', '0px');
    root.style.setProperty('--py', '0px');
    root.style.setProperty('--lamp', '0');

    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 300, clientY: 200 }));
    gsap.globalTimeline.progress(1, true);

    expect(root.style.getPropertyValue('--px')).toBe('300px');
    expect(root.style.getPropertyValue('--py')).toBe('200px');
    // The fade-in is unitless, so `calc(--lamp * --bg-lamp-max)` resolves to a number.
    expect(root.style.getPropertyValue('--lamp')).toBe('1');

    gsap.globalTimeline.progress(0, true).clear();
  });
});
