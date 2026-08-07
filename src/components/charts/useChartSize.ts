import { useEffect, useRef, useState } from 'react';

/**
 * The plot's pixel width, measured from its own container.
 *
 * **Width is measured; height is a token.** §6.5.3 requires the plot area to keep its exact height
 * through loading, empty, error, partial and no-coverage, so the height comes from
 * `--size-plot*` in `charts.css` and never from the content. Width has no such constraint and must
 * follow the container, because tick density is a function of axis length (§6.3) — a chart that
 * assumed a width would pick its tick count for a viewport it is not in.
 *
 * The initial value is `0`, and every consumer must survive it: `plotArea()` clamps its inner
 * dimensions at zero for exactly this frame. Rendering a chart at width 0 for one frame is correct;
 * guessing a width and then correcting it is a visible jump.
 */
export function useChartSize<T extends HTMLElement = HTMLDivElement>(): {
  ref: React.RefObject<T | null>;
  width: number;
  height: number;
} {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (node === null) return undefined;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      setSize((previous) =>
        /* Only commit a genuine change. A ResizeObserver fires on sub-pixel noise during a CSS
         * transition, and a setState per frame would re-render the whole chart on every one. */
        Math.round(previous.width) === Math.round(rect.width) &&
        Math.round(previous.height) === Math.round(rect.height)
          ? previous
          : { width: rect.width, height: rect.height },
      );
    };

    measure();

    /* jsdom implements no ResizeObserver and no layout, so this branch is the test environment's
     * and the width stays 0 there. That is stated rather than polyfilled: a fake observer would
     * hand geometry to code whose job is to measure real geometry, and a later test would pass for
     * the wrong reason — the same argument `vitest.setup.ts` makes about `getBoundingClientRect`. */
    if (typeof ResizeObserver !== 'function') return undefined;

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, width: size.width, height: size.height };
}
