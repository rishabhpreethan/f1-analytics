import type { DriverRace, DriverSeason, DriverTotals } from '@schemas/driver';
import type { RibbonSeason } from '@/components/entity/ribbon';
import type { StatTile } from '@/components/entity/StatTiles';

/**
 * **Presentation grouping for the driver page.**
 *
 * The boundary this file sits on, stated once because it is easy to drift across: `selectors.ts` is
 * the data layer and belongs to the engineer — it shapes an API payload and is where a data trap
 * gets violated silently. `presenters.ts` is the designer's, and it groups, labels and folds values
 * the payload has **already made safe**. `src/features/season/presenters.ts` set the precedent with
 * `groupStandings` and `teamLineage`.
 *
 * Everything below reads fields whose trap handling is already done upstream: `positionsGained` is
 * `null` wherever the metric does not apply, `points` is a championship figure and never a sum,
 * `position` is `null` for unranked rather than for last. Nothing here re-derives any of that; it
 * folds rows into rows.
 */

/* -------------------------------------------------------------------- the career ribbon */

/**
 * §7.9 — the driver's championship position by season.
 *
 * `isChampion` is carried from the payload, **never inferred from `position === 1`**. The payload
 * gates it on the season being complete, and that gate is live rather than theoretical: the 2026
 * snapshot in this data currently ranks Antonelli first with 12 of 22 rounds unrun.
 */
export function driverRibbon(seasons: readonly DriverSeason[]): RibbonSeason[] {
  return seasons.map((season) => {
    const detail = season.teams[0]?.name;
    return {
      year: season.year,
      position: season.position,
      champion: season.isChampion,
      ...(detail === undefined ? {} : { detail }),
    };
  });
}

/* ---------------------------------------------------------------------- the career totals */

/** Which coverage footnote a tile points at. One key per distinct *reason*, never per tile. */
export const QUALIFYING_NOTE = 'qualifying';
export const FASTEST_LAP_NOTE = 'fastest-lap';

/**
 * §6.6.2.2 — the eight figures, and the **denominator rule** applied to the two that need it.
 *
 * A coverage-limited count has three states and a boundary year can only express two:
 *
 * - denominator `0` → the figure **cannot be computed**, so the tile shows `—`. `0 poles` for
 *   Fangio is a false statement, not a low score.
 * - denominator `> 0` but below the driver's starts → the figure is real and **partial**; it is
 *   shown with a marker and the footnote says how partial.
 * - denominator equal to starts → complete, and nothing is explained.
 *
 * **Points is deliberately not one of the eight.** A career points total is trap 4 and §6.2 in one:
 * 24 point systems, several best-N eras, and no arithmetic that makes a 1950s total comparable to a
 * 2020s one. The counts above and the per-season points on the table below are the honest answers.
 */
export function driverTiles(totals: DriverTotals): StatTile[] {
  const covered = (denominator: number): boolean => denominator > 0 && denominator >= totals.starts;

  const figure = (value: number, denominator: number): number | null =>
    denominator === 0 ? null : value;

  return [
    { key: 'starts', label: 'Starts', value: totals.starts, emphasis: true },
    { key: 'wins', label: 'Wins', value: totals.wins, emphasis: true },
    { key: 'podiums', label: 'Podiums', value: totals.podiums },
    { key: 'points-finishes', label: 'Points finishes', value: totals.pointsFinishes },
    {
      key: 'poles',
      label: 'Poles',
      value: figure(totals.poles, totals.racesWithQualifying),
      ...(covered(totals.racesWithQualifying) ? {} : { note: QUALIFYING_NOTE }),
    },
    {
      key: 'fastest-laps',
      label: 'Fastest laps',
      value: figure(totals.fastestLaps, totals.racesWithFastestLapData),
      ...(covered(totals.racesWithFastestLapData) ? {} : { note: FASTEST_LAP_NOTE }),
    },
    { key: 'dnfs', label: 'Retirements', value: totals.dnfs },
    { key: 'championships', label: 'Championships', value: totals.championships, emphasis: true },
  ];
}

export interface CoverageNote {
  key: string;
  text: string;
}

/**
 * One sentence per distinct absent-or-partial window, in §6.5.3's three-part form: **where the
 * boundary is, which side this request falls on, and what is available instead.** The third is the
 * one that gets dropped and the only one that helps.
 */
