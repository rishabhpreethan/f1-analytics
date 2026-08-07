import type {
  DriverLaps,
  DriverStints,
  GridStatus,
  LapRow,
  PaceSummary,
  PitDurationSummary,
  PitStop,
  Race,
  RaceClassificationRow,
  RaceLaps,
  RaceOutcome,
  RaceSession,
  RaceStints,
  Stint,
} from '../schemas/race';
import { toBoolean } from './seasons';
import { prepared } from './prepared';

/**
 * ALL SQL for the race page (ARCHITECTURE.md §3). Every statement is parameterised —
 * named parameters, never interpolation, not even for a round integer (S-1).
 *
 * ============================================================== S-10, and it is real here
 *
 * **This is the first surface in the product that touches `lap` in anger**, so the bound
 * is stated with the measurement that establishes it rather than asserted.
 *
 * Every `lap` access below is reached through `v_race` filtered to **one year and one
 * round**, and `session` holds exactly one `R` session per round (verified: all 1,173
 * rounds). So a request can address at most one race session's lap rows, and the largest
 * in the archive is **1,649** — 2010 R18, followed by 2012 R11 at 1,621 and 2011 R6 at
 * 1,604. There is no parameter that widens this and no path from a request to an
 * unbounded scan.
 *
 * Measured on this machine, warm prepared statements, 30 runs each, against §8's 200 ms
 * p95 lap budget:
 *
 * | Race | Lap rows | `readRaceLaps` SQL |
 * |---|---|---|
 * | 2010 R18 — the largest | 1,649 | **1.45 ms** |
 * | 2011 R6 | 1,604 | 1.34 ms |
 * | 2026 R1 | 1,003 | 0.89 ms |
 * | 1996 R1 | 812 | 0.70 ms |
 * | 1988 R1 — no laps | 0 | 0.19 ms |
 *
 * `EXPLAIN QUERY PLAN` on every statement here reports `SEARCH … USING INDEX` and no
 * `SCAN` of `lap`: the access path is `idx_lap_entry (session_entry_id, number)` and the
 * round is resolved through `idx_season_year`.
 *
 * **No `?drivers=` or `?fromLap=` narrowing**, and that is a decision rather than an
 * omission — ARCHITECTURE.md §6 offers those parameters and §6 is amended to record why
 * this endpoint declines them. RD-1 plots the whole field, so the client fetches every
 * lap regardless; a filter parameter would turn RD-2's ≤ 4-driver selection into a
 * network round-trip and break §8's "chart interaction < 100 ms, no network".
 *
 * ================================================== trap 8, and where the filter lives
 *
 * **There is deliberately no `AND l.is_deleted = 0` in `SQL_RACE_LAPS`, and the trap is
 * still honoured.** The chart needs to distinguish a lap that was struck from a lap that
 * never happened (`DESIGN_SYSTEM.md` §6.6.1, RD-2), so the flag is *exposed* rather than
 * filtered — and the filter is applied in `buildPaceSummary`, which is pure and directly
 * tested, on the path where it is a pace metric. Exposure and filtering are different
 * operations and only one of them is what trap 8 forbids skipping.
 *
 * On the present data this is moot and the fact is worth stating: `is_deleted = 1` on
 * 2,199 of 717,764 lap rows and on **none** of the 627,025 race lap rows. The filter is
 * a no-op today that one refresh can make load-bearing.
 *
 * ==================================================================== other traps handled
 *
 *  1  `session.has_time_data` is never read. Availability tests for `lap` rows
 *     (DATABASE.md §6.4) — the flag disagrees with reality in both directions.
 *  3  `position IS NULL` is never read as a DNF. `status` is decoded through §3 into
 *     `outcome` and `is_classified` travels beside it.
 *  9  `grid = 0` is a pit-lane start, translated at the boundary by `toGrid`.
 * 10  pit durations are never compared across eras here; the payload states one race's.
 * 11  no internal integer id reaches a payload. `entry_id` is used to join and dropped.
 * 12  a cancelled round is returned as `isCancelled`, not filtered away.
 * 13  a future round returns `hasResults: false`, never a date comparison.
 * 15  `r.number IS NOT NULL` is implicit: `:round` is a positive integer, and a cancelled
 *     round carries a NULL number and so cannot be addressed by one.
 * 16  `position = 1` is not unique, and neither is `driverRef` within a race — 40 races
 *     before 1965 classify one driver twice. Nothing here keys a race by driver:
 *     `classification` is an ordered list. The two lap payloads *do* key by `driverRef`,
 *     which is safe because none of those 40 races has a lap row (counted directly).
 */

