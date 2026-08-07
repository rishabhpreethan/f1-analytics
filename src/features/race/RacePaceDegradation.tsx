import { useState } from 'react';
import { ScatterChart, TREND_R2_FLOOR } from '@/components/charts';
import { formatDuration } from '@/lib/format';
import type { RaceLaps, RaceStints } from '@schemas/race';
import {
  selectInferredSafetyCarLaps,
  selectPaceDegradation,
  selectPitLapsByDriver,
  SAFETY_CAR_RATIO,
} from './pace';
import { selectDriverShortLabel } from './selectors';
import { mergeAdjacent } from './bands';

/**
 * **RD-4 — pace degradation, and the honesty requirements are the feature.**
 *
 * A per-stint least-squares fit of lap time against lap number. The arithmetic is entirely the
 * `developer`'s (`pace.ts`); what this file owns is the three places the presentation could tell a lie
 * and does not.
 *
 * **1. The trend is dashed and the data is solid.** `ScatterChart` enforces it; the reason is that a
 * fit is a claim and the points are what happened. A solid line through a scatter is the most common
 * way a chart launders a model into a fact.
 *
 * **2. A fit that explains nothing is not drawn.** `fitLinear` returns `r2` and its own comment calls
 * it *"the honesty term"*, because a four-lap stint will happily produce a confident-looking slope. So
 * a trend is drawn only above `TREND_R2_FLOOR` and **the number is always in the table**, where a
 * reader can see that the line they are not being shown would have explained 12% of the variation.
 * The floor is a judgement and labelled as one — there is no ground truth for tyre degradation here.
 *
 * **3. An inferred neutralisation is hatched and named as inferred.** `REQUIREMENTS.md` RD-4 and
 * `DATABASE.md` §6.9 both say it: **there is no safety-car flag anywhere in the data.** So the copy
 * says *"likely safety car or red flag"* and never "safety car", the band is hatch rather than fill
 * (rung 4 already means "a different kind of thing"), and the note states the method rather than
 * presenting its output as a finding.
 *
 * **The detection's accuracy is unverified by construction, not merely unmeasured.** There is no flag
 * to compare `SAFETY_CAR_RATIO` against, so no false-positive rate can be computed — not now and not
 * later. The label carries that uncertainty because nothing else can.
 */

export interface PaceDegradationProps {
  laps: RaceLaps;
  stints: RaceStints | null;
}

