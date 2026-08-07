import { useState } from 'react';
import { useParams } from 'react-router';
import { RankChart } from '@/components/charts';
import { DataUnavailableState } from '@/components/ui/DataUnavailableState';
import { ErrorState } from '@/components/ui/ErrorState';
import { StateCard } from '@/components/ui/StateCard';
import { CalendarDays } from '@/components/ui/icons';
import { useMeta } from '@/features/meta/useMeta';
import { RaceClassification } from '@/features/race/RaceClassification';
import { RaceDataState } from '@/features/race/RaceDataState';
import { LapTimeTrace, PitTimeline, StintChart } from '@/features/race/RaceLapCharts';
import { RaceMasthead } from '@/features/race/RaceMasthead';
import {
  resolveRaceRef,
  selectClassificationView,
  selectRaceCounts,
  selectRaceDataStates,
} from '@/features/race/selectors';
import { selectRankChart } from '@/features/race/series';
import { useRace, useRaceLaps, useRaceStints, useRetryRace } from '@/features/race/useRace';
import { snapToPositionTick } from '@/features/season/progression';

/**
 * `/seasons/:year/races/:round` — the race deep dive.
 *
 * **This is the feature boundary, so this is the only thing here that fetches** (`ARCHITECTURE.md`
 * §3). It resolves the URL, calls the hooks, runs the pure selectors, and hands plain values down.
 *
 * ---
 *
 * ## The page is assembled bottom-up, and that is the whole design
 *
 * §6.6.1: **results exist 1950+, lap data 1996+, pit data 2011+**, and 484 races predate 1990 with
 * **not one lap row between them**. So the reduced page is the *majority case across the archive*,
 * not an edge case — and the classification table is the spine while every chart is an addition that
 * may be absent, each replaced by a neutral state carrying §6.5.3's three-part copy.
 *
 * A race page that led with four empty plots for 1988 would be the defect this ordering prevents.
 *
 * **The lap query only fires when the race says it has laps.** `useRaceLaps` takes the payload rather
 * than a year and a round for exactly that reason: 1988 R1 costs 9.4 KB and reports
 * `hasLapData: false`, where a client fetching laps blindly would pull ~99 KB to learn there are none.
 *
 * **A bad URL parameter is named, not defaulted.** Unlike the season hub — which can show the latest
 * season and a notice — there is no "latest race" a reader who typed a wrong round would have meant.
 * So `resolveRaceRef` reports which parameter was wrong and this explains it in a sentence, which
 * still satisfies §5's "never a blank page, never a crash".
 */
