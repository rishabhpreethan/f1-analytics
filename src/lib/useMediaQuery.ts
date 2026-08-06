import { useSyncExternalStore } from 'react';

/**
 * A media query as a render-time value, kept live.
 *
 * **Used only where a decision is about what to *render*, not how to style it.** Anything
 * expressible in CSS stays in CSS — a media query in JavaScript is a second source of truth
 * for a breakpoint, and the two can disagree at exactly the widths nobody tests. The one case
 * that needs it here is the dock's active indicator (G-3), which moves on `y` in the rail and
 * on `x` in the bottom dock: an axis is not a style, it is which property a tween writes.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: a media query *is* an external
 * store, and the store form has no setState-in-effect cascade and no window between first
 * paint and the subscription in which the value could be stale.
 *
 * `matchMedia` is absent in a bare jsdom and in some embedded webviews, so it is never
 * assumed — absent means `false`, the same convention `prefersReducedMotion()` and
 * `lib/theme.ts` both use.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => undefined;
      }
      let list: MediaQueryList;
      try {
        list = window.matchMedia(query);
      } catch {
        return () => undefined;
      }
      list.addEventListener('change', onStoreChange);
      return () => {
        list.removeEventListener('change', onStoreChange);
      };
    },
    () => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
      try {
        return window.matchMedia(query).matches;
      } catch {
        return false;
      }
    },
    () => false,
  );
}
