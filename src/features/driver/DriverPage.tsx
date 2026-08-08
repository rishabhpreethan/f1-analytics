import type { Driver } from '@schemas/driver';
import { StatTiles } from '@/components/entity/StatTiles';
import { DataUnavailableState } from '@/components/ui/DataUnavailableState';
import { ErrorState } from '@/components/ui/ErrorState';
import { StateCard } from '@/components/ui/StateCard';
import { Users } from '@/components/ui/icons';
import { DriverMasthead } from './DriverMasthead';
import { DriverProgress } from './DriverProgress';
import { DriverSeasons } from './DriverSeasons';
import { driverCoverageNotes, driverTiles } from './presenters';

/**
 * **The driver page** — F4, DR-1 … DR-5. `DESIGN_SYSTEM.md` §6.6.2.
 *
 * A pure function of a payload and two error states, so the route component above it does the
 * fetching and this does the rendering — the same split `RaceDeepDive` and `SeasonHub` use, and the
 * reason this file can be tested against a fixture without a network or a router.
 *
 * **Assembled top-down, unlike the race page.** F3's ordering was bottom-up because most of the
 * archive is the *reduced* page: 484 races have no lap data at all. Nothing here is like that —
 * results exist from 1950, so every driver in the record has a complete profile, a complete season
 * table and a complete career-totals grid. What varies is the **coverage of two figures** (poles
 * and fastest laps) and the availability of **one measure** (qualifying), and both are handled
 * where they occur rather than by demoting the whole page.
 */

export interface DriverPageProps {
  driver: Driver | null;
  pending: boolean;
  /** `null` when the request succeeded. */
  error: { code: string } | null;
  onRetry: () => void;
}

export function DriverPage({ driver, pending, error, onRetry }: DriverPageProps) {
  if (error?.code === 'DATABASE_UNAVAILABLE') {
    return (
      <div className="shell-container entity-page px-4 md:px-6 xl:px-8">
        <DataUnavailableState />
      </div>
    );
  }

  const name = driver === null ? '' : `${driver.driver.forename} ${driver.driver.surname}`;

  return (
    <div className="shell-container entity-page px-4 md:px-6 xl:px-8">
      <DriverMasthead driver={driver} pending={pending} />

      {error?.code === 'NOT_FOUND' ? (
        <StateCard icon={<Users />} tone="neutral" as="h2" title="No such driver" code="NOT_FOUND">
          <p>
            There is no driver at this address. The record holds 881 drivers from 1950 onwards, and
            a driver is addressed by their reference — the same slug that appears in a race
            classification link.
          </p>
        </StateCard>
      ) : error !== null ? (
        <ErrorState
          title="This driver could not be loaded"
          detail="Nothing was lost — the record is read-only. Try again."
          code={error.code}
          onRetry={onRetry}
        />
      ) : (
        <>
          <section className="season-section" aria-labelledby="driver-totals-title">
            <div>
              <p className="season-eyebrow">
                <span className="accent-rule" aria-hidden="true" />
                The record
              </p>
              <h2 id="driver-totals-title" className="t-display-sm text-ink-primary mt-3">
                Career totals
              </h2>
              {/*
               * Trap 17, surfaced rather than absorbed: `entries` and `races` differ for 45
               * drivers, because 40 races between 1950 and 1964 classify one driver twice — he
               * took over a second car mid-race. Stated **only when they disagree**, because
               * printing it on 836 drivers would be noise around the one place it matters.
               */}
              {driver !== null && driver.totals.entries !== driver.totals.races && (
                <p className="t-sm text-ink-secondary mt-2">
                  {`${String(driver.totals.races)} races entered from ${String(driver.totals.entries)} classifications — this driver took over a second car mid-race, so some races classify them twice. Every figure below counts races, not classifications.`}
                </p>
              )}
            </div>

            <StatTiles
              ariaLabel="Career totals"
              pending={pending}
              tiles={driver === null ? PLACEHOLDER_TILES : driverTiles(driver.totals)}
              notes={
                driver === null
                  ? []
                  : driverCoverageNotes(driver.totals).map((note) => ({
                      key: note.key,
                      text: note.text,
                    }))
              }
            />
          </section>

          <DriverProgress driver={driver} pending={pending} />

          <DriverSeasons
            seasons={driver?.seasons ?? []}
            driverName={name}
            pending={pending || driver === null}
          />
        </>
      )}
    </div>
  );
}

/**
 * The loading grid's geometry (§7.5 — a skeleton mirrors what is coming). The labels are real and
 * the values are ignored while `pending`, so the grid holds its exact eight-column shape and
 * nothing below it moves when the query resolves.
 */
const PLACEHOLDER_TILES = [
  { key: 'starts', label: 'Starts', value: 0 },
  { key: 'wins', label: 'Wins', value: 0 },
  { key: 'podiums', label: 'Podiums', value: 0 },
  { key: 'points-finishes', label: 'Points finishes', value: 0 },
  { key: 'poles', label: 'Poles', value: 0 },
  { key: 'fastest-laps', label: 'Fastest laps', value: 0 },
  { key: 'dnfs', label: 'Retirements', value: 0 },
  { key: 'championships', label: 'Championships', value: 0 },
];
