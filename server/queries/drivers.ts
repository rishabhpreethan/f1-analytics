import type { QualifyingSession } from '../schemas/entity';
import type {
  Driver,
  DriverRace,
  DriverSeason,
  DriverTotals,
  GridVsFinish,
  QualifyingVsRace,
} from '../schemas/driver';
import type { DriverTeam } from '../schemas/season';
import { classifyAdjustment, readSeasonCompleteness, toBoolean } from './seasons';
import { decodeOutcome, toGrid } from './race';
import { prepared } from './prepared';

/**
 * ALL SQL for the driver profile (ARCHITECTURE.md §3). Every statement is parameterised —
 * named parameters, never interpolation, not even for a slug that has already been
 * allowlisted by `referenceParamSchema` (S-1).
 *
 * ========================================================= why these are not `v_race`
 *
 * **The canonical views are entered by `(year, round)`, and this surface is entered by a
 * driver.** Measured warm on this machine with `EXPLAIN QUERY PLAN` and 30 timed runs,
 * both statements returning the **same 17 columns and the same 438 rows** for `alonso`,
 * the deepest career in the archive:
 *
 * | Shape | Plan | p50 |
 * |---|---|---|
 * | `SELECT … FROM v_race WHERE driver_ref = ?` | `SEARCH ses USING idx_session_type` — every one of 26,093 race entries produced, driver filtered last | **20–23 ms** |
 * | `v_race JOIN <entry-id CTE>` | the same, plus a bloom filter | **worse still** |
 * | the `driver_entry` CTE below | `idx_driver_ref` → `idx_td_driver` → `idx_re_td` → `idx_se_re`, all covering | **5–8 ms** |
 *
 * The view cannot be entered from the driver side: the planner reaches `session_entry`
 * through `session`, so a `driver_ref` predicate can only ever be applied after the rows
 * are produced. Anchoring on the driver **is** re-deriving four joins of the canonical
 * path, which ARCHITECTURE.md §3 otherwise forbids, so it is recorded as a deliberate
 * amendment in §10 #32 rather than taken quietly. The four joins are exactly the
 * `driver → team_driver → round_entry → session_entry` spine; everything downstream of
 * `session_entry` (round, season, circuit, team) is joined the same way the view joins it.
 *
 * `MATERIALIZED` is not decoration. Without it SQLite inlines the CTE and re-plans back to
 * the view's shape; with it the driver's ~440 entry ids are built once through the index
 * path and everything else hangs off them. `drivers.test.ts` asserts the plan, because
 * both shapes return identical data and only one of them is anchored on the parameter.
 *
 * The figures move by ~30 % between runs of the same process, so they are quoted as
 * ranges. The ratio is what the decision rests on, not the absolute.
 *
 * ===================================================================== S-10, and its bound
 *
 * **No statement here reads `lap` or `pit_stop`.** The deepest career in the archive is
 * 438 races, so every result set is bounded by one driver's entries; the largest measured
 * is 991 rows (Alonso's qualifying, all segments across 23 seasons). There is no `limit`,
 * `sort` or `filter` parameter to allowlist, and no parameter that widens a result set —
 * `:reference` selects exactly one driver.
 *
 * The one statement that reads a whole table is `SQL_DRIVER_CHAMPIONSHIPS`, whose
 * `last_snapshot` CTE groups all 36,091 `driver_championship` rows to find each season's
 * final snapshot. That is **5 ms warm and independent of the parameter** — no request can
 * make it bigger — and `driver_championship` is the table `DATABASE.md` §8 names as the
 * cheapest in the schema. The alternative (a correlated `max()` per year) measured 28 ms,
 * five times worse.
 *
 * ==================================================================== traps handled here
 *
 *  3  `position IS NULL` is never read as a DNF. `status` is decoded through §3.
 *  4  championship points and titles are **read** from `driver_championship`, never
 *     summed from `session_entry` (DL-8). Per-race `points` is published as a per-race
 *     figure and nothing here adds it across seasons.
 *  9  `grid = 0` is a pit-lane start, translated at the boundary by `toGrid` and excluded
 *     from the positions-gained metric.
 * 11  no internal integer id reaches a payload.
 * 14  `team_driver.role` and `adjustment_type` are never selected for display;
 *     `classifyAdjustment` derives an observable state instead.
 * 15  `r.number IS NOT NULL` on every statement — a cancelled round has no number and
 *     cannot appear in a career list keyed by one.
 * 17  **the load-bearing one here.** 83 (driver, race) pairs hold 172 classification rows.
 *     `collapseRaces` folds them to one row per race; nothing downstream counts rows.
 * 18  `fastest_lap_rank` is used, and its limits are published rather than worked around —
 *     see `schemas/driver.ts`. The `lap` table would be the better authority for one
 *     session and is unusable for a 438-race career (DL-5).
 * 22  `detail` is passed through for display and never parsed for a figure.
 */

