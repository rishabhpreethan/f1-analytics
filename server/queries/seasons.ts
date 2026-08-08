import type {
  Adjustment,
  CancelledRound,
  Counting,
  DriverSeries,
  DriverStanding,
  DriverTeam,
  ProgressionPoint,
  Scoring,
  Season,
  SeasonList,
  SeasonRound,
  StandingsProgression,
  TeamSeries,
  TeamStanding,
} from '../schemas/season';
import { DatabaseUnavailableError } from '../db';
import { SEASON_CACHE_TTL_MS } from '../config';
import { memoize } from '../cache/memo';
import { prepared } from './prepared';

/**
 * ALL SQL for the season hub (ARCHITECTURE.md §3). Every statement is parameterised —
 * named parameters, never interpolation, not even for a year integer (S-1).
 *
 * ============================================================ the one rule that matters
 *
 * **Standings are read from `driver_championship` / `team_championship`. Nothing here
 * sums `session_entry.points`, and nothing ever may** (trap 4, DATABASE.md §5). There
 * are 24 point systems and several eras counted only a driver's best N results, so a
 * sum is not an approximation of a championship total — it is a different number.
 * Verified against the record: the 1950 snapshot reads Farina 30 / Fangio 27 /
 * Fagioli 24, which is the historical championship and is *not* the sum of their race
 * points.
 *
 * ================================================================== other traps handled
 *
 *  1  `session.has_time_data` is never read. `hasLapData` tests for `lap` rows
 *     (DATABASE.md §6.4) — the flag disagrees with reality in both directions.
 *  3  `position IS NULL` is never treated as a DNF. It is not read as anything: the
 *     null is carried through to the client, where the schema documents what it means.
 *  7  the only `lap` access is an `EXISTS` reached through one round's session entries
 *     via `idx_lap_entry`, short-circuited on the first row. There is no path from a
 *     request to an unbounded `lap` scan (S-10).
 * 11  no internal integer id is selected into any payload. `reference` slugs only.
 * 12  cancelled rounds are returned, not filtered away — a cancelled round is a fact
 *     about the calendar, not a data gap.
 * 13  future rounds are returned with `hasResults: false`. "Completed" is the existence
 *     of classification rows and is never a comparison against today's date.
 * 15  **the calendar is partitioned on `number IS NULL`, not on `is_cancelled`.** On this
 *     data the two are exactly co-extensive, and DATABASE.md §9 requires re-verifying
 *     that after every refresh — but partitioning on the number means the two lists are a
 *     *total* partition of the season's rounds whether or not the equivalence survives,
 *     so no round can be dropped from both. `seasons.test.ts` asserts the equivalence
 *     against the live database, which is where a refresh would break it.
 */

/* ------------------------------------------------------------------------------- SQL */

/**
 * Every season with its round counts.
 *
 * `max(r.number)` is the season's round count and **`count(*)` is not** (trap 15): 2026
 * has 24 `round` rows and 22 numbered rounds. `coalesce(..., 0)` because `max()` over an
 * empty set is NULL, and a season with no rounds is 0 rounds, not an error.
 */
const SQL_SEASON_LIST = `
SELECT s.year AS year,
       coalesce((SELECT max(r.number) FROM round r WHERE r.season_id = s.id), 0) AS rounds,
       (SELECT count(*) FROM round r
         WHERE r.season_id = s.id AND r.number IS NULL) AS cancelledRounds,
       (SELECT count(*) FROM round r
         WHERE r.season_id = s.id AND r.number IS NOT NULL
           AND EXISTS (SELECT 1 FROM session ses
                       JOIN session_entry se ON se.session_id = ses.id
                       WHERE ses.round_id = r.id AND ses.type = 'R')) AS completedRounds,
       cs.team_best_results AS teamBestResults
FROM season s
JOIN championship_system cs ON cs.id = s.championship_system_id
ORDER BY s.year DESC`;

