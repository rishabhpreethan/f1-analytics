// @vitest-environment jsdom
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
  document.body.replaceChildren();
});

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
