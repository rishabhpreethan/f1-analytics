import { useEffect } from 'react';

/**
 * **MR-3 — nothing animates while the tab is hidden** (`DESIGN_SYSTEM.md` §4.5).
 *
 * One implementation, mounted once by `AppShell`. It toggles a single attribute on
 * `<html>`; the rule that acts on it is one selector in `src/styles/motion.css`, so a new
 * looping animation is covered the moment it exists and there is nothing per-component to
 * remember.
 *
 * `animation-play-state: paused` rather than `animation: none`: a paused animation resumes
 * at the frame it stopped on, so a returning user does not meet a jump — which is exactly
 * what §4.5 asks for. `animation: none` would restart every loop from 0%.
 *
 * **GSAP needs no equivalent.** Its animations here are short one-shots, and browsers do
 * not fire `requestAnimationFrame` in a hidden tab, so a tween in flight simply resumes.
 */

export const MOTION_PAUSED_ATTRIBUTE = 'data-motion-paused';

export function useMotionPause(): void {
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      if (document.visibilityState === 'hidden') root.setAttribute(MOTION_PAUSED_ATTRIBUTE, '');
      else root.removeAttribute(MOTION_PAUSED_ATTRIBUTE);
    };

    apply();
    document.addEventListener('visibilitychange', apply);
    return () => {
      document.removeEventListener('visibilitychange', apply);
      // Never leave the document paused because this component unmounted.
      root.removeAttribute(MOTION_PAUSED_ATTRIBUTE);
    };
  }, []);
}