/** Existence of the season itself, so an in-range year that is absent is a 404. */
const SQL_SEASON_EXISTS = `SELECT 1 AS present FROM season WHERE year = @year`;

const SQL_SCORING = `
SELECT cs.reference           AS systemRef,
       cs.name                AS systemName,
       cs.driver_best_results AS driverBestResults,
       cs.team_best_results   AS teamBestResults
FROM season s
JOIN championship_system cs ON cs.id = s.championship_system_id
WHERE s.year = @year`;

/**
 * The numbered calendar.
 *
 * The three `EXISTS` clauses each answer a question the UI has to answer honestly:
 * whether the race happened (classification rows, not a date), whether the weekend had a
 * sprint, and whether lap-level data exists for it. The last is the only `lap` access in
 * this file and it is bounded three ways — one round, one session type, and `EXISTS`
 * stopping at the first row through `idx_lap_entry`.
 */
const SQL_SEASON_ROUNDS = `
SELECT r.number      AS round,
       r.name        AS name,
       r.date        AS date,
       c.reference   AS circuitRef,
       c.name        AS circuitName,
       EXISTS (SELECT 1 FROM session ses
               JOIN session_entry se ON se.session_id = ses.id
               WHERE ses.round_id = r.id AND ses.type = 'R')  AS hasResults,
       EXISTS (SELECT 1 FROM session ses
               WHERE ses.round_id = r.id AND ses.type = 'SR') AS hasSprint,
       EXISTS (SELECT 1 FROM session ses
               JOIN session_entry se ON se.session_id = ses.id
               JOIN lap l ON l.session_entry_id = se.id
               WHERE ses.round_id = r.id AND ses.type = 'R')  AS hasLapData
FROM round r
JOIN season s ON s.id = r.season_id
LEFT JOIN circuit c ON c.id = r.circuit_id
WHERE s.year = @year AND r.number IS NOT NULL
ORDER BY r.number`;

/** The complement of the query above — every round the season could not number. */
const SQL_SEASON_UNNUMBERED_ROUNDS = `
SELECT r.name      AS name,
       r.date      AS date,
       c.reference AS circuitRef,
       c.name      AS circuitName
FROM round r
JOIN season s ON s.id = r.season_id
LEFT JOIN circuit c ON c.id = r.circuit_id
WHERE s.year = @year AND r.number IS NULL
ORDER BY r.date`;

/**
 * Race winners for a season, through the canonical `v_race` view — the join path is
 * defined once (DATABASE.md §6.1) and no feature re-derives it.
 *
 * Ordered so a shared drive is deterministic: points descending, then surname. Three
 * races return two rows here.
 */
const SQL_SEASON_WINNERS = `
SELECT round_number AS round,
       driver_ref   AS driverRef,
       driver_code  AS code,
       forename, surname,
       team_ref     AS teamRef,
       team_name    AS teamName,
       points
FROM v_race
WHERE year = @year AND round_number IS NOT NULL AND position = 1
ORDER BY round_number, points DESC, surname`;

/**
 * Every (driver, team) pair that started a race in the season, with the round span.
 *
 * A mid-season team change is ordinary rather than exceptional — 1976 alone has 59 pairs
 * — so this is a separate grouped query rather than a `team_id` on the standings row.
 */
const SQL_SEASON_DRIVER_TEAMS = `
SELECT driver_ref        AS driverRef,
       team_ref          AS teamRef,
       team_name         AS teamName,
       min(round_number) AS firstRound,
       max(round_number) AS lastRound,
       count(*)          AS entries
FROM v_race
WHERE year = @year AND round_number IS NOT NULL
GROUP BY driver_ref, team_ref
ORDER BY driver_ref, max(round_number), min(round_number)`;

