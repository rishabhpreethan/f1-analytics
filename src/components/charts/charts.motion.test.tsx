// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **matchMedia answers `no-preference`, and that is the entire reason this file exists.**
 *
 * `charts.test.tsx` forces `reduce: true` on purpose, so it asserts the *resting* DOM — which MR-2
 * requires to be the final readable state. The cost of that choice is that **no tween is ever
 * created there**, so an entire class of defect is invisible to it: anything about how often, or
 * whether, the mount animation runs.
 *
 * One such defect shipped. `LineChart` passed `deps: [resolved, …]` to `useChartMount`. `resolved`
 * is rebuilt on every render; `useGSAP` compares its dependency array by **identity**; and
 * `useMotion` hard-codes `revertOnUpdate: true`. So G-28's left-to-right clip wipe was reverted and
 * re-created on **every render** — and since `onPointerMove` calls `setActiveIndex`, moving the
 * pointer across the plot restarted the reveal continuously. `BarChart` had the same shape with
 * `data`.
 *
 * `ChartMountOptions.deps` already documented the rule that broke — *"a chart's identity, never its
 * data"* — which is what makes this a translation loss rather than a missing decision.
 *
 * **What is still untestable here:** jsdom performs no layout, so every chart renders at width 0 and
 * every mark sits at the origin. Nothing below asserts a position, a duration in wall-clock terms,
 * or that anything looked right. It asserts *how many times a timeline is built*, which is a
 * countable fact and the one that was wrong.
 */

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (media: string) => ({
      // `no-preference` matches, `reduce` does not. The mirror image of `charts.test.tsx`.
      matches: !media.includes('reduce'),
      media,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

import { gsap } from '@/lib/motion/gsap';
import { BarChart } from './BarChart';
import { LineChart } from './LineChart';
import { mountKey } from './geometry';
import type { BarDatum, SeriesInput } from './types';

const SEASON: SeriesInput[] = [
  {
    reference: 'verstappen',
    teamReference: 'red_bull',
    label: 'Verstappen',
    points: [
      { x: 1, y: 25 },
      { x: 2, y: 43 },
      { x: 3, y: 61 },
    ],
  },
  {
    reference: 'norris',
    teamReference: 'mclaren',
    label: 'Norris',
    points: [
      { x: 1, y: 18 },
      { x: 2, y: 33 },
      { x: 3, y: 51 },
    ],
  },
];

const RECORDS: BarDatum[] = [
  { key: 'hamilton', label: 'Hamilton', value: 105, teamReference: 'mercedes' },
  { key: 'schumacher', label: 'Schumacher', value: 91, teamReference: 'ferrari' },
];

/**
 * The real factory, captured at module scope **before** any spy replaces it. The spy delegates to
 * this, so the builder still receives a working timeline and the tweens it adds are real — the
 * count is the only thing being observed.
 */
const realTimeline: typeof gsap.timeline = gsap.timeline.bind(gsap);

let timelines = 0;

beforeEach(() => {
  timelines = 0;
  /*
   * `useMotion` calls `gsap.timeline()` exactly once per run of its builder, so counting the calls
   * counts the mounts. Spying on the shared `gsap` singleton is what makes that observable without
   * reaching into the hook or exporting a counter from production code.
   */
  vi.spyOn(gsap, 'timeline').mockImplementation((vars) => {
    timelines += 1;
    return realTimeline(vars);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('a tween IS created when motion is allowed', () => {
  it('builds a timeline on mount — proving this file is not silently reduced', () => {
    render(<LineChart series={SEASON} title="Points" ariaLabel="Points by round" />);
    expect(timelines).toBeGreaterThan(0);
  });
});

describe('the chart mount does not re-run on every render', () => {
  it('does not rebuild the timeline when the series identity and size are unchanged', () => {
    const { rerender } = render(
      <LineChart series={SEASON} title="Points" ariaLabel="Points by round" />,
    );
    const afterMount = timelines;

    // A prop change that is not a change of identity. Before the fix, `resolved` was a new array
    // here and the mount re-ran — which is exactly what a pointer move used to do.
    rerender(<LineChart series={SEASON} title="Points" ariaLabel="Points by round" />);
    rerender(<LineChart series={SEASON} title="Points" ariaLabel="Points by round" />);

    expect(timelines).toBe(afterMount);
  });

  it('does not rebuild when only the title changes', () => {
    const { rerender } = render(
      <LineChart series={SEASON} title="Points" ariaLabel="Points by round" />,
    );
    const afterMount = timelines;
    rerender(<LineChart series={SEASON} title="Points after each round" ariaLabel="Points" />);
    expect(timelines).toBe(afterMount);
  });

  it('DOES rebuild when the plotted entities change — the one legitimate re-mount', () => {
    const { rerender } = render(
      <LineChart series={SEASON} title="Points" ariaLabel="Points by round" />,
    );
    const afterMount = timelines;
    rerender(
      <LineChart series={[SEASON[0] as SeriesInput]} title="Points" ariaLabel="Points by round" />,
    );
    expect(timelines).toBeGreaterThan(afterMount);
  });

  it('does not rebuild a bar chart on a re-render with the same bars', () => {
    const { rerender } = render(
      <BarChart data={RECORDS} title="Wins" ariaLabel="Wins" valueTitle="Wins" />,
    );
    const afterMount = timelines;
    // A fresh array with the same contents — what every real caller produces every render.
    rerender(<BarChart data={[...RECORDS]} title="Wins" ariaLabel="Wins" valueTitle="Wins" />);
    expect(timelines).toBe(afterMount);
  });
});

describe('mountKey — the value that replaced the identity comparison', () => {
  it('is equal for equal contents, which an array literal never is', () => {
    expect(mountKey(['a', 'b'], 800, 240)).toBe(mountKey(['a', 'b'], 800, 240));
    expect(['a', 'b']).not.toBe(['a', 'b']);
  });

  it('changes when the entity set changes', () => {
    expect(mountKey(['a', 'b'], 800, 240)).not.toBe(mountKey(['a'], 800, 240));
  });

  it('changes when the entity ORDER changes, since the ladder assigns rungs by order', () => {
    expect(mountKey(['a', 'b'], 800, 240)).not.toBe(mountKey(['b', 'a'], 800, 240));
  });

  it('changes when the plot is resized', () => {
    expect(mountKey(['a'], 800, 240)).not.toBe(mountKey(['a'], 900, 240));
  });

  it('absorbs sub-pixel ResizeObserver jitter rather than re-running the reveal', () => {
    expect(mountKey(['a'], 800.2, 240.4)).toBe(mountKey(['a'], 800, 240));
  });
});
