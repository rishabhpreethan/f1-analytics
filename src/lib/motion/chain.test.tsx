// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `ScrollTrigger.register()` calls `window.matchMedia` at module evaluation of `./gsap`, before any
 * `beforeEach` can run. `vi.hoisted` is the only place a stub lands early enough.
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

import { CHAIN_DROP_ATTR, CHAIN_LINK_ATTR, CHAIN_RUN_ATTR, useChainWalk } from './chart';
import { gsap } from './gsap';
import { dur, ease, stagger } from './tokens';

/**
 * **G-32 — the lineage chain walk** (`DESIGN_SYSTEM.md` §6.6.6.4, §4.6.2).
 *
 * **What this cannot prove.** jsdom has no layout and no compositing, so nothing here shows that
 * the staircase reads as a walk backwards through time, that a connector meets its capsule, or that
 * the interleave between the two tracks looks like a handoff. Those are untested by construction
 * and are named as such in the hand-off.
 *
 * **What it does prove** is every property decidable from the tween objects, and each of these is a
 * thing that would look plausible while being wrong: which property is animated, which origin it
 * grows from, and — the one that matters most — that under `reduce` **no tween exists at all**.
 */

function Chain({ links = 3 }: { links?: number }) {
  const { scope } = useChainWalk<HTMLDivElement>(['a', 'b', links]);
  return (
    <div ref={scope}>
      {Array.from({ length: links }, (_, index) => (
        <div key={index}>
          {index > 0 && <span data-motion={CHAIN_DROP_ATTR} />}
          {index > 0 && <span data-motion={CHAIN_RUN_ATTR} />}
          <span data-motion={CHAIN_LINK_ATTR} />
        </div>
      ))}
    </div>
  );
}

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  gsap.globalTimeline.clear();
});

const tweens = () =>
  gsap.globalTimeline
    .getChildren(true, false, true)
    .flatMap((child) => (child as gsap.core.Timeline).getChildren?.(true, true, false) ?? []);

describe('G-32 — the chain walks itself back through the archive', () => {
  it('creates NO tween at all under prefers-reduced-motion: reduce', () => {
    /*
     * The strongest form of "stopped". Authored as `from` (MR-2), so with no tween every capsule,
     * drop and run rests at its full, correct extent — the chain is simply *drawn* rather than
     * walked, which is a legitimate still image rather than a broken one.
     */
    stubMedia('reduce');
    const before = gsap.globalTimeline.getChildren(true, true, true).length;
    render(<Chain />);
    expect(gsap.globalTimeline.getChildren(true, true, true).length).toBe(before);
  });

  it('grows every capsule from its right edge, because the chain travels backwards in time', () => {
    /*
     * Right, not left. Each pairing extends *out of the one above it* into the past; a capsule
     * growing left-to-right would run against the direction its connector arrives from and the
     * staircase would stop reading as a walk. This is G-27's "the origin is the axis, never the
     * mark's own centre" applied to a mark whose axis is time.
     */
    stubMedia('no-preference');
    render(<Chain />);
    const capsule = tweens().find((tween) => 'scaleX' in ((tween.vars ?? {}) as object));
    expect(capsule).toBeDefined();
    const vars = (capsule?.vars ?? {}) as Record<string, unknown>;
    expect(vars.transformOrigin).toBe('right');
    expect(vars.duration).toBe(dur.chart);
    expect(vars.ease).toBe(ease.mech);
  });

  it('drops each connector from the row above — scaleY from the top', () => {
    stubMedia('no-preference');
    render(<Chain />);
    const drop = tweens().find((tween) => 'scaleY' in ((tween.vars ?? {}) as object));
    expect(drop).toBeDefined();
    const vars = (drop?.vars ?? {}) as Record<string, unknown>;
    expect(vars.transformOrigin).toBe('top');
    expect(vars.duration).toBe(dur.fast);
    expect(vars.ease).toBe(ease.enter);
  });

  it('interleaves the connectors between the capsules by half a stagger step', () => {
    /*
     * Capsule *i* lands at `each × i`; the connector into row *i* is element `i − 1` of its own
     * array. Offsetting that array by `each / 2` is what puts each handoff squarely between two
     * capsules. Without it all three tracks fire in lockstep and the chain arrives as a block —
     * which would look deliberate and be wrong.
     */
    stubMedia('no-preference');
    render(<Chain />);
    const scaleY = tweens().filter((tween) => 'scaleY' in ((tween.vars ?? {}) as object));
    expect(scaleY.length).toBeGreaterThan(0);
    expect(scaleY[0]?.startTime()).toBeCloseTo(stagger.bar.each / 2, 6);
  });

  it('creates no tween when the chain has no links', () => {
    /*
     * `useMotion` builds the timeline before it calls the builder, so the empty timeline still
     * exists — what must not exist is a tween targeting nothing, which GSAP would happily create
     * and which would keep the ticker awake for the lifetime of the page.
     */
    stubMedia('no-preference');
    render(<Chain links={0} />);
    expect(tweens()).toHaveLength(0);
  });
});
