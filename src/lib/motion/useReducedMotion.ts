import { useSyncExternalStore } from 'react';
import { MOTION_QUERY_REDUCE, prefersReducedMotion } from './reducedMotion';

/**
 * `prefers-reduced-motion` as a **render-time** value, kept live.
 *
 * Most reduced-motion handling in this product is structural and never reaches React: a
 * tween lives inside the `no-preference` branch of `gsap.matchMedia()` and simply is not
 * created (`DESIGN_SYSTEM.md` §4.4). But three requirements are decisions about what to
 * *render*, not about how to animate it, and those need the value at render time:
 *
 *   - the scroll-progress bar (G-14) is **not rendered at all** under `reduce`
 *   - the dock rail is **permanently expanded** under `reduce`, with the pin control
 *     hidden — a hover-to-reveal affordance is exactly what a reduced-motion user should
 *     not have to chase
 *   - a disclosure that would otherwise wait for an exit tween must unmount immediately
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: a media query *is* an
 * external store, and the store form has no setState-in-effect cascade and no window
 * between first paint and the subscription in which the value could be stale.
 */

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }

  let query: MediaQueryList;
  try {
    query = window.matchMedia(MOTION_QUERY_REDUCE);
  } catch {
    return () => undefined;
  }

  query.addEventListener('change', onStoreChange);
  return () => {
    query.removeEventListener('change', onStoreChange);
  };
}

function getSnapshot(): boolean {
  return prefersReducedMotion();
}

/** No DOM, no preference — the same convention `prefersReducedMotion()` uses. */
function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