/* ------------------------------------------------------------------------------- SQL */

/** Existence, so a well-formed slug the dataset does not hold is a **404** before any work. */
const SQL_DRIVER_EXISTS = `SELECT 1 AS present FROM driver WHERE reference = @ref`;

/** DR-1's identity fields. `abbreviation` is null for 774 of 881 drivers. */
const SQL_DRIVER_PROFILE = `
SELECT reference            AS ref,
       abbreviation         AS code,
       forename, surname,
       nationality          AS nationality,
       country_code         AS countryCode,
       permanent_car_number AS permanentCarNumber,
       date_of_birth        AS dateOfBirth
FROM driver
WHERE reference = @ref`;

/**
 * Every race classification row for one driver — the input to DR-2, DR-3, DR-4 and DR-5.
 *
 * Two `EXISTS` clauses answer questions that would otherwise be guessed from an absence:
 *
 * - `roundHasQualifying` separates "this weekend has no qualifying in the dataset" from
 *   "it does and this driver is not in it". Counted per year, the first case covers most
 *   of 1996–2002 and all of 1950–1993.
 * - `roundHasFastestLapData` does the same for the fastest-lap flag, which is present on
 *   1958–59 and 2004+ and absent for the 44 seasons between.
 *
 * Both are bounded to one round and short-circuit on the first row.
 */
export const SQL_DRIVER_RACES = `
WITH driver_entry AS MATERIALIZED (
  SELECT se.id             AS entry_id,
         se.session_id     AS session_id,
         td.team_id        AS team_id,
         re.car_number     AS car_number,
         se.position       AS position,
         se.grid           AS grid,
         se.points         AS points,
         se.status         AS status,
         se.detail         AS detail,
         se.is_classified  AS is_classified,
         se.laps_completed AS laps_completed,
         se.fastest_lap_rank AS fastest_lap_rank
  FROM driver d
  JOIN team_driver td   ON td.driver_id = d.id
  JOIN round_entry re   ON re.team_driver_id = td.id
  JOIN session_entry se ON se.round_entry_id = re.id
  WHERE d.reference = @ref
)
SELECT s.year          AS year,
       r.number        AS round,
       r.name          AS name,
       r.date          AS date,
       c.reference     AS circuitRef,
       c.name          AS circuitName,
       t.reference     AS teamRef,
       t.name          AS teamName,
       de.car_number   AS carNumber,
       de.position     AS position,
       de.grid         AS grid,
       de.points       AS points,
       de.status       AS status,
       de.detail       AS detail,
       de.is_classified   AS isClassified,
       de.laps_completed  AS lapsCompleted,
       de.fastest_lap_rank AS fastestLapRank,
       EXISTS (SELECT 1 FROM session_entry fe
               WHERE fe.session_id = ses.id AND fe.fastest_lap_rank = 1) AS roundHasFastestLapData,
       EXISTS (SELECT 1 FROM session q
               JOIN session_entry qe ON qe.session_id = q.id
               WHERE q.round_id = r.id
                 AND q.type IN ('Q1','Q2','Q3','QA','QB')
                 AND qe.position IS NOT NULL) AS roundHasQualifying
FROM driver_entry de
JOIN session ses    ON ses.id = de.session_id AND ses.type = 'R'
JOIN round r        ON r.id = ses.round_id
JOIN season s       ON s.id = r.season_id
LEFT JOIN circuit c ON c.id = r.circuit_id
JOIN team t         ON t.id = de.team_id
WHERE r.number IS NOT NULL
ORDER BY s.year, r.number, (de.position IS NULL), de.position`;

