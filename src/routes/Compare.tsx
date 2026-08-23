import { type ReactNode, useCallback, useEffect, useMemo } from 'react';
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
 * **The picker writes to the URL** _(closed 2026-08-23)_. `ComparePage` takes `selected` and
 * `onSelect`, so adding or removing a driver in the tray is a navigation: `?e=` changes, the two
 * queries refetch on their new key, and the bay resolves. Until those props existed the page kept a
 * private copy of the selection and a driver added from the picker became a *pending* bay that
 * never resolved — a page that owns a private copy of its own URL state is a page that cannot be
 * linked to.
 *
 * `replace: false` here, unlike the default-fill effect below: adding a driver is a thing the
 * reader did on purpose, so Back should undo it.
 *
 * The year rail needs no equivalent, because `GET /api/compare/seasons` sends every season the
 * selection ran in one response — there is no network on the rail at all.
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
 *
 * ⚠ **`className="compare"` and nothing else.** These three branches used to carry
 * `shell-container px-4 md:px-6 xl:px-8` as a literal while the success branch inside `ComparePage`
 * carried none, and the page measured **left gutter 96px, right gutter 0** — `.shell-main` reserves
 * the dock's rail clearance on the left, and nothing supplied the right. Three copies of a rule in
 * three branches is what let the fourth drift, so the width, the centring and the inline padding
 * now live once, in `.compare` (`compare.css`), and every branch names only the class.
 */
function Shell({ busy = false, children }: { busy?: boolean; children: ReactNode }) {
  return (
    <div className="compare" {...(busy ? { 'aria-busy': true } : {})}>
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

  /**
   * The tray's add and remove, lifted into the URL — `ARCHITECTURE.md` §5, *"comparison state lives
   * entirely in the query string so any comparison is shareable"*.
   *
   * `replace: false`, unlike the default-fill effect above: adding a driver is something the reader
   * did on purpose, so Back should undo it.
   *
   * **Emptying the tray restores the default rather than showing an empty page**, and that is
   * forced rather than chosen: `?e=` with nothing in it parses as absent, so the effect above
   * re-derives the default from the directory. Stated here because it is surprising if you meet it
   * without knowing why. Removing down to *one* driver behaves normally — the career lens has a
   * designed state for that and asks for a second.
   */
  const select = useCallback(
    (next: string[]) => {
      setParams(
        (current) => {
          const params_ = new URLSearchParams(current);
          if (next.length === 0) params_.delete('e');
          else params_.set('e', next.join(','));
          return params_;
        },
        { replace: false },
      );
    },
    [setParams],
  );

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

  /*
   * **Inside `ComparePage`, not above it.** Rendered as a sibling it landed before the page's `h1`
   * and put an `h2` first in the document outline. The slot places it under the masthead, which is
   * also where the sentence reads best — it is about the comparison below it.
   */
  const notice = selection.corrected ? (
    <StateCard as="h2" icon={<Users />} tone="neutral" title="Part of that link could not be read">
      <p>
        A comparison holds up to four drivers, each addressed by their reference. Anything else in
        the link was dropped, and the comparison below is what remains of it.
      </p>
    </StateCard>
  ) : null;

  return (
    <ComparePage
      available={candidates}
      data={career.data}
      notice={notice}
      onSelect={select}
      seasons={seasons.data?.seasons ?? []}
      selected={refs}
    />
  );
}
