import { type ReactNode, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StateCard } from '@/components/ui/StateCard';
import { Users } from '@/components/ui/icons';
import { ComparePage } from '@/features/compare/ComparePage';
import { defaultSelection, parseSelection } from '@/features/compare/selection';
import {
  selectCandidates,
  useCompare,
  useCompareSeasons,
  useRetryCompare,
} from '@/features/compare/useCompare';
import { useDriverIndex } from '@/features/entity/useEntityIndex';

/**
 * `/compare` — the comparison workspace. F7, `DESIGN_SYSTEM.md` §6.6.6.
 *
 * **This is the feature boundary, so this is the only thing here that fetches**
 * (ARCHITECTURE.md §3). It resolves the URL, calls three hooks, and hands plain values to
 * `ComparePage`, which is a pure function of its props and is tested against a fixture with no
 * network and no router.
 *
 * ======================================================================= the URL is the state
 *
 * `ARCHITECTURE.md` §5: *"comparison state lives entirely in the query string so any comparison is
 * shareable"*. `?e=` is a comma-separated list of `driver.reference` slugs, at most four of them,
 * and `selection.ts` holds both rules — how a link is read, and what the page opens on when the
 * link says nothing. They are pure and unit-tested there rather than inline here, which is also
 * what keeps this file exporting nothing but a component.
 *
 * ⚠ **The tray's picker cannot yet change what is fetched.** `ComparePage` keeps `selected` in
 * local state and publishes no callback, so a driver added from the picker becomes a *pending* bay
 * that never resolves — the component's own comment predicts exactly that and expects the endpoint
 * to fill it. Filling it needs `ComparePage` to accept `selected` and an `onSelect` (or to call
 * back on add and remove); the moment it does, this route lifts the selection into `?e=` and the
 * bay resolves with no other change here. **Every comparison addressed by a URL works today** —
 * only changing the selection from inside the page does not. The same gap applies to the season
 * lens's year rail, which is why `GET /api/compare/seasons` sends every season at once instead of
 * one per request.
 *
 * ================================================================================ the five states
 *
 * **loading** — the directory and both comparison payloads under one skeleton: three spinners for
 * one page is three announcements of one fact (§7.5).
 * **error** — one card carrying the error's own code and a retry that invalidates both keys.
 * **empty** — reachable only through an `?e=` whose every element is malformed. The card says what
 * a reference looks like rather than silently substituting the default, because a reader who typed
 * a slug meant something by it.
 * **partial** — a season still being run, carried as **data** rather than left to be inferred:
 * `archive[].isComplete` is false for 2026 and so is every `championshipPositionIsFinal` on a 2026
 * row, because 2026 is 10 rounds of 22. Rendering it is the surface's.
 * **no-coverage** — **there is none to render, and that is a fact rather than an omission.** Every
 * figure on this page comes from race classifications, which are complete from 1950, and neither
 * lens reads `lap` or `pit_stop` at all — so no coverage window bounds this surface. The one era
 * boundary that does bite is the season lens's best-N counting rule, and the payload publishes it
 * as `bestResults` so the surface can explain a flat line rather than hide one.
 */

/**
 * The wrapper the three pre-`ComparePage` states share.
 *
 * **It carries the `h1`, and that is the point of it.** The page's visible title lives inside
 * `ComparePage`, which cannot render without a payload — so without this the document has no
 * level-one heading while it is loading, and a different one on every failure. A page's name does
 * not depend on whether its data arrived. It is `sr-only` because the card beneath it already says
 * what is happening on screen, and two titles would be one too many.
 */
function Shell({ busy = false, children }: { busy?: boolean; children: ReactNode }) {
  return (
    <div
      className="shell-container compare px-4 md:px-6 xl:px-8"
      {...(busy ? { 'aria-busy': true } : {})}
    >
      <h1 className="sr-only">Compare</h1>
      {children}
    </div>
  );
}

export function Compare() {
  const [params, setParams] = useSearchParams();
  const directory = useDriverIndex();

  const candidates = useMemo(() => selectCandidates(directory.data), [directory.data]);
  const selection = useMemo(() => parseSelection(params.get('e')), [params]);

  const refs = useMemo(
    () => (selection.refs.length > 0 ? selection.refs : defaultSelection(candidates)),
    [candidates, selection.refs],
  );

  const career = useCompare(refs);
  const seasons = useCompareSeasons(refs);
  const retry = useRetryCompare(refs);

  /*
   * No `?e=` means "open the page", not "compare nothing" — the derived default is written back so
   * the URL a reader copies is the comparison they are looking at. `replace`, because the entry it
   * replaces is this same page with the parameter missing.
   *
   * In an effect rather than in the render body: navigating is a side effect, and doing it while
   * rendering updates the router mid-render. The render that precedes it is not wasted — `refs`
   * already holds the default, so the fetch starts on the first pass and the URL catches up.
   */
  const missingParam = selection.refs.length === 0 && refs.length > 0;
  const joined = refs.join(',');
  useEffect(() => {
    if (!missingParam) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('e', joined);
        return next;
      },
      { replace: true },
    );
  }, [joined, missingParam, setParams]);

  const error = directory.error ?? career.error ?? seasons.error;
  const pending =
    error === null &&
    (directory.data === undefined || career.data === undefined || seasons.data === undefined);

  if (error !== null) {
    const missing = error.code === 'NOT_FOUND';
    return (
      <Shell>
        <ErrorState
          title={missing ? 'No comparison for those drivers' : 'The comparison could not be loaded'}
          detail={
            missing
              ? 'One of the references in this link is not a driver who has started a Grand Prix, so there is no career to compare.'
              : error.message
          }
          code={error.code}
          onRetry={retry}
        />
      </Shell>
    );
  }

  if (pending && refs.length > 0) {
    return (
      <Shell busy>
        <LoadingState label="Loading the comparison" />
      </Shell>
    );
  }

  if (career.data === undefined) {
    return (
      <Shell>
        <StateCard
          as="h2"
          icon={<Users />}
          tone="neutral"
          title="Nobody to compare"
          code="BAD_REQUEST"
        >
          <p>
            A comparison is addressed by driver references — letters, digits, hyphens and
            underscores, up to four of them, separated by commas. Nothing in this link is one.
          </p>
        </StateCard>
      </Shell>
    );
  }

  return (
    <>
      {selection.corrected && (
        <div className="shell-container compare px-4 md:px-6 xl:px-8">
          <StateCard
            as="h2"
            icon={<Users />}
            tone="neutral"
            title="Part of that link could not be read"
          >
            <p>
              A comparison holds up to four drivers, each addressed by their reference. Anything
              else in the link was dropped, and the comparison below is what remains of it.
            </p>
          </StateCard>
        </div>
      )}
      <ComparePage
        available={candidates}
        data={career.data}
        seasons={seasons.data?.seasons ?? []}
      />
    </>
  );
}
