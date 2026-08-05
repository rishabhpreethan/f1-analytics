import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { shellMount, shellMountReduced } from '@/lib/motion';

/**
 * The chrome: skip link, `header`, `main#main`, `footer` (Design Spec §2.1, §8).
 *
 * **This component owns the single `main` landmark and the `#main` id** — the skip link's
 * target. No other component renders a `main`.
 *
 * **M-1** is applied here, to the header, and fires once per hard load rather than per
 * route: the route-level motion is M-2 in `RootLayout`.
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
  const reduced = useReducedMotion();

  return (
    <div className="bg-surface-canvas flex min-h-screen flex-col">
      <a href="#main" className="skip-link t-sm">
        Skip to main content
      </a>

      <motion.header
        className="shell-header sticky top-0 z-30"
        variants={reduced === true ? shellMountReduced : shellMount}
        initial="hidden"
        animate="visible"
      >
        <Header />
      </motion.header>

      <main
        id="main"
        className="shell-container flex-1 px-4 py-6 md:px-6 md:py-8 xl:px-8 xl:py-12"
      >
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
