import { motion, useReducedMotion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router';
import { selectCoverageDetail } from '@/features/meta/selectors';
import { useMeta, useRetryMeta } from '@/features/meta/useMeta';
import { AppShell } from '@/components/layout/AppShell';
import { DataUnavailableState } from '@/components/ui/DataUnavailableState';
import { ErrorState } from '@/components/ui/ErrorState';
import type { ApiRequestError } from '@/lib/api';
import { routeEnter, routeEnterReduced } from '@/lib/motion';

/**
 * The layout route every surface renders inside.
 *
 * `AppShell` owns the `header`, the **single** `main#main` and the `footer`; this file
 * owns **M-2**, the footer echo, and the decision of what `main` shows when `/api/meta`
 * fails.
 *
 * M-2 has **no exit variant**, and there is deliberately no `AnimatePresence` here.
 * `mode="wait"` would add the exit duration to every perceived navigation, so a route
 * change must never hold the outgoing view. Keying the wrapper on `location.pathname`
 * remounts it, which replays the enter animation and nothing else.
 *
 * **Loading is not one of the states handled here.** F0's route surfaces fetch nothing,
 * so there is nothing for them to wait on — the only in-flight indicator in the shell is
 * `DataVintage`'s skeleton (Design Spec §7).
 */

/**
 * The API's fixed error codes mapped to the Design Spec §7 copy. The chip carries the
 * code itself, which is one of a closed set of constants — never a server message, so
 * nothing here can surface a path, a stack frame or SQL (S-6).
 */
function MetaFailure({ error, onRetry }: { error: ApiRequestError; onRetry: () => void }) {
  if (error.code === 'DATABASE_UNAVAILABLE') return <DataUnavailableState />;

  if (error.code === 'RATE_LIMITED') {
    return (
      <ErrorState
        title="Too many requests"
        detail="Wait a moment and try again."
        code={error.code}
        onRetry={onRetry}
      />
    );
  }

  return (
    <ErrorState
      title="Something went wrong"
      detail="This view couldn't be loaded."
      code={error.code}
      onRetry={onRetry}
    />
  );
}

export function RootLayout() {
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  const { data, error } = useMeta();
  const retry = useRetryMeta();

  const detail = data === undefined ? null : selectCoverageDetail(data);

  return (
    <AppShell footerNote={detail?.footerEcho ?? null}>
      <motion.div
        key={pathname}
        variants={reduced === true ? routeEnterReduced : routeEnter}
        initial="hidden"
        animate="visible"
      >
        {error === null ? <Outlet /> : <MetaFailure error={error} onRetry={retry} />}
      </motion.div>
    </AppShell>
  );
}
