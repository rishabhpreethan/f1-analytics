import { useState } from 'react';
import { Link } from 'react-router';
import type { Circuit, CircuitRace } from '@schemas/circuit';
import { BarChart } from '@/components/charts';
import { CareerRibbon } from '@/components/entity/CareerRibbon';
import { CircuitLocator } from '@/components/entity/CircuitLocator';
import { EntityMasthead, type MastheadFact } from '@/components/entity/EntityMasthead';
import { StatTiles } from '@/components/entity/StatTiles';
import { DataUnavailableState } from '@/components/ui/DataUnavailableState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StateCard } from '@/components/ui/StateCard';
import { MapPin } from '@/components/ui/icons';
import { formatIsoDate } from '@/lib/format';
import { circuitRibbon, circuitTiles, topEntityBars } from './presenters';

/**
 * **The circuit page** — F6, CI-1 … CI-3. `DESIGN_SYSTEM.md` §6.6.2.
 *
 * **There is no map, and §6.6.2.7 rules that rather than leaving it open.** A tile map is a
 * third-party network call on a request path, which `ARCHITECTURE.md` §7 forbids and the CSP does
 * not whitelist; a vector basemap costs more than the whole application; and a **track outline does
 * not exist in the data** — `circuit` holds a name, a locality, a country and three numbers. What
 * ships is `CircuitLocator` (§7.11): those three numbers, drawn.
 *
 * **The ribbon's measure is different here and the component is the same**, which is the point of
 * having it: on a driver's page a cell's fill is a championship position; on a venue's it is
 * hosted-or-not, so the strip reads as the venue's presence on the calendar across seventy years.
 * Interlagos' gap through the 1980s is a fact about the sport that the strip states without a word.
 */

export interface CircuitPageProps {
  circuit: Circuit | null;
  pending: boolean;
  error: { code: string } | null;
  onRetry: () => void;
}

