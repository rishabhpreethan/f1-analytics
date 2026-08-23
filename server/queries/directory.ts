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
import { readSeasonCompleteness } from './seasons';

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
 * Five statements now, not three: the two championship-standings statements are read by the
 * driver and team indexes and are *not* the same shape, which is why they are documented
 * separately below.
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
 * ==================================================== the achievement fields, and the trap
 *
 * `wins`, `podiums` and `starts` ride the **existing** `driver_race` / `team_race` CTE as
 * further `count(DISTINCT …)` aggregates. Nothing new is scanned for them: the rows were
 * already being produced to count races, and only the aggregate list grew. Measured cost
 * of the three, drivers, p50 of 15 warm runs: **11.1 ms → 15.9 ms**.
 *
 * Every one of them counts **distinct rounds**, never rows (trap 17), and the two team
 * counts differ in shape on purpose — `wins` is distinct rounds because three races hold
 * two P1 rows (trap 16), `podiums` is distinct `round:position` because a 1–2 finish is two
 * podium places and a shared car classified P2 is one. The whole set is asserted row-for-row
 * against a JS fold of the raw classification rows for **all 881 drivers and 214 teams**,
 * and separately against the profile endpoints for a sample.
 *
 * **`championships` is the one that has bitten this project.** `driver_championship` holds
 * a per-round *snapshot*, so `WHERE position = 1` over the whole table finds every driver
 * who ever **led** a championship — 66 of them — where the answer is 35. Two structural
 * gates, neither of them a remembered check:
 *
 * 1. `SQL_DRIVER_TITLE_STANDINGS` joins `last_snapshot`, so only a season's **final**
 *    standing reaches the fold. There is no code path that sees a mid-season row.
 * 2. `foldChampionshipStandings` takes the completeness map as a **required argument**, so
 *    an unfinished season cannot produce a title. On this data that is 2026 at 10 of 22
 *    rounds, which would otherwise award Antonelli a title and Mercedes a ninth
 *    constructors' championship.
 *
 * The map is `readSeasonCompleteness()` — the same memoised value `queries/drivers.ts` and
 * `queries/teams.ts` use for `isChampion`, so the index and the profile cannot drift.
 *
 * ============================================================== S-10, and its bound
 *
 * **No statement here reads `lap` or `pit_stop`, and none takes a parameter.** Two of the
 * five aggregate the 26,093 race classification rows once; one walks the 1,171 numbered
 * rounds; the two standings statements group `driver_championship` (36,091 rows) and
 * `team_championship` (14,205) to find each season's final snapshot and return 1,664 and
 * 712 rows. Those are whole-relation reads, and they are bounded **by construction
 * rather than by validation** — there is no parameter, so no request can make any of them
 * larger. That is the same posture as `SQL_DRIVER_CHAMPIONSHIPS` on the profile side.
 *
 * Measured on this machine, `better-sqlite3` on Node 22.23.2. Per statement, p50 of 12–15
 * warm runs: **drivers 15.9 ms, teams 12.3 ms, circuits 0.9 ms**, plus **5.4 ms** for the
 * driver standings and **2.2 ms** for the team standings.
 *
 * End to end with an empty memo — which is what a request pays, once an hour — p50 of 9:
 * **`readDriverIndex` 22.4 ms / 881 rows / 209 KB JSON (22.6 KB gzipped), `readTeamIndex`
 * 15.6 ms / 214 rows / 41.5 KB (4.6 KB), `readCircuitIndex` 0.9 ms / 78 rows / 18.6 KB
 * (3.9 KB)**. Warm, 1,000 `readDriverIndex()` calls total **0.09 ms**.
 *
 * The plans are asserted in `directory.test.ts`, because a plan is the thing that
 * regresses silently.
 *
 * The absolute numbers move by ~30 % between runs of the same process; the shape is what
 * the decisions rest on.
 *
 * ======================================================================= memoisation
 *
 * All three are memoised, and this is the case ARCHITECTURE.md §6 convention 4 describes
 * rather than an exception to it. **The key space is exactly one per endpoint** — these
 * routes take no parameter at all, so there is no bounded-key-space cost to weigh, only
 * ~270 KB of retained JSON in total. They are all-time aggregates, which `DATABASE.md` §8
 * and NF-3 say must be cached rather than computed per request, and a directory is fetched
 * on the way to every profile. 22.4 ms becomes ~0 for the price of a Map entry.
 *
 * The TTL is `SEASON_CACHE_TTL_MS` (one hour), matching the `Cache-Control` the routes
 * send so the browser cache and the process cache expire together.
 *
 * ==================================================================== traps handled here
 *
 *  4  points are never summed and never published. `championships` is **read** from the
 *     championship tables, and only from a season's final snapshot.
 *  6  no `primary_color` is selected. Colour is resolved from `ref` client-side.
 * 11  no internal integer id reaches a payload — `reference` only (DL-3).
 * 13  a scheduled round is not missing data. `roundsHeld` counts it and
 *     `racesWithResults` does not, so Madring reads 1 and 0 rather than absent; and
 *     `lastScheduledYear` is what says the venue is on the current calendar.
 * 15  `r.number IS NOT NULL` on every statement.
 * 16  three races hold two P1 rows, so a win is a distinct **round**, never a row.
 * 17  race, win, start and podium counts are over distinct rounds, never over
 *     classification rows.
 *
 * Trap 1 does not apply: `session.has_time_data` is not read here, and nothing in a
 * directory depends on lap availability. Trap 18 is handled by omission — no fastest-lap
 * figure crosses this boundary, and `schemas/directory.ts` says why.
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
         r.id         AS round_id,
         se.position  AS position,
         se.status    AS status
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
         count(DISTINCT CASE WHEN status NOT IN (30, 40) THEN round_id END) AS starts,
         count(DISTINCT CASE WHEN position = 1 THEN round_id END)  AS wins,
         count(DISTINCT CASE WHEN position <= 3 THEN round_id END) AS podiums,
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
       coalesce(a.races, 0)   AS races,
       coalesce(a.starts, 0)  AS starts,
       coalesce(a.wins, 0)    AS wins,
       coalesce(a.podiums, 0) AS podiums,
       a.firstSeason  AS firstSeason,
       a.lastSeason   AS lastSeason
