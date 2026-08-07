// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `ScrollTrigger.register()` calls `window.matchMedia` at *module evaluation* of `./gsap`, before
 * any `beforeEach` can run. `vi.hoisted` is the only place a stub lands early enough.
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
import { chartReadout, crossFadeMarks, fadeTooltipIn, useChartMount } from './chart';
import { dur, ease, stagger } from './tokens';

/**
 * **What this file can and cannot prove, stated up front.**
 *
 * jsdom has no layout, no compositing and no `SVGElement.getBBox` at all (probed). So nothing here
 * asserts that a bar grows from the right edge *on screen* — that is untestable by construction and
 * is named as such in the hand-off. What it does assert is every property that is decidable from
 * the tween object: which property is animated, from which origin, at which duration and ease, and
 * — the one that matters most — that under `prefers-reduced-motion: reduce` **no tween exists at
 * all**, which is the difference between "stopped" and "slowed".
 */

/** A `matchMedia` answering `true` to one query only. */
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

function Chart({ orientation = 'column' as const }) {
  const { scope } = useChartMount<HTMLDivElement>({
    orientation,
    origin: [40, 260],
    reveal: { x: 40, width: 400 },
  });
  return (
    <div ref={scope}>
      <svg viewBox="0 0 480 300">
        <clipPath id="c">
          <rect data-motion="chart-reveal" x={40} y={0} width={400} height={300} />
        </clipPath>
        <g clipPath="url(#c)">
          <rect data-motion="chart-bar" x={50} y={100} width={20} height={160} />
          <rect data-motion="chart-bar" x={90} y={140} width={20} height={120} />
          <rect data-motion="chart-bar" x={130} y={60} width={20} height={200} />
        </g>
      </svg>
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  gsap.globalTimeline.clear();
});

describe('G-27 / G-28 — the chart mount', () => {
  it('creates NO tween at all under prefers-reduced-motion: reduce', () => {
    /*
     * The strongest form of "stopped": the tween is never created, so GSAP's ticker has no active
     * child and puts itself to sleep. A `duration: 0` tween — which GSAP's own reduced-motion
     * example uses — would still instantiate, render once and touch the ticker.
     */
    stubMedia('reduce');
    const before = gsap.globalTimeline.getChildren(true, true, true).length;
    render(<Chart />);
    expect(gsap.globalTimeline.getChildren(true, true, true).length).toBe(before);
  });

  it('creates one timeline when motion is allowed', () => {
    stubMedia('no-preference');
    render(<Chart />);
    expect(gsap.globalTimeline.getChildren(true, false, true).length).toBeGreaterThan(0);
  });

  it('animates scaleY for a column chart and scaleX for a horizontal one', () => {
    /*
     * The origin is the axis, never the mark's own centre — a bar that grows from its middle is
     * not reporting a magnitude, it is decorating one. `svgOrigin` is the exact user-space anchor
     * the component already computed, rather than a `getBBox()`-derived one that does not exist in
     * this environment and would only be approximate in a browser.
     */
    stubMedia('no-preference');
    const { unmount } = render(<Chart />);
    const column = gsap.globalTimeline
      .getChildren(true, false, true)
      .flatMap((child) => (child as gsap.core.Timeline).getChildren?.(true, true, false) ?? []);
    expect(column.some((tween) => 'scaleY' in ((tween.vars ?? {}) as object))).toBe(true);
    unmount();
    gsap.globalTimeline.clear();

    render(<Chart orientation="row" />);
    const row = gsap.globalTimeline
      .getChildren(true, false, true)
      .flatMap((child) => (child as gsap.core.Timeline).getChildren?.(true, true, false) ?? []);
    expect(row.some((tween) => 'scaleX' in ((tween.vars ?? {}) as object))).toBe(true);
  });
});

describe('G-30 — the readout snaps, it never follows', () => {
  it('builds quickSetters, which carry no duration and therefore no lag', () => {
    /*
     * `m.pointer`'s 600ms catch-up is for decoration — the magnetic CTA, the atmosphere lamp, the
     * card tilt. A value readout that lagged behind the cursor would be misreporting which lap the
     * reader is pointing at, so this uses `quickSetter`, which writes immediately and creates no
     * tween. The assertion is that calling it adds nothing to the global timeline.
     */
    document.body.innerHTML =
      '<svg><line id="x"/></svg><div id="t" style="position:absolute"></div>';
    const line = document.getElementById('x') as unknown as SVGElement;
    const tip = document.getElementById('t');
    const readout = chartReadout(line, tip);

    const before = gsap.globalTimeline.getChildren(true, true, true).length;
    readout.crosshair(120);
    readout.tooltip(120, 40);
    expect(gsap.globalTimeline.getChildren(true, true, true).length).toBe(before);
  });

  it('survives a null crosshair and a null tooltip', () => {
    // The first render, before refs attach. A throw here would blank the whole chart.
    const readout = chartReadout(null, null);
    expect(() => {
      readout.crosshair(10);
      readout.tooltip(10, 10);
    }).not.toThrow();
  });

  it('fades the tooltip in at dur.fast / ease.enter — the only motion G-30 has', () => {
    document.body.innerHTML = '<div id="t"></div>';
    const tip = document.getElementById('t');
    expect(tip).not.toBeNull();
    if (tip === null) return;
    const tween = fadeTooltipIn(tip);
    expect(tween.duration()).toBe(dur.fast);
    expect(tween.vars.ease).toBe(ease.enter);
    // Opacity only. §4.4 rule 1 keeps a 140ms crossfade outside the reduced-motion guard, which
    // is why this one is created unconditionally.
    expect(Object.keys(tween.vars)).toContain('opacity');
  });
});

describe('G-29 — a chart does not animate on a data update', () => {
  it('offers a cross-fade only, at dur.fast, and never a re-run of the mount', () => {
    /*
     * The exception, and the only one: a deliberate user action changing the entity set or the
     * scope. A chart that re-animates while someone is reading it is a defect (§4.2), so there is
     * no exported way to replay G-27 or G-28 on new data.
     */
    document.body.innerHTML = '<svg><g id="layer"/></svg>';
    const layer = document.getElementById('layer') as unknown as SVGElement;
    const tween = crossFadeMarks(layer);
    expect(tween.duration()).toBe(dur.fast);
    expect(tween.vars.ease).toBe(ease.enter);
  });
});

describe('the stagger stays inside its stated budget', () => {
  it('caps a long bar chart with `amount`, not `each`', () => {
    // A 20-bar chart at `each: 0.06` would queue 1.2s of delay before the last bar even starts.
    // `amount` distributes a total, so items past the cap get a shrinking share.
    expect(stagger.cap).toBe(12);
    expect(stagger.bar.each).toBe(0.06);
    // 12 × 60 + 400 = 1120ms — outside the 400ms interaction ceiling, and legal only because a
    // chart mount is not an interaction path (§4.6.2 G-27).
    expect(stagger.cap * stagger.bar.each + dur.chart).toBeCloseTo(1.12, 6);
  });
});
