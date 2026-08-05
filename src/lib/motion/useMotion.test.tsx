// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `ScrollTrigger.register()` calls `window.matchMedia` while it is being registered, and
 * registration happens at *module evaluation* of `./gsap` — before any `beforeEach` can
 * run. `vi.hoisted` executes before the imports below, which is the only place a stub can
 * land early enough. Each test then replaces it through `vi.stubGlobal`.
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
import { MOTION } from './tokens';
import { useMotion, type MotionCtx, type MotionSpec } from './useMotion';

/**
 * CT-5 … CT-8. The mechanical guard on reduced motion and on GSAP-in-React cleanup.
 *
 * There is no E2E gate in this project any more (CR-006), so these assertions are the
 * only automated evidence that a tween is **not created** under `reduce`, and that a
 * dependency change does not stack tweens. CT-7 is the most valuable test in the list:
 * the leak it guards against stays invisible until an inline transform left by a dead
 * tween fights a live one — which is exactly what a persistent shell component (the dock,
 * the atmosphere, the route wrapper) would hit, because none of them unmount.
 */

interface StubQuery {
  matches: boolean;
  media: string;
  listeners: Array<(event: { matches: boolean }) => void>;
}

let queries: StubQuery[] = [];

/**
 * A `matchMedia` GSAP is happy with — it attaches through `addEventListener('change')`.
 *
 * `all` must match unconditionally: that is the key that makes `settle` run in **both**
 * modes, and a stub that returned `false` for it would make CT-5 pass for the wrong
 * reason.
 */
function stubMatchMedia(reduce: boolean): void {
  queries = [];
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => {
      const entry: StubQuery = {
        matches: media === 'all' ? true : media.includes('reduce') === reduce,
        media,
        listeners: [],
      };
      queries.push(entry);
      return {
        get matches() {
          return entry.matches;
        },
        media,
        onchange: null,
        addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
          entry.listeners.push(listener);
        },
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    }),
  );
}

/**
 * What the tests need back from the hook. Deliberately **not** the whole handle: passing
 * the scope ref out of a component during render is what `react-hooks/refs` exists to
 * stop, and the host element is reachable through `getByTestId` anyway.
 */
interface Reported {
  reduced: boolean;
  motionSafe: ReturnType<typeof useMotion<HTMLDivElement>>['motionSafe'];
}

interface HarnessProps {
  token: number;
  build: (token: number) => MotionSpec<HTMLDivElement>;
  onHandle: (reported: Reported) => void;
}

function Harness({ token, build, onHandle }: HarnessProps) {
  const { scope, reduced, motionSafe } = useMotion<HTMLDivElement>(build(token));
  onHandle({ reduced, motionSafe });
  return (
    <div ref={scope} data-testid="host">
      <span className="target" />
    </div>
  );
}

beforeEach(() => {
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount(build: (token: number) => MotionSpec<HTMLDivElement>) {
  let handle: Reported | null = null;
  const onHandle = (next: Reported) => {
    handle = next;
  };

  const view = render(<Harness token={0} build={build} onHandle={onHandle} />);

  return {
    host: view.getByTestId('host'),
    get handle() {
      if (handle === null) throw new Error('the hook did not run');
      return handle;
    },
    rerender(token: number) {
      view.rerender(<Harness token={token} build={build} onHandle={onHandle} />);
    },
    unmount: view.unmount,
  };
}

describe('CT-5 — under reduce, settle runs and animate never does', () => {
  it('creates no tween at all', () => {
    stubMatchMedia(true);
    const settle = vi.fn();
    const animate = vi.fn();

    const view = mount(() => ({ settle, animate }));

    expect(settle).toHaveBeenCalledTimes(1);
    expect(animate).not.toHaveBeenCalled();
    expect(view.handle.reduced).toBe(true);
  });
});

describe('CT-6 — under no-preference, settle runs before animate', () => {
  it('passes both builders the scoped root, and the query cannot escape it', () => {
    const order: string[] = [];
    let settleRoot: HTMLElement | null = null;
    let animateRoot: HTMLElement | null = null;
    let insideCount = -1;
    let outsideCount = -1;

    const view = mount(() => ({
      settle: (ctx: MotionCtx<HTMLDivElement>) => {
        order.push('settle');
        settleRoot = ctx.root;
      },
      animate: (ctx) => {
        order.push('animate');
        animateRoot = ctx.root;
        insideCount = ctx.q('.target').length;
        outsideCount = ctx.q('body').length;
      },
    }));

    expect(order).toEqual(['settle', 'animate']);
    expect(settleRoot).toBe(view.host);
    expect(animateRoot).toBe(view.host);
    expect(insideCount).toBe(1);
    // R-G2: a selector that matches nothing inside the container cannot leak outside it.
    expect(outsideCount).toBe(0);
    expect(view.handle.reduced).toBe(false);
  });
});

describe('CT-7 — no leak across dependency changes (R-G3)', () => {
  it('reverts before re-running, and leaves no inline transform behind', () => {
    const before = gsap.globalTimeline.getChildren().length;

    const view = mount((token) => ({
      animate: ({ tl, q }) => {
        // A long duration on purpose: the tween must still be a live child of the global
        // timeline when the next dependency change arrives. A completed tween removes
        // itself, and the test would then pass without proving anything.
        tl.fromTo(q('.target'), { x: 40 }, { x: 0, duration: 30, ease: MOTION.ease.enter });
      },
      deps: [token],
    }));

    const target = view.host.querySelector<HTMLElement>('.target');
    expect(target).not.toBeNull();
    // gsap.fromTo applies its start value immediately — R-G1's whole point.
    expect(target?.style.transform ?? '').not.toBe('');

    const afterMount = gsap.globalTimeline.getChildren().length;
    expect(afterMount).toBeGreaterThan(before);

    // Three dependency changes. Without `revertOnUpdate: true` each one ADDS a timeline
    // on top of the last, and this count climbs.
    for (const token of [1, 2, 3]) {
      view.rerender(token);
      expect(
        gsap.globalTimeline.getChildren().length,
        `global timeline children after dependency change ${String(token)}`,
      ).toBe(afterMount);
    }

    view.unmount();

    expect(gsap.globalTimeline.getChildren().length).toBe(before);
    expect(target?.style.transform ?? '').toBe('');
  });
});

describe('CT-8 — motionSafe', () => {
  it('invokes the function under no-preference', () => {
    const view = mount(() => ({}));
    const fn = vi.fn();
    view.handle.motionSafe(fn)('argument');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('argument');
  });

  it('is a no-op under reduce', () => {
    stubMatchMedia(true);
    const view = mount(() => ({}));
    const fn = vi.fn();
    view.handle.motionSafe(fn)();
    expect(fn).not.toHaveBeenCalled();
  });
});
