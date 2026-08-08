import type { Team, TeamSeason, TeamSeasonDriver, TeamTotals } from '../schemas/team';
import type { EntityRoundRef } from '../schemas/entity';
import { classifyAdjustment, readSeasonCompleteness } from './seasons';
import { prepared } from './prepared';

/**
 * ALL SQL for the team profile (ARCHITECTURE.md §3). Every statement is parameterised —
 * named parameters, never interpolation, not even for a slug the route has already
 * allowlisted (S-1).
 *
 * ===================================================== why this is not `v_race` either
 *
 * The same measurement as `queries/drivers.ts`, on `ferrari` — 2,500 race entries across
 * 77 seasons, the largest team in the archive. Both statements returning the same columns
 * and the same rows, 30 timed runs warm: `SELECT … FROM v_race WHERE team_ref = ?` plans
 * as `SEARCH ses USING idx_session_type` and filters the team last, at **24–36 ms p50**;
 * the `team_entry` CTE below enters through `idx_team_ref → idx_td_team → idx_re_td →
 * idx_se_re` at **13–17 ms p50**. See ARCHITECTURE.md §10 #32 — the canonical views are
 * entered by `(year, round)` and there is no way to enter them by an entity.
 *
 * Ferrari is the archive's worst case and it is stated rather than smoothed: the whole
 * payload measures **~30 ms p50 / ~55 ms p95** end to end, against §8's aspirational
 * 50 ms p95 for a non-lap endpoint. The dominant cost is SQLite materialising 2,500 row
 * objects, not the plan. It was left as raw rows plus a pure builder rather than pushed
 * into `GROUP BY` aggregates because the counting rules here are exactly where traps 16
 * and 17 bite, and CI — which never has `data/f1.db` — can only exercise them in the
 * builder. A typical team measures 10–25 ms.
 *
 * ===================================================================== S-10, and its bound
 *
 * **No statement here reads `lap` or `pit_stop`.** `:reference` selects one team and the
 * largest result set the archive can produce is Ferrari's 2,500 rows across 77 seasons.
 * There is no `limit`, `sort` or `filter` parameter. `SQL_TEAM_CHAMPIONSHIPS` groups all
 * 14,205 `team_championship` rows to find each season's final snapshot — a fixed cost
 * independent of the parameter, measured at ~3 ms, against 30 ms for the correlated
 * alternative.
 *
 * ==================================================================== traps handled here
 *
 *  3  `position IS NULL` is never read as a DNF.
 *  4  championship points and titles are **read** from `team_championship`. The only sum
 *     in this module is over one season's `session_entry.points`, published under the
 *     name `racePoints` and never as a championship figure (`schemas/team.ts`).
 *  5  `base_team_id` is never selected. The table holds 0 rows, so lineage is unavailable
 *     and is not claimed.
 *  6  no `primary_color` crosses the boundary.
 * 11  no internal integer id reaches a payload.
 * 14  `adjustment_type` is not displayed; `classifyAdjustment` derives an observable state.
 * 15  `r.number IS NOT NULL` on every statement.
 * 16  `position = 1` is not unique within a race — three races have two winners. A win is
 *     a **distinct race**, computed in `buildTeamSeasons`.
 * 17  71 `(race, driver, team)` triples hold more than one row. Driver-level counts are
 *     collapsed per race before anything is counted.
 */

/* ------------------------------------------------------------------------------- SQL */

const SQL_TEAM_EXISTS = `SELECT 1 AS present FROM team WHERE reference = @ref`;

const SQL_TEAM_PROFILE = `
SELECT reference    AS ref,
       name         AS name,
       nationality  AS nationality,
       country_code AS countryCode
FROM team
WHERE reference = @ref`;

/**
 * Every race classification row for one team, with the driver on it.
 *
 * One statement feeds CN-1 through CN-4: the totals, the per-season summary, the lineup
 * and the intra-team points split are all folds over these rows, so they cannot disagree
 * with one another about what a season contained.
 *
 * Ordered so the fold is deterministic and the per-driver collapse can take the first row
 * it sees for a race as that driver's result — classified positions ascending, unranked
 * last, exactly as the race page orders a classification.
 */