/* ------------------------------------------------------------------------------- SQL */

/**
 * Does this round exist? Separate from every other query so a well-formed round the
 * season does not hold is a **404** decided before any work, rather than an empty
 * payload that renders as a race with no drivers.
 */
const SQL_ROUND_EXISTS = `
SELECT 1 AS present
FROM round r JOIN season s ON s.id = r.season_id
WHERE s.year = @year AND r.number = @round`;

/**
 * The round, its circuit, and the race session's own schedule.
 *
 * `LEFT JOIN circuit` mirrors `v_entry` — no numbered round lacks a circuit today, and
 * the join tolerates one that does. The `R` session is joined rather than subqueried
 * because every round has exactly one.
 */
const SQL_ROUND = `
SELECT r.number       AS round,
       r.name         AS name,
       r.date         AS date,
       r.is_cancelled AS isCancelled,
       c.reference    AS circuitRef,
       c.name         AS circuitName,
       c.locality     AS locality,
       c.country      AS country,
       c.country_code AS countryCode,
       ses.timestamp  AS timestamp,
       ses.timezone   AS timezone
FROM round r
JOIN season s ON s.id = r.season_id
LEFT JOIN circuit c ON c.id = r.circuit_id
JOIN session ses ON ses.round_id = r.id AND ses.type = 'R'
WHERE s.year = @year AND r.number = @round`;

/**
 * The classification, through the canonical `v_race` view — the five-join path from a
 * lap to a driver name is defined once (DATABASE.md §6.1) and no feature re-derives it.
 *
 * `ORDER BY (position IS NULL), position` puts unclassified entries last: SQLite sorts
 * NULL first, so without the leading term a retirement would head the table. `grid` and
 * `surname` break the tie among the unclassified, so the order does not depend on the
 * database's row order — and `position` itself ties on the three shared drives, where
 * `points DESC` credits the greater share first.
 *
 * `team_color` exists on the view and is deliberately **not** selected: no brand colour
 * crosses this boundary (`schemas/race.ts`).
 */
const SQL_CLASSIFICATION = `
SELECT driver_ref              AS driverRef,
       driver_code             AS code,
       forename, surname,
       team_ref                AS teamRef,
       team_name               AS teamName,
       car_number              AS carNumber,
       position                AS position,
       grid                    AS grid,
       status                  AS status,
       detail                  AS detail,
       points                  AS points,
       laps_completed          AS lapsCompleted,
       is_classified           AS isClassified,
       is_eligible_for_points  AS isEligibleForPoints,
       time_ms                 AS totalTimeMs
FROM v_race
WHERE year = @year AND round_number = @round
ORDER BY (position IS NULL), position, points DESC, grid, surname`;

/**
 * The weekend's sessions — schedule metadata only.
 *
 * **Practice is included here and nowhere else.** 423 FP1 sessions hold 698 entries
 * between them and `session_entry.time_ms` is NULL for every practice row (trap 2), so
 * practice is a line on a schedule and never a results surface. `entries` is returned so
 * a surface can see how little is there rather than discovering it by rendering.
 *
 * `hasLapData` is per session and tests for `lap` rows — the only `lap` access in this
 * statement, bounded to one session and short-circuited by `EXISTS` through
 * `idx_lap_entry`.
 */
