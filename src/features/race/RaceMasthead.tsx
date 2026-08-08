import { Link } from 'react-router';
import { LoadingState } from '@/components/ui/LoadingState';
import { ChevronLeft } from '@/components/ui/icons';
import { formatIsoDate } from '@/lib/format';
import type { Race } from '@schemas/race';
import type { selectRaceCounts } from './selectors';

/**
 * **The race masthead.** The round number is the largest type on the page, and the season it belongs
 * to is a link — a race is addressed *through* its season (`/seasons/:year/races/:round`), and the
 * masthead should say so rather than leaving the reader to edit a URL.
 *
 * **It does not depend on lap data, and that is the point.** The masthead, the counts and the session
 * strip are all derived from the race payload, which exists for every round from 1950 — so a 1988 page
 * has a complete header and the reduced content sits below it. This is the same rule the landing hero
 * and the season masthead follow: *no failure or absence below the fold can blank the top of the
 * page*.
 *
 * **Every count comes from `selectRaceCounts`, which derives them from `status`** and never from a
 * null position (trap 3). `finishers` is `is_classified` — §3's canonical flag — and not
 * `status === 0`, because a lapped car is classified and did finish the race.
 */

export interface RaceMastheadProps {
  race: Race | null;
  counts: ReturnType<typeof selectRaceCounts> | null;
  /** `raceLaps` — `max(laps_completed)`, never `session.scheduled_laps` (trap 21). */
  raceLaps: number | null;
  pending: boolean;
}

export function RaceMasthead({ race, counts, raceLaps, pending }: RaceMastheadProps) {
  return (
    <section className="race-masthead" aria-labelledby="race-title">
      <div>
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          {race === null ? 'Race' : `${String(race.year)} season`}
        </p>

        <div className="race-headline mt-3">
          {race === null ? (
            <h1 id="race-title" className="race-round" aria-busy="true">
              Race
              <span className="skeleton skeleton-season-year" aria-hidden="true" />
            </h1>
          ) : (
            <>
              <Link
                to={`/seasons/${String(race.year)}`}
                className="season-step"
                aria-label={`Back to the ${String(race.year)} season`}
              >
                <ChevronLeft size={16} />
              </Link>
              <span className="race-round-label" aria-hidden="true">
                Round
              </span>
              <h1 id="race-title" className="race-round">
                {String(race.round).padStart(2, '0')}
                <span className="sr-only">{` — ${race.name}, ${String(race.year)}`}</span>
              </h1>
            </>
          )}
        </div>

        {race !== null && (
          <p className="race-name t-display-sm text-ink-primary mt-4">{race.name}</p>
        )}

        {race !== null && (
          <p className="race-meta t-sm text-ink-secondary mt-2">
            {race.circuit !== null && (
              <>
                <span>{race.circuit.name}</span>
                {race.circuit.locality !== null && <span>{race.circuit.locality}</span>}
              </>
            )}
            <span className="t-mono">{formatIsoDate(race.date)}</span>
            {raceLaps !== null && <span className="t-mono">{raceLaps} laps</span>}
          </p>
        )}
      </div>

      {pending ? (
        <div className="race-counts" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <span className="race-count" key={i}>
              <LoadingState announce={false} className="skeleton-title-detail" />
            </span>
          ))}
        </div>
      ) : (
        counts !== null && <RaceCounts counts={counts} />
      )}
    </section>
  );
}

/**
 * The four figures worth stating above the fold. **Not a chart** — no scale, no axis; four stat
 * tiles, in the same language the landing page's strip uses.
 *
 * `nonStarters` is shown only when there are any, because §3 requires `status IN (30, 40)` to be
 * excluded from starts counts — so it is a separate fact, and printing "0 did not start" on 1,100
 * races would be noise around the one place it matters.
 */
function RaceCounts({ counts }: { counts: ReturnType<typeof selectRaceCounts> }) {
  const figures: { label: string; value: number }[] = [
    { label: 'Starters', value: counts.starters },
    { label: 'Classified', value: counts.finishers },
    { label: 'Retirements', value: counts.retirements },
    ...(counts.disqualified > 0 ? [{ label: 'Disqualified', value: counts.disqualified }] : []),
    ...(counts.nonStarters > 0 ? [{ label: 'Did not start', value: counts.nonStarters }] : []),
  ];

  return (
    <dl className="race-counts">
      {figures.map((figure) => (
        <div className="race-count" key={figure.label}>
          <dt className="season-eyebrow">{figure.label}</dt>
          <dd className="race-count-figure">{figure.value}</dd>
        </div>
      ))}
    </dl>
  );
}
