import type {
  CircuitList,
  CircuitListItem,
  DriverList,
  DriverListItem,
  TeamList,
  TeamListItem,
} from '../schemas/directory';
import { SEASON_CACHE_TTL_MS } from '../config';
import { memoize } from '../cache/memo';
import { prepared } from './prepared';

/**
 * ALL SQL for the three **index** endpoints (ARCHITECTURE.md §3). Every statement is
 * parameterised — and in this module there is nothing to parameterise, which is itself the
 * security story: see S-4 below.
 *
 * The per-entity modules beside this one are scoped to their **profile** by their own
 * headers, so nothing is being split out of them. One module for three because the three
 * statements are the same statement — aggregate race entries by dimension, then left-join
 * the dimension table — and because the ruling in `schemas/directory.ts` is shared.
 *
 * ================================================== the shape, and the one rejected
 *
 * Each statement is `WITH <entity>_race AS (…), agg AS (… GROUP BY …) SELECT … LEFT JOIN
 * agg`. The **`LEFT JOIN` is the ruling made mechanical**: an inner join would silently
 * drop the 63 drivers, 9 teams and 1 circuit that hold no race row, which is exactly the
 * decision `schemas/directory.ts` argues against — and it would do it invisibly, which is
 * worse than doing it on purpose. `coalesce(…, 0)` turns the resulting NULL into the
 * measured zero the schema publishes.
 *
 * The single-statement alternative — one five-way `LEFT JOIN` chain from `driver` down to
 * `season` with the aggregates in the outer `SELECT` — was rejected: it produces one row
 * per classification row before grouping, so `count(DISTINCT r.id)` is computed over a
 * 26,093-row cross product per driver rather than over a pre-grouped 881-row table.
 *
 * `count(DISTINCT round_id)` rather than `count(*)` is **trap 17**, load-bearing here: 40
 * races between 1950 and 1964 classify the same driver twice or three times, so a row
 * count would give Ascari two races for the 1950 Italian Grand Prix and would disagree
 * with the profile's `totals.races` on 45 drivers.
 *
 * `AND r.number IS NOT NULL` is **trap 15** — a cancelled round carries no number and is
 * not a race entered. It sits in the `JOIN … ON` clause rather than in a `WHERE`, which
 * matters: in a `WHERE` on a left-joined table it would silently become an inner join.
 *
 * ============================================================== S-10, and its bound
 *
 * **No statement here reads `lap` or `pit_stop`, and none takes a parameter.** Two of the
 * three aggregate the 26,093 race classification rows once; the third walks the 1,171
 * numbered rounds. Those are whole-relation reads, and they are bounded **by construction
 * rather than by validation** — there is no parameter, so no request can make any of them
 * larger. That is the same posture as `SQL_DRIVER_CHAMPIONSHIPS`, which groups all 36,091
 * `driver_championship` rows.
 *
 * Measured warm on this machine, `better-sqlite3` on Node 22.23.2, p50 of 12 runs:
 * **drivers 20.2 ms / 881 rows / 139 KB JSON (18.7 KB gzipped), teams 17.7 ms / 214 rows /
 * 26.9 KB (3.9 KB), circuits 2.9 ms / 78 rows / 13.7 KB (2.8 KB).** The plans are asserted
 * in `directory.test.ts`, because a plan is the thing that regresses silently.
 *
 * ======================================================================= memoisation
 *
 * All three are memoised, and this is the case ARCHITECTURE.md §6 convention 4 describes
 * rather than an exception to it. **The key space is exactly one per endpoint** — these
 * routes take no parameter at all, so there is no bounded-key-space cost to weigh, only
 * ~180 KB of retained JSON in total. They are all-time aggregates, which `DATABASE.md` §8
 * and NF-3 say must be cached rather than computed per request, and a directory is fetched
 * on the way to every profile. 20 ms becomes ~0 for the price of a Map entry.
 *
 * The TTL is `SEASON_CACHE_TTL_MS` (one hour), matching the `Cache-Control` the routes
 * send so the browser cache and the process cache expire together.
 *
 * ==================================================================== traps handled here
 *
 *  6  no `primary_color` is selected. Colour is resolved from `ref` client-side.
 * 11  no internal integer id reaches a payload — `reference` only (DL-3).
 * 13  a scheduled round is not missing data. `roundsHeld` counts it and
 *     `racesWithResults` does not, so Madring reads 1 and 0 rather than absent.
 * 15  `r.number IS NOT NULL` on every statement.
 * 17  race counts are over distinct rounds, never over classification rows.
 *
 * Trap 1 does not apply: `session.has_time_data` is not read here, and nothing in a
 * directory depends on lap availability.
 */