const SQL_WEEKEND = `
SELECT ses.type         AS type,
       ses.number       AS number,
       ses.timestamp    AS timestamp,
       ses.timezone     AS timezone,
       ses.is_cancelled AS isCancelled,
       (SELECT count(*) FROM session_entry se WHERE se.session_id = ses.id) AS entries,
       EXISTS (SELECT 1 FROM session_entry se
               JOIN lap l ON l.session_entry_id = se.id
               WHERE se.session_id = ses.id) AS hasLapData
FROM session ses
JOIN round r ON r.id = ses.round_id
JOIN season s ON s.id = r.season_id
WHERE s.year = @year AND r.number = @round
ORDER BY ses.number, ses.type`;

/**
 * Availability — DATABASE.md §6.4's rule, per round, for both lap-scale datasets.
 *
 * One statement rather than two so the spine endpoint pays for one round-trip. Both
 * halves are `EXISTS` and stop at the first row.
 */
const SQL_AVAILABILITY = `
SELECT
  EXISTS (SELECT 1 FROM v_race ve JOIN lap l ON l.session_entry_id = ve.entry_id
          WHERE ve.year = @year AND ve.round_number = @round) AS hasLapData,
  EXISTS (SELECT 1 FROM v_race ve JOIN pit_stop ps ON ps.session_entry_id = ve.entry_id
          WHERE ve.year = @year AND ve.round_number = @round) AS hasPitData`;

/**
 * Every lap row for one race, with the identity each series needs — **one query, and
 * that is the point.**
 *
 * The pace summary and the traces are both built from these rows by
 * `buildRaceLaps`, so they cannot disagree about the session's fastest lap. Two
 * statements — one aggregating, one listing — would agree by rule; this agrees by
 * construction, which is the stronger guarantee and the reason the session's fastest lap
 * is server-stated at all (`schemas/race.ts`, `paceSummarySchema`).
 *
 * `is_deleted` is selected and **not** filtered — see the trap 8 note at the top.
 *
 * Identity repeats on all 1,649 rows in the result set and is collapsed by the builder;
 * that is in-process cost, not payload, and it is inside the 1.45 ms measured above.
 */
const SQL_RACE_LAPS = `
SELECT ve.driver_ref  AS driverRef,
       ve.driver_code AS code,
       ve.surname     AS surname,
       ve.team_ref    AS teamRef,
       ve.grid        AS grid,
       ve.position    AS finishPosition,
       l.number       AS lap,
       l.position     AS position,
       l.time_ms      AS timeMs,
       l.is_deleted   AS isDeleted
FROM v_race ve
JOIN lap l ON l.session_entry_id = ve.entry_id
WHERE ve.year = @year AND ve.round_number = @round
ORDER BY ve.driver_ref, l.number`;

/**
 * Each entry's lap span, for the stint endpoint.
 *
 * `max(l.number)` is what closes the final stint, and it is **not** `laps_completed`:
 * the two disagree on 105 of 11,720 race entries with lap data, by up to 57 laps either
 * way, and a disqualified entry reads `laps_completed = 0` while holding a pit stop on
 * lap 29. Closing a stint at `laps_completed` would produce a negative-length final
 * stint on every one of those.
 *
 * Driven off `lap` rather than off `pit_stop`, so a driver who ran the whole race without
 * stopping still gets a row — and therefore one full-race stint — instead of being absent
 * from a stint chart.
 */
const SQL_ENTRY_LAP_SPANS = `
SELECT ve.driver_ref  AS driverRef,
       ve.driver_code AS code,
       ve.surname     AS surname,
       ve.team_ref    AS teamRef,
       ve.position    AS finishPosition,
       ve.grid        AS grid,
       min(l.number)  AS firstLap,
       max(l.number)  AS lastLap
FROM v_race ve
JOIN lap l ON l.session_entry_id = ve.entry_id
WHERE ve.year = @year AND ve.round_number = @round
GROUP BY ve.entry_id
ORDER BY ve.driver_ref`;

/**
 * Pit stops for one race — DATABASE.md §6.7.
 *
 * `JOIN lap` rather than `LEFT JOIN`: `pit_stop.lap_id` is non-NULL on all 12,582 race
 * stops and every one points at a lap of the **same** entry, both verified, so an inner
 * join cannot silently drop a stop. If a refresh broke that, `readRaceStints` would
 * return fewer stops than `durations.stops` counts — which `race.test.ts` asserts.
 *
 * **`ORDER BY l.number`, never `ps.number`.** The stop's own ordinal disagrees with the
 * lap order on 3 race entries, and stint boundaries derived from a wrong order are
 * wrong in a way that still renders.
 */