FROM driver d
LEFT JOIN agg a ON a.driver_id = d.id
ORDER BY d.surname, d.forename, d.reference`;

/**
 * 214 teams. The same statement grouped by `team_id`, with **one deliberate difference**.
 *
 * `podiums` counts distinct `round_id * 1000 + position` rather than distinct rounds,
 * because a team's podium count is of **places**: a 1–2 finish is two, and Ferrari's 845
 * from 1,134 races is only reachable that way. The multiplier is safe with room to spare —
 * the largest race position in the archive is 39 and the largest `round.id` is 1,197.
 *
 * `wins` stays distinct **rounds** for the reason the driver statement does, and it matters
 * more here: three races hold two P1 rows (trap 16), so `count(*)` would give Alfa Romeo two
 * wins for the 1951 French Grand Prix.
 *
 * There is no `starts`: `team.totals` has no such figure, and a team does not start a race,
 * its cars do.
 */
export const SQL_TEAM_INDEX = `
WITH team_race AS (
  SELECT td.team_id AS team_id,
         s.year     AS year,
         r.id       AS round_id,
         se.position AS position
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
         count(DISTINCT CASE WHEN position = 1 THEN round_id END) AS wins,
         count(DISTINCT CASE WHEN position <= 3 THEN round_id * 1000 + position END)
           AS podiums,
         min(year)                AS firstSeason,
         max(year)                AS lastSeason
  FROM team_race
  GROUP BY team_id
)
SELECT t.reference    AS ref,
       t.name         AS name,
       t.nationality  AS nationality,
       t.country_code AS countryCode,
       coalesce(a.races, 0)   AS races,
       coalesce(a.wins, 0)    AS wins,
       coalesce(a.podiums, 0) AS podiums,
       a.firstSeason  AS firstSeason,
       a.lastSeason   AS lastSeason
FROM team t
LEFT JOIN agg a ON a.team_id = t.id
ORDER BY t.name, t.reference`;

/**
 * Every **final** championship standing in the archive that carries a position — the only
 * rows from which a title or a career-best placing may be derived.
 *
 * Two statements rather than one parameterised by table name, because a table name cannot
 * be a bound parameter and building one by interpolation is the exact thing the layering
 * rules forbid. They are the same shape and are asserted to stay so.
 *
 * `last_snapshot` is grouped over the whole table because a season's final snapshot is a
 * property of the **season**, not of the entity — a driver who stopped racing in round 8
 * still carries a row at round 22. `round_number * 1000 + session_number` is
 * `DATABASE.md` §6.6's key verbatim; `session_number` reaches 9, comfortably inside the
 * multiplier. This is `SQL_DRIVER_CHAMPIONSHIPS` from `queries/drivers.ts` with the
 * per-entity `WHERE` removed and every entity returned at once.
 *
 * `WHERE position IS NOT NULL` halves the result (1,664 rows of 3,128 for drivers): a null
 * position is a driver listed in the standings without a classified placing, which
 * contributes to neither field.
 *
 * **This statement does not know what a title is.** It cannot: whether a season is finished
 * is not in these tables. `foldChampionshipStandings` applies that gate.
 */
export const SQL_DRIVER_TITLE_STANDINGS = `
WITH last_snapshot AS (
  SELECT year, max(round_number * 1000 + session_number) AS k
  FROM driver_championship
  GROUP BY year
)
SELECT d.reference AS ref,
       dc.year     AS year,
       dc.position AS position