/**
 * The driver's qualifying classifications, every segment, for DR-5.
 *
 * All five session types are returned and the **overall** result is chosen in
 * `pickQualifying` rather than in SQL, because "the highest segment the driver reached"
 * is a rule about the sport's format that a reader has to be able to check. Sprint
 * qualifying (`SQ1`–`SQ3`) is deliberately absent: it sets the sprint grid, not the race
 * grid, and DR-5 compares against the race.
 */
export const SQL_DRIVER_QUALIFYING = `
WITH driver_entry AS MATERIALIZED (
  SELECT se.session_id AS session_id, se.position AS position
  FROM driver d
  JOIN team_driver td   ON td.driver_id = d.id
  JOIN round_entry re   ON re.team_driver_id = td.id
  JOIN session_entry se ON se.round_entry_id = re.id
  WHERE d.reference = @ref
)
SELECT s.year    AS year,
       r.number  AS round,
       ses.type  AS sessionType,
       de.position AS position
FROM driver_entry de
JOIN session ses ON ses.id = de.session_id AND ses.type IN ('Q1','Q2','Q3','QA','QB')
JOIN round r     ON r.id = ses.round_id
JOIN season s    ON s.id = r.season_id
WHERE r.number IS NOT NULL AND de.position IS NOT NULL`;

/**
 * The driver's standing at the end of every season they contested — `DATABASE.md` §6.6's
 * rule applied to all seasons at once rather than one.
 *
 * `last_snapshot` is grouped over the whole table because a season's final snapshot is a
 * property of the **season**, not of the driver: a driver who stopped racing in round 8
 * still carries a row at round 22, and taking their own last row would report a mid-season
 * standing as a final one. Verified that this is complete rather than merely correct —
 * every driver who raced in 1976, 2005 and 2024 appears in that season's final snapshot
 * (47/47, 27/27, 24/24), as do all 23 of Alonso's seasons.
 *
 * `round_number * 1000 + session_number` is §6.6's key verbatim; `session_number` reaches
 * 9 in the data, comfortably inside the multiplier.
 */
export const SQL_DRIVER_CHAMPIONSHIPS = `
WITH last_snapshot AS (
  SELECT year, max(round_number * 1000 + session_number) AS k
  FROM driver_championship
  GROUP BY year
)
SELECT dc.year            AS year,
       dc.points          AS points,
       dc.position        AS position,
       dc.win_count       AS wins,
       dc.highest_finish  AS bestFinish,
       dc.adjustment_type AS adjustmentType
FROM driver_championship dc
JOIN driver d ON d.id = dc.driver_id
JOIN last_snapshot ls
  ON ls.year = dc.year AND (dc.round_number * 1000 + dc.session_number) = ls.k
WHERE d.reference = @ref
ORDER BY dc.year`;

const Q_DRIVER_EXISTS = prepared(SQL_DRIVER_EXISTS);
const Q_DRIVER_PROFILE = prepared(SQL_DRIVER_PROFILE);
const Q_DRIVER_RACES = prepared(SQL_DRIVER_RACES);
const Q_DRIVER_QUALIFYING = prepared(SQL_DRIVER_QUALIFYING);
const Q_DRIVER_CHAMPIONSHIPS = prepared(SQL_DRIVER_CHAMPIONSHIPS);

/* ------------------------------------------------------------------------- row shapes */

interface ProfileRow {
  ref: string;
  code: string | null;
  forename: string;
  surname: string;
  nationality: string | null;
  countryCode: string | null;
  permanentCarNumber: number | null;
  dateOfBirth: string | null;
}

export interface DriverRaceRow {
  year: number;
  round: number;
  name: string;
  date: string;
  circuitRef: string | null;
  circuitName: string | null;
  teamRef: string;
  teamName: string;
  carNumber: number | null;
  position: number | null;
  grid: number | null;
  points: number;
  status: number;
  detail: string;
  isClassified: number;
  lapsCompleted: number;
  fastestLapRank: number | null;
  roundHasFastestLapData: number;
  roundHasQualifying: number;
}

export interface DriverQualifyingRow {
  year: number;
  round: number;
  sessionType: string;
  position: number;
}

export interface DriverChampionshipRow {
  year: number;
  points: number;
  position: number | null;
  wins: number;
  bestFinish: number | null;
  adjustmentType: number | null;
}

/* ------------------------------------------------------- pure builders (no database) */