export function RaceDeepDive() {
  const { year: yearParam, round: roundParam } = useParams();
  const ref = resolveRaceRef(yearParam, roundParam);
  const address = ref.status === 'resolved' ? { year: ref.year, round: ref.round } : null;

  const meta = useMeta();
  const race = useRace(address);
  const laps = useRaceLaps(race.data);
  /* A third query, and it fires only when the payload says there are pit stops. 2021 R12 — the
   * Belgian Grand Prix that ran two laps behind the safety car — has lap rows and no stops, which is
   * the one race in the data where `hasPitData` is false inside its coverage window. */
  const stints = useRaceStints(race.data);
  const retry = useRetryRace(address);

  /* The whole field is the default: §6.5.4a's rank chart plots the field as context and caps the
   * emphasised set at four. Nothing is selected until the reader chooses, so the resting state is the
   * shape of the race rather than an arbitrary four drivers. */
  const [selected, setSelected] = useState<string[]>([]);
  /* RD-2's selection is separate from RD-1's: bringing a driver forward in the rank chart and
   * plotting their lap times are different questions, and sharing one list would make answering one
   * silently change the other. */
  const [traced, setTraced] = useState<string[]>([]);

  if (ref.status === 'invalid') {
    return (
      <div className="shell-container season px-4 md:px-6 xl:px-8">
        <StateCard
          icon={<CalendarDays />}
          tone="neutral"
          title={ref.reason === 'year' ? 'That is not a season' : 'That is not a round'}
          code="BAD_REQUEST"
        >
          <p>
            {ref.reason === 'year'
              ? `A season is four digits — “${ref.value}” isn’t one.`
              : `A round is a number from 1 upwards — “${ref.value}” isn’t one.`}
          </p>
        </StateCard>
      </div>
    );
  }

  const unavailable =
    meta.error?.code === 'DATABASE_UNAVAILABLE' || race.error?.code === 'DATABASE_UNAVAILABLE';

  const data = race.data;
  const pending = data === undefined && race.error === null;

  const counts = data === undefined ? null : selectRaceCounts(data);
  const classification = data === undefined ? [] : selectClassificationView(data);
  const states =
    data === undefined || meta.data === undefined ? null : selectRaceDataStates(meta.data, data);

  const rank = laps.data === undefined ? null : selectRankChart(laps.data);

  return (
    <div className="shell-container season px-4 md:px-6 xl:px-8">
      <RaceMasthead
        race={data ?? null}
        counts={counts}
        raceLaps={data?.raceLaps ?? null}
        pending={pending}
      />

      {unavailable ? (
        <DataUnavailableState />
      ) : race.error?.code === 'NOT_FOUND' ? (
        <StateCard
          icon={<CalendarDays />}
          tone="neutral"
          as="h2"
          title="No such race"
          code="NOT_FOUND"
        >
          <p>{`There is no round ${String(ref.round)} in the ${String(ref.year)} season.`}</p>
        </StateCard>
      ) : race.error !== null ? (
        <ErrorState
          title="This race could not be loaded"
          detail="Nothing was lost — the record is read-only. Try again."
          code={race.error.code}
          onRetry={retry}
        />
      ) : (
        <>
          <RaceClassification
            rows={classification}
            year={ref.year}
            raceName={data?.name ?? ''}
            notice={states?.results.kind === 'notRun' ? states.results.notice : null}
            pending={pending}
          />

          {/*
           * RD-1, the flagship — and the first thing to go when a race predates 1996, which is most
           * of them. `RaceDataState` replaces it with a neutral card naming the boundary and what is
           * available instead; it is never a `caution` colour, because the sport's history is not a
           * fault (§3.4.3).
           */}
          {states !== null && states.laps.kind !== 'available' ? (
            <RaceDataState title="Position by lap" state={states.laps} />
          ) : (
            <section className="season-section" aria-labelledby="race-rank-title">
              <div>
                <p className="season-eyebrow">
                  <span className="accent-rule" aria-hidden="true" />
                  The race, plotted
                </p>
                <h2 id="race-rank-title" className="t-display-sm text-ink-primary mt-3">
                  How the order changed
                </h2>
              </div>

              <div className="season-panel season-progression">
                {laps.error !== null ? (
                  <ErrorState
                    title="This chart could not load"
                    detail="The lap-by-lap data is a separate request from the rest of this page."
                    code={laps.error.code}
                    onRetry={retry}
                  />
                ) : (
                  <RankChart
                    series={(rank?.series ?? []).map((s) => ({
                      /* `driverRef` alone is safe as a key **only** for lap payloads: none of the 40
                       * races that classify a driver twice has a lap row (trap 17). That is a fact
                       * about this dump, not a consequence of the 1996 boundary, so it is stated
                       * rather than assumed — the classification table uses the composite key. */
                      reference: s.driverRef,
                      teamReference: s.colorRef,
                      label: s.label,
                      shortLabel: s.label,
                      points: s.points.map((p) => ({ x: p.lap, y: p.position })),
                    }))}
                    selected={selected}
                    {...(rank?.deepestPosition == null
                      ? {}
                      : { fieldSize: snapToPositionTick(rank.deepestPosition) })}
                    title="Position by lap"
                    subtitle={`${String(rank?.series.length ?? 0)} drivers · ${String(data?.raceLaps ?? 0)} laps`}
                    ariaLabel={`Position held by every driver after each lap of the ${String(ref.year)} ${data?.name ?? 'race'}.`}
                    caption="Position on each lap, for the whole field. Select up to four drivers to bring them forward; the rest stay as context."
                    state={laps.isPending ? 'loading' : rank === null ? 'empty' : 'ready'}
                    xTitle="Lap"
                    formatX={(lap) => `L${String(lap)}`}
                    formatXLong={(lap) => `Lap ${String(lap)}`}
                  />
                )}
              </div>

              {rank !== null && rank.series.length > 0 && (
                <fieldset className="season-select-field">
                  <legend className="season-select-legend">
                    {`Bring forward — ${String(selected.length)} of 4`}
                  </legend>
                  {rank.series.map((s) => {
                    const on = selected.includes(s.driverRef);
                    return (
                      <button
                        key={s.driverRef}
                        type="button"
                        className="season-entity-chip"
                        aria-pressed={on}
                        disabled={!on && selected.length >= 4}
                        onClick={() => {
                          setSelected(
                            on
                              ? selected.filter((entry) => entry !== s.driverRef)
                              : [...selected, s.driverRef],
                          );
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </fieldset>
              )}
            </section>
          )}

          {/*
           * RD-2 — inside the lap window, so it shares the rank chart's availability. Its own
           * section rather than a tab: §6.5.4 fixes the form by scope, and a reader comparing four
           * drivers' pace wants the order chart still on screen above it.
           */}
          {states !== null && states.laps.kind === 'available' && laps.data !== undefined && (
            <section className="season-section" aria-labelledby="race-pace-title">
              <div>
                <p className="season-eyebrow">
                  <span className="accent-rule" aria-hidden="true" />
                  The pace
                </p>
                <h2 id="race-pace-title" className="t-display-sm text-ink-primary mt-3">
                  How fast they went
                </h2>
              </div>

              <LapTimeTrace laps={laps.data} selected={traced} onSelect={setTraced} />
            </section>
          )}

          {/*
           * RD-3 and RD-7 — the **2011** boundary, which is a different one from RD-1's 1996. A 1996
           * race therefore shows lap charts with no strategy layer, and that is a designed state
           * rather than a gap: `RaceDataState` names which dataset is missing and from when it exists.
           */}
          <section className="season-section" aria-labelledby="race-strategy-title">
            <div>
              <p className="season-eyebrow">
                <span className="accent-rule" aria-hidden="true" />
                The strategy
              </p>
              <h2 id="race-strategy-title" className="t-display-sm text-ink-primary mt-3">
                When they stopped
              </h2>
            </div>

            {states !== null && states.pits.kind !== 'available' ? (
              <RaceDataState title="Stints and pit stops" state={states.pits} />
            ) : stints.error !== null ? (
              <ErrorState
                title="The strategy data could not load"
                detail="Stints and pit stops are a separate request from the rest of this page."
                code={stints.error.code}
                onRetry={retry}
              />
            ) : stints.data === undefined ? null : (
              <>
                <StintChart stints={stints.data} />
                <PitTimeline stints={stints.data} />
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