export const SQL_TEAM_RACES = `
WITH team_entry AS MATERIALIZED (
  SELECT se.id            AS entry_id,
         se.session_id    AS session_id,
         td.driver_id     AS driver_id,
         se.position      AS position,
         se.points        AS points,
         se.status        AS status
  FROM team t
  JOIN team_driver td   ON td.team_id = t.id
  JOIN round_entry re   ON re.team_driver_id = td.id
  JOIN session_entry se ON se.round_entry_id = re.id
  WHERE t.reference = @ref
)
SELECT s.year        AS year,
       r.number      AS round,
       r.name        AS name,
       r.date        AS date,
       c.reference   AS circuitRef,
       c.name        AS circuitName,
       d.reference   AS driverRef,
       d.abbreviation AS code,
       d.forename, d.surname,
       te.position   AS position,
       te.points     AS points,
       te.status     AS status
FROM team_entry te
JOIN session ses    ON ses.id = te.session_id AND ses.type = 'R'
JOIN round r        ON r.id = ses.round_id
JOIN season s       ON s.id = r.season_id
LEFT JOIN circuit c ON c.id = r.circuit_id
JOIN driver d       ON d.id = te.driver_id
WHERE r.number IS NOT NULL
ORDER BY s.year, r.number, (te.position IS NULL), te.position, d.surname`;

/**
 * The team's standing at the end of every season it contested — `DATABASE.md` §6.6's rule
 * applied across seasons.
 *
 * Grouped over the whole table for the same reason as the driver version: the final
 * snapshot is a property of the **season**, so a team that folded mid-season still has a
 * row at the last round and its own last row would be a mid-season standing.
 */
export const SQL_TEAM_CHAMPIONSHIPS = `
WITH last_snapshot AS (
  SELECT year, max(round_number * 1000 + session_number) AS k
  FROM team_championship
  GROUP BY year
)
SELECT tc.year            AS year,
       tc.points          AS points,
       tc.position        AS position,
       tc.win_count       AS wins,
       tc.adjustment_type AS adjustmentType
FROM team_championship tc
JOIN team t ON t.id = tc.team_id
JOIN last_snapshot ls
  ON ls.year = tc.year AND (tc.round_number * 1000 + tc.session_number) = ls.k
WHERE t.reference = @ref
ORDER BY tc.year`;

const Q_TEAM_EXISTS = prepared(SQL_TEAM_EXISTS);
const Q_TEAM_PROFILE = prepared(SQL_TEAM_PROFILE);
const Q_TEAM_RACES = prepared(SQL_TEAM_RACES);
const Q_TEAM_CHAMPIONSHIPS = prepared(SQL_TEAM_CHAMPIONSHIPS);

/* ------------------------------------------------------------------------- row shapes */

interface TeamProfileRow {
  ref: string;
  name: string;
  nationality: string | null;
  countryCode: string | null;
}

export interface TeamRaceRow {
  year: number;
  round: number;
  name: string;
  date: string;
  circuitRef: string | null;
  circuitName: string | null;
  driverRef: string;
  code: string | null;
  forename: string;
  surname: string;
  position: number | null;
  points: number;
  status: number;
}

export interface TeamChampionshipRow {
  year: number;
  points: number;
  position: number | null;
  wins: number;
  adjustmentType: number | null;
}

/* ------------------------------------------------------- pure builders (no database) */

const NON_START_STATUS = new Set([30, 40]);

interface DriverAccumulator {
  driverRef: string;
  code: string | null;
  forename: string;
  surname: string;
  firstRound: number;
  lastRound: number;
  entries: number;
  starts: number;
  wins: number;
  podiums: number;
  bestFinish: number | null;
  racePoints: number;
  /** Races already folded for this driver, so a second row does not re-count a start. */
  seenRounds: Set<number>;
}

interface SeasonAccumulator {
  year: number;
  entries: number;
  rounds: Set<number>;
  winRounds: Set<number>;
  /** `round:position` for every top-three placing, so a shared podium counts once. */
  podiumSlots: Set<string>;
  bestFinish: number | null;
  drivers: Map<string, DriverAccumulator>;
}

