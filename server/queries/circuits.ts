import type { QualifyingSession } from '../schemas/entity';
import type {
  Circuit,
  CircuitDriverRecord,
  CircuitRace,
  CircuitTeamRecord,
} from '../schemas/circuit';
import { toBoolean } from './seasons';
import { prepared } from './prepared';

/**
 * ALL SQL for the circuit profile (ARCHITECTURE.md §3). Every statement is parameterised —
 * named parameters, never interpolation (S-1).
 *
 * ===================================================================== S-10, and its bound
 *
 * `:reference` selects one circuit. The busiest venue in the archive is **Monza with 75
 * Grands Prix and 1,732 classification rows**, which bounds every result set here. There
 * is no `limit`, `sort` or `filter` parameter.
 *
 * `lap` is read **once**, as a short-circuiting `EXISTS` per round through
 * `idx_lap_entry` (`DATABASE.md` §6.4). That is the same access `SQL_SEASON_ROUNDS` makes
 * and it is bounded to one round's session entries — 75 of them at worst. No statement
 * here scans `lap` and none reads `pit_stop`.
 *
 * ==================================================================== traps handled here
 *
 *  1  `session.has_time_data` is never read. `hasLapData` tests for `lap` rows.
 *  3  `position IS NULL` is never read as a DNF.
 * 11  no internal integer id reaches a payload.
 * 12  a cancelled round has no number and is excluded by `r.number IS NOT NULL`; it is not
 *     a race held at the venue, so it is absent from `roundsHeld` rather than counted and
 *     hidden.
 * 13  a future round is returned with `hasResults: false` — the existence of
 *     classification rows, never a comparison against today's date.
 * 16  `position = 1` is not unique: three races have two winners. `winners` is a list.
 * 17  a driver can hold two rows in one race (40 races before 1965). `starts` and `wins`
 *     for the venue record are counted over **distinct races**, in `buildRecords`.
 */

/* ------------------------------------------------------------------------------- SQL */

const SQL_CIRCUIT_EXISTS = `SELECT 1 AS present FROM circuit WHERE reference = @ref`;

const SQL_CIRCUIT_PROFILE = `
SELECT reference    AS ref,
       name         AS name,
       locality     AS locality,
       country      AS country,
       country_code AS countryCode,
       latitude     AS latitude,
       longitude    AS longitude,
       altitude     AS altitude
FROM circuit
WHERE reference = @ref`;

/**
 * Every numbered round held at the venue, with the two availability facts.
 *
 * `hasResults` is the existence of classification rows and **never a date comparison** —
 * the dump can lag the real calendar by ~2 weeks, so a date test reports a race as run
 * with nothing in it (`REQUIREMENTS.md` §2.5). It is stated rather than left to
 * `entries > 0` so an empty race cannot mean two things.
 */
export const SQL_CIRCUIT_ROUNDS = `
SELECT s.year   AS year,
       r.number AS round,
       r.name   AS name,
       r.date   AS date,
       (SELECT count(*) FROM session ses
        JOIN session_entry se ON se.session_id = ses.id
        WHERE ses.round_id = r.id AND ses.type = 'R') AS entries,
       EXISTS (SELECT 1 FROM session ses
               JOIN session_entry se ON se.session_id = ses.id
               WHERE ses.round_id = r.id AND ses.type = 'R') AS hasResults,
       EXISTS (SELECT 1 FROM session ses
               JOIN session_entry se ON se.session_id = ses.id
               JOIN lap l ON l.session_entry_id = se.id
               WHERE ses.round_id = r.id AND ses.type = 'R') AS hasLapData,
       EXISTS (SELECT 1 FROM session q
               JOIN session_entry qe ON qe.session_id = q.id
               WHERE q.round_id = r.id
                 AND q.type IN ('Q1','Q2','Q3','QA','QB')
                 AND qe.position IS NOT NULL) AS hasQualifying
FROM circuit c
JOIN round r  ON r.circuit_id = c.id
JOIN season s ON s.id = r.season_id
WHERE c.reference = @ref AND r.number IS NOT NULL
ORDER BY s.year DESC, r.number DESC`;