const SQL_RACE_PITS = `
SELECT ve.driver_ref    AS driverRef,
       ps.number        AS stopNumber,
       l.number         AS lap,
       ps.duration_ms   AS durationMs
FROM v_race ve
JOIN pit_stop ps ON ps.session_entry_id = ve.entry_id
JOIN lap l ON l.id = ps.lap_id
WHERE ve.year = @year AND ve.round_number = @round
ORDER BY ve.driver_ref, l.number`;

const Q_ROUND_EXISTS = prepared(SQL_ROUND_EXISTS);
const Q_ROUND = prepared(SQL_ROUND);
const Q_CLASSIFICATION = prepared(SQL_CLASSIFICATION);
const Q_WEEKEND = prepared(SQL_WEEKEND);
const Q_AVAILABILITY = prepared(SQL_AVAILABILITY);
const Q_RACE_LAPS = prepared(SQL_RACE_LAPS);
const Q_ENTRY_LAP_SPANS = prepared(SQL_ENTRY_LAP_SPANS);
const Q_RACE_PITS = prepared(SQL_RACE_PITS);

/* ------------------------------------------------------------------------- row shapes */

interface RoundRow {
  round: number;
  name: string;
  date: string;
  isCancelled: number;
  circuitRef: string | null;
  circuitName: string | null;
  locality: string | null;
  country: string | null;
  countryCode: string | null;
  timestamp: string;
  timezone: string;
}

interface ClassificationRow {
  driverRef: string;
  code: string | null;
  forename: string;
  surname: string;
  teamRef: string;
  teamName: string;
  carNumber: number | null;
  position: number | null;
  grid: number | null;
  status: number;
  detail: string;
  points: number;
  lapsCompleted: number;
  isClassified: number;
  isEligibleForPoints: number;
  totalTimeMs: number | null;
}

interface WeekendRow {
  type: string;
  number: number;
  timestamp: string;
  timezone: string;
  isCancelled: number;
  entries: number;
  hasLapData: number;
}

interface AvailabilityRow {
  hasLapData: number;
  hasPitData: number;
}

export interface LapQueryRow {
  driverRef: string;
  code: string | null;
  surname: string;
  teamRef: string;
  grid: number | null;
  finishPosition: number | null;
  lap: number;
  position: number | null;
  timeMs: number | null;
  isDeleted: number;
}

export interface LapSpanRow {
  driverRef: string;
  code: string | null;
  surname: string;
  teamRef: string;
  finishPosition: number | null;
  grid: number | null;
  firstLap: number;
  lastLap: number;
}

export interface PitStopRow {
  driverRef: string;
  stopNumber: number;
  lap: number;
  durationMs: number | null;
}

/* ------------------------------------------------------- pure builders (no database) */

/**
 * `session_entry.grid` → the three-state grid, at the boundary.
 *
 * **`0` means a pit-lane start** (trap 9), and translating it here is what stops a `0`
 * ever reaching a reader as "position zero" or a `!grid` test as "no grid position".
 *
 * A NULL becomes `'unknown'` rather than `'pitLane'`, which is the whole reason the enum
 * has three values instead of two: the two facts have different consequences — a
 * pit-lane start is excluded from "positions gained", an unknown grid is excluded from
 * the metric entirely. `grid` is NULL on **0 of 26,093** race entries today and
 * `race.test.ts` asserts that against the live database, so a refresh introducing NULLs
 * fails a test instead of inventing 26,093 pit-lane starts.
 */
export function toGrid(grid: number | null): {
  gridPosition: number | null;
  gridStatus: GridStatus;
} {
  if (grid === null) return { gridPosition: null, gridStatus: 'unknown' };
  if (grid === 0) return { gridPosition: null, gridStatus: 'pitLane' };
  return { gridPosition: grid, gridStatus: 'grid' };
}