FROM driver_championship dc
JOIN last_snapshot ls
  ON ls.year = dc.year AND (dc.round_number * 1000 + dc.session_number) = ls.k
JOIN driver d ON d.id = dc.driver_id
WHERE dc.position IS NOT NULL`;

/** The constructors' equivalent. 712 rows; no team standing exists before 1958. */
export const SQL_TEAM_TITLE_STANDINGS = `
WITH last_snapshot AS (
  SELECT year, max(round_number * 1000 + session_number) AS k
  FROM team_championship
  GROUP BY year
)
SELECT t.reference AS ref,
       tc.year     AS year,
       tc.position AS position
FROM team_championship tc
JOIN last_snapshot ls
  ON ls.year = tc.year AND (tc.round_number * 1000 + tc.session_number) = ls.k
JOIN team t ON t.id = tc.team_id
WHERE tc.position IS NOT NULL`;

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
 *
 * `lastScheduledYear` is `max(year)` **without** the `hasResults` guard the other three
 * carry, which is the whole point of it: it is the last year the venue holds a numbered
 * round whether or not that round has been run, so Madring reads 2026 where `lastYear`
 * reads null. It costs nothing — the rows are already grouped.
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
         max(CASE WHEN hasResults THEN year END) AS lastYear,
         max(year)                               AS lastScheduledYear
  FROM circuit_round
  GROUP BY circuit_id
)
SELECT c.reference    AS ref,
       c.name         AS name,
       c.locality     AS locality,
       c.country      AS country,
       c.country_code AS countryCode,
       c.latitude     AS latitude,
       c.longitude    AS longitude,
       coalesce(a.roundsHeld, 0)       AS roundsHeld,
       coalesce(a.racesWithResults, 0) AS racesWithResults,
       a.firstYear    AS firstYear,
       a.lastYear     AS lastYear,
       a.lastScheduledYear AS lastScheduledYear
FROM circuit c
LEFT JOIN agg a ON a.circuit_id = c.id
ORDER BY c.name, c.reference`;

const Q_DRIVER_INDEX = prepared(SQL_DRIVER_INDEX);
const Q_TEAM_INDEX = prepared(SQL_TEAM_INDEX);
const Q_CIRCUIT_INDEX = prepared(SQL_CIRCUIT_INDEX);
const Q_DRIVER_TITLE_STANDINGS = prepared(SQL_DRIVER_TITLE_STANDINGS);
const Q_TEAM_TITLE_STANDINGS = prepared(SQL_TEAM_TITLE_STANDINGS);

/* ------------------------------------------------------------------------- row shapes */

export interface DriverIndexRow {
  ref: string;
  code: string | null;
  forename: string;
  surname: string;
  nationality: string | null;
  countryCode: string | null;
  races: number;
  starts: number;
  wins: number;
  podiums: number;
  firstSeason: number | null;
  lastSeason: number | null;
}

export interface TeamIndexRow {
  ref: string;
  name: string;
  nationality: string | null;
  countryCode: string | null;
  races: number;
  wins: number;
  podiums: number;
  firstSeason: number | null;
  lastSeason: number | null;
}

export interface CircuitIndexRow {
  ref: string;
  name: string;
  locality: string | null;
  country: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  roundsHeld: number;
  racesWithResults: number;
  firstYear: number | null;
  lastYear: number | null;
  lastScheduledYear: number | null;
}

/** One row of either title-standings statement: an entity's placing in a final standing. */
export interface TitleStandingRow {
  ref: string;
  year: number;
  position: number;
}

/**
 * What a whole championship history reduces to on an index row. Two scalars, no array.
 *
 * The pair travels together because they are derived together and are meaningless apart:
 * `championships` without the completeness gate is the 66-vs-35 defect, and
 * `bestChampionshipPosition` without it hands 2026's leader a career-best P1 in a season
 * that is 10 rounds from over.
 */
export interface ChampionshipRecord {
  championships: number;
  bestChampionshipPosition: number | null;
}

/** The record of an entity with no classified placing in any finished season. */
export const NO_CHAMPIONSHIP_RECORD: ChampionshipRecord = {
  championships: 0,
  bestChampionshipPosition: null,
};

/* ------------------------------------------------------- pure builders (no database) */