/**
 * Every race classification row at the venue — the input to CI-2's winners and CI-3's
 * records.
 *
 * **`CROSS JOIN` is load-bearing here and is not a different kind of join.** In SQLite it
 * is the one available join-order hint: it forbids the planner from reordering, and
 * without it the plan for this statement was `SEARCH ses USING idx_session_type` — that
 * is, walk **all 1,173 race sessions** and check afterwards whether each belongs to this
 * circuit, which is work no parameter can reduce. Forcing `circuit_round` to be the outer
 * loop turns it into `idx_circuit_ref → idx_round_circuit → idx_session_round →
 * idx_se_session`, genuinely anchored on the venue, and it is also faster: **3.1 ms
 * against 5.0 ms** on Monza, the archive's busiest venue at 76 rounds and 1,732 rows.
 * `queries/circuits.test.ts` asserts the plan, because both versions return identical
 * data and only one of them is bounded by the parameter.
 *
 * The identity join below `session_entry` mirrors `v_entry` exactly.
 */
export const SQL_CIRCUIT_RESULTS = `
WITH circuit_round AS MATERIALIZED (
  SELECT r.id AS round_id, s.year AS year, r.number AS round
  FROM circuit c
  JOIN round r  ON r.circuit_id = c.id
  JOIN season s ON s.id = r.season_id
  WHERE c.reference = @ref AND r.number IS NOT NULL
),
circuit_entry AS MATERIALIZED (
  SELECT cr.year            AS year,
         cr.round           AS round,
         se.round_entry_id  AS round_entry_id,
         se.position        AS position,
         se.points          AS points,
         se.status          AS status
  FROM circuit_round cr
  CROSS JOIN session ses      ON ses.round_id = cr.round_id AND ses.type = 'R'
  CROSS JOIN session_entry se ON se.session_id = ses.id
)
SELECT ce.year         AS year,
       ce.round        AS round,
       d.reference     AS driverRef,
       d.abbreviation  AS code,
       d.forename, d.surname,
       t.reference     AS teamRef,
       t.name          AS teamName,
       ce.position     AS position,
       ce.points       AS points,
       ce.status       AS status
FROM circuit_entry ce
JOIN round_entry re   ON re.id = ce.round_entry_id
JOIN team_driver td   ON td.id = re.team_driver_id
JOIN driver d         ON d.id = td.driver_id
JOIN team t           ON t.id = td.team_id
ORDER BY ce.year, ce.round, (ce.position IS NULL), ce.position, ce.points DESC, d.surname`;

/**
 * Qualifying leaders at the venue — every session type, every P1.
 *
 * **The overall pole is the P1 of the highest segment the round ran**, so this returns
 * `position = 1` for all five types and `pickPole` chooses. That is exact rather than
 * approximate: each knockout segment ranks everyone who took part in it, so Q3's P1 is
 * the overall P1 whenever a Q3 exists, and the same holds down the chain.
 *
 * Sprint qualifying (`SQ1`–`SQ3`) is deliberately absent: it sets the sprint grid, not the
 * Grand Prix grid.
 *
 * **No `CROSS JOIN` here, unlike `SQL_CIRCUIT_RESULTS`, and that is measured rather than
 * inconsistent.** The planner enters through `idx_se_position (position = 1)` — roughly
 * 5,200 rows across every session type in the archive, a fixed cost no parameter can
 * widen — and joins back to the venue's rounds. Forcing the venue-first order instead made
 * it look at `idx_se_position` once **per qualifying session** and took it from 1.2 ms to
 * **74 ms**, 60× worse. The join-order hint is a tool, not a rule.
 */
export const SQL_CIRCUIT_POLES = `
WITH circuit_round AS MATERIALIZED (
  SELECT r.id AS round_id, s.year AS year, r.number AS round
  FROM circuit c
  JOIN round r  ON r.circuit_id = c.id
  JOIN season s ON s.id = r.season_id
  WHERE c.reference = @ref AND r.number IS NOT NULL
)
SELECT cr.year        AS year,
       cr.round       AS round,
       ses.type       AS sessionType,
       d.reference    AS driverRef,
       d.abbreviation AS code,
       d.forename, d.surname
FROM circuit_round cr
JOIN session ses      ON ses.round_id = cr.round_id AND ses.type IN ('Q1','Q2','Q3','QA','QB')
JOIN session_entry se ON se.session_id = ses.id AND se.position = 1
JOIN round_entry re   ON re.id = se.round_entry_id
JOIN team_driver td   ON td.id = re.team_driver_id
JOIN driver d         ON d.id = td.driver_id
ORDER BY cr.year, cr.round, d.surname`;

const Q_CIRCUIT_EXISTS = prepared(SQL_CIRCUIT_EXISTS);
const Q_CIRCUIT_PROFILE = prepared(SQL_CIRCUIT_PROFILE);
const Q_CIRCUIT_ROUNDS = prepared(SQL_CIRCUIT_ROUNDS);
const Q_CIRCUIT_RESULTS = prepared(SQL_CIRCUIT_RESULTS);
const Q_CIRCUIT_POLES = prepared(SQL_CIRCUIT_POLES);