/**
 * Final (or current) standings — DATABASE.md §6.6.
 *
 * The key is `round_number * 1000 + session_number` because a round carries **more than
 * one snapshot**: 2026 writes one after every session, so Q1, Q2, Q3 and the race each
 * leave a row and the race's is the one that counts. `session_number` reaches 9 in the
 * data, comfortably inside the 1000 multiplier.
 *
 * `ORDER BY (position IS NULL), position` puts unranked entries last. SQLite sorts NULL
 * first, so without the leading term an excluded team would head the table.
 */
const SQL_DRIVER_STANDINGS = `
WITH last_snapshot AS (
  SELECT max(round_number * 1000 + session_number) AS k
  FROM driver_championship WHERE year = @year
)
SELECT dc.position        AS position,
       dc.round_number    AS asOfRound,
       d.reference        AS driverRef,
       d.abbreviation     AS code,
       d.forename, d.surname,
       d.nationality      AS nationality,
       dc.points          AS points,
       dc.win_count       AS wins,
       dc.highest_finish  AS bestFinish,
       dc.adjustment_type AS adjustmentType
FROM driver_championship dc
JOIN driver d ON d.id = dc.driver_id
JOIN last_snapshot ls ON (dc.round_number * 1000 + dc.session_number) = ls.k
WHERE dc.year = @year
ORDER BY (dc.position IS NULL), dc.position, dc.points DESC, d.surname`;

const SQL_TEAM_STANDINGS = `
WITH last_snapshot AS (
  SELECT max(round_number * 1000 + session_number) AS k
  FROM team_championship WHERE year = @year
)
SELECT tc.position        AS position,
       tc.round_number    AS asOfRound,
       t.reference        AS teamRef,
       t.name             AS name,
       t.nationality      AS nationality,
       tc.points          AS points,
       tc.win_count       AS wins,
       tc.highest_finish  AS bestFinish,
       tc.adjustment_type AS adjustmentType
FROM team_championship tc
JOIN team t ON t.id = tc.team_id
JOIN last_snapshot ls ON (tc.round_number * 1000 + tc.session_number) = ls.k
WHERE tc.year = @year
ORDER BY (tc.position IS NULL), tc.position, tc.points DESC, t.name`;

/**
 * Round-by-round progression — **one point per round, and that is a decision**.
 *
 * `driver_championship` holds a snapshot after every points-scoring session, and in 2026
 * that includes Q1, Q2 and Q3, which change nothing: 962 rows for the season against 484
 * round-ends. Taking the last snapshot *within each round* gives the standings as they
 * stood when the round finished, which is what a championship progression chart plots.
 * `max(session_number)` per round rather than the global maximum of DATABASE.md §6.6,
 * which answers a different question (the final standings) and returns one round.
 */
const SQL_DRIVER_PROGRESSION = `
WITH last_of_round AS (
  SELECT round_number, max(session_number) AS session_number
  FROM driver_championship WHERE year = @year GROUP BY round_number
)
SELECT dc.round_number    AS round,
       d.reference        AS driverRef,
       d.abbreviation     AS code,
       d.forename, d.surname,
       dc.points          AS points,
       dc.position        AS position,
       dc.adjustment_type AS adjustmentType
FROM driver_championship dc
JOIN last_of_round lr
  ON lr.round_number = dc.round_number AND lr.session_number = dc.session_number
JOIN driver d ON d.id = dc.driver_id
WHERE dc.year = @year
ORDER BY dc.round_number`;

const SQL_TEAM_PROGRESSION = `
WITH last_of_round AS (
  SELECT round_number, max(session_number) AS session_number
  FROM team_championship WHERE year = @year GROUP BY round_number
)
SELECT tc.round_number    AS round,
       t.reference        AS teamRef,
       t.name             AS name,
       tc.points          AS points,
       tc.position        AS position,
       tc.adjustment_type AS adjustmentType
FROM team_championship tc
JOIN last_of_round lr
  ON lr.round_number = tc.round_number AND lr.session_number = tc.session_number
JOIN team t ON t.id = tc.team_id
WHERE tc.year = @year
ORDER BY tc.round_number`;