/**
 * Whole years between two ISO dates, or null when either is absent.
 *
 * Calendar arithmetic on the strings rather than `Date`, deliberately: `new Date('1911-07-02')`
 * is parsed as UTC midnight while `new Date(1911, 6, 2)` is local, and a birthday that
 * falls on the boundary would resolve differently depending on the server's zone. Both
 * inputs are `YYYY-MM-DD` in this database (verified: 0 of 865 dates of birth and 0 of
 * 1,173 round dates deviate), so comparing the month-day suffix lexicographically is exact.
 */
export function ageYears(dateOfBirth: string | null, on: string | null): number | null {
  if (dateOfBirth === null || on === null) return null;
  const bornYear = Number(dateOfBirth.slice(0, 4));
  const onYear = Number(on.slice(0, 4));
  if (!Number.isFinite(bornYear) || !Number.isFinite(onYear)) return null;
  const hadBirthday = on.slice(5, 10) >= dateOfBirth.slice(5, 10);
  const age = onYear - bornYear - (hadBirthday ? 0 : 1);
  return age < 0 ? null : age;
}

/**
 * §5.1's positions gained — `grid - position` — **or null where the metric does not
 * apply**, which is three distinct cases and not one.
 *
 * A number here always means a real place change, so 0 reads as "finished where it
 * started" and nothing else. Returning 0 for a retirement would put 61 zeroes into
 * Senna's mean and pull it toward the middle; returning 0 for a pit-lane start would
 * credit a car that started from nowhere with holding its place.
 */
export function positionsGained(
  gridPosition: number | null,
  position: number | null,
): number | null {
  if (gridPosition === null || position === null) return null;
  return gridPosition - position;
}

/**
 * The driver's overall qualifying classification for one weekend.
 *
 * **The highest segment reached wins**, because each segment ranks everyone who took part
 * in it: the five drivers knocked out in Q2 hold positions 11–15 *in Q2*, and the ten who
 * reach Q3 are re-ranked 1–10 there. So a driver's overall grid-order position is the one
 * from their last segment, and reading Q1 for everybody would report Verstappen 3rd on a
 * weekend he took pole (2024 R1, verified).
 *
 * `QA` and `QB` are single-classification formats and never coexist within a round —
 * 2005 used `QA` for rounds 1–6 and `QB` for 7–19, counted — so their relative order in
 * the priority list is unobservable and is fixed only so the function is total.
 */
const QUALIFYING_PRIORITY: readonly QualifyingSession[] = ['Q3', 'Q2', 'Q1', 'QA', 'QB'];

export function pickQualifying(
  rows: readonly { sessionType: string; position: number }[],
): { position: number; session: QualifyingSession } | null {
  for (const session of QUALIFYING_PRIORITY) {
    const hit = rows.find((row) => row.sessionType === session);
    if (hit !== undefined) return { position: hit.position, session };
  }
  return null;
}

const raceKey = (year: number, round: number): string => `${String(year)}:${String(round)}`;

/**
 * Fold classification rows into **one row per race** — trap 17, and the single most
 * consequential builder in this module.
 *
 * 83 (driver, race) pairs in the archive hold two or three rows, because a driver took
 * over a second car mid-race and both entries were classified. 1950 R7 lists Ascari on
 * car 16 (grid 2, `status 11` "Engine") *and* car 48 (P2, 3 points). Counting rows would
 * give him a retirement in a race he finished second in, and two starts for one race.
 *
 * **The best-positioned row is the race's result**, and the rows arrive ordered
 * `(position IS NULL), position` so the first one seen for a race is already it. Points
 * are **summed** across the entries, because both cars' scores are the driver's; grid is
 * taken from the result row, which is the car they were classified in.
 *
 * `entries` records how many rows were folded, so a surface can say "shared drive" rather
 * than the number quietly disappearing.
 */