/**
 * `session_entry.status` → `DATABASE.md` §3's grouping.
 *
 * Decoded once, here, because §3 was reverse-engineered from the data rather than
 * specified: one authority beats every consumer hard-coding `status === 11`. An
 * unrecognised value becomes `'unknown'` and is **never folded into a neighbour** — a
 * refresh that adds a status code must not silently become a mechanical retirement.
 *
 * §3's own caveat applies and is the reason `detail` travels alongside: `status = 20`
 * holds two rows whose `detail` reads `Finished`, disqualification after classification.
 * `status` is authoritative for grouping, `detail` for display.
 */
export function decodeOutcome(status: number): RaceOutcome {
  switch (status) {
    case 0:
      return 'finished';
    case 1:
      return 'lapped';
    case 10:
      return 'accident';
    case 11:
      return 'mechanical';
    case 20:
      return 'disqualified';
    case 30:
      return 'didNotStart';
    case 40:
      return 'didNotQualify';
    default:
      return 'unknown';
  }
}

/**
 * A session's start instant, or null when the recorded timestamp is a placeholder.
 *
 * Every `session.timestamp` is non-NULL, but before 2005 **every one is exactly midnight
 * UTC** — a date with a zero time. Through 2021 only the race carries a real time (2010:
 * 19 of 19 races do, 0 of 19 FP1s do); from 2022 all 860 sessions do. So the
 * discriminator is the time component, and it has **zero false positives across
 * 2022–2026**, where every time is known real.
 *
 * It remains a heuristic, and the honest statement of its limit is this: a session that
 * genuinely began at 00:00:00 UTC would be reported as having no known time. None exists
 * in the data. The alternative — a year threshold — would be wrong in the other
 * direction for 2005–2021, where the race has a real time and the practice sessions in
 * the same weekend do not.
 */
export function toStartTime(timestamp: string): string | null {
  return timestamp.slice(11, 19) === '00:00:00' ? null : timestamp;
}

export function buildClassification(rows: readonly ClassificationRow[]): RaceClassificationRow[] {
  return rows.map((row) => ({
    driverRef: row.driverRef,
    code: row.code,
    forename: row.forename,
    surname: row.surname,
    teamRef: row.teamRef,
    teamName: row.teamName,
    carNumber: row.carNumber,
    position: row.position,
    ...toGrid(row.grid),
    outcome: decodeOutcome(row.status),
    detail: row.detail,
    isClassified: toBoolean(row.isClassified),
    isEligibleForPoints: toBoolean(row.isEligibleForPoints),
    points: row.points,
    lapsCompleted: row.lapsCompleted,
    totalTimeMs: row.totalTimeMs,
  }));
}

export function buildWeekend(rows: readonly WeekendRow[]): RaceSession[] {
  return rows.map((row) => ({
    type: row.type,
    number: row.number,
    startTime: toStartTime(row.timestamp),
    timezone: row.timezone,
    isCancelled: toBoolean(row.isCancelled),
    entries: row.entries,
    hasLapData: toBoolean(row.hasLapData),
  }));
}

/**
 * Nearest-rank percentile over an **already sorted ascending** array.
 *
 * `sorted[floor(p/100 × n)]`, clamped to the last index. The method is named in
 * `paceSummarySchema` because a different one gives different numbers on the same data,
 * and `race.test.ts` pins 2026 R1 to the exact values this produces.
 *
 * @param sorted ascending; the caller sorts, because it sorts once for four percentiles
 */
export function percentileNearestRank(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index] ?? null;
}

/**
 * The session's pace facts, from the same rows the traces are built from.
 *
 * **This is where trap 8 is honoured** (see the module header): a lap that is deleted or
 * has no recorded time contributes to no figure here, while remaining present in the
 * driver's series so a chart can show that it existed.
 *
 * The fastest lap is `min(timeMs)` over that filtered set, tie-broken by the earlier lap
 * so the answer does not depend on row order. It is **not** read from
 * `session_entry.fastest_lap_rank`: 133 race sessions with lap rows carry no flagged
 * fastest lap, 20 carry the flag with no lap rows, and on 5 of the 445 where both exist
 * the flagged driver's own fastest lap is not the session minimum — 2011 R9 by 1.517 s.
 */
