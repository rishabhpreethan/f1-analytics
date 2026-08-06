import type { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { shellMount } from '@/lib/motion/surfaces';
import { useMotion } from '@/lib/motion/useMotion';
import { useMotionPause } from '@/lib/motion/useMotionPause';

/**
 * The chrome: skip link, `header`, `main#main`, `footer` (Design Spec §2.1, §8).
 *
 * **This component owns the single `main` landmark and the `#main` id** — the skip link's
 * target. No other component renders a `main`.
 *
 * **G-1** is applied here, to the header, and fires once per hard load rather than per
 * route: the route-level motion is G-2 in `RootLayout`. There is no reduced variant to
 * select between any more — `useMotion` never builds the tween under `reduce`, and the
 * header's resting CSS is its final state (MR-2), so the reduced outcome is the correct
 * one by construction rather than by a second set of values.
 *
 * It also mounts **MR-3** once, for the whole document.
 *
 * `footerNote` is the §2.1 footer echo, which is a value from `/api/meta`. It arrives as
 * a prop because components never fetch (`ARCHITECTURE.md` §3), and it is `null` until
 * the data resolves — the footer then holds its space rather than appearing late.
 */

export interface AppShellProps {
  children: ReactNode;
  footerNote: string | null;
}

export function AppShell({ children, footerNote }: AppShellProps) {
  useMotionPause();
  const { scope: headerScope } = useMotion<HTMLElement>({ animate: shellMount });

  return (
    <div className="bg-surface-canvas flex min-h-screen flex-col">
      <a href="#main" className="skip-link t-sm">
        Skip to main content
      </a>

      <header ref={headerScope} className="shell-header sticky top-0 z-30">
        <Header />
      </header>

      <main id="main" className="shell-container flex-1 px-4 py-6 md:px-6 md:py-8 xl:px-8 xl:py-12">
        {children}
      </main>

      <footer className="border-border-subtle border-t">
        <div className="shell-container t-xs text-ink-tertiary px-4 py-6 md:px-6 xl:px-8">
          {footerNote}
        </div>
      </footer>
    </div>
  );
}