export function collapseRaces(
  rows: readonly DriverRaceRow[],
  qualifying: readonly DriverQualifyingRow[],
): DriverRace[] {
  const qualifyingByRace = new Map<string, DriverQualifyingRow[]>();
  for (const row of qualifying) {
    const key = raceKey(row.year, row.round);
    const list = qualifyingByRace.get(key) ?? [];
    list.push(row);
    qualifyingByRace.set(key, list);
  }

  const byRace = new Map<string, DriverRace>();
  for (const row of rows) {
    const key = raceKey(row.year, row.round);
    const existing = byRace.get(key);
    if (existing !== undefined) {
      // A later row for the same race is by definition worse-positioned (the SQL orders
      // classified first, ascending), so only the additive facts move.
      existing.entries += 1;
      existing.points += row.points;
      existing.hasFastestLap = existing.hasFastestLap || row.fastestLapRank === 1;
      continue;
    }

    const grid = toGrid(row.grid);
    const quali = pickQualifying(qualifyingByRace.get(key) ?? []);
    byRace.set(key, {
      year: row.year,
      round: row.round,
      name: row.name,
      date: row.date,
      circuitRef: row.circuitRef,
      circuitName: row.circuitName,
      teamRef: row.teamRef,
      teamName: row.teamName,
      carNumber: row.carNumber,
      entries: 1,
      gridPosition: grid.gridPosition,
      gridStatus: grid.gridStatus,
      position: row.position,
      outcome: decodeOutcome(row.status),
      detail: row.detail,
      isClassified: toBoolean(row.isClassified),
      points: row.points,
      lapsCompleted: row.lapsCompleted,
      qualifyingPosition: quali?.position ?? null,
      qualifyingSession: quali?.session ?? null,
      roundHasQualifying: toBoolean(row.roundHasQualifying),
      hasFastestLap: row.fastestLapRank === 1,
      roundHasFastestLapData: toBoolean(row.roundHasFastestLapData),
      positionsGained: positionsGained(grid.gridPosition, row.position),
    });
  }

  return [...byRace.values()];
}

/** Did this race never begin for the driver? `DATABASE.md` §3's "never started" grouping. */
function isNonStart(race: DriverRace): boolean {
  return race.outcome === 'didNotStart' || race.outcome === 'didNotQualify';
}

function isRetirement(race: DriverRace): boolean {
  return race.outcome === 'accident' || race.outcome === 'mechanical';
}

/**
 * DR-2, from the collapsed races plus the championship snapshots.
 *
 * Every count here is over races, not rows, and `entries` is carried separately so the
 * difference stays visible. Verified against the record on the live database:
 * Fangio 51 starts / 24 wins / 35 podiums, Senna 161 / 41 / 80, Schumacher 307 starts of
 * 308 races with 91 wins, Clark 72 / 25, Ascari 32 / 13.
 */
export function buildTotals(
  races: readonly DriverRace[],
  entryCount: number,
  championships: number,
): DriverTotals {
  let starts = 0;
  let wins = 0;
  let podiums = 0;
  let pointsFinishes = 0;
  let poles = 0;
  let racesWithQualifying = 0;
  let fastestLaps = 0;
  let racesWithFastestLapData = 0;
  let dnfs = 0;
  let mechanicalDnfs = 0;
  let accidentDnfs = 0;
  let disqualifications = 0;

  for (const race of races) {
    if (!isNonStart(race)) starts += 1;
    if (race.position === 1) wins += 1;
    if (race.position !== null && race.position <= 3) podiums += 1;
    if (race.points > 0) pointsFinishes += 1;
    if (race.qualifyingPosition !== null) {
      racesWithQualifying += 1;
      if (race.qualifyingPosition === 1) poles += 1;
    }
    if (race.roundHasFastestLapData) racesWithFastestLapData += 1;
    if (race.hasFastestLap) fastestLaps += 1;
    if (isRetirement(race)) dnfs += 1;
    if (race.outcome === 'mechanical') mechanicalDnfs += 1;
    if (race.outcome === 'accident') accidentDnfs += 1;
    if (race.outcome === 'disqualified') disqualifications += 1;
  }

  return {
    entries: entryCount,
    races: races.length,
    starts,
    nonStarts: races.length - starts,
    wins,
    podiums,
    pointsFinishes,
    poles,
    racesWithQualifying,
    fastestLaps,
    racesWithFastestLapData,
    dnfs,
    mechanicalDnfs,
    accidentDnfs,
    disqualifications,
    championships,
  };
}

/**
 * DR-4's career figure, with the excluded races counted rather than dropped.
 *
 * `unclassified` and `pitLaneStarts` are not overlapping categories here: a race is tested
 * for a classified position first, so a pit-lane start that ended in retirement is counted
 * once, as unclassified. That makes the three exclusion counts plus `racesCounted` sum to
 * the number of races, which is the property that makes them readable as a caption.
 */