/**
 * Final standings → one `ChampionshipRecord` per entity reference.
 *
 * **`seasonComplete` is a required parameter and that is the design.** It is not defaulted,
 * not optional, and not read from a module-level cache inside this function: a caller
 * cannot compute a title without deciding, explicitly and at the call site, which seasons
 * are finished. That is the structural half of the guard the module header describes — the
 * SQL half being that only final snapshots are in `rows` at all.
 *
 * A year absent from the map is treated as **not complete**. That is the safe direction:
 * an unmapped season withholds a title rather than inventing one, and it matches
 * `buildSeasons` in `queries/drivers.ts`, which does `seasonComplete.get(year) ?? false`.
 *
 * `position === 1` is the whole definition of a title, with no adjustment test — identical
 * to `isChampion` on both profiles. A stripped or reinstated championship is a display
 * concern the profile handles through `classifyAdjustment`; an index row that quietly
 * disagreed with the profile's count would be worse than one that is bluntly the same.
 */
export function foldChampionshipStandings(
  rows: readonly TitleStandingRow[],
  seasonComplete: ReadonlyMap<number, boolean>,
): Map<string, ChampionshipRecord> {
  const byRef = new Map<string, ChampionshipRecord>();

  for (const row of rows) {
    if (seasonComplete.get(row.year) !== true) continue;
    const record = byRef.get(row.ref) ?? { championships: 0, bestChampionshipPosition: null };
    if (row.position === 1) record.championships += 1;
    if (
      record.bestChampionshipPosition === null ||
      row.position < record.bestChampionshipPosition
    ) {
      record.bestChampionshipPosition = row.position;
    }
    byRef.set(row.ref, record);
  }

  return byRef;
}

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
export function buildDriverIndexItem(
  row: DriverIndexRow,
  championship: ChampionshipRecord,
): DriverListItem {
  return {
    ref: row.ref,
    code: row.code,
    forename: row.forename,
    surname: row.surname,
    nationality: row.nationality,
    countryCode: row.countryCode,
    races: row.races,
    starts: row.starts,
    wins: row.wins,
    podiums: row.podiums,
    championships: championship.championships,
    bestChampionshipPosition: championship.bestChampionshipPosition,
    firstSeason: row.firstSeason,
    lastSeason: row.lastSeason,
  };
}

export function buildTeamIndexItem(
  row: TeamIndexRow,
  championship: ChampionshipRecord,
): TeamListItem {
  return {
    ref: row.ref,
    name: row.name,
    nationality: row.nationality,
    countryCode: row.countryCode,
    races: row.races,
    wins: row.wins,
    podiums: row.podiums,
    championships: championship.championships,
    bestChampionshipPosition: championship.bestChampionshipPosition,
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
    latitude: row.latitude,
    longitude: row.longitude,
    roundsHeld: row.roundsHeld,
    racesWithResults: row.racesWithResults,
    firstYear: row.firstYear,
    lastYear: row.lastYear,
    lastScheduledYear: row.lastScheduledYear,
  };
}

/* -------------------------------------------------------------------- read functions */

/**
 * `GET /api/drivers`. All 881, including the 63 who never raced — see the schema module.
 *
 * The completeness map is read **inside** the memoised factory rather than at module load,
 * so the hour-long index cache and the season-completeness cache expire independently and
 * a stale title cannot outlive its own source.
 */
export function readDriverIndex(): DriverList {
  return memoize('driver-index', SEASON_CACHE_TTL_MS, () => {
    const titles = foldChampionshipStandings(
      Q_DRIVER_TITLE_STANDINGS().all() as TitleStandingRow[],
      readSeasonCompleteness(),
    );
    return {
      drivers: (Q_DRIVER_INDEX().all() as DriverIndexRow[]).map((row) =>
        buildDriverIndexItem(row, titles.get(row.ref) ?? NO_CHAMPIONSHIP_RECORD),
      ),
    };
  });
}

/** `GET /api/teams`. All 214, including the 9 that entered and never started. */
export function readTeamIndex(): TeamList {
  return memoize('team-index', SEASON_CACHE_TTL_MS, () => {
    const titles = foldChampionshipStandings(
      Q_TEAM_TITLE_STANDINGS().all() as TitleStandingRow[],
      readSeasonCompleteness(),
    );
    return {
      teams: (Q_TEAM_INDEX().all() as TeamIndexRow[]).map((row) =>
        buildTeamIndexItem(row, titles.get(row.ref) ?? NO_CHAMPIONSHIP_RECORD),
      ),
    };
  });
}

/** `GET /api/circuits`. All 78, including the one with a scheduled round and no results. */
export function readCircuitIndex(): CircuitList {
  return memoize('circuit-index', SEASON_CACHE_TTL_MS, () => ({
    circuits: (Q_CIRCUIT_INDEX().all() as CircuitIndexRow[]).map(buildCircuitIndexItem),
  }));
}