/**
 * The progression chart's category axis: the rounds that carry a snapshot.
 *
 * Driven off `driver_championship` rather than `round`, because a round the championship
 * never recorded is not a gap in the line — it is a race that has not happened
 * (REQUIREMENTS.md §2.2).
 */
const SQL_PROGRESSION_ROUNDS = `
SELECT DISTINCT r.number    AS round,
                r.name      AS name,
                r.date      AS date,
                c.reference AS circuitRef
FROM driver_championship dc
JOIN round r ON r.id = dc.round_id
LEFT JOIN circuit c ON c.id = r.circuit_id
WHERE dc.year = @year AND r.number IS NOT NULL
ORDER BY r.number`;

const Q_SEASON_LIST = prepared(SQL_SEASON_LIST);
const Q_SEASON_EXISTS = prepared(SQL_SEASON_EXISTS);
const Q_SCORING = prepared(SQL_SCORING);
const Q_SEASON_ROUNDS = prepared(SQL_SEASON_ROUNDS);
const Q_SEASON_UNNUMBERED_ROUNDS = prepared(SQL_SEASON_UNNUMBERED_ROUNDS);
const Q_SEASON_WINNERS = prepared(SQL_SEASON_WINNERS);
const Q_SEASON_DRIVER_TEAMS = prepared(SQL_SEASON_DRIVER_TEAMS);
const Q_DRIVER_STANDINGS = prepared(SQL_DRIVER_STANDINGS);
const Q_TEAM_STANDINGS = prepared(SQL_TEAM_STANDINGS);
const Q_DRIVER_PROGRESSION = prepared(SQL_DRIVER_PROGRESSION);
const Q_TEAM_PROGRESSION = prepared(SQL_TEAM_PROGRESSION);
const Q_PROGRESSION_ROUNDS = prepared(SQL_PROGRESSION_ROUNDS);

/* ------------------------------------------------------------------------- row shapes */

interface SeasonListRow {
  year: number;
  rounds: number;
  cancelledRounds: number;
  completedRounds: number;
  teamBestResults: number | null;
}

interface ScoringRow {
  systemRef: string;
  systemName: string;
  driverBestResults: number | null;
  teamBestResults: number | null;
}

interface RoundRow {
  round: number;
  name: string;
  date: string;
  circuitRef: string | null;
  circuitName: string | null;
  hasResults: number;
  hasSprint: number;
  hasLapData: number;
}

interface UnnumberedRoundRow {
  name: string;
  date: string;
  circuitRef: string | null;
  circuitName: string | null;
}

interface WinnerRow {
  round: number;
  driverRef: string;
  code: string | null;
  forename: string;
  surname: string;
  teamRef: string;
  teamName: string;
  points: number;
}

interface DriverTeamRow {
  driverRef: string;
  teamRef: string;
  teamName: string;
  firstRound: number;
  lastRound: number;
  entries: number;
}

interface DriverStandingRow {
  position: number | null;
  asOfRound: number;
  driverRef: string;
  code: string | null;
  forename: string;
  surname: string;
  nationality: string | null;
  points: number;
  wins: number;
  bestFinish: number | null;
  adjustmentType: number | null;
}

interface TeamStandingRow {
  position: number | null;
  asOfRound: number;
  teamRef: string;
  name: string;
  nationality: string | null;
  points: number;
  wins: number;
  bestFinish: number | null;
  adjustmentType: number | null;
}

interface DriverProgressionRow {
  round: number;
  driverRef: string;
  code: string | null;
  forename: string;
  surname: string;
  points: number;
  position: number | null;
  adjustmentType: number | null;
}

interface TeamProgressionRow {
  round: number;
  teamRef: string;
  name: string;
  points: number;
  position: number | null;
  adjustmentType: number | null;
}

interface ProgressionRoundRow {
  round: number;
  name: string;
  date: string;
  circuitRef: string | null;
}