/**
 * Fold one team's race rows into per-season accumulators.
 *
 * Three different counting rules live here and each exists for a measured reason:
 *
 * - **`rounds` and `winRounds` are sets of round numbers.** Three races have two P1 rows
 *   (trap 16), so counting rows would give Alfa Romeo two wins for the 1951 French Grand
 *   Prix.
 * - **`podiumSlots` is a set of `round:position`.** A 1-2 finish is two podiums; a shared
 *   car classified P2 is one. 20 `(race, position)` pairs in the archive hold more than
 *   one row.
 * - **A driver's per-race facts are folded on first sight of a round** (`seenRounds`),
 *   because 71 `(race, driver, team)` triples hold two or three rows where a driver took
 *   over a second car (trap 17). Points are the exception and are summed, because both
 *   cars' scores were the driver's.
 */
export function foldTeamRaces(rows: readonly TeamRaceRow[]): Map<number, SeasonAccumulator> {
  const byYear = new Map<number, SeasonAccumulator>();

  for (const row of rows) {
    let season = byYear.get(row.year);
    if (season === undefined) {
      season = {
        year: row.year,
        entries: 0,
        rounds: new Set<number>(),
        winRounds: new Set<number>(),
        podiumSlots: new Set<string>(),
        bestFinish: null,
        drivers: new Map<string, DriverAccumulator>(),
      };
      byYear.set(row.year, season);
    }

    season.entries += 1;
    season.rounds.add(row.round);
    if (row.position === 1) season.winRounds.add(row.round);
    if (row.position !== null && row.position <= 3) {
      season.podiumSlots.add(`${String(row.round)}:${String(row.position)}`);
    }
    if (row.position !== null && (season.bestFinish === null || row.position < season.bestFinish)) {
      season.bestFinish = row.position;
    }

    let driver = season.drivers.get(row.driverRef);
    if (driver === undefined) {
      driver = {
        driverRef: row.driverRef,
        code: row.code,
        forename: row.forename,
        surname: row.surname,
        firstRound: row.round,
        lastRound: row.round,
        entries: 0,
        starts: 0,
        wins: 0,
        podiums: 0,
        bestFinish: null,
        racePoints: 0,
        seenRounds: new Set<number>(),
      };
      season.drivers.set(row.driverRef, driver);
    }

    driver.entries += 1;
    driver.racePoints += row.points;
    if (row.round < driver.firstRound) driver.firstRound = row.round;
    if (row.round > driver.lastRound) driver.lastRound = row.round;

    // The rows arrive best-position-first within a round, so the first sighting carries
    // this driver's result for that race and any later one is the car they abandoned.
    if (!driver.seenRounds.has(row.round)) {
      driver.seenRounds.add(row.round);
      if (!NON_START_STATUS.has(row.status)) driver.starts += 1;
      if (row.position === 1) driver.wins += 1;
      if (row.position !== null && row.position <= 3) driver.podiums += 1;
      if (
        row.position !== null &&
        (driver.bestFinish === null || row.position < driver.bestFinish)
      ) {
        driver.bestFinish = row.position;
      }
    }
  }

  return byYear;
}

