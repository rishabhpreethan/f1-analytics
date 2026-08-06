import { useMeta, useRetryMeta } from '@/features/meta/useMeta';
import { CapabilityGrid } from '@/features/landing/CapabilityGrid';
import { CoverageRuler } from '@/features/landing/CoverageRuler';
import { HeroSection } from '@/features/landing/HeroSection';
import {
  selectCoverageBands,
  selectHeroFigures,
  selectRulerTicks,
} from '@/features/landing/selectors';
import { DataUnavailableState } from '@/components/ui/DataUnavailableState';
import { ScrollProgress } from '@/components/ui/ScrollProgress';
import { useMediaQuery } from '@/lib/useMediaQuery';

/**
 * `/` — the landing surface (Design Spec §3, `ARCHITECTURE.md` §10 #23).
 *
 * **This is the feature boundary, so this is the only thing here that fetches**
 * (`ARCHITECTURE.md` §3): `Landing` calls `useMeta()`, runs the pure selectors, and hands plain
 * values to presentational children. No section below fetches anything, and none of them derives
 * a figure of its own.
 *
 * **The hero never depends on data** (§8). Its headline, sub-headline, CTAs and background need no
 * API response, so no failure of `/api/meta` can blank this page — the loading, error and
 * unavailable states are scoped to the stat strip and the coverage ruler. On a 503 the hero renders
 * in full and the two lower sections are replaced by one `DataUnavailableState`, because a missing
 * database must not produce a blank first impression.
 *
 * **No figure is a literal.** `77`, `1950`, `2026`, `22`, `10` and `1996` all arrive from
 * `/api/meta` through `selectHeroFigures` / `selectCoverageBands`; CT-14 greps this file and every
 * component it renders for a three-digit sequence, because those numbers are correct today and
 * silently wrong after the next refresh — on the most visible surface in the product.
 *
 * `staleTime` is deliberately left alone (§S.2): `/api/meta` is cached for five minutes, so the
 * hero paints from cache on every return to `/` and its loading state is seen once per session.
 * Adding a refetch-on-mount to make the hero feel "live" would trade that away for nothing.
 */

/**
 * ≥768px gets the full axis. The same figure as `--breakpoint-md`, and one of the two places a
 * breakpoint is legitimately a JavaScript value (see `useMediaQuery`): **which ticks exist** is a
 * decision about what to render, not how to style it. Five 4-digit mono labels do not fit in the
 * ~170px of track a 390px viewport leaves, so Design Spec §3.6 drops the axis to three there —
 * and rendering all five and hiding two in CSS would leave the collision to be discovered by
 * whoever next changed the label width.
 */
const DENSE_AXIS_QUERY = '(min-width: 48rem)';

export function Landing() {
  const { data, error, isPending } = useMeta();
  const retry = useRetryMeta();
  const denseAxis = useMediaQuery(DENSE_AXIS_QUERY);

  const figures = data === undefined ? null : selectHeroFigures(data);
  const bands = data === undefined ? null : selectCoverageBands(data);
  const ticks = data === undefined ? [] : selectRulerTicks(data, denseAxis);

  // A missing database is the fresh-clone case and gets the instructional state, not an error
  // card. Every other failure is a failure of *this section*, not of the product.
  const unavailable = error?.code === 'DATABASE_UNAVAILABLE';
  const sectionError = error !== null && !unavailable ? error.code : null;

  return (
    <>
      {/* G-14, `/` only, and not rendered at all under reduced motion — the component decides. */}
      <ScrollProgress />

      <HeroSection figures={figures} pending={isPending} failed={error !== null} />

      {unavailable ? (
        <div className="shell-container px-4 py-12 md:px-6 xl:px-8">
          <DataUnavailableState />
        </div>
      ) : (
        <>
          <CapabilityGrid />
          <CoverageRuler
            bands={bands}
            ticks={ticks}
            lapTimingFrom={figures?.lapTimingFrom ?? null}
            pending={isPending}
            errorCode={sectionError}
            onRetry={retry}
          />
        </>
      )}
    </>
  );
}
