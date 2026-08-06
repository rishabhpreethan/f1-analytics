import type { CSSProperties } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useAxisAnchoredBars, useSectionReveal } from '@/lib/motion/scroll';
import type { CoverageBand } from './selectors';

/**
 * Section C — the coverage ruler (Design Spec §3.5).
 *
 * **This is not a chart, and that is a checkable claim.** No Recharts, no visx, no scale function,
 * no axis component: six absolutely-positioned bars whose `left` and `width` are plain percentages
 * computed by `selectCoverageBands` over the fixed domain `firstYear → latestYear`. F0's "no chart
 * and no chart primitive" rule holds, and a reviewer can verify it by the absence of an import.
 *
 * **Why it is on the landing page at all.** The most-seen state in this whole product is "no
 * coverage" (§7.4). Teaching the boundary once, at the front door, in a form that is interesting
 * rather than apologetic, makes every later encounter a reminder instead of a surprise. It is also
 * the most product-truthful thing F0 can show while it has no analytical content.
 *
 * **Every year is read from `meta.coverage`.** A hard-coded 1996 in the section whose entire point
 * is that the product knows its own limits would be self-refuting as well as wrong. The one static
 * figure is "1990" in the closing paragraph, and it is a fact about the data that does not move:
 * zero of the 484 races before 1990 carry lap rows.
 *
 * A `<details>` table view is present even though this is not a chart, because §6.2's
 * table-for-every-chart rule is the right habit and this is the surface that teaches it.
 */

export interface CoverageRulerProps {
  bands: readonly CoverageBand[] | null;
  ticks: ReadonlyArray<{ year: number; at: number }>;
  lapTimingFrom: number | null;
  pending: boolean;
  /** The fixed error code, or `null`. Never a server message (S-6). */
  errorCode: string | null;
  onRetry: () => void;
}

export function CoverageRuler({
  bands,
  ticks,
  lapTimingFrom,
  pending,
  errorCode,
  onRetry,
}: CoverageRulerProps) {
  const { scope } = useSectionReveal<HTMLElement>();

  return (
    <section
      ref={scope}
      className="shell-container px-4 py-12 md:px-6 xl:px-8"
      aria-labelledby="coverage-title"
    >
      <p className="t-2xs text-ink-tertiary flex items-center gap-2" data-motion="reveal-item">
        <span className="accent-rule" aria-hidden="true" />
        THE HONEST PART
      </p>
      <h2
        id="coverage-title"
        className="t-display-sm text-ink-primary mt-3"
        data-motion="reveal-item"
      >
        What the record holds
      </h2>
      <p className="t-md text-ink-secondary mt-4 max-w-[68ch]" data-motion="reveal-item">
        Formula 1&apos;s record gets richer the closer you get to now. Rather than hide that, this
        product states it: wherever a surface depends on data that doesn&apos;t exist for the season
        you&apos;re looking at, it will say so — and say what does exist instead.
      </p>

      <div className="mt-8" data-motion="reveal-item">
        {errorCode !== null ? (
          <div className="coverage-error">
            <ErrorState
              title={errorCode === 'RATE_LIMITED' ? 'Too many requests' : 'Something went wrong'}
              detail={
                errorCode === 'RATE_LIMITED'
                  ? 'Wait a moment and try again.'
                  : "This section couldn't be loaded."
              }
              code={errorCode}
              onRetry={onRetry}
            />
          </div>
        ) : pending || bands === null ? (
          <RulerSkeleton />
        ) : (
          <Ruler bands={bands} ticks={ticks} />
        )}
      </div>

      {lapTimingFrom !== null && (
        <p className="t-sm text-ink-secondary mt-6 max-w-[68ch]" data-motion="reveal-item">
          Lap-by-lap timing begins in {lapTimingFrom}. Before that the record holds full race
          classifications, starting grids and championship standings — but no lap times, so pace and
          stint analysis simply aren&apos;t available. No race before 1990 has any lap data at all.
        </p>
      )}
    </section>
  );
}

