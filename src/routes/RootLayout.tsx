import { Outlet, useLocation } from 'react-router';
import { selectCoverageDetail } from '@/features/meta/selectors';
import { useMeta, useRetryMeta } from '@/features/meta/useMeta';
import { AppShell } from '@/components/layout/AppShell';
import { DataUnavailableState } from '@/components/ui/DataUnavailableState';
import { ErrorState } from '@/components/ui/ErrorState';
import type { ApiRequestError } from '@/lib/api';
import { dist, dur, ease } from '@/lib/motion/tokens';
import { useMotion } from '@/lib/motion/useMotion';

/**
 * The layout route every surface renders inside.
 *
 * `AppShell` owns the `header`, the **single** `main#main` and the `footer`; this file
 * owns the **route enter** (G-2), the footer echo, and the decision of what `main`
 * shows when `/api/meta` fails.
 *
 * **The route enter has no exit half, by design.** Holding the outgoing view would add
 * its duration to every perceived navigation. The retired library's presence wrapper was
 * deliberately not used here for that reason, and GSAP has no equivalent to be tempted
 * by — so the property survives the CR-007 migration for free.
 *
 * The replay mechanism changed with CR-007, though. It used to be `key={pathname}`,
 * remounting the wrapper. Now `deps: [pathname]` does it: `useMotion` hard-codes
 * `revertOnUpdate: true`, so a pathname change reverts the previous tween — clearing its
 * inline transform rather than layering a second one over it — and rebuilds. The wrapper
 * stays mounted, which is one fewer subtree remount per navigation.
 *
 * Authored as `from` (MR-2): the resting CSS is the readable state, so under reduced
 * motion, a stalled chunk or a thrown error, the content is simply *there*.
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
  const { data, error } = useMeta();
  const retry = useRetryMeta();

  const { scope } = useMotion<HTMLDivElement>({
    animate: ({ tl, root }) => {
      tl.from(root, {
        opacity: 0,
        y: dist.rise,
        duration: dur.base,
        ease: ease.enter,
      });
    },
    deps: [pathname],
  });

  const detail = data === undefined ? null : selectCoverageDetail(data);

  return (
    <AppShell footerNote={detail?.footerEcho ?? null}>
      <div ref={scope}>
        {error === null ? <Outlet /> : <MetaFailure error={error} onRetry={retry} />}
      </div>
    </AppShell>
  );
}