/* ------------------------------------------------------------------------------- SQL */

/**
 * 881 drivers with their race count and season span.
 *
 * `ORDER BY d.surname` rides `idx_driver_surname` (the plan reads `SCAN d USING INDEX
 * idx_driver_surname`), so only the last two terms need a temp b-tree. **The order is a
 * stable default and not the reader's sort**: SQLite compares with BINARY collation, which
 * puts `Räikkönen` after `Ryan`. The locale-aware sort is `src/features/entity/selectors.ts`.
 */
export const SQL_DRIVER_INDEX = `
WITH driver_race AS (
  SELECT td.driver_id AS driver_id,
         s.year       AS year,
         r.id         AS round_id
  FROM session_entry se
  JOIN session ses    ON ses.id = se.session_id AND ses.type = 'R'
  JOIN round r        ON r.id = ses.round_id AND r.number IS NOT NULL
  JOIN season s       ON s.id = r.season_id
  JOIN round_entry re ON re.id = se.round_entry_id
  JOIN team_driver td ON td.id = re.team_driver_id
),
agg AS (
  SELECT driver_id,
         count(DISTINCT round_id) AS races,
         min(year)                AS firstSeason,
         max(year)                AS lastSeason
  FROM driver_race
  GROUP BY driver_id
)
SELECT d.reference    AS ref,
       d.abbreviation AS code,
       d.forename     AS forename,
       d.surname      AS surname,
       d.nationality  AS nationality,
       d.country_code AS countryCode,
       coalesce(a.races, 0) AS races,
       a.firstSeason  AS firstSeason,
       a.lastSeason   AS lastSeason
FROM driver d
LEFT JOIN agg a ON a.driver_id = d.id
ORDER BY d.surname, d.forename, d.reference`;

/** 214 teams. Identical to the driver statement but grouped by `team_id`. */
export const SQL_TEAM_INDEX = `
WITH team_race AS (
  SELECT td.team_id AS team_id,
         s.year     AS year,
         r.id       AS round_id
  FROM session_entry se
  JOIN session ses    ON ses.id = se.session_id AND ses.type = 'R'
  JOIN round r        ON r.id = ses.round_id AND r.number IS NOT NULL
  JOIN season s       ON s.id = r.season_id
  JOIN round_entry re ON re.id = se.round_entry_id
  JOIN team_driver td ON td.id = re.team_driver_id
),
agg AS (
  SELECT team_id,
         count(DISTINCT round_id) AS races,
         min(year)                AS firstSeason,
         max(year)                AS lastSeason
  FROM team_race
  GROUP BY team_id
)
SELECT t.reference    AS ref,
       t.name         AS name,
       t.nationality  AS nationality,
       t.country_code AS countryCode,
       coalesce(a.races, 0) AS races,
       a.firstSeason  AS firstSeason,
       a.lastSeason   AS lastSeason
FROM team t
LEFT JOIN agg a ON a.team_id = t.id
ORDER BY t.name, t.reference`;

/**
 * 78 circuits, entered from `round` rather than from `session_entry`, because a venue's
 * count is of **rounds** and a round with no results still counts as one.
 *
 * `MATERIALIZED` on `circuit_round` is not decoration. Without it SQLite inlines the CTE
 * and re-evaluates the `EXISTS` subquery once per aggregate that references it — the plan
 * prints `CORRELATED SCALAR SUBQUERY` **three** times, and it measures **3.27 ms against
 * 1.83 ms** materialised (p50 of 15 warm runs, identical 78 rows). Materialising also
 * turns the round access into a plain `SCAN r` over 1,173 rows, which is the faster of the
 * two here; `directory.test.ts` asserts the subquery count rather than an index name for
 * that reason.
 *
 * `hasResults` is the existence of classification rows and **never a date comparison**: the
 * dataset can lag the real calendar by ~2 weeks (`REQUIREMENTS.md` §2.5), so a date test
 * would report a race as run with nothing in it.
 */