export function buildTeamSeasons(
  rows: readonly TeamRaceRow[],
  championships: readonly TeamChampionshipRow[],
  seasonComplete: ReadonlyMap<number, boolean>,
): TeamSeason[] {
  const byYear = foldTeamRaces(rows);
  const championshipByYear = new Map<number, TeamChampionshipRow>();
  for (const row of championships) championshipByYear.set(row.year, row);

  return [...byYear.values()]
    .sort((a, b) => a.year - b.year)
    .map((season) => {
      const snapshot = championshipByYear.get(season.year);
      const isComplete = seasonComplete.get(season.year) ?? false;
      const driverRacePointsTotal = [...season.drivers.values()].reduce(
        (sum, driver) => sum + driver.racePoints,
        0,
      );

      const drivers: TeamSeasonDriver[] = [...season.drivers.values()]
        .sort(
          (a, b) =>
            b.racePoints - a.racePoints ||
            a.firstRound - b.firstRound ||
            a.surname.localeCompare(b.surname),
        )
        .map((driver) => ({
          driverRef: driver.driverRef,
          code: driver.code,
          forename: driver.forename,
          surname: driver.surname,
          firstRound: driver.firstRound,
          lastRound: driver.lastRound,
          entries: driver.entries,
          starts: driver.starts,
          wins: driver.wins,
          podiums: driver.podiums,
          bestFinish: driver.bestFinish,
          racePoints: driver.racePoints,
          racePointsShare:
            driverRacePointsTotal === 0 ? null : driver.racePoints / driverRacePointsTotal,
        }));

      return {
        year: season.year,
        entries: season.entries,
        races: season.rounds.size,
        wins: season.winRounds.size,
        podiums: season.podiumSlots.size,
        bestFinish: season.bestFinish,
        points: snapshot?.points ?? null,
        position: snapshot?.position ?? null,
        championshipWins: snapshot?.wins ?? null,
        adjustment: classifyAdjustment(
          snapshot?.adjustmentType ?? null,
          snapshot?.position ?? null,
        ),
        // Derived from the presence of a snapshot rather than from `year >= 1958`: the
        // season hub reaches the same fact through `championship_system`, and neither is
        // allowed to be a hard-coded year (`schemas/season.ts`, `countingSchema`).
        hasTeamStandings: snapshot !== undefined,
        isSeasonComplete: isComplete,
        isChampion: isComplete && snapshot?.position === 1,
        driverRacePointsTotal,
        drivers,
      };
    });
}

export function buildTeamTotals(
  rows: readonly TeamRaceRow[],
  seasons: readonly TeamSeason[],
): TeamTotals {
  const races = new Set<string>();
  const winRaces = new Set<string>();
  const podiumSlots = new Set<string>();
  const drivers = new Set<string>();

  for (const row of rows) {
    const key = `${String(row.year)}:${String(row.round)}`;
    races.add(key);
    drivers.add(row.driverRef);
    if (row.position === 1) winRaces.add(key);
    if (row.position !== null && row.position <= 3) {
      podiumSlots.add(`${key}:${String(row.position)}`);
    }
  }

  return {
    races: races.size,
    entries: rows.length,
    wins: winRaces.size,
    podiums: podiumSlots.size,
    driversUsed: drivers.size,
    championships: seasons.filter((season) => season.isChampion).length,
  };
}

function toRoundRef(row: TeamRaceRow | undefined): EntityRoundRef | null {
  if (row === undefined) return null;
  return {
    year: row.year,
    round: row.round,
    name: row.name,
    date: row.date,
    circuitRef: row.circuitRef,
    circuitName: row.circuitName,
  };
}

/** Assemble the payload from rows already read. Pure, so CI exercises it without a database. */
export function buildTeam(
  profile: TeamProfileRow,
  raceRows: readonly TeamRaceRow[],
  championshipRows: readonly TeamChampionshipRow[],
  seasonComplete: ReadonlyMap<number, boolean>,
): Team {
  const seasons = buildTeamSeasons(raceRows, championshipRows, seasonComplete);

  return {
    team: {
      ref: profile.ref,
      name: profile.name,
      nationality: profile.nationality,
      countryCode: profile.countryCode,
    },
    career: {
      firstSeason: seasons[0]?.year ?? null,
      lastSeason: seasons[seasons.length - 1]?.year ?? null,
      seasonsEntered: seasons.length,
      firstRace: toRoundRef(raceRows[0]),
      lastRace: toRoundRef(raceRows[raceRows.length - 1]),
    },
    totals: buildTeamTotals(raceRows, seasons),
    seasons,
  };
}

/* -------------------------------------------------------------------- read functions */

/** False for a well-formed reference the dataset does not hold — the 404 case. */
export function teamExists(reference: string): boolean {
  return Q_TEAM_EXISTS().get({ ref: reference }) !== undefined;
}

/** `GET /api/teams/:reference`, or null when the team is absent. */
export function readTeam(reference: string): Team | null {
  const profile = Q_TEAM_PROFILE().get({ ref: reference }) as TeamProfileRow | undefined;
  if (profile === undefined) return null;

  return buildTeam(
    profile,
    Q_TEAM_RACES().all({ ref: reference }) as TeamRaceRow[],
    Q_TEAM_CHAMPIONSHIPS().all({ ref: reference }) as TeamChampionshipRow[],
    readSeasonCompleteness(),
  );
}