function Ruler({
  bands,
  ticks,
}: {
  bands: readonly CoverageBand[];
  ticks: ReadonlyArray<{ year: number; at: number }>;
}) {
  // §3.5's `Reveal` row: the bars grow from their right edge, which is the axis they are
  // anchored to. Mounted here rather than on the section, because the bars only exist once the
  // data has resolved and G-15's `once: true` trigger has usually fired by then.
  const { scope } = useAxisAnchoredBars<HTMLDivElement>();

  return (
    <>
      {/*
       * `role="list"` with focusable rows, so the information is reachable by keyboard and not
       * only by hover. The accessible name combines the label and the availability, because a row
       * that announces only "Lap-by-lap timing" has told a screen-reader user nothing.
       */}
      <div ref={scope} role="list" className="ruler">
        {bands.map((band) => (
          <div
            key={band.label}
            role="listitem"
            tabIndex={0}
            className="ruler-row"
            aria-label={`${band.label}: available from ${String(band.from)}`}
          >
            <span className="ruler-label t-sm text-ink-primary">{band.label}</span>

            <span className="ruler-track" aria-hidden="true">
              <span
                className="ruler-fill"
                data-motion="ruler-bar"
                style={
                  {
                    '--band-offset': `${String(band.offset * 100)}%`,
                    '--band-extent': `${String(band.extent * 100)}%`,
                  } as CSSProperties
                }
              />
            </span>

            <span className="ruler-from t-mono t-xs text-ink-tertiary">{band.from} →</span>
          </div>
        ))}

        {/*
         * The axis repeats the row's three columns and puts the ticks in the middle one, so a
         * tick's percentage is a percentage **of the track it labels**. Without the inner
         * element the ticks were positioned against the full row width and every one of them
         * sat ~130px left of its year.
         */}
        <div className="ruler-axis" aria-hidden="true">
          <span className="ruler-axis-track">
            {ticks.map((tick) => (
              <span
                key={tick.year}
                className="ruler-tick t-2xs t-mono text-ink-tertiary"
                style={{ '--tick-at': `${String(tick.at * 100)}%` } as CSSProperties}
              >
                {tick.year}
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* §6.2's table view. The ruler is never the only route to the information. */}
      <details className="ruler-table mt-6">
        <summary className="t-sm text-ink-secondary">View as a table</summary>
        <table className="t-sm mt-3">
          <thead>
            <tr>
              <th scope="col">Data class</th>
              <th scope="col">Available from</th>
              <th scope="col">Not available before</th>
            </tr>
          </thead>
          <tbody>
            {bands.map((band) => (
              <tr key={band.label}>
                <td>{band.label}</td>
                <td className="t-mono">{band.from}</td>
                <td className="t-mono">{band.from - 1}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

/**
 * Six empty tracks at full width with the labels rendered normally — they are static strings, so
 * skeletoning them would be pretending not to know something we do know. Only the years are
 * skeletons. The block holds the ruler's height so nothing below it moves (G-12).
 */
function RulerSkeleton() {
  return (
    // One busy region for the whole ruler, for the same reason `StatStrip` has one for the whole
    // strip: six `role="status"` regions with the same name inside one `aria-busy` container is
    // six announcements of one fact, and §7.5 asks for one.
    <div role="list" className="ruler" aria-busy="true" aria-label="Coverage windows">
      {[
        'Results',
        'Qualifying positions',
        'Lap-by-lap timing',
        'Q1 / Q2 / Q3',
        'Pit stops',
        'Sprint races',
      ].map((label) => (
        <div key={label} role="listitem" className="ruler-row">
          <span className="ruler-label t-sm text-ink-primary">{label}</span>
          <span className="ruler-track" aria-hidden="true" />
          <span className="ruler-from">
            <LoadingState announce={false} className="skeleton-ruler-year" />
          </span>
        </div>
      ))}
    </div>
  );
}
