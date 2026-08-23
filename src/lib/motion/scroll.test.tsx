// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `ScrollTrigger.register()` reads `window.matchMedia` at *module evaluation* of `./gsap`, before
 * any `beforeEach` could run. `vi.hoisted` is the only place a stub lands early enough.
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
import { GAIN_BAR_ATTR, TIER_BAR_ATTR, usePopulationMount } from './scroll';
import { dur, ease } from './tokens';

/**
 * **`usePopulationMount`'s third mark — the diverging bar** (`DESIGN_SYSTEM.md` §6.6.6.14 C).
 *
 * `ComparePage.test.tsx` said "the hook half is `usePopulationMount`'s own test" and there was no
 * such file; this is it, written for the one thing in the hook that is not a constant.
 *
 * jsdom performs no layout and no compositing, so nothing here says a bar *grows from the zero
 * line on screen*. What is decidable from the tween object is which property moves, at what
 * duration and ease, and — the part worth a file — that `transformOrigin` is resolved **per
 * target** from the mark's own `data-origin`. A misspelt dataset key would silently hand every bar
 * `'left'`, and every negative one would then animate sliding across the axis it is measured from,
 * which looks enough like a chart that nobody would report it.
 */

function stubMedia(trueFor: string) {
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: media.includes(trueFor),
    media,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

function Board() {
  const { scope } = usePopulationMount<HTMLDivElement>(['two']);
  return (
    <div ref={scope}>
      <span data-motion={GAIN_BAR_ATTR} data-origin="left" />
      <span data-motion={GAIN_BAR_ATTR} data-origin="right" />
    </div>
  );
}

function Rails() {
  const { scope } = usePopulationMount<HTMLDivElement>(['rails']);
  return (
    <div ref={scope}>
      <span data-motion={TIER_BAR_ATTR} />
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  gsap.globalTimeline.clear();
});

const lastTween = () => gsap.globalTimeline.getChildren(true, true, false).at(-1);

describe('the diverging bar grows from the axis, and the axis is zero', () => {
  it('creates no tween at all under prefers-reduced-motion: reduce', () => {
    stubMedia('reduce');
    const before = gsap.globalTimeline.getChildren(true, true, true).length;
    render(<Board />);
    expect(gsap.globalTimeline.getChildren(true, true, true).length).toBe(before);
  });

  it('resolves transformOrigin per target, from the mark’s own data-origin', () => {
    render(<Board />);
    const origin: unknown = lastTween()?.vars.transformOrigin;
    expect(typeof origin).toBe('function');
    const resolve = origin as (index: number, target: Element) => string;

    const forward = document.createElement('span');
    forward.dataset['origin'] = 'left';
    const back = document.createElement('span');
    back.dataset['origin'] = 'right';

    expect(resolve(0, forward)).toBe('left');
    expect(resolve(1, back)).toBe('right');
  });

  it('falls back to left for a mark that states no origin', () => {
    // A bar with no stated anchor is a positive one by construction — the component only omits the
    // attribute where it never renders a mark at all — and `left` is the safe reading of that.
    render(<Board />);
    const resolve = lastTween()?.vars.transformOrigin as unknown as (
      index: number,
      target: Element,
    ) => string;
    expect(resolve(0, document.createElement('span'))).toBe('left');
    expect(resolve(0, document.createElementNS('http://www.w3.org/2000/svg', 'rect'))).toBe('left');
  });

  it('scales along x only, at the chart mount’s own duration and ease', () => {
    render(<Board />);
    const tween = lastTween();
    expect(Object.keys(tween?.vars ?? {})).toContain('scaleX');
    expect(tween?.vars.duration).toBe(dur.chart);
    expect(tween?.vars.ease).toBe(ease.mech);
  });

  it('still animates the rate board’s bars from the left, unchanged', () => {
    // The third mark is additive. A magnitude bar's axis IS its left edge, and nothing about that
    // moved when the diverging one was added.
    render(<Rails />);
    expect(lastTween()?.vars.transformOrigin).toBe('left');
  });
});