export function buildGridVsFinish(races: readonly DriverRace[]): GridVsFinish {
  let total = 0;
  let counted = 0;
  let gained = 0;
  let lost = 0;
  let held = 0;
  let unclassified = 0;
  let pitLaneStarts = 0;
  let unknownGrid = 0;
  let bestGain: number | null = null;
  let worstLoss: number | null = null;

  for (const race of races) {
    const delta = race.positionsGained;
    if (delta === null) {
      if (race.position === null) unclassified += 1;
      else if (race.gridStatus === 'pitLane') pitLaneStarts += 1;
      else unknownGrid += 1;
      continue;
    }
    counted += 1;
    total += delta;
    if (delta > 0) gained += 1;
    else if (delta < 0) lost += 1;
    else held += 1;
    if (bestGain === null || delta > bestGain) bestGain = delta;
    if (worstLoss === null || delta < worstLoss) worstLoss = delta;
  }

  return {
    racesCounted: counted,
    meanPositionsGained: counted === 0 ? null : total / counted,
    bestGain,
    worstLoss,
    gained,
    lost,
    held,
    excluded: { unclassified, pitLaneStarts, unknownGrid },
  };
}

/**
 * DR-5's career figure — the qualifying classification against the race result.
 *
 * Deliberately **not** the same metric as `buildGridVsFinish`: the grid is where the car
 * started after any penalty, the qualifying classification is what the driver earned, and
 * the two disagree exactly when a grid drop was applied.
 */
export function buildQualifyingVsRace(races: readonly DriverRace[]): QualifyingVsRace {
  let counted = 0;
  let deltaTotal = 0;
  let withQualifying = 0;
  let qualifyingTotal = 0;

  for (const race of races) {
    if (race.qualifyingPosition === null) continue;
    withQualifying += 1;
    qualifyingTotal += race.qualifyingPosition;
    if (race.position === null) continue;
    counted += 1;
    deltaTotal += race.qualifyingPosition - race.position;
  }

  return {
    racesCounted: counted,
    meanDelta: counted === 0 ? null : deltaTotal / counted,
    racesWithQualifying: withQualifying,
    meanQualifyingPosition: withQualifying === 0 ? null : qualifyingTotal / withQualifying,
  };
}

/**
 * DR-3, one row per season, with **every** team the driver drove for that season.
 *
 * The teams are derived from the race rows rather than from `team_driver`, so the round
 * span is the span they actually raced rather than the span they were contracted for.
 * 318 driver-seasons in the archive carry more than one team; ordering is by last round
 * then first round, matching `SQL_SEASON_DRIVER_TEAMS` in `queries/seasons.ts` so the two
 * surfaces list a mid-season change in the same order.
 */
export function buildSeasons(
  races: readonly DriverRace[],
  championships: readonly DriverChampionshipRow[],
  seasonComplete: ReadonlyMap<number, boolean>,
): DriverSeason[] {
  interface Accumulator {
    year: number;
    teams: Map<string, DriverTeam>;
    entries: number;
    starts: number;
    wins: number;
    podiums: number;
    bestFinish: number | null;
  }

  const byYear = new Map<number, Accumulator>();
  for (const race of races) {
    const acc = byYear.get(race.year) ?? {
      year: race.year,
      teams: new Map<string, DriverTeam>(),
      entries: 0,
      starts: 0,
      wins: 0,
      podiums: 0,
      bestFinish: null,
    };
    acc.entries += race.entries;
    if (!isNonStart(race)) acc.starts += 1;
    if (race.position === 1) acc.wins += 1;
    if (race.position !== null && race.position <= 3) acc.podiums += 1;
    if (race.position !== null && (acc.bestFinish === null || race.position < acc.bestFinish)) {
      acc.bestFinish = race.position;
    }

    const team = acc.teams.get(race.teamRef);
    if (team === undefined) {
      acc.teams.set(race.teamRef, {
        ref: race.teamRef,
        name: race.teamName,
        firstRound: race.round,
        lastRound: race.round,
        entries: 1,
      });
    } else {
      team.entries += 1;
      if (race.round < team.firstRound) team.firstRound = race.round;
      if (race.round > team.lastRound) team.lastRound = race.round;
    }
    byYear.set(race.year, acc);
  }

  const championshipByYear = new Map<number, DriverChampionshipRow>();
  for (const row of championships) championshipByYear.set(row.year, row);

  return [...byYear.values()]
    .sort((a, b) => a.year - b.year)
    .map((acc) => {
      const snapshot = championshipByYear.get(acc.year);
      const isComplete = seasonComplete.get(acc.year) ?? false;
      return {
        year: acc.year,
        teams: [...acc.teams.values()].sort(
          (a, b) => a.lastRound - b.lastRound || a.firstRound - b.firstRound,
        ),
        entries: acc.entries,
        starts: acc.starts,
        wins: acc.wins,
        podiums: acc.podiums,
        bestFinish: acc.bestFinish,
        points: snapshot?.points ?? null,
        position: snapshot?.position ?? null,
        championshipWins: snapshot?.wins ?? null,
        adjustment: classifyAdjustment(
          snapshot?.adjustmentType ?? null,
          snapshot?.position ?? null,
        ),
        isSeasonComplete: isComplete,
        // A title is P1 in the final snapshot **of a finished season**. Without the
        // completeness gate the current data would award a 2026 championship to whoever
        // leads after round 10 of 22.
        isChampion: isComplete && snapshot?.position === 1,
      };
    });
}