export function buildPaceSummary(rows: readonly LapQueryRow[]): PaceSummary {
  let deletedLaps = 0;
  const times: number[] = [];
  let fastest: PaceSummary['fastest'] = null;

  for (const row of rows) {
    if (row.isDeleted === 1) {
      deletedLaps += 1;
      continue;
    }
    if (row.timeMs === null) continue;
    times.push(row.timeMs);
    if (
      fastest === null ||
      row.timeMs < fastest.timeMs ||
      (row.timeMs === fastest.timeMs && row.lap < fastest.lap)
    ) {
      fastest = { timeMs: row.timeMs, driverRef: row.driverRef, lap: row.lap };
    }
  }

  times.sort((a, b) => a - b);

  return {
    timedLaps: times.length,
    deletedLaps,
    fastest,
    medianMs: percentileNearestRank(times, 50),
    p90Ms: percentileNearestRank(times, 90),
    p99Ms: percentileNearestRank(times, 99),
    slowestMs: times.length === 0 ? null : (times[times.length - 1] ?? null),
  };
}

/**
 * Order two entities the way a race page orders them: by finishing position, with the
 * unclassified last and ordered among themselves by where they started.
 *
 * A comparator rather than a sort on `position ?? Infinity` because the tail is large and
 * real — 10,000 of 26,093 race entries hold no classified position — and inside it grid
 * then surname is the only ordering stable across runs.
 */
function compareFinish(
  a: { finishPosition: number | null; grid: number | null; surname: string },
  b: { finishPosition: number | null; grid: number | null; surname: string },
): number {
  if (a.finishPosition !== null && b.finishPosition !== null) {
    return a.finishPosition - b.finishPosition;
  }
  if (a.finishPosition !== null) return -1;
  if (b.finishPosition !== null) return 1;
  const aGrid = a.grid === null || a.grid === 0 ? Number.MAX_SAFE_INTEGER : a.grid;
  const bGrid = b.grid === null || b.grid === 0 ? Number.MAX_SAFE_INTEGER : b.grid;
  if (aGrid !== bGrid) return aGrid - bGrid;
  return a.surname.localeCompare(b.surname);
}

/**
 * Group lap rows into one trace per driver, ordered by finishing position.
 *
 * Keyed by `driverRef`, which is safe **here** and not on the classification: the 40
 * races that classify one driver twice all predate 1965 and none has a lap row, counted
 * directly rather than assumed from the 1996 coverage boundary.
 *
 * `firstLap` / `lastLap` are taken from the rows rather than left to the consumer to
 * infer from the array — `d3.ticks` drops both endpoints of `[1, 58]`, and a retirement
 * makes a driver's last lap differ from the session's.
 */
export function buildDriverLaps(rows: readonly LapQueryRow[]): DriverLaps[] {
  interface Accumulator {
    driver: DriverLaps;
    grid: number | null;
  }
  const byDriver = new Map<string, Accumulator>();

  for (const row of rows) {
    const lap: LapRow = {
      lap: row.lap,
      position: row.position,
      timeMs: row.timeMs,
      isDeleted: row.isDeleted === 1,
    };
    const existing = byDriver.get(row.driverRef);
    if (existing === undefined) {
      byDriver.set(row.driverRef, {
        grid: row.grid,
        driver: {
          driverRef: row.driverRef,
          code: row.code,
          surname: row.surname,
          teamRef: row.teamRef,
          ...toGrid(row.grid),
          finishPosition: row.finishPosition,
          firstLap: row.lap,
          lastLap: row.lap,
          laps: [lap],
        },
      });
      continue;
    }
    existing.driver.laps.push(lap);
    if (row.lap < existing.driver.firstLap) existing.driver.firstLap = row.lap;
    if (row.lap > existing.driver.lastLap) existing.driver.lastLap = row.lap;
  }

  return [...byDriver.values()]
    .sort((a, b) =>
      compareFinish(
        { finishPosition: a.driver.finishPosition, grid: a.grid, surname: a.driver.surname },
        { finishPosition: b.driver.finishPosition, grid: b.grid, surname: b.driver.surname },
      ),
    )
    .map((entry) => entry.driver);
}

