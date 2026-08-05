import { motion, useReducedMotion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { routeEnter, routeEnterReduced } from '@/lib/motion';

/**
 * The layout route every surface renders inside.
 *
 * `AppShell` owns the `header`, the **single** `main#main` and the `footer`; this file
 * owns **M-2** and nothing else.
 *
 * M-2 has **no exit variant**, and there is deliberately no `AnimatePresence` here.
 * `mode="wait"` would add the exit duration to every perceived navigation, so a route
 * change must never hold the outgoing view. Keying the wrapper on `location.pathname`
 * remounts it, which replays the enter animation and nothing else.
 */
export function RootLayout() {
  const { pathname } = useLocation();
  const reduced = useReducedMotion();

  return (
    <AppShell footerNote={null}>
      <motion.div
        key={pathname}
        variants={reduced === true ? routeEnterReduced : routeEnter}
        initial="hidden"
        animate="visible"
      >
        <Outlet />
      </motion.div>
    </AppShell>
  );
}