/**
 * How many entries CI-3's two lists carry.
 *
 * A cap rather than "everyone", because Monza's 75 Grands Prix involve several hundred
 * drivers and a list of the ones with no wins is not a record of success. Ten is enough to
 * show a clear leader and a tail without becoming a table of its own.
 */
export const TOP_RECORD_LIMIT = 10;

/* ------------------------------------------------------------------------- row shapes */

interface CircuitProfileRow {
  ref: string;
  name: string;
  locality: string | null;
  country: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
}

export interface CircuitRoundRow {
  year: number;
  round: number;
  name: string;
  date: string;
  entries: number;
  hasResults: number;
  hasLapData: number;
  hasQualifying: number;
}

export interface CircuitResultRow {
  year: number;
  round: number;
  driverRef: string;
  code: string | null;
  forename: string;
  surname: string;
  teamRef: string;
  teamName: string;
  position: number | null;
  points: number;
  status: number;
}

export interface CircuitPoleRow {
  year: number;
  round: number;
  sessionType: string;
  driverRef: string;
  code: string | null;
  forename: string;
  surname: string;
}

/* ------------------------------------------------------- pure builders (no database) */

const roundKey = (year: number, round: number): string => `${String(year)}:${String(round)}`;

const POLE_PRIORITY: readonly QualifyingSession[] = ['Q3', 'Q2', 'Q1', 'QA', 'QB'];

/**
 * The round's pole sitters — the P1 rows of the **highest segment that round ran**.
 *
 * Returning a list rather than a row for the same reason `winners` is a list: `position`
 * is not a unique key within a session anywhere in this schema (trap 16), so a singular
 * field would silently pick one at the mercy of row order. No shared pole has been
 * observed; the shape is defensive about the schema, not about a known case.
 */
export function pickPole(
  rows: readonly CircuitPoleRow[],
): { rows: CircuitPoleRow[]; session: QualifyingSession } | null {
  for (const session of POLE_PRIORITY) {
    const matching = rows.filter((row) => row.sessionType === session);
    if (matching.length > 0) return { rows: matching, session };
  }
  return null;
}

/** CI-2. Attach winners and pole sitters to each round at the venue. */
export function buildCircuitRaces(
  rounds: readonly CircuitRoundRow[],
  results: readonly CircuitResultRow[],
  poles: readonly CircuitPoleRow[],
): CircuitRace[] {
  const winnersByRound = new Map<string, CircuitResultRow[]>();
  for (const row of results) {
    if (row.position !== 1) continue;
    const key = roundKey(row.year, row.round);
    const list = winnersByRound.get(key) ?? [];
    list.push(row);
    winnersByRound.set(key, list);
  }

  const polesByRound = new Map<string, CircuitPoleRow[]>();
  for (const row of poles) {
    const key = roundKey(row.year, row.round);
    const list = polesByRound.get(key) ?? [];
    list.push(row);
    polesByRound.set(key, list);
  }

  return rounds.map((round) => {
    const key = roundKey(round.year, round.round);
    const pole = pickPole(polesByRound.get(key) ?? []);
    return {
      year: round.year,
      round: round.round,
      name: round.name,
      date: round.date,
      hasResults: toBoolean(round.hasResults),
      hasLapData: toBoolean(round.hasLapData),
      entries: round.entries,
      winners: (winnersByRound.get(key) ?? []).map((row) => ({
        driverRef: row.driverRef,
        code: row.code,
        forename: row.forename,
        surname: row.surname,
        teamRef: row.teamRef,
        teamName: row.teamName,
        points: row.points,
      })),
      poleSitters: (pole?.rows ?? []).map((row) => ({
        driverRef: row.driverRef,
        code: row.code,
        forename: row.forename,
        surname: row.surname,
        session: pole?.session ?? 'QB',
      })),
      hasQualifying: toBoolean(round.hasQualifying),
    };
  });
}

const NON_START_STATUS = new Set([30, 40]);

/**
 * CI-3. Who has done best here.
 *
 * **Every count is over distinct races**, which is what trap 17 makes necessary rather
 * than tidy: 40 races before 1965 classify one driver twice, so a row count would give
 * Ascari two starts at Monza in 1950. The rows arrive best-position-first within a round,
 * so the first sighting of a `(driver, round)` pair carries that driver's result.
 *
 * Team podiums are counted as distinct `(round, position)` pairs so a 1-2 counts twice
 * and a shared car classified P2 counts once; team `races` is distinct rounds entered.
 */