export function PaceDegradation({ laps, stints }: PaceDegradationProps) {
  /*
   * One driver at a time, and that is the form rather than a limitation: RD-4 asks whether *this car*
   * slowed through *this stint*, and two drivers' stints on one plot share no boundaries, so the fits
   * would be over incomparable windows.
   */
  const [driverRef, setDriverRef] = useState<string | null>(null);
  const chosen = laps.drivers.find((d) => d.driverRef === driverRef) ?? laps.drivers[0];

  const inferred = selectInferredSafetyCarLaps(laps);
  const bands = mergeAdjacent(inferred.map((slow) => slow.lap));

  if (chosen === undefined) return null;

  /*
   * Stints come from the pit payload, which sits behind a *later* boundary than laps (2011 vs 1996).
   * With no stints there is still one implicit stint — the whole race — and a fit over it is the
   * honest reduced answer rather than an absent section.
   */
  const driverStints = stints?.drivers.find((d) => d.driverRef === chosen.driverRef)?.stints ?? [];
  const pitLaps =
    stints === null ? [] : (selectPitLapsByDriver(stints).get(chosen.driverRef) ?? []);
  const wholeRace =
    driverStints.length > 0
      ? driverStints
      : [
          {
            stint: 1,
            fromLap: Math.min(...chosen.laps.map((l) => l.lap)),
            toLap: Math.max(...chosen.laps.map((l) => l.lap)),
            laps: chosen.laps.length,
            endedByStop: null,
          },
        ];

  const degradation = selectPaceDegradation(chosen, wholeRace, pitLaps);

  const groups = degradation.map((entry) => ({
    reference: `stint-${String(entry.stint.stint)}`,
    teamReference: chosen.teamRef,
    label: `Stint ${String(entry.stint.stint)}`,
    points: entry.laps.map((lap) => ({ x: lap.lap, y: lap.timeMs })),
    fit:
      entry.fit === null
        ? null
        : {
            slope: entry.fit.slopeMsPerLap,
            intercept: entry.fit.interceptMs,
            r2: entry.fit.r2,
            n: entry.fit.n,
          },
  }));

  /* Every timed lap the fits did not use: lap 1, the in-laps and the out-laps. Counted and stated,
   * the same way the off-scale caret states its own count rather than quietly dropping laps. */
  const timed = chosen.laps.filter((lap) => lap.timeMs !== null && !lap.isDeleted).length;
  const fitted = groups.reduce((total, group) => total + group.points.length, 0);
  const excluded = Math.max(0, timed - fitted);

  const weakFits = groups.filter((g) => g.fit != null && g.fit.r2 < TREND_R2_FLOOR);

  const notes: string[] = [];

  if (excluded > 0) {
    notes.push(
      `${String(excluded)} of ${String(timed)} timed laps are excluded from the trends: the first lap, and each lap into and out of the pits. They distort a degradation fit without saying anything about tyre wear.`,
    );
  }

  if (bands.length > 0) {
    /*
     * **The wording is load-bearing and is §6.6.1's.** "Likely safety car or red flag", never "safety
     * car": the heuristic cannot separate a safety car from a red flag, a virtual safety car, a wet
     * restart or a lap behind a recovery vehicle. All of them mean the field was not racing, which is
     * the property that disqualifies a lap — and none of them is in the data.
     */
    notes.push(
      `The hatched laps were ${String(Math.round((SAFETY_CAR_RATIO - 1) * 100))}% or more slower than this race's typical lap across the whole field, which usually means a likely safety car or red flag. This is inferred from the lap times themselves — the record carries no flag for it — so treat it as a probable neutralisation rather than a fact.`,
    );
  }

  if (weakFits.length > 0) {
    notes.push(
      weakFits.length === 1
        ? `One stint's laps are too scattered to draw a trend through. Its slope and r² are in the table.`
        : `${String(weakFits.length)} stints' laps are too scattered to draw a trend through. Their slopes and r² are in the table.`,
    );
  }

  return (
    <div className="season-subsection">
      <h3 className="t-display-xs text-ink-primary">Pace through a stint</h3>

      <div className="season-panel season-progression">
        <ScatterChart
          groups={groups}
          bands={bands}
          title="Lap time within each stint"
          subtitle={`${selectDriverShortLabel(chosen)} · ${String(groups.length)} ${groups.length === 1 ? 'stint' : 'stints'}`}
          ariaLabel={`How ${chosen.surname}'s lap time changed through each stint, with a fitted trend per stint.`}
          caption="Each point is a clean racing lap. The dashed line is a least-squares trend through that stint — a model of the pace, not a measurement of it, which is why it is drawn differently from the laps."
          notes={notes}
          state={groups.length === 0 ? 'empty' : 'ready'}
          stateCopy={{ body: 'This driver has no clean racing laps to fit a trend through.' }}
          xTitle="Lap"
          yTitle="Lap time"
          formatX={(lap) => String(lap)}
          formatY={formatDuration}
        />
      </div>

      <fieldset className="season-select-field">
        <legend className="season-select-legend">Driver</legend>
        {laps.drivers.map((driver) => {
          const on = driver.driverRef === chosen.driverRef;
          return (
            <button
              key={driver.driverRef}
              type="button"
              className="season-entity-chip"
              aria-pressed={on}
              onClick={() => {
                setDriverRef(driver.driverRef);
              }}
            >
              {selectDriverShortLabel(driver)}
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}
