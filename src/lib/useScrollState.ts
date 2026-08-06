import { useEffect } from 'react';

/**
 * `<html data-scrolled>` past a threshold — the **non-motion** half of G-13.
 *
 * It is a plain scroll listener and not a `ScrollTrigger` for one reason: it has to work in the
 * mode where no tween is permitted. Everything `useMotion` builds is suppressed under
 * `prefers-reduced-motion: reduce` by design, and §4.6 G-13 requires the header's border to
 * appear at the same 24px threshold there — instantly, with no `scaleX` and no blur tween. An
 * attribute plus a CSS rule is exactly that.
 *
 * `passive: true` because it never calls `preventDefault`; a non-passive scroll listener is a
 * scroll-performance defect on a page that is meant to feel light.
 */
export function useScrollState(threshold = 24): void {
  useEffect(() => {
    const apply = () => {
      document.documentElement.toggleAttribute('data-scrolled', window.scrollY > threshold);
    };
    apply();
    window.addEventListener('scroll', apply, { passive: true });
    return () => {
      window.removeEventListener('scroll', apply);
      document.documentElement.removeAttribute('data-scrolled');
    };
  }, [threshold]);
}