function toRoundRef(race: DriverRace | undefined): Driver['career']['firstRace'] {
  if (race === undefined) return null;
  return {
    year: race.year,
    round: race.round,
    name: race.name,
    date: race.date,
    circuitRef: race.circuitRef,
    circuitName: race.circuitName,
  };
}

/** Assemble the payload from rows already read. Pure, so CI exercises it without a database. */
export function buildDriver(
  profile: ProfileRow,
  raceRows: readonly DriverRaceRow[],
  qualifyingRows: readonly DriverQualifyingRow[],
  championshipRows: readonly DriverChampionshipRow[],
  seasonComplete: ReadonlyMap<number, boolean>,
): Driver {
  const races = collapseRaces(raceRows, qualifyingRows);
  const seasons = buildSeasons(races, championshipRows, seasonComplete);
  const firstRace = races[0];
  const lastRace = races[races.length - 1];
  const championships = seasons.filter((season) => season.isChampion).length;

  return {
    driver: {
      ref: profile.ref,
      code: profile.code,
      forename: profile.forename,
      surname: profile.surname,
      nationality: profile.nationality,
      countryCode: profile.countryCode,
      permanentCarNumber: profile.permanentCarNumber,
      dateOfBirth: profile.dateOfBirth,
    },
    career: {
      firstSeason: seasons[0]?.year ?? null,
      lastSeason: seasons[seasons.length - 1]?.year ?? null,
      seasonsEntered: seasons.length,
      firstRace: toRoundRef(firstRace),
      lastRace: toRoundRef(lastRace),
      ageAtFirstRace: ageYears(profile.dateOfBirth, firstRace?.date ?? null),
      ageAtLastRace: ageYears(profile.dateOfBirth, lastRace?.date ?? null),
    },
    totals: buildTotals(races, raceRows.length, championships),
    seasons,
    races,
    gridVsFinish: buildGridVsFinish(races),
    qualifyingVsRace: buildQualifyingVsRace(races),
  };
}

/* -------------------------------------------------------------------- read functions */

/** False for a well-formed reference the dataset does not hold — the 404 case. */
export function driverExists(reference: string): boolean {
  return Q_DRIVER_EXISTS().get({ ref: reference }) !== undefined;
}

/**
 * `GET /api/drivers/:reference`, or null when the driver is absent.
 *
 * Returning null rather than throwing keeps the 404 decision in the route handler, where
 * the HTTP vocabulary belongs — the same split `readSeason` and `readRace` use.
 */
export function readDriver(reference: string): Driver | null {
  const profile = Q_DRIVER_PROFILE().get({ ref: reference }) as ProfileRow | undefined;
  if (profile === undefined) return null;

  return buildDriver(
    profile,
    Q_DRIVER_RACES().all({ ref: reference }) as DriverRaceRow[],
    Q_DRIVER_QUALIFYING().all({ ref: reference }) as DriverQualifyingRow[],
    Q_DRIVER_CHAMPIONSHIPS().all({ ref: reference }) as DriverChampionshipRow[],
    readSeasonCompleteness(),
  );
}