/* ------------------------------------------------------- pure builders (no database) */

/**
 * SQLite has no boolean type and `EXISTS` yields 0 or 1. Converting at the boundary
 * rather than at every use site is what keeps `0` from reaching a `strictObject` that
 * wants a boolean — a failure that would surface as an outbound-schema 500 rather than
 * as anything a reader could act on.
 */
export function toBoolean(value: number): boolean {
  return value === 1;
}

/**
 * Decode `championship_system.*_best_results`, conservatively.
 *
 * Positive → the season counted only the best N results, and the value is N. Verified
 * against the sport's actual rules for every positive value present: 1950–53 → 4,
 * 1954–57 → 5, 1958 → 6, 1959 → 5, 1979 → 4, 1980 → 5, 1981–90 → 11.
 *
 * `-1` → every result counted, which is right from 1991 onward.
 *
 * `0` → **no championship of this kind that season**, and it is only ever seen on the
 * team side. Exact rather than assumed: the two systems carrying 0 cover 1950–1957, and
 * `team_championship` holds no row before 1958.
 *
 * Anything else → a limit applied that this dataset does not quantify. The live case is
 * `-2` for 1967–78, where the real rule was best-N per half-season and the value gives
 * neither N nor the split. **Returning `'limited'` with a null N is the honest answer**;
 * inventing a number here would be a silent cross-era error of exactly the kind
 * REQUIREMENTS.md §5.2 exists to prevent.
 */
export function toCounting(bestResults: number | null): {
  counting: Counting;
  bestResults: number | null;
} {
  if (bestResults === null) return { counting: 'limited', bestResults: null };
  if (bestResults > 0) return { counting: 'bestN', bestResults };
  if (bestResults === 0) return { counting: 'none', bestResults: null };
  if (bestResults === -1) return { counting: 'all', bestResults: null };
  return { counting: 'limited', bestResults: null };
}

export function buildScoring(row: ScoringRow): Scoring {
  const driver = toCounting(row.driverBestResults);
  const team = toCounting(row.teamBestResults);
  return {
    systemRef: row.systemRef,
    systemName: row.systemName,
    // A driver championship has existed in every season in this data, so `'none'` is not
    // a value the driver side can take. The schema excludes it; this keeps the two
    // agreeing rather than letting a `0` in a refreshed database produce a 500.
    driverCounting: driver.counting === 'none' ? 'limited' : driver.counting,
    driverBestResults: driver.bestResults,
    teamCounting: team.counting,
    teamBestResults: team.bestResults,
  };
}

/**
 * What the stewards did to an entry, derived from two observable properties rather than
 * from the value of an undocumented enum (trap 14).
 *
 * The database's `championship_adjustment` table holds three rows and they correspond
 * one-to-one with the three `adjustment_type` values that appear in the snapshots. In
 * every one of the three the adjustment is **already applied**: 2007 McLaren reads 0
 * points and no position beside 8 wins; 2020 Racing Point reads 195, the post-penalty
 * figure in the record; 1997 Schumacher keeps 78 points and loses his position. So this
 * annotates and never re-applies — subtracting the penalty again would double-count it.
 *
 * `'excluded'` is distinguished from `'adjusted'` by whether a ranked position survived,
 * which is a property of the row. Note that a null position **alone** is not an
 * adjustment: 13,701 rows have one simply because the entity scored nothing.
 */
export function classifyAdjustment(
  adjustmentType: number | null,
  position: number | null,
): Adjustment {
  if (adjustmentType === null || adjustmentType === 0) return 'none';
  return position === null ? 'excluded' : 'adjusted';
}

/** Group `(driver, team)` rows into one array per driver, earliest team first. */
export function groupDriverTeams(rows: readonly DriverTeamRow[]): Map<string, DriverTeam[]> {
  const byDriver = new Map<string, DriverTeam[]>();
  for (const row of rows) {
    const list = byDriver.get(row.driverRef) ?? [];
    list.push({
      ref: row.teamRef,
      name: row.teamName,
      firstRound: row.firstRound,
      lastRound: row.lastRound,
      entries: row.entries,
    });
    byDriver.set(row.driverRef, list);
  }
  return byDriver;
}

