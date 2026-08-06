import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { AtmosphereField } from '@/components/layout/AtmosphereField';
import { Header } from '@/components/layout/Header';
import { BACKDROP_ATTRIBUTE, backdropAttributeFor } from '@/components/layout/backdrop';
import { shellMount } from '@/lib/motion/surfaces';
import { useMotion } from '@/lib/motion/useMotion';
import { useMotionPause } from '@/lib/motion/useMotionPause';

/**
 * The chrome: the atmosphere, the skip link, `header`, `main#main`, `footer`
 * (Design Spec §5.5, §10).
 *
 * **This component owns the single `main` landmark and the `#main` id** — the skip link's
 * target. No other component renders a `main`, and the skip link renders at `--z-skip` (60)
 * rather than under the dock, because at ≥1024px a link at 40 would be covered by the rail
 * and a keyboard user would be told about a target they cannot see.
 *
 * **`main` carries no max-width and no padding of its own** (Design Spec §5.5). It reserves
 * the dock's clearance and sits at `--z-content` so it is above the atmosphere; each route
 * wraps its own content in `.shell-container`, which carries the page gutters. That is what
 * lets the landing hero be full-bleed without a negative-margin hack, and it is a structural
 * change rather than a stylistic one.
 *
 * **G-1** is applied here, to the header, and fires once per hard load rather than per route:
 * the route-level motion is G-2 in `RootLayout`. There is no reduced variant to select between
 * any more — `useMotion` never builds the tween under `reduce`, and the header's resting CSS
 * is its final state (MR-2), so the reduced outcome is correct by construction rather than by
 * a second set of values. **MR-3** is mounted here too, once, for the whole document.
 *
 * `footerNote` is the footer echo, a value from `/api/meta`. It arrives as a prop because
 * components never fetch (`ARCHITECTURE.md` §3), and it is `null` until the data resolves —
 * the footer holds its space rather than appearing late.
 */

export interface AppShellProps {
  children: ReactNode;
  footerNote: string | null;
}

export function AppShell({ children, footerNote }: AppShellProps) {
  const { pathname } = useLocation();
  useMotionPause();
  const { scope: headerScope } = useMotion<HTMLElement>({ animate: shellMount });

  /**
   * `<html data-bg>` — **the shell writes it, never a route** (`DESIGN_SYSTEM.md` §7.7.2), so
   * a route that never thinks about its background still gets a correct, quiet one. It is
   * deliberately not written by `theme-init.js`: unlike the theme, the atmosphere is not a
   * flash risk, and the pre-paint script has no router to ask.
   */
  useEffect(() => {
    document.documentElement.setAttribute(BACKDROP_ATTRIBUTE, backdropAttributeFor(pathname));
  }, [pathname]);

  return (
    // `isolation: isolate` on the shell root, so the grain's `mix-blend-mode` cannot reach
    // past the shell into the page's own root stacking context.
    <div className="shell-root flex min-h-screen flex-col">
      <AtmosphereField />

      <a href="#main" className="skip-link t-sm">
        Skip to main content
      </a>

      <header ref={headerScope} className="shell-header sticky top-0">
        <Header />
      </header>

      <main id="main" className="shell-main flex-1">
        {children}
      </main>

      <footer className="shell-footer">
        <div className="shell-container t-xs text-ink-tertiary px-4 py-6 md:px-6 xl:px-8">
          {footerNote}
        </div>
      </footer>
    </div>
  );
}