/**
 * Stint boundaries from pit laps — `DATABASE.md` §6.7, which puts this in application
 * code, and this is that code.
 *
 * `[1 … pit₁]`, `(pit₁ … pit₂]`, … `(pitₙ … lastLap]` — **the in-lap belongs to the
 * stint it ends**, which is why `toLap` is the pit lap itself and the next stint starts
 * the lap after.
 *
 * Three shapes in the data that are real and not defensive guards:
 *
 * - **A one-lap stint.** 494 race pit stops fall on the lap after another one, so
 *   `[p+1 … p+1]` occurs and `laps: 1` is a measurement.
 * - **A stop on lap 1.** The minimum pit lap in the archive is 1, giving a first stint of
 *   exactly one lap.
 * - **A stop at or beyond `lastLap`.** The trailing stint would be empty or inverted, so
 *   it is omitted rather than emitted with `toLap < fromLap` — which is the only case
 *   where a stint is dropped, and it drops nothing a reader could see.
 *
 * @param pitLaps ascending lap numbers, ordered by **lap** and never by `pit_stop.number`
 *                (they disagree on 3 race entries)
 */
export function deriveStints(pitLaps: readonly number[], lastLap: number): Stint[] {
  const stints: Stint[] = [];
  let from = 1;

  for (const [index, pitLap] of pitLaps.entries()) {
    // A stop at or past the driver's last lap closes nothing: the stint it would end
    // extends past the end of their race.
    if (pitLap >= lastLap) break;
    if (pitLap < from) continue;
    stints.push({
      stint: stints.length + 1,
      fromLap: from,
      toLap: pitLap,
      laps: pitLap - from + 1,
      endedByStop: index + 1,
    });
    from = pitLap + 1;
  }

  if (from <= lastLap) {
    stints.push({
      stint: stints.length + 1,
      fromLap: from,
      toLap: lastLap,
      laps: lastLap - from + 1,
      endedByStop: null,
    });
  }

  return stints;
}

/**
 * Attach each driver's stops and derived stints to their lap span.
 *
 * Driven off the lap spans, not the stops, so a driver who never pitted still appears
 * with one full-race stint. `stints` is therefore non-empty for every driver with a lap
 * row, which is what lets a stacked bar have a row per driver rather than per pitter.
 */
export function buildDriverStints(
  spans: readonly LapSpanRow[],
  stopRows: readonly PitStopRow[],
): DriverStints[] {
  const stopsByDriver = new Map<string, PitStop[]>();
  for (const row of stopRows) {
    const list = stopsByDriver.get(row.driverRef) ?? [];
    list.push({ stopNumber: row.stopNumber, lap: row.lap, durationMs: row.durationMs });
    stopsByDriver.set(row.driverRef, list);
  }

  return [...spans]
    .sort((a, b) => compareFinish(a, b))
    .map((span) => {
      const stops = stopsByDriver.get(span.driverRef) ?? [];
      return {
        driverRef: span.driverRef,
        code: span.code,
        surname: span.surname,
        teamRef: span.teamRef,
        lastLap: span.lastLap,
        stops,
        stints: deriveStints(
          stops.map((stop) => stop.lap),
          span.lastLap,
        ),
      };
    });
}

/**
 * The pit-duration distribution, for the same anti-drift reason as `buildPaceSummary`:
 * RD-7 clips its axis against these figures and two charts must not compute two of them.
 *
 * A stop with no recorded duration is counted in `stops` and excluded from the
 * statistics — it happened, and its length is unknown. Currently null on **zero** of
 * 12,582 race stops.
 */
export function buildPitDurationSummary(rows: readonly PitStopRow[]): PitDurationSummary {
  const durations = rows
    .map((row) => row.durationMs)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  return {
    stops: rows.length,
    timedStops: durations.length,
    fastestMs: durations[0] ?? null,
    medianMs: percentileNearestRank(durations, 50),
    p90Ms: percentileNearestRank(durations, 90),
    slowestMs: durations.length === 0 ? null : (durations[durations.length - 1] ?? null),
  };
}