/**
 * Order two series the way a standings table orders its rows: by the position they hold
 * at the end of the data, unranked last, then by points.
 *
 * A comparator rather than a sort on `position ?? Infinity`, because the tail matters:
 * with 13,701 unranked rows in the data, "unranked" is a large, real group and inside it
 * points and name are the only ordering that is stable across runs.
 */
function comparePosition(
  a: { position: number | null; points: number; label: string },
  b: { position: number | null; points: number; label: string },
): number {
  if (a.position !== null && b.position !== null) return a.position - b.position;
  if (a.position !== null) return -1;
  if (b.position !== null) return 1;
  if (a.points !== b.points) return b.points - a.points;
  return a.label.localeCompare(b.label);
}

/**
 * Fold per-round rows into one series per driver.
 *
 * `adjustment` is taken from the **last** row rather than the first: 2020 Racing Point's
 * deduction is carried on every snapshot, but an adjustment applied at the end of a
 * season would only appear on the final one, and a series that reported `'none'` because
 * round 1 said so would be wrong in the one case that matters.
 */
export function buildDriverSeries(
  rows: readonly DriverProgressionRow[],
  teams: Map<string, DriverTeam[]>,
): DriverSeries[] {
  interface Accumulator {
    series: DriverSeries;
    lastPosition: number | null;
    lastPoints: number;
  }
  const byDriver = new Map<string, Accumulator>();

  for (const row of rows) {
    const point: ProgressionPoint = {
      round: row.round,
      points: row.points,
      position: row.position,
    };
    const existing = byDriver.get(row.driverRef);
    if (existing === undefined) {
      byDriver.set(row.driverRef, {
        series: {
          driverRef: row.driverRef,
          code: row.code,
          forename: row.forename,
          surname: row.surname,
          teams: teams.get(row.driverRef) ?? [],
          adjustment: classifyAdjustment(row.adjustmentType, row.position),
          progression: [point],
        },
        lastPosition: row.position,
        lastPoints: row.points,
      });
      continue;
    }
    existing.series.progression.push(point);
    existing.series.adjustment = classifyAdjustment(row.adjustmentType, row.position);
    existing.lastPosition = row.position;
    existing.lastPoints = row.points;
  }

  return [...byDriver.values()]
    .sort((a, b) =>
      comparePosition(
        { position: a.lastPosition, points: a.lastPoints, label: a.series.surname },
        { position: b.lastPosition, points: b.lastPoints, label: b.series.surname },
      ),
    )
    .map((entry) => entry.series);
}

export function buildTeamSeries(rows: readonly TeamProgressionRow[]): TeamSeries[] {
  interface Accumulator {
    series: TeamSeries;
    lastPosition: number | null;
    lastPoints: number;
  }
  const byTeam = new Map<string, Accumulator>();

  for (const row of rows) {
    const point: ProgressionPoint = {
      round: row.round,
      points: row.points,
      position: row.position,
    };
    const existing = byTeam.get(row.teamRef);
    if (existing === undefined) {
      byTeam.set(row.teamRef, {
        series: {
          teamRef: row.teamRef,
          name: row.name,
          adjustment: classifyAdjustment(row.adjustmentType, row.position),
          progression: [point],
        },
        lastPosition: row.position,
        lastPoints: row.points,
      });
      continue;
    }
    existing.series.progression.push(point);
    existing.series.adjustment = classifyAdjustment(row.adjustmentType, row.position);
    existing.lastPosition = row.position;
    existing.lastPoints = row.points;
  }

  return [...byTeam.values()]
    .sort((a, b) =>
      comparePosition(
        { position: a.lastPosition, points: a.lastPoints, label: a.series.name },
        { position: b.lastPosition, points: b.lastPoints, label: b.series.name },
      ),
    )
    .map((entry) => entry.series);
}

