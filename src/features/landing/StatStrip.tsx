import { LoadingState } from '@/components/ui/LoadingState';
import { useCountUp } from '@/lib/motion/text';
import type { HeroFigures } from './selectors';

/**
 * The hero's four figures (Design Spec §3.3).
 *
 * **Every value comes from `/api/meta`.** `77`, `10`, `1996` and `1950–2026` are all correct today
 * and all wrong after the next database refresh, so none of them is a literal here — CT-14 greps
 * this file and its siblings for a three-digit sequence to keep it that way.
 *
 * **The strip holds its full height while loading**, so the CTA row above it never moves when the
 * data lands. That is the same reason `DataVintage`'s skeleton is the exact width of its resolved
 * chip: a hero that reflows on first paint is the worst possible first impression.
 *
 * **Tile 3 does not count up**, on purpose: counting up to a year is a gimmick and reads as a bug
 * — 1200, 1400, 1600 are not "loading", they are wrong years. Tile 4 is a range, so there is
 * nothing to count. §3.3 fixes both.
 *
 * The rendered text is always the final value; G-17 counts *to what is already there*, so under
 * reduced motion or a thrown error the figure is simply correct (MR-2).
 */

export interface StatStripProps {
  figures: HeroFigures | null;
  pending: boolean;
  failed: boolean;
}

export function StatStrip({ figures, pending, failed }: StatStripProps) {
  // Keyed on the figures so the count-up runs when they arrive and never again.
  const { scope } = useCountUp<HTMLDListElement>([
    figures?.seasonCount,
    figures?.roundProgress.completed,
  ]);

  if (failed) {
    return (
      <p className="t-xs text-ink-tertiary stat-strip-error">
        Coverage figures aren&apos;t available right now.
      </p>
    );
  }

  if (pending || figures === null) {
    return (
      // **One busy region for the strip, not one per skeleton block.** §7.5's rule is "told busy
      // once"; eight `role="status"` regions all named "Coverage figures" inside one `aria-busy`
      // container is eight announcements of one fact. The strip is the thing that is loading, so
      // the strip carries the region and the blocks are geometry.
      <div className="stat-strip" role="status" aria-busy="true" aria-label="Coverage figures">
        {[0, 1, 2, 3].map((slot) => (
          <div key={slot} className="stat-tile">
            <LoadingState announce={false} className="skeleton-stat-figure" />
            <LoadingState announce={false} className="skeleton-stat-label" />
          </div>
        ))}
      </div>
    );
  }

  const { seasonCount, roundProgress, lapTimingFrom, latestYear, seasonSpan } = figures;

  return (
    <dl ref={scope} className="stat-strip">
      <div className="stat-tile">
        <dd className="stat-figure t-mono" data-countup data-countup-to={seasonCount}>
          {seasonCount}
        </dd>
        <dt className="stat-label t-2xs text-ink-tertiary">Seasons</dt>
      </div>

      <div className="stat-tile">
        <dd className="stat-figure t-mono" data-countup data-countup-to={roundProgress.completed}>
          {roundProgress.completed}
        </dd>
        <dt className="stat-label t-2xs text-ink-tertiary">Rounds complete in {latestYear}</dt>
      </div>

      {/* Omitted rather than shown as a dash when the window is unknown (§8 partial data): a
       * label promising a year should not sit beside an absence. */}
      {lapTimingFrom !== null && (
        <div className="stat-tile">
          <dd className="stat-figure t-mono">{lapTimingFrom}</dd>
          <dt className="stat-label t-2xs text-ink-tertiary">Lap timing from</dt>
        </div>
      )}

      <div className="stat-tile">
        <dd className="stat-figure t-mono">{seasonSpan}</dd>
        <dt className="stat-label t-2xs text-ink-tertiary">Results coverage</dt>
      </div>
    </dl>
  );
}