export function buildRecords(rows: readonly CircuitResultRow[]): {
  topDrivers: CircuitDriverRecord[];
  topTeams: CircuitTeamRecord[];
} {
  interface DriverAcc extends CircuitDriverRecord {
    seen: Set<string>;
  }
  interface TeamAcc extends CircuitTeamRecord {
    rounds: Set<string>;
    winRounds: Set<string>;
    podiumSlots: Set<string>;
  }

  const drivers = new Map<string, DriverAcc>();
  const teams = new Map<string, TeamAcc>();

  for (const row of rows) {
    const key = roundKey(row.year, row.round);

    let driver = drivers.get(row.driverRef);
    if (driver === undefined) {
      driver = {
        driverRef: row.driverRef,
        code: row.code,
        forename: row.forename,
        surname: row.surname,
        starts: 0,
        wins: 0,
        podiums: 0,
        bestFinish: null,
        seen: new Set<string>(),
      };
      drivers.set(row.driverRef, driver);
    }
    if (!driver.seen.has(key)) {
      driver.seen.add(key);
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

    let team = teams.get(row.teamRef);
    if (team === undefined) {
      team = {
        teamRef: row.teamRef,
        name: row.teamName,
        races: 0,
        wins: 0,
        podiums: 0,
        rounds: new Set<string>(),
        winRounds: new Set<string>(),
        podiumSlots: new Set<string>(),
      };
      teams.set(row.teamRef, team);
    }
    team.rounds.add(key);
    if (row.position === 1) team.winRounds.add(key);
    if (row.position !== null && row.position <= 3) {
      team.podiumSlots.add(`${key}:${String(row.position)}`);
    }
  }

  const topDrivers = [...drivers.values()]
    .map((driver) => ({
      driverRef: driver.driverRef,
      code: driver.code,
      forename: driver.forename,
      surname: driver.surname,
      starts: driver.starts,
      wins: driver.wins,
      podiums: driver.podiums,
      bestFinish: driver.bestFinish,
    }))
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.podiums - a.podiums ||
        b.starts - a.starts ||
        a.surname.localeCompare(b.surname),
    )
    .slice(0, TOP_RECORD_LIMIT);

  const topTeams = [...teams.values()]
    .map((team) => ({
      teamRef: team.teamRef,
      name: team.name,
      races: team.rounds.size,
      wins: team.winRounds.size,
      podiums: team.podiumSlots.size,
    }))
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.podiums - a.podiums ||
        b.races - a.races ||
        a.name.localeCompare(b.name),
    )
    .slice(0, TOP_RECORD_LIMIT);

  return { topDrivers, topTeams };
}

/** Assemble the payload from rows already read. Pure, so CI exercises it without a database. */
export function buildCircuit(
  profile: CircuitProfileRow,
  roundRows: readonly CircuitRoundRow[],
  resultRows: readonly CircuitResultRow[],
  poleRows: readonly CircuitPoleRow[],
): Circuit {
  const races = buildCircuitRaces(roundRows, resultRows, poleRows);
  const withResults = races.filter((race) => race.hasResults);
  const years = withResults.map((race) => race.year);
  const records = buildRecords(resultRows);

  return {
    circuit: {
      ref: profile.ref,
      name: profile.name,
      locality: profile.locality,
      country: profile.country,
      countryCode: profile.countryCode,
      latitude: profile.latitude,
      longitude: profile.longitude,
      altitude: profile.altitude,
    },
    firstYear: years.length === 0 ? null : Math.min(...years),
    lastYear: years.length === 0 ? null : Math.max(...years),
    roundsHeld: races.length,
    racesWithResults: withResults.length,
    races,
    topDrivers: records.topDrivers,
    topTeams: records.topTeams,
  };
}

/* -------------------------------------------------------------------- read functions */

/** False for a well-formed reference the dataset does not hold — the 404 case. */
export function circuitExists(reference: string): boolean {
  return Q_CIRCUIT_EXISTS().get({ ref: reference }) !== undefined;
}

/** `GET /api/circuits/:reference`, or null when the circuit is absent. */
export function readCircuit(reference: string): Circuit | null {
  const profile = Q_CIRCUIT_PROFILE().get({ ref: reference }) as CircuitProfileRow | undefined;
  if (profile === undefined) return null;

  return buildCircuit(
    profile,
    Q_CIRCUIT_ROUNDS().all({ ref: reference }) as CircuitRoundRow[],
    Q_CIRCUIT_RESULTS().all({ ref: reference }) as CircuitResultRow[],
    Q_CIRCUIT_POLES().all({ ref: reference }) as CircuitPoleRow[],
  );
}