/** Attach each round's winners to its calendar row. Three rounds get two. */
export function buildRounds(
  roundRows: readonly RoundRow[],
  winnerRows: readonly WinnerRow[],
): SeasonRound[] {
  const winnersByRound = new Map<number, WinnerRow[]>();
  for (const row of winnerRows) {
    const list = winnersByRound.get(row.round) ?? [];
    list.push(row);
    winnersByRound.set(row.round, list);
  }

  return roundRows.map((row) => ({
    round: row.round,
    name: row.name,
    date: row.date,
    circuitRef: row.circuitRef,
    circuitName: row.circuitName,
    hasResults: toBoolean(row.hasResults),
    hasSprint: toBoolean(row.hasSprint),
    hasLapData: toBoolean(row.hasLapData),
    winners: (winnersByRound.get(row.round) ?? []).map((winner) => ({
      driverRef: winner.driverRef,
      code: winner.code,
      forename: winner.forename,
      surname: winner.surname,
      team: { ref: winner.teamRef, name: winner.teamName },
      points: winner.points,
    })),
  }));
}

export function buildDriverStandings(
  rows: readonly DriverStandingRow[],
  teams: Map<string, DriverTeam[]>,
): DriverStanding[] {
  return rows.map((row) => ({
    position: row.position,
    driverRef: row.driverRef,
    code: row.code,
    forename: row.forename,
    surname: row.surname,
    nationality: row.nationality,
    points: row.points,
    wins: row.wins,
    bestFinish: row.bestFinish,
    teams: teams.get(row.driverRef) ?? [],
    adjustment: classifyAdjustment(row.adjustmentType, row.position),
  }));
}

export function buildTeamStandings(rows: readonly TeamStandingRow[]): TeamStanding[] {
  return rows.map((row) => ({
    position: row.position,
    teamRef: row.teamRef,
    name: row.name,
    nationality: row.nationality,
    points: row.points,
    wins: row.wins,
    bestFinish: row.bestFinish,
    adjustment: classifyAdjustment(row.adjustmentType, row.position),
  }));
}

/* ------------------------------------------------------------------- read functions */

export function readSeasonList(): SeasonList {
  const rows = Q_SEASON_LIST().all() as SeasonListRow[];
  return {
    seasons: rows.map((row) => ({
      year: row.year,
      rounds: row.rounds,
      completedRounds: row.completedRounds,
      cancelledRounds: row.cancelledRounds,
      // Guarded on `rounds > 0`: 0 of 0 is "not started", not "finished" — the same
      // reasoning as `readLatestSeasonProgress` in queries/meta.ts.
      isComplete: row.rounds > 0 && row.completedRounds === row.rounds,
      hasTeamStandings: toCounting(row.teamBestResults).counting !== 'none',
    })),
  };
}

/**
 * `year → is every numbered round of that season complete`, memoised in-process.
 *
 * **The entity pages need this and cannot ask a season endpoint for it.** A driver's
 * season row carries `isChampion`, which is `position = 1` in the final snapshot **of a
 * finished season** — and the gate is live rather than defensive: the 2026 snapshot in
 * this data ranks Antonelli first with 12 of 22 rounds unrun, and a team page would
 * likewise hand Mercedes a tenth constructors' title.
 *
 * Memoised here rather than at a route, which is the one departure from
 * ARCHITECTURE.md §6 convention 4's usual placement, because **three endpoints share it**
 * (driver, team, and any later career surface) and a per-route memo would hold three
 * copies of the same 77-entry map. The payload it derives from is the memo's own subject:
 * global, tiny, and immutable between database refreshes — exactly convention 4's test.
 * `invalidateMemo()` clears it for tests.
 */