export const SQL_CIRCUIT_INDEX = `
WITH circuit_round AS MATERIALIZED (
  SELECT r.circuit_id AS circuit_id,
         s.year       AS year,
         EXISTS (SELECT 1 FROM session ses
                 JOIN session_entry se ON se.session_id = ses.id
                 WHERE ses.round_id = r.id AND ses.type = 'R') AS hasResults
  FROM round r
  JOIN season s ON s.id = r.season_id
  WHERE r.number IS NOT NULL AND r.circuit_id IS NOT NULL
),
agg AS (
  SELECT circuit_id,
         count(*)                                AS roundsHeld,
         sum(hasResults)                         AS racesWithResults,
         min(CASE WHEN hasResults THEN year END) AS firstYear,
         max(CASE WHEN hasResults THEN year END) AS lastYear
  FROM circuit_round
  GROUP BY circuit_id
)
SELECT c.reference    AS ref,
       c.name         AS name,
       c.locality     AS locality,
       c.country      AS country,
       c.country_code AS countryCode,
       coalesce(a.roundsHeld, 0)       AS roundsHeld,
       coalesce(a.racesWithResults, 0) AS racesWithResults,
       a.firstYear    AS firstYear,
       a.lastYear     AS lastYear
FROM circuit c
LEFT JOIN agg a ON a.circuit_id = c.id
ORDER BY c.name, c.reference`;

const Q_DRIVER_INDEX = prepared(SQL_DRIVER_INDEX);
const Q_TEAM_INDEX = prepared(SQL_TEAM_INDEX);
const Q_CIRCUIT_INDEX = prepared(SQL_CIRCUIT_INDEX);

/* ------------------------------------------------------------------------- row shapes */

export interface DriverIndexRow {
  ref: string;
  code: string | null;
  forename: string;
  surname: string;
  nationality: string | null;
  countryCode: string | null;
  races: number;
  firstSeason: number | null;
  lastSeason: number | null;
}

export interface TeamIndexRow {
  ref: string;
  name: string;
  nationality: string | null;
  countryCode: string | null;
  races: number;
  firstSeason: number | null;
  lastSeason: number | null;
}

export interface CircuitIndexRow {
  ref: string;
  name: string;
  locality: string | null;
  country: string | null;
  countryCode: string | null;
  roundsHeld: number;
  racesWithResults: number;
  firstYear: number | null;
  lastYear: number | null;
}

/* ------------------------------------------------------- pure builders (no database) */

/**
 * Row → payload for a driver.
 *
 * The mapping is field-for-field and the builder exists anyway, for two reasons this
 * project has been bitten by: it is the only place a column rename can be caught by a test
 * that runs in CI (which never has `data/f1.db`), and it pins the **span/count invariant**
 * the client depends on — `firstSeason` is null exactly when `races` is 0.
 *
 * That invariant is not enforced here by clamping. A row that violated it would be a
 * database anomaly, and quietly rewriting one would hide it; `directory.test.ts` asserts
 * it against all 881 rows instead, so a refresh that broke it fails a test rather than
 * producing a driver who raced in a season they have no races in.
 */
export function buildDriverIndexItem(row: DriverIndexRow): DriverListItem {
  return {
    ref: row.ref,
    code: row.code,
    forename: row.forename,
    surname: row.surname,
    nationality: row.nationality,
    countryCode: row.countryCode,
    races: row.races,
    firstSeason: row.firstSeason,
    lastSeason: row.lastSeason,
  };
}

export function buildTeamIndexItem(row: TeamIndexRow): TeamListItem {
  return {
    ref: row.ref,
    name: row.name,
    nationality: row.nationality,
    countryCode: row.countryCode,
    races: row.races,
    firstSeason: row.firstSeason,
    lastSeason: row.lastSeason,
  };
}

export function buildCircuitIndexItem(row: CircuitIndexRow): CircuitListItem {
  return {
    ref: row.ref,
    name: row.name,
    locality: row.locality,
    country: row.country,
    countryCode: row.countryCode,
    roundsHeld: row.roundsHeld,
    racesWithResults: row.racesWithResults,
    firstYear: row.firstYear,
    lastYear: row.lastYear,
  };
}

/* -------------------------------------------------------------------- read functions */

/** `GET /api/drivers`. All 881, including the 63 who never raced — see the schema module. */
export function readDriverIndex(): DriverList {
  return memoize('driver-index', SEASON_CACHE_TTL_MS, () => ({
    drivers: (Q_DRIVER_INDEX().all() as DriverIndexRow[]).map(buildDriverIndexItem),
  }));
}

/** `GET /api/teams`. All 214, including the 9 that entered and never started. */
export function readTeamIndex(): TeamList {
  return memoize('team-index', SEASON_CACHE_TTL_MS, () => ({
    teams: (Q_TEAM_INDEX().all() as TeamIndexRow[]).map(buildTeamIndexItem),
  }));
}

/** `GET /api/circuits`. All 78, including the one with a scheduled round and no results. */
export function readCircuitIndex(): CircuitList {
  return memoize('circuit-index', SEASON_CACHE_TTL_MS, () => ({
    circuits: (Q_CIRCUIT_INDEX().all() as CircuitIndexRow[]).map(buildCircuitIndexItem),
  }));
}