export function CircuitPage({ circuit, pending, error, onRetry }: CircuitPageProps) {
  const [board, setBoard] = useState<'drivers' | 'teams'>('drivers');

  if (error?.code === 'DATABASE_UNAVAILABLE') {
    return (
      <div className="shell-container entity-page px-4 md:px-6 xl:px-8">
        <DataUnavailableState />
      </div>
    );
  }

  const facts: MastheadFact[] = [];
  if (circuit !== null) {
    const place = [circuit.circuit.locality, circuit.circuit.country].filter(Boolean).join(', ');
    if (place !== '') facts.push({ label: 'Location', value: place });
    if (circuit.firstYear !== null && circuit.lastYear !== null) {
      facts.push({
        label: 'Hosted',
        value:
          circuit.firstYear === circuit.lastYear
            ? String(circuit.firstYear)
            : `${String(circuit.firstYear)}–${String(circuit.lastYear)}`,
        mono: true,
      });
    }
    facts.push({
      label: 'Grands Prix',
      value: `${String(circuit.roundsHeld)} ${circuit.roundsHeld === 1 ? 'Grand Prix' : 'Grands Prix'}`,
      mono: true,
    });
  }

  const ribbon = circuit === null ? [] : circuitRibbon(circuit);
  const bars = circuit === null ? [] : topEntityBars(circuit, board);
  const located =
    circuit !== null && circuit.circuit.latitude !== null && circuit.circuit.longitude !== null;

  return (
    <div className="shell-container entity-page px-4 md:px-6 xl:px-8">
      <EntityMasthead
        eyebrow="Circuit"
        titleId="circuit-title"
        name={circuit?.circuit.name ?? null}
        /*
         * **No identity colour on a circuit, and none is borrowed.** A venue has no brand colour in
         * the data and inventing one — the winning team's, say — would make the same page change
         * colour whenever a different team won there (§3.3a: colour follows the entity).
         */
        teamReference={null}
        facts={facts}
        pending={pending}
      >
        {(pending || ribbon.length > 0) && (
          <CareerRibbon
            seasons={ribbon}
            pending={pending}
            measureLabel="Hosted a Grand Prix in"
            formatPosition={() => 'this season'}
            absentCopy="No Grand Prix this season"
            unrankedCopy="Scheduled, no results recorded"
            ariaLabel={`Seasons in which this circuit hosted a Grand Prix, ${String(circuit?.firstYear ?? '')} to ${String(circuit?.lastYear ?? '')}. Every race is listed in the table below.`}
          />
        )}
      </EntityMasthead>

      {error?.code === 'NOT_FOUND' ? (
        <StateCard
          icon={<MapPin />}
          tone="neutral"
          as="h2"
          title="No such circuit"
          code="NOT_FOUND"
        >
          <p>
            There is no circuit at this address. The record holds 78 venues used for a World
            Championship Grand Prix since 1950, each addressed by its own reference.
          </p>
        </StateCard>
      ) : error !== null ? (
        <ErrorState
          title="This circuit could not be loaded"
          detail="Nothing was lost — the record is read-only. Try again."
          code={error.code}
          onRetry={onRetry}
        />
      ) : (
        <>
          <section className="season-section" aria-labelledby="circuit-place-title">
            <div>
              <p className="season-eyebrow">
                <span className="accent-rule" aria-hidden="true" />
                The venue
              </p>
              <h2 id="circuit-place-title" className="t-display-sm text-ink-primary mt-3">
                Where it is
              </h2>
              <p className="t-sm text-ink-secondary mt-2">
                {/*
                 * §6.6.2.7 — the absence of a map is **stated**, not left for a reader to wonder
                 * about. Altitude is named as the coordinate that changes how the car behaves,
                 * because it is the one of the three that an F1 reader can actually use.
                 */}
                This record holds a venue’s coordinates and elevation, and no track geometry — so
                the position is drawn rather than mapped. Altitude is the coordinate that changes
                how a car behaves: the highest venue on record sits at 2,227 m and the lowest at −7
                m.
              </p>
            </div>

            <div className="season-panel entity-chart-panel">
              {pending || circuit === null ? (
                <LoadingState className="skeleton-standings-row" label="Circuit location" />
              ) : located ? (
                <CircuitLocator
                  latitude={circuit.circuit.latitude ?? 0}
                  longitude={circuit.circuit.longitude ?? 0}
                  altitude={circuit.circuit.altitude}
                  place={[circuit.circuit.name, circuit.circuit.locality, circuit.circuit.country]
                    .filter(Boolean)
                    .join(', ')}
                />
              ) : (
                /*
                 * §6.5.3's three-part copy: where the boundary is, which side this falls on, and
                 * what IS available. Neutral, never a status colour — a venue with no recorded
                 * coordinates is a gap in the record, not a fault in the request.
                 */
                <p className="t-sm text-ink-tertiary">
                  No coordinates are recorded for this circuit, so its position cannot be drawn. Its
                  race history and its most successful drivers and teams are below.
                </p>
              )}
            </div>
          </section>

          <section className="season-section" aria-labelledby="circuit-record-title">
            <div>
              <p className="season-eyebrow">
                <span className="accent-rule" aria-hidden="true" />
                The record
              </p>
              <h2 id="circuit-record-title" className="t-display-sm text-ink-primary mt-3">
                At this venue
              </h2>
            </div>
            <StatTiles
              ariaLabel="Circuit record"
              pending={pending}
              tiles={circuit === null ? PLACEHOLDER_TILES : circuitTiles(circuit)}
            />
          </section>

          <section className="season-section" aria-labelledby="circuit-top-title">
            <div>
              <p className="season-eyebrow">
                <span className="accent-rule" aria-hidden="true" />
                The specialists
              </p>
              <h2 id="circuit-top-title" className="t-display-sm text-ink-primary mt-3">
                Most successful here
              </h2>
            </div>

            <div className="season-panel entity-chart-panel">
              <div className="season-filters">
                <div className="chart-seg" role="group" aria-label="Leaderboard">
                  {(['drivers', 'teams'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="chart-seg-btn"
                      aria-pressed={board === option}
                      onClick={() => {
                        setBoard(option);
                      }}
                    >
                      {option === 'drivers' ? 'Drivers' : 'Teams'}
                    </button>
                  ))}
                </div>
              </div>

              <BarChart
                data={bars}
                orientation="row"
                title={board === 'drivers' ? 'Wins by driver' : 'Wins by team'}
                subtitle={`${String(bars.length)} shown`}
                valueTitle="Wins"
                categoryTitle={board === 'drivers' ? 'Driver' : 'Team'}
                state={pending ? 'loading' : bars.length === 0 ? 'empty' : 'ready'}
                stateCopy={{
                  title: 'No winners recorded here',
                  body: 'This venue has no race with classification rows, so nobody has won at it in the record.',
                }}
                ariaLabel={
                  board === 'drivers'
                    ? 'Grand Prix wins at this circuit, by driver.'
                    : 'Grand Prix wins at this circuit, by constructor.'
                }
                /*
                 * The honesty the raw count needs: a venue's race count ranges from 1 to more than
                 * 70, so wins here favour the regulars of a long-running venue. The table view is
                 * where a reader checks the rate, which is why it carries starts beside wins.
                 */
                caption="Wins at this venue only. A venue’s race count ranges from one to more than seventy, so a raw win count favours whoever raced here most — the table view carries starts beside wins so the rate is checkable."
                notes={
                  bars.length > 0
                    ? [
                        `Ordered by wins, then podiums, then starts. Everyone who has raced here is not shown — only those with a win or the strongest record.`,
                      ]
                    : []
                }
              />
            </div>
          </section>

          <CircuitHistory
            races={circuit?.races ?? []}
            circuitName={circuit?.circuit.name ?? ''}
            pending={pending || circuit === null}
          />
        </>
      )}
    </div>
  );
}