export function readSeasonCompleteness(): ReadonlyMap<number, boolean> {
  return memoize('season-completeness', SEASON_CACHE_TTL_MS, () => {
    const map = new Map<number, boolean>();
    for (const season of readSeasonList().seasons) map.set(season.year, season.isComplete);
    return map;
  });
}

/** False for a well-formed year the dataset does not hold — the 404 case. */
export function seasonExists(year: number): boolean {
  return Q_SEASON_EXISTS().get({ year }) !== undefined;
}

/**
 * @throws DatabaseUnavailableError('schema') when the season exists but has no
 * championship system. Not reachable on the present data — all 77 seasons carry one, and
 * `championship_system_id` is the join `buildScoring` needs — but it is the same
 * classification `readSeasonRange` uses for an empty `season` table: a database without
 * the expected content, rather than an empty result to render.
 */
function readScoringOrThrow(year: number): Scoring {
  const row = Q_SCORING().get({ year }) as ScoringRow | undefined;
  if (row === undefined) throw new DatabaseUnavailableError('schema');
  return buildScoring(row);
}

export function readCancelledRounds(year: number): CancelledRound[] {
  const rows = Q_SEASON_UNNUMBERED_ROUNDS().all({ year }) as UnnumberedRoundRow[];
  return rows.map((row) => ({
    name: row.name,
    date: row.date,
    circuitRef: row.circuitRef,
    circuitName: row.circuitName,
  }));
}

export function readSeasonRounds(year: number): SeasonRound[] {
  return buildRounds(
    Q_SEASON_ROUNDS().all({ year }) as RoundRow[],
    Q_SEASON_WINNERS().all({ year }) as WinnerRow[],
  );
}

function readDriverTeams(year: number): Map<string, DriverTeam[]> {
  return groupDriverTeams(Q_SEASON_DRIVER_TEAMS().all({ year }) as DriverTeamRow[]);
}

/**
 * The whole `GET /api/seasons/:year` payload, or null when the season is absent.
 *
 * Returning null rather than throwing keeps the 404 decision in the route handler, which
 * is where the HTTP vocabulary belongs.
 */
export function readSeason(year: number): Season | null {
  if (!seasonExists(year)) return null;
  const scoring = readScoringOrThrow(year);

  const rounds = readSeasonRounds(year);
  const teams = readDriverTeams(year);
  const driverRows = Q_DRIVER_STANDINGS().all({ year }) as DriverStandingRow[];
  const teamRows = Q_TEAM_STANDINGS().all({ year }) as TeamStandingRow[];

  return {
    year,
    rounds,
    cancelledRounds: readCancelledRounds(year),
    scheduledRounds: rounds.length,
    completedRounds: rounds.filter((round) => round.hasResults).length,
    isComplete: rounds.length > 0 && rounds.every((round) => round.hasResults),
    scoring,
    standings: {
      // Every row of one snapshot carries the same round, so the first is the snapshot's.
      asOfRound: driverRows[0]?.asOfRound ?? null,
      drivers: buildDriverStandings(driverRows, teams),
      teams: buildTeamStandings(teamRows),
    },
  };
}

/** `GET /api/seasons/:year/standings`, or null when the season is absent. */
export function readStandingsProgression(year: number): StandingsProgression | null {
  if (!seasonExists(year)) return null;
  const scoring = readScoringOrThrow(year);

  const teams = readDriverTeams(year);
  const roundRows = Q_PROGRESSION_ROUNDS().all({ year }) as ProgressionRoundRow[];

  return {
    year,
    rounds: roundRows.map((row) => ({
      round: row.round,
      name: row.name,
      date: row.date,
      circuitRef: row.circuitRef,
    })),
    drivers: buildDriverSeries(
      Q_DRIVER_PROGRESSION().all({ year }) as DriverProgressionRow[],
      teams,
    ),
    teams: buildTeamSeries(Q_TEAM_PROGRESSION().all({ year }) as TeamProgressionRow[]),
    scoring,
  };
}