export function driverCoverageNotes(totals: DriverTotals): CoverageNote[] {
  const notes: CoverageNote[] = [];

  if (totals.racesWithQualifying < totals.starts) {
    notes.push({
      key: QUALIFYING_NOTE,
      text:
        totals.racesWithQualifying === 0
          ? `Qualifying results are not recorded for any of this driver's races, so a pole count cannot be given. Qualifying classifications begin in 1994 and are complete from 2003. Race results, grid positions and championship standings are complete for this career.`
          : `Qualifying results are recorded for ${String(totals.racesWithQualifying)} of ${String(totals.starts)} starts, so the pole count covers only those. Qualifying classifications begin in 1994 and are complete from 2003. Race results, grid positions and championship standings are complete for this career.`,
    });
  }

  if (totals.racesWithFastestLapData < totals.starts) {
    notes.push({
      key: FASTEST_LAP_NOTE,
      text:
        totals.racesWithFastestLapData === 0
          ? `Fastest laps are not recorded for any of this driver's races, so a count cannot be given. The fastest-lap flag exists for 1958 and 1959 and again from 2004, and for no season in between. Finishing positions and points are complete for this career.`
          : `Fastest laps are recorded for ${String(totals.racesWithFastestLapData)} of ${String(totals.starts)} starts, so the count covers only those. The flag exists for 1958 and 1959 and again from 2004, and for no season in between. Finishing positions and points are complete for this career.`,
    });
  }

  return notes;
}

/* ------------------------------------------------------- DR-4 / DR-5, per season */

/** The two measures the one chart switches between (§6.6.2.4). */
export type ProgressMetric = 'grid' | 'qualifying';

export interface SeasonProgress {
  year: number;
  /** Mean places gained across the season's counted races. */
  mean: number;
  /** How many races the mean is over — the caption's denominator. */
  counted: number;
  /** The team the driver drove most races for that season, for the bar's colour. */
  teamRef: string;
}

/**
 * Fold the career's races into one mean per season, for whichever measure is selected.
 *
 * **Races where the measure does not apply are excluded and counted, never treated as zero.** For
 * `grid` the payload has already done that work — `positionsGained` is `null` for an unclassified
 * finish, a pit-lane start (`grid = 0`, 267 race entries) and an unknown grid — so this only has to
 * respect the null. For `qualifying` the pair is `qualifyingPosition` and `position`, and a race
 * missing either is not a zero-place change; it is a race the question cannot be asked of.
 *
 * A season with **no** counted race produces **no row**, rather than a row at zero. A zero bar says
 * "started and finished level all year", which is a completely different claim from "this season is
 * outside the measure's coverage".
 */
export function seasonProgress(
  races: readonly DriverRace[],
  metric: ProgressMetric,
): SeasonProgress[] {
  const byYear = new Map<number, { total: number; counted: number; teams: Map<string, number> }>();

  for (const race of races) {
    const delta =
      metric === 'grid'
        ? race.positionsGained
        : race.qualifyingPosition !== null && race.position !== null
          ? race.qualifyingPosition - race.position
          : null;

    let bucket = byYear.get(race.year);
    if (bucket === undefined) {
      bucket = { total: 0, counted: 0, teams: new Map() };
      byYear.set(race.year, bucket);
    }
    /* The team tally counts **every** race of the season, not only the counted ones: the row's
     * colour should say who the driver drove for, and a season whose only measurable races were
     * with the second of two teams must not be painted as if the first never happened. */
    bucket.teams.set(race.teamRef, (bucket.teams.get(race.teamRef) ?? 0) + 1);

    if (delta === null) continue;
    bucket.total += delta;
    bucket.counted += 1;
  }

  const rows: SeasonProgress[] = [];
  for (const [year, bucket] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    if (bucket.counted === 0) continue;
    /* Ties broken by reference ascending, so the colour is stable across reloads rather than
     * depending on `Map` insertion order for a driver who split a season evenly. */
    const teamRef = [...bucket.teams.entries()].sort(
      (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
    )[0]?.[0];
    if (teamRef === undefined) continue;
    rows.push({ year, mean: bucket.total / bucket.counted, counted: bucket.counted, teamRef });
  }
  return rows;
}

/**
 * How many seasons the selected measure could not be computed for, and how many it could. The
 * partial note (§6.5.3) is generated from this rather than from a year, because the qualifying
 * window is **holed** and "seasons before 1994" would understate it by six years.
 */
export function progressCoverage(
  races: readonly DriverRace[],
  metric: ProgressMetric,
): { seasonsCovered: number; seasonsTotal: number } {
  const all = new Set(races.map((race) => race.year));
  return {
    seasonsCovered: seasonProgress(races, metric).length,
    seasonsTotal: all.size,
  };
}