/**
 * **CI-2 — every race at the venue.** A table, not a chart: the job is identity and sequence, and
 * there is no scale here. Same anatomy as the season hub's calendar rotated to a venue.
 *
 * **Every row links to its race page** (§1.0a), and the winner and pole cells name drivers without
 * linking them — for the same principled reason `SeasonCalendar` does not: an anchor inside an
 * anchor is invalid HTML and a screen-reader failure, and the whole row is already the link to the
 * race, where every driver named *is* a link.
 */
function CircuitHistory({
  races,
  circuitName,
  pending,
}: {
  races: readonly CircuitRace[];
  circuitName: string;
  pending: boolean;
}) {
  return (
    <section className="season-section" aria-labelledby="circuit-history-title">
      <div>
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          The history
        </p>
        <h2 id="circuit-history-title" className="t-display-sm text-ink-primary mt-3">
          Every Grand Prix here
        </h2>
      </div>

      <div className="season-panel">
        {pending ? (
          <div className="standings-skeleton" role="status" aria-busy="true" aria-label="Races">
            {Array.from({ length: 8 }, (_, index) => (
              <LoadingState announce={false} className="skeleton-standings-row" key={index} />
            ))}
          </div>
        ) : races.length === 0 ? (
          <p className="t-sm text-ink-tertiary p-4">
            No Grand Prix is recorded at this circuit. The venue is in the record because a round
            was scheduled here, and the round’s results have not been recorded.
          </p>
        ) : (
          <div className="standings-scroll">
            <table className="standings-table">
              <caption className="sr-only">
                {`${circuitName} — every Grand Prix held here, with its winner and pole sitter.`}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Season</th>
                  <th scope="col">Race</th>
                  <th scope="col">Winner</th>
                  <th scope="col" className="standings-optional">
                    Pole
                  </th>
                </tr>
              </thead>
              <tbody>
                {races.map((race) => (
                  <tr key={`${String(race.year)}:${String(race.round)}`}>
                    <th scope="row" className="standings-position">
                      <Link
                        className="entity-link t-mono"
                        to={`/seasons/${String(race.year)}/races/${String(race.round)}`}
                        aria-label={`${String(race.year)} ${race.name}`}
                      >
                        {race.year}
                      </Link>
                    </th>
                    <td>
                      <span className="standings-name">{race.name}</span>
                      <span className="standings-team t-mono">{formatIsoDate(race.date)}</span>
                    </td>
                    <td>
                      {race.winners.length === 0 ? (
                        <span className="round-pending">
                          {/*
                           * A scheduled round is not a gap in the record (`REQUIREMENTS.md` §2.2).
                           * Saying "no data" about a race that has not happened is the mistake
                           * `SeasonCalendar` already ruled against.
                           */}
                          {race.hasResults ? 'No winner recorded' : 'Not yet raced'}
                        </span>
                      ) : (
                        race.winners.map((winner, index) => (
                          <span key={winner.driverRef}>
                            {index > 0 && (
                              <span className="round-winner-shared" aria-hidden="true">
                                shared with
                              </span>
                            )}
                            <span className="standings-name">
                              {winner.forename} {winner.surname}
                            </span>
                            <span className="standings-team">{winner.teamName}</span>
                          </span>
                        ))
                      )}
                    </td>
                    <td className="standings-optional">
                      {race.poleSitters.length > 0 ? (
                        <span className="standings-name">
                          {race.poleSitters[0]?.forename} {race.poleSitters[0]?.surname}
                        </span>
                      ) : (
                        /*
                         * §6.5.3 — a boundary, stated where it bites. Qualifying classifications
                         * begin in 1994 and are complete only from 2003, so most rows before then
                         * have no pole and that is the data rather than a fault. Neutral copy, no
                         * status colour.
                         */
                        <span className="round-pending">
                          {race.hasQualifying ? 'Not recorded' : 'No qualifying data'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

const PLACEHOLDER_TILES = [
  { key: 'races', label: 'Grands Prix', value: 0 },
  { key: 'with-results', label: 'With results', value: 0 },
  { key: 'first', label: 'First', value: 0 },
  { key: 'last', label: 'Most recent', value: 0 },
];
