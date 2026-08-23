import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router';
import { selectCoverageDetail } from '@/features/meta/selectors';
import { useMeta, useRetryMeta } from '@/features/meta/useMeta';
import { AppShell } from '@/components/layout/AppShell';
import { DataUnavailableState } from '@/components/ui/DataUnavailableState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
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
 *
 * ============================================================ the route Suspense boundary
 *
 * Amended 2026-08-23, when route-level code splitting landed (`App.tsx`). Ten of the twelve
 * route surfaces are now `React.lazy`, so a route can suspend, and **the boundary has to be
 * exactly here** — one boundary, wrapping the `Outlet`, inside the shell and mounted for the
 * whole session.
 *
 * **Why not around `<Routes>` in `App.tsx`:** the boundary replaces its own subtree with the
 * fallback, and there the subtree is `RootLayout` — header, dock, footer and all. A cold load
 * of `/drivers` would paint no chrome until the route chunk arrived, which is strictly worse
 * than not splitting.
 *
 * **Why one stable boundary rather than one per route:** React does not show a fallback for a
 * boundary that is *already showing content* when the suspension happens inside a transition —
 * it keeps the previous content on screen instead. `BrowserRouter` wraps its location state
 * update in `React.startTransition` unless `useTransitions={false}` (verified in
 * `react-router@8.3.0`, `dist/production/lib/dom/lib.js`), so an in-app navigation to a lazy
 * route holds the current page until the chunk resolves and then swaps. **That is what stops
 * the split from flashing, and it only works because this boundary stays mounted.** A boundary
 * placed per route would be a *new* boundary on every navigation, and a new boundary shows its
 * fallback even in a transition.
 *
 * So the fallback below is reached in exactly one situation: **a cold load — or a reload, or a
 * pasted link — on a lazy route**, where there is no previous content to hold and the shell has
 * already painted around it. It is deliberately the least it can be: the existing `LoadingState`
 * geometry in the existing page container, no new CSS, no new visual vocabulary. **It is
 * nonetheless a user-visible state that did not exist before, and the `designer` owns it** — if
 * the entrance wants a designed treatment, this is the component to replace.
 *
 * Two consequences worth knowing before looking at it in a browser, neither verifiable here
 * (jsdom does no layout, no compositing and no timing):
 *
 *  1. On that cold load the G-2 route enter plays on the **fallback**, because the pathname is
 *     already settled when the skeleton mounts; the real content then appears without an
 *     entrance. Locally the chunk resolves in a few milliseconds so there may be nothing to
 *     see. On a slow link there is.
 *  2. During an in-app navigation there is **no pending indicator** — declarative mode exposes
 *     no `useNavigation()`, so the current page simply stays put until the chunk lands. That is
 *     the correct trade for a fast connection and reads as lag on a slow one. Link-hover
 *     prefetch is the fix if it ever matters; it was deliberately not built on speculation.
 */

/**
 * What `main` shows while a lazy route chunk is in flight. See the boundary note above for
 * when that is (cold load of a lazy route, and only then).
 *
 * The geometry is generic on purpose — masthead-shaped, because every route surface in this
 * product opens with one — and every class here is already in the stylesheet. Nothing new is
 * introduced by the split.
 */
function RouteChunkPending() {
  return (
    // Same container every route surface wraps itself in: `main` stopped providing the page
    // gutters in C7-4 (Design Spec §5.5).
    <div className="shell-container px-4 py-6 md:px-6 md:py-8 xl:px-8 xl:py-12">
      <div
        className="flex flex-col gap-3"
        role="status"
        aria-busy="true"
        aria-label="Loading this page"
      >
        {/* One busy region for the group (§7.5): the blocks are geometry, announced once. */}
        <LoadingState announce={false} className="skeleton-title-eyebrow" />
        <LoadingState announce={false} className="skeleton-title-name" />
        <LoadingState announce={false} className="skeleton-title-detail" />
      </div>
    </div>
  );
}

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
        {error === null ? (
          <Suspense fallback={<RouteChunkPending />}>
            <Outlet />
          </Suspense>
        ) : (
          // The failure states are not a route, so they have no `.shell-container` of their
          // own — `main` stopped providing one in C7-4 (Design Spec §5.5).
          <div className="shell-container px-4 py-6 md:px-6 md:py-8 xl:px-8 xl:py-12">
            <MetaFailure error={error} onRetry={retry} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