/** The whole lap payload, from one query's rows. */
export function buildRaceLaps(year: number, round: number, rows: readonly LapQueryRow[]): RaceLaps {
  const drivers = buildDriverLaps(rows);
  let firstLap: number | null = null;
  let lastLap: number | null = null;
  for (const driver of drivers) {
    if (firstLap === null || driver.firstLap < firstLap) firstLap = driver.firstLap;
    if (lastLap === null || driver.lastLap > lastLap) lastLap = driver.lastLap;
  }

  return {
    year,
    round,
    firstLap,
    lastLap,
    lapCount: rows.length,
    pace: buildPaceSummary(rows),
    drivers,
  };
}

/* -------------------------------------------------------------------- read functions */

/** False for a well-formed round the season does not hold — the 404 case. */
export function roundExists(year: number, round: number): boolean {
  return Q_ROUND_EXISTS().get({ year, round }) !== undefined;
}

/**
 * `GET /api/seasons/:year/races/:round`, or null when the round is absent.
 *
 * Returning null rather than throwing keeps the 404 decision in the route handler, where
 * the HTTP vocabulary belongs — the same split `readSeason` uses.
 */
export function readRace(year: number, round: number): Race | null {
  const round_ = Q_ROUND().get({ year, round }) as RoundRow | undefined;
  if (round_ === undefined) return null;

  const classificationRows = Q_CLASSIFICATION().all({ year, round }) as ClassificationRow[];
  const availability = Q_AVAILABILITY().get({ year, round }) as AvailabilityRow;
  const classification = buildClassification(classificationRows);

  return {
    year,
    round: round_.round,
    name: round_.name,
    date: round_.date,
    isCancelled: toBoolean(round_.isCancelled),
    circuit:
      round_.circuitRef === null || round_.circuitName === null
        ? null
        : {
            ref: round_.circuitRef,
            name: round_.circuitName,
            locality: round_.locality,
            country: round_.country,
            countryCode: round_.countryCode,
          },
    startTime: toStartTime(round_.timestamp),
    timezone: round_.timezone,
    // The existence of classification rows, never a date comparison (trap 13). It is
    // stated rather than left to `classification.length`, so an empty array cannot mean
    // both "not run yet" and "results missing".
    hasResults: classification.length > 0,
    raceLaps:
      classification.length === 0
        ? null
        : Math.max(...classification.map((row) => row.lapsCompleted)),
    classification,
    weekend: buildWeekend(Q_WEEKEND().all({ year, round }) as WeekendRow[]),
    availability: {
      hasLapData: toBoolean(availability.hasLapData),
      hasPitData: toBoolean(availability.hasPitData),
    },
  };
}

/**
 * `GET /api/seasons/:year/races/:round/laps`, or null when the round is absent.
 *
 * A round that exists with no lap rows returns an **empty payload, not a 404**: the
 * question "does this race have lap data" has the answer "no", which is a designed state
 * (`DESIGN_SYSTEM.md` §6.5.3) and not a missing resource. The client should not reach
 * here at all in that case — the spine's `availability.hasLapData` says so first — but
 * the endpoint must still answer honestly if it does.
 */
export function readRaceLaps(year: number, round: number): RaceLaps | null {
  if (!roundExists(year, round)) return null;
  return buildRaceLaps(year, round, Q_RACE_LAPS().all({ year, round }) as LapQueryRow[]);
}

/** `GET /api/seasons/:year/races/:round/stints`, or null when the round is absent. */
export function readRaceStints(year: number, round: number): RaceStints | null {
  if (!roundExists(year, round)) return null;
  const stopRows = Q_RACE_PITS().all({ year, round }) as PitStopRow[];
  return {
    year,
    round,
    drivers: buildDriverStints(Q_ENTRY_LAP_SPANS().all({ year, round }) as LapSpanRow[], stopRows),
    durations: buildPitDurationSummary(stopRows),
  };
}
