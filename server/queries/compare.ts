import type {
  ArchiveSeason,
  Chain,
  ChainLink,
  CompareData,
  CompareEntity,
  CompareIdentity,
  ComparePair,
  CompareSeason,
  Ledger,
  Relation,
} from '../schemas/compare';
import type { GridStatus } from '../schemas/race';
import { buildGridVsFinish, positionsGained } from './drivers';
import { prepared } from './prepared';
import { toGrid } from './race';
import { readSeasonCompleteness, readSeasonList } from './seasons';
import { findChain, readTeammateGraph } from './teammateGraph';

/**
 * `GET /api/compare` — the career lens of the comparison workspace. F7.
 *
 * ============================================================================ five statements
 *
 * The whole payload for four drivers is **five parameterised statements plus the memoised teammate
 * graph and season list**, and none of them is per pair. The pairwise head-to-heads are the case
 * that would obviously have been six statements (four drivers is six pairs) and are instead
 * **computed in pure TypeScript from one statement's rows**: `SQL_COMPARE_RACES` returns every race
 * row for the selected drivers — 897 rows for Hamilton, Rosberg, Verstappen and Fangio together —
 * and the pair ledgers fall out of intersecting them on `session_id`. That is not only cheaper
 * (~10 ms against ~48), it puts the head-to-head *definition* in one pure function that a test can
 * drive with six synthetic rows instead of in six copies of a `WHERE` clause.
 *
 * The set of selected references is bound as **one JSON parameter** and expanded with
 * `json_each()`, so every statement is a fixed string with a fixed parameter list. Building
 * `?, ?, ?` placeholders per request would also have been safe, but it makes the statement text
 * request-shaped and un-preparable, and this project's rule is that SQL is a constant.
 *
 * ===================================================================================== the traps
 *
 *  3  `position` is populated on **all 26,093 race rows**, 9,683 of them unclassified, where it is
 *     a retirement order and not a result. Every head-to-head is gated on `is_classified`, never
 *     on `position IS NOT NULL`.
 *  4  **no points figure is published by this lens at all.** Every measure is a count or a rate,
 *     and `championships` is *read* from `driver_championship`'s final snapshots.
 *  6  no `primary_color` is selected; colour is resolved from `colorTeamRef` client-side.
 *  7  no `lap` or `pit_stop` access on this path — not even an `EXISTS`.
 * 11  no internal integer id reaches the payload. `session_id` is used to intersect two drivers'
 *     races inside this module and is never published.
 * 15  `AND r.number IS NOT NULL` on every statement; the archive's round count is `max(number)`,
 *     taken from `readSeasonList`.
 * 16  three races hold two P1 rows, so a win is a distinct **race**, never a row — and a same-team
 *     pair that both took P1 is a **tie**, not a win for whichever row sorted first.
 * 17  40 races classify the same driver more than once, so every count collapses to one row per
 *     (driver, race) before it counts anything.
 * 25  a title is `position = 1` in the final snapshot of a **finished** season. The completeness
 *     map is a required argument to the builder, exactly as `queries/directory.ts` makes it.
 *
 * ============================================================ agreement with the driver profile
 *
 * `totals` here must equal `GET /api/drivers/:reference`'s, or one page says Hamilton won 106 and
 * the other 105. It is guaranteed by using the profile's collapse rule verbatim — per race, the row
 * ordered by `(position IS NULL), position` first decides the outcome, and the additive facts come
 * from all of them — rather than by two definitions that happen to agree today. `compare.test.ts`
 * asserts the two endpoints against each other on four careers.
 */

/* ------------------------------------------------------------------------------------- SQL */

/**
 * Every race row for the selected drivers. **One row per classification, not per race** — the
 * collapse is `collapseRaces` below, because "the best row" is a rule about the sport that a reader
 * has to be able to check, and because the same rows carry three different notions of best:
 *
 * - the **outcome** row, `(position IS NULL), position` ascending, which decides status and team —
 *   `queries/drivers.ts`'s rule verbatim, so the two endpoints cannot disagree;
 * - the best **classified** finish, for the race head-to-head;
 * - the best **grid slot**, for the grid head-to-head.
 *
 * Bounded by construction: four references, and the longest career in the archive is 438 races
 * (S-10). No `limit` parameter exists because none is needed.
 */
export const SQL_COMPARE_RACES = `
WITH picked AS MATERIALIZED (
  SELECT se.id            AS entry_id,
         se.session_id    AS session_id,
         d.reference      AS driver_ref,
         td.team_id       AS team_id,
         se.position      AS position,
         se.grid          AS grid,
         se.status        AS status,
         se.is_classified AS is_classified
  FROM driver d
  JOIN team_driver td   ON td.driver_id = d.id
  JOIN round_entry re   ON re.team_driver_id = td.id
  JOIN session_entry se ON se.round_entry_id = re.id
  WHERE d.reference IN (SELECT value FROM json_each(@refs))
)
SELECT p.driver_ref      AS driverRef,
       p.session_id      AS sessionId,
       s.year            AS year,
       r.number          AS round,
       t.reference       AS teamRef,
       t.name            AS teamName,
       p.position        AS position,
       p.grid            AS grid,
       p.status          AS status,
       p.is_classified   AS isClassified
FROM picked p
JOIN session ses ON ses.id = p.session_id AND ses.type = 'R'
JOIN round r     ON r.id = ses.round_id AND r.number IS NOT NULL
JOIN season s    ON s.id = r.season_id
JOIN team t      ON t.id = p.team_id
ORDER BY p.driver_ref, s.year, r.number, (p.position IS NULL), p.position, p.entry_id`;

/**
 * The career teammate record for each selected driver, over the whole archive.
 *
 * **The unit is a pairing, not a race.** A driver in a two-car team contributes one pairing per
 * race; Fangio, whose Maserati and Alfa Romeo entries ran alongside as many as five other cars of
 * the same marque, contributes several — 196 pairings against 51 starts, of which 93 are rated. The
 * schema says so on the field, because the number reads as an error otherwise.
 *
 * `count(DISTINCT o.driver_ref)` is the teammate **count**: 7 for Hamilton, 46 for Fangio.
 */
export const SQL_COMPARE_TEAMMATE_TOTALS = `
WITH picked AS MATERIALIZED (
  SELECT se.id            AS entry_id,
         se.session_id    AS session_id,
         d.reference      AS driver_ref,
         td.team_id       AS team_id,
         se.position      AS position,
         se.grid          AS grid,
         se.is_classified AS is_classified
  FROM driver d
  JOIN team_driver td   ON td.driver_id = d.id
  JOIN round_entry re   ON re.team_driver_id = td.id
  JOIN session_entry se ON se.round_entry_id = re.id
  WHERE d.reference IN (SELECT value FROM json_each(@refs))
),
mine AS (
  SELECT p.session_id AS session_id, p.team_id AS team_id, p.driver_ref AS driver_ref,
         min(CASE WHEN p.is_classified = 1 THEN p.position END) AS pos,
         min(CASE WHEN p.grid > 0 THEN p.grid END) AS grd
  FROM picked p
  JOIN session ses ON ses.id = p.session_id AND ses.type = 'R'
  JOIN round r     ON r.id = ses.round_id AND r.number IS NOT NULL
  GROUP BY p.session_id, p.team_id, p.driver_ref
),
other AS (
  SELECT se.session_id AS session_id, td.team_id AS team_id, d.reference AS driver_ref,
         min(CASE WHEN se.is_classified = 1 THEN se.position END) AS pos,
         min(CASE WHEN se.grid > 0 THEN se.grid END) AS grd
  FROM session_entry se
  JOIN round_entry re ON re.id = se.round_entry_id
  JOIN team_driver td ON td.id = re.team_driver_id
  JOIN driver d       ON d.id = td.driver_id
  WHERE se.session_id IN (SELECT DISTINCT session_id FROM mine)
  GROUP BY se.session_id, td.team_id, d.reference
)
SELECT m.driver_ref AS ref,
       count(DISTINCT o.driver_ref) AS mates,
       count(*) AS pool,
       sum(m.pos IS NOT NULL AND o.pos IS NOT NULL) AS raceRated,
       sum(m.pos < o.pos)  AS raceA,
       sum(o.pos < m.pos)  AS raceB,
       sum(m.pos = o.pos)  AS raceTied,
       sum(m.grd IS NOT NULL AND o.grd IS NOT NULL) AS gridRated,
       sum(m.grd < o.grd)  AS gridA,
       sum(o.grd < m.grd)  AS gridB,
       sum(m.grd = o.grd)  AS gridTied
FROM mine m
JOIN other o
  ON o.session_id = m.session_id AND o.team_id = m.team_id AND o.driver_ref <> m.driver_ref
GROUP BY m.driver_ref`;

/**
 * Same-team head-to-heads **among a given set of drivers**, one row per (pair, season, team).
 *
 * One statement serves two callers, which is why it is grouped this finely. The pairs band needs it
 * for the ≤ 4 selected drivers, to fill `sameTeamSeasons` and to decide `relation`; the lineage
 * chain needs it for the ≤ 40 drivers a set of chains names, to fill each link's ledger and its
 * `teams` list. Both want the same fact at the same grain, and a second statement would be a second
 * definition of "were they teammates".
 *
 * Oriented `a < b` by reference, so the caller flips the ledger when it wants the other direction.
 */
export const SQL_COMPARE_SAME_TEAM = `
WITH picked AS MATERIALIZED (
  SELECT se.id            AS entry_id,
         se.session_id    AS session_id,
         d.reference      AS driver_ref,
         td.team_id       AS team_id,
         se.position      AS position,
         se.grid          AS grid,
         se.is_classified AS is_classified
  FROM driver d
  JOIN team_driver td   ON td.driver_id = d.id
  JOIN round_entry re   ON re.team_driver_id = td.id
  JOIN session_entry se ON se.round_entry_id = re.id
  WHERE d.reference IN (SELECT value FROM json_each(@refs))
),
best AS (
  SELECT p.session_id AS session_id, p.team_id AS team_id, p.driver_ref AS driver_ref,
         s.year       AS year,
         t.reference  AS team_ref,
         t.name       AS team_name,
         min(CASE WHEN p.is_classified = 1 THEN p.position END) AS pos,
         min(CASE WHEN p.grid > 0 THEN p.grid END) AS grd
  FROM picked p
  JOIN session ses ON ses.id = p.session_id AND ses.type = 'R'
  JOIN round r     ON r.id = ses.round_id AND r.number IS NOT NULL
  JOIN season s    ON s.id = r.season_id
  JOIN team t      ON t.id = p.team_id
  GROUP BY p.session_id, p.team_id, p.driver_ref
)
SELECT a.driver_ref AS a,
       b.driver_ref AS b,
       a.year       AS year,
       a.team_ref   AS teamRef,
       a.team_name  AS teamName,
       count(*) AS pool,
       sum(a.pos IS NOT NULL AND b.pos IS NOT NULL) AS raceRated,
       sum(a.pos < b.pos)  AS raceA,
       sum(b.pos < a.pos)  AS raceB,
       sum(a.pos = b.pos)  AS raceTied,
       sum(a.grd IS NOT NULL AND b.grd IS NOT NULL) AS gridRated,
       sum(a.grd < b.grd)  AS gridA,
       sum(b.grd < a.grd)  AS gridB,
       sum(a.grd = b.grd)  AS gridTied
FROM best a
JOIN best b
  ON b.session_id = a.session_id AND b.team_id = a.team_id AND b.driver_ref > a.driver_ref
GROUP BY a.driver_ref, b.driver_ref, a.year, a.team_ref
ORDER BY a.driver_ref, b.driver_ref, a.year, a.team_ref`;

/**
 * Every **final** championship standing of every season the selected drivers appear in.
 *
 * `SQL_DRIVER_CHAMPIONSHIPS` from `queries/drivers.ts` with the single-driver `WHERE` widened to a
 * set. `last_snapshot` is grouped over the whole table because a season's final snapshot is a
 * property of the season, not of the driver — a driver who stopped racing in round 8 still carries
 * a row at round 22, and taking their own last row would report a mid-season standing as final.
 *
 * ⚠ **The join is on `year` and `round_number * 1000 + session_number`, never on `season_id`.**
 * `driver_championship.season_id` is NULL on **32,963 of 36,091 rows (91.3 %)**, and a join through
 * it fails *silently and plausibly*: it returns only the ~3,128 rows that carry one, which happen to
 * be final snapshots, so the result looks like a correct answer. `DATABASE.md` §7 carries this as a
 * trap because the wrong join is the natural one to write.
 */
export const SQL_COMPARE_CHAMPIONSHIPS = `
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
WHERE d.reference IN (SELECT value FROM json_each(@refs))`;

/** Identities for a set of references. Drives both `people` and the existence check. */
export const SQL_COMPARE_IDENTITIES = `
SELECT reference    AS ref,
       forename     AS forename,
       surname      AS surname,
       abbreviation AS code
FROM driver
WHERE reference IN (SELECT value FROM json_each(@refs))
ORDER BY reference`;

const Q_COMPARE_RACES = prepared(SQL_COMPARE_RACES);
const Q_COMPARE_TEAMMATE_TOTALS = prepared(SQL_COMPARE_TEAMMATE_TOTALS);
const Q_COMPARE_SAME_TEAM = prepared(SQL_COMPARE_SAME_TEAM);
const Q_COMPARE_CHAMPIONSHIPS = prepared(SQL_COMPARE_CHAMPIONSHIPS);
const Q_COMPARE_IDENTITIES = prepared(SQL_COMPARE_IDENTITIES);

/* -------------------------------------------------------------------------------- row shapes */

export interface CompareRaceRow {
  driverRef: string;
  sessionId: number;
  year: number;
  round: number;
  teamRef: string;
  teamName: string;
  position: number | null;
  grid: number | null;
  status: number;
  isClassified: number;
}

export interface TeammateTotalRow {
  ref: string;
  mates: number;
  pool: number;
  raceRated: number;
  raceA: number;
  raceB: number;
  raceTied: number;
  gridRated: number;
  gridA: number;
  gridB: number;
  gridTied: number;
}

export interface SameTeamRow {
  a: string;
  b: string;
  year: number;
  teamRef: string;
  teamName: string;
  pool: number;
  raceRated: number;
  raceA: number;
  raceB: number;
  raceTied: number;
  gridRated: number;
  gridA: number;
  gridB: number;
  gridTied: number;
}

export interface ChampionshipRow {
  ref: string;
  year: number;
  position: number | null;
}

export interface IdentityRow {
  ref: string;
  forename: string;
  surname: string;
  code: string | null;
}

/* --------------------------------------------------------- pure builders (no database access) */

/**
 * One race, after the rows for it have been collapsed.
 *
 * ============================================ two readings of one race, and the naming rule
 *
 * A shared drive gives one (driver, race) pair **two grid slots and two finishing positions**
 * — 40 races between 1950 and 1964 do (trap 17), and 1951 R4 is the sharpest: Fangio started
 * his own car from pole, retired it, took over Fagioli's car which had started 7th, and won.
 * There is no single true "he started Nth and finished Mth" for that race, so this struct
 * carries both readings under a naming rule that has to hold for every field added later:
 *
 * - **unprefixed** — `position`, `isClassified`, `teamRef`, `gridPosition`, `gridStatus` —
 *   is the **outcome row**, `queries/drivers.ts`'s rule verbatim. Fangio's 1951 R4 reads
 *   grid 7, P1. This is the reading the driver profile publishes, and everything the two
 *   endpoints must agree on is built from it.
 * - **`best…`** is the minimum across the driver's rows, which is what a head-to-head wants:
 *   asking whether Fangio out-qualified a rival should use the pole, not the second car.
 *
 * Mixing them is the defect to avoid. The pair ledgers use `best…`; `gridVsFinish` uses the
 * outcome row, because agreeing with `GET /api/drivers/:reference` is a stated contract of
 * this module and a reader on two pages must not be told two different careers.
 */
export interface CollapsedRace {
  sessionId: number;
  year: number;
  round: number;
  /** Every team the driver was entered by in this race, in row order. Almost always one. */
  teamRefs: string[];
  /** The outcome row's team — the one the profile page also attributes the race to. */
  teamRef: string;
  /** The outcome row's finishing position. Never null on the present data (trap 27). */
  position: number | null;
  /** The outcome row's `status` (`DATABASE.md` §3). */
  status: number;
  /** The outcome row's classification flag. */
  isClassified: boolean;
  /** The outcome row's grid slot, null for a pit-lane start or an unknown grid. */
  gridPosition: number | null;
  /** Which of those the null is (trap 9). `queries/race.ts`'s `toGrid`. */
  gridStatus: GridStatus;
  /** `grid - position` on the outcome row, or null. `queries/drivers.ts`'s `positionsGained`. */
  positionsGained: number | null;
  /** Best **classified** finishing position across the driver's rows. Null when none was. */
  bestClassifiedPosition: number | null;
  /** Best grid slot across the driver's rows, excluding a pit-lane start (`grid = 0`, trap 9). */
  bestGridPosition: number | null;
}

const NEVER_STARTED = new Set([30, 40]);
const RETIREMENT = new Set([10, 11]);

/**
 * Rows → one entry per (driver, race).
 *
 * The rows arrive ordered by driver, year, round and then the profile's outcome ordering, so **the
 * first row of a race is the outcome row** and everything else folds into it. That ordering is a
 * contract with `SQL_COMPARE_RACES` and the reason this is not sorting again here.
 */
export function collapseRaces(rows: readonly CompareRaceRow[]): Map<string, CollapsedRace[]> {
  const byDriver = new Map<string, CollapsedRace[]>();
  const seen = new Map<string, CollapsedRace>();

  for (const row of rows) {
    const key = `${row.driverRef} ${String(row.sessionId)}`;
    const existing = seen.get(key);
    const classified = row.isClassified === 1;
    const grid = toGrid(row.grid);
    const classifiedPosition = classified ? row.position : null;

    if (existing !== undefined) {
      if (!existing.teamRefs.includes(row.teamRef)) existing.teamRefs.push(row.teamRef);
      existing.bestClassifiedPosition = smaller(
        existing.bestClassifiedPosition,
        classifiedPosition,
      );
      existing.bestGridPosition = smaller(existing.bestGridPosition, grid.gridPosition);
      continue;
    }

    const race: CollapsedRace = {
      sessionId: row.sessionId,
      year: row.year,
      round: row.round,
      teamRefs: [row.teamRef],
      teamRef: row.teamRef,
      position: row.position,
      status: row.status,
      isClassified: classified,
      gridPosition: grid.gridPosition,
      gridStatus: grid.gridStatus,
      positionsGained: positionsGained(grid.gridPosition, row.position, classified),
      bestClassifiedPosition: classifiedPosition,
      bestGridPosition: grid.gridPosition,
    };
    seen.set(key, race);
    const list = byDriver.get(row.driverRef);
    if (list === undefined) byDriver.set(row.driverRef, [race]);
    else list.push(race);
  }

  return byDriver;
}

function smaller(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return Math.min(left, right);
}

/**
 * Career totals, on `queries/drivers.ts`'s definitions exactly.
 *
 * `starts` excludes `status IN (30, 40)` — withdrew, did not start, did not qualify — which is
 * `DATABASE.md` §3's grouping and the reason Schumacher reads 307 starts from 308 races.
 * `classifiedFinishes` is the field this lens adds, and it is a **race** count rather than a row
 * count for trap 17's sake.
 */
export function buildCareerTotals(races: readonly CollapsedRace[]): CompareEntity['totals'] {
  let starts = 0;
  let wins = 0;
  let podiums = 0;
  let dnfs = 0;
  let classifiedFinishes = 0;

  for (const race of races) {
    if (!NEVER_STARTED.has(race.status)) starts += 1;
    if (race.position === 1) wins += 1;
    if (race.position !== null && race.position <= 3) podiums += 1;
    if (RETIREMENT.has(race.status)) dnfs += 1;
    if (race.isClassified) classifiedFinishes += 1;
  }

  return {
    races: races.length,
    starts,
    wins,
    podiums,
    dnfs,
    classifiedFinishes,
    championships: 0,
  };
}

/**
 * The team whose colour represents a driver: **most starts, ties to the most recent.**
 *
 * The tiebreak matters more than it looks. A driver split evenly between two teams has no
 * "signature" team by count, and picking the alphabetically-first one would give Hamilton
 * Ferrari's red for a career that is 246 races in silver. Recency is the reader's own mental model
 * of who someone drives for.
 */
export function pickColorTeam(races: readonly CollapsedRace[]): string {
  const starts = new Map<string, { count: number; last: number }>();
  for (const race of races) {
    if (NEVER_STARTED.has(race.status)) continue;
    const key = race.teamRef;
    const entry = starts.get(key) ?? { count: 0, last: 0 };
    entry.count += 1;
    entry.last = Math.max(entry.last, race.year * 100 + race.round);
    starts.set(key, entry);
  }
  /* Every driver with a race has a team on it, but a driver whose every entry is a DNS has no
   * *start* — fall back to the first race's team rather than publishing an empty reference. */
  if (starts.size === 0) return races[0]?.teamRef ?? '';

  let bestRef = '';
  let best = { count: -1, last: -1 };
  for (const [ref, entry] of starts) {
    if (entry.count > best.count || (entry.count === best.count && entry.last > best.last)) {
      best = entry;
      bestRef = ref;
    }
  }
  return bestRef;
}

/**
 * Season-by-season, one row per season the driver raced in.
 *
 * `championshipPositionIsFinal` comes from the completeness map, which is a **required argument**
 * for the reason `queries/directory.ts` gives: a caller must decide, at the call site, which
 * seasons are finished, rather than inherit a default that quietly awards 2026's leader a title.
 */
export function buildEntitySeasons(
  races: readonly CollapsedRace[],
  championships: readonly ChampionshipRow[],
  seasonComplete: ReadonlyMap<number, boolean>,
): CompareSeason[] {
  const positionByYear = new Map<number, number | null>();
  for (const row of championships) positionByYear.set(row.year, row.position);

  const byYear = new Map<number, CompareSeason>();
  for (const race of races) {
    let season = byYear.get(race.year);
    if (season === undefined) {
      season = {
        year: race.year,
        teamRefs: [],
        starts: 0,
        wins: 0,
        podiums: 0,
        dnfs: 0,
        championshipPosition: positionByYear.get(race.year) ?? null,
        championshipPositionIsFinal: seasonComplete.get(race.year) === true,
      };
      byYear.set(race.year, season);
    }
    for (const teamRef of race.teamRefs) {
      if (!season.teamRefs.includes(teamRef)) season.teamRefs.push(teamRef);
    }
    if (!NEVER_STARTED.has(race.status)) season.starts += 1;
    if (race.position === 1) season.wins += 1;
    if (race.position !== null && race.position <= 3) season.podiums += 1;
    if (RETIREMENT.has(race.status)) season.dnfs += 1;
  }

  return [...byYear.values()].sort((x, y) => x.year - y.year);
}

/** How many finished seasons this driver ended on top of. Trap 25's two filters, both applied. */
export function countTitles(
  championships: readonly ChampionshipRow[],
  seasonComplete: ReadonlyMap<number, boolean>,
): number {
  let titles = 0;
  for (const row of championships) {
    if (row.position === 1 && seasonComplete.get(row.year) === true) titles += 1;
  }
  return titles;
}

const EMPTY_LEDGER: Ledger = { rated: 0, pool: 0, a: 0, b: 0, tied: 0 };

/**
 * The two head-to-head ledgers between two drivers, over **every race both entered, whatever car
 * each was in**.
 *
 * Pure and intersection-based: the races are already collapsed to one per driver per race, so this
 * is a walk over the smaller list with a `session_id` lookup. It is the only definition of a
 * head-to-head in this feature, used for the pairs band, and it is the same rule
 * `SQL_COMPARE_SAME_TEAM` applies in SQL for the same-team case — verified equal on the live data
 * in `compare.test.ts`, because two implementations of one rule is exactly how they drift.
 */
export function buildPairLedgers(
  first: readonly CollapsedRace[],
  second: readonly CollapsedRace[],
): { pool: number; sharedSeasons: number[]; race: Ledger; grid: Ledger } {
  const bySession = new Map<number, CollapsedRace>();
  for (const race of second) bySession.set(race.sessionId, race);

  const race: Ledger = { ...EMPTY_LEDGER };
  const grid: Ledger = { ...EMPTY_LEDGER };
  const years = new Set<number>();
  let pool = 0;

  for (const mine of first) {
    const theirs = bySession.get(mine.sessionId);
    if (theirs === undefined) continue;
    pool += 1;
    years.add(mine.year);

    race.pool += 1;
    grid.pool += 1;

    if (mine.bestClassifiedPosition !== null && theirs.bestClassifiedPosition !== null) {
      race.rated += 1;
      if (mine.bestClassifiedPosition < theirs.bestClassifiedPosition) race.a += 1;
      else if (theirs.bestClassifiedPosition < mine.bestClassifiedPosition) race.b += 1;
      else race.tied += 1;
    }
    if (mine.bestGridPosition !== null && theirs.bestGridPosition !== null) {
      grid.rated += 1;
      if (mine.bestGridPosition < theirs.bestGridPosition) grid.a += 1;
      else if (theirs.bestGridPosition < mine.bestGridPosition) grid.b += 1;
      else grid.tied += 1;
    }
  }

  return { pool, sharedSeasons: [...years].sort((x, y) => x - y), race, grid };
}

/** A `SameTeamRow` read from `a`'s side, or flipped when the caller wants `b`'s. */
function sameTeamLedgers(row: SameTeamRow, flipped: boolean): { race: Ledger; grid: Ledger } {
  return {
    race: {
      rated: row.raceRated,
      pool: row.pool,
      a: flipped ? row.raceB : row.raceA,
      b: flipped ? row.raceA : row.raceB,
      tied: row.raceTied,
    },
    grid: {
      rated: row.gridRated,
      pool: row.pool,
      a: flipped ? row.gridB : row.gridA,
      b: flipped ? row.gridA : row.gridB,
      tied: row.gridTied,
    },
  };
}

function addLedger(into: Ledger, from: Ledger): void {
  into.rated += from.rated;
  into.pool += from.pool;
  into.a += from.a;
  into.b += from.b;
  into.tied += from.tied;
}

/** The same-team rows for one unordered pair, keyed `a b` with `a < b`. */
export function groupSameTeam(rows: readonly SameTeamRow[]): Map<string, SameTeamRow[]> {
  const byPair = new Map<string, SameTeamRow[]>();
  for (const row of rows) {
    const key = `${row.a} ${row.b}`;
    const list = byPair.get(key);
    if (list === undefined) byPair.set(key, [row]);
    else list.push(row);
  }
  return byPair;
}

export function pairKey(first: string, second: string): string {
  return first < second ? `${first} ${second}` : `${second} ${first}`;
}

/**
 * Whole years between one career ending and the other beginning; `0` when the two overlap.
 *
 * Overlap is measured on seasons entered, not on races shared. **Two drivers can share a season and
 * never share a grid** — Senna entered rounds 1–3 of 1994 and Coulthard debuted at round 5 — and
 * that pair is `contemporary` with `sharedRaces: 0`, not `disjoint`. `disjoint`'s own sentence
 * claims there is "no race, no car and no points system the two of them share", and the points
 * system is shared, so the claim would be false. See `relationFor`.
 */
export function yearsApart(
  first: { firstSeason: number; lastSeason: number },
  second: { firstSeason: number; lastSeason: number },
): number {
  if (first.firstSeason <= second.lastSeason && second.firstSeason <= first.lastSeason) return 0;
  return first.firstSeason > second.lastSeason
    ? first.firstSeason - second.lastSeason
    : second.firstSeason - first.lastSeason;
}

/**
 * Which of the three comparisons this is.
 *
 * `contemporary` is claimed on a **shared season**, not on a shared race, for the reason
 * `yearsApart` gives. The consequence for the surface is worth stating: a pair who shared a season
 * and no race reaches `contemporary`'s copy, whose body sentence stays true word for word
 * ("started 0 of the same Grands Prix … and never one of them in the same car") while its headline,
 * "Same grid, different cars", does not. That headline is the surface's and wants a fourth case.
 */
export function relationFor(sameTeamRaces: number, sharedSeasons: number): Relation {
  if (sameTeamRaces > 0) return 'teammate';
  if (sharedSeasons > 0) return 'contemporary';
  return 'disjoint';
}

/* ------------------------------------------------------------------------------ assembly */

interface EntityWorkings {
  entity: CompareEntity;
  races: CollapsedRace[];
}

function buildEntity(
  identity: CompareIdentity,
  races: readonly CollapsedRace[],
  teammates: TeammateTotalRow | undefined,
  championships: readonly ChampionshipRow[],
  seasonComplete: ReadonlyMap<number, boolean>,
): CompareEntity {
  const totals = buildCareerTotals(races);
  const seasons = buildEntitySeasons(races, championships, seasonComplete);
  const years = races.map((race) => race.year);

  return {
    identity,
    colorTeamRef: pickColorTeam(races),
    firstSeason: Math.min(...years),
    lastSeason: Math.max(...years),
    seasonsEntered: seasons.length,
    totals: { ...totals, championships: countTitles(championships, seasonComplete) },
    /*
     * **The driver profile's builder, not a second one.** `buildGridVsFinish` reads only the
     * outcome-row fields of `CollapsedRace`, which are `queries/drivers.ts`'s collapse rule
     * verbatim, so `GET /api/compare` and `GET /api/drivers/:reference` cannot report
     * different careers for the same driver — and `compare.test.ts` asserts it rather than
     * trusting it, the same way it already does for `totals`.
     *
     * Career only, deliberately. Measured before deciding: a per-season figure would sit on
     * 14–22 counted races in a modern season and 2–8 in a 1950s one, and Hamilton's season
     * means swing −1.67 to +3.25 with medians that stay at 0 — a noise series, and nothing
     * has asked for one. The season lens already carries per-round finishing positions.
     */
    gridVsFinish: buildGridVsFinish(races),
    teammates: {
      count: teammates?.mates ?? 0,
      race: {
        rated: teammates?.raceRated ?? 0,
        pool: teammates?.pool ?? 0,
        a: teammates?.raceA ?? 0,
        b: teammates?.raceB ?? 0,
        tied: teammates?.raceTied ?? 0,
      },
      grid: {
        rated: teammates?.gridRated ?? 0,
        pool: teammates?.pool ?? 0,
        a: teammates?.gridA ?? 0,
        b: teammates?.gridB ?? 0,
        tied: teammates?.gridTied ?? 0,
      },
    },
    seasons,
  };
}

function buildPair(
  first: EntityWorkings,
  second: EntityWorkings,
  sameTeam: readonly SameTeamRow[],
): ComparePair {
  const a = first.entity.identity.ref;
  const b = second.entity.identity.ref;
  const ledgers = buildPairLedgers(first.races, second.races);

  let sameTeamRaces = 0;
  const sameTeamSeasons: ComparePair['sameTeamSeasons'] = [];
  for (const row of sameTeam) {
    sameTeamRaces += row.pool;
    sameTeamSeasons.push({ year: row.year, teamRef: row.teamRef, teamName: row.teamName });
  }

  return {
    a,
    b,
    relation: relationFor(sameTeamRaces, ledgers.sharedSeasons.length),
    sharedRaces: ledgers.pool,
    sameTeamRaces,
    sharedSeasons: ledgers.sharedSeasons,
    sameTeamSeasons,
    yearsApart: yearsApart(first.entity, second.entity),
    /* Oriented to `first`, which is the reader's selection order — `buildPairLedgers` walks
     * `first`'s races, so `a` is always the first-selected driver's count. The same-team rows are
     * oriented by reference instead, and are only read through `sameTeamLedgers`. */
    race: ledgers.race,
    grid: ledgers.grid,
  };
}

/**
 * A chain's links, filled in from the same-team rows for every driver the chain names.
 *
 * Returns null when any consecutive pair has no same-team row, which would mean the graph and this
 * statement disagreed about what a teammate is — impossible on one database and worth refusing
 * rather than publishing a link with an empty ledger.
 */
export function buildChainLinks(
  path: readonly string[],
  byPair: ReadonlyMap<string, SameTeamRow[]>,
): ChainLink[] | null {
  const links: ChainLink[] = [];
  for (let i = 0; i + 1 < path.length; i += 1) {
    const from = path[i] ?? '';
    const to = path[i + 1] ?? '';
    const rows = byPair.get(pairKey(from, to));
    if (rows === undefined || rows.length === 0) return null;

    const flipped = from > to;
    const race: Ledger = { ...EMPTY_LEDGER };
    const grid: Ledger = { ...EMPTY_LEDGER };
    const teams: ChainLink['teams'] = [];
    let firstYear = Number.POSITIVE_INFINITY;
    let lastYear = Number.NEGATIVE_INFINITY;

    for (const row of rows) {
      const oriented = sameTeamLedgers(row, flipped);
      addLedger(race, oriented.race);
      addLedger(grid, oriented.grid);
      teams.push({ year: row.year, teamRef: row.teamRef, teamName: row.teamName });
      firstYear = Math.min(firstYear, row.year);
      lastYear = Math.max(lastYear, row.year);
    }

    links.push({ from, to, firstYear, lastYear, teams, race, grid });
  }
  return links;
}

/**
 * `readSeasonList` reshaped to the archive spine every year axis on the page shares.
 *
 * **Sorted ascending here, because `GET /api/seasons` is `ORDER BY s.year DESC`** — a season list
 * is read newest-first and a *year axis* runs left to right, so the reshape is not a pass-through.
 * `src/features/compare/model.ts`'s `archiveDomain` takes `archive[0]` as the domain's start, so
 * publishing the season hub's order would have drawn every era strip backwards from 2026 to 1950.
 */
export function buildArchive(): ArchiveSeason[] {
  return readSeasonList()
    .seasons.map((season) => ({
      year: season.year,
      rounds: season.rounds,
      isComplete: season.isComplete,
    }))
    .sort((x, y) => x.year - y.year);
}

/* -------------------------------------------------------------------------- read functions */

function jsonRefs(refs: readonly string[]): { refs: string } {
  return { refs: JSON.stringify(refs) };
}

export function readIdentities(refs: readonly string[]): Map<string, CompareIdentity> {
  const rows = Q_COMPARE_IDENTITIES().all(jsonRefs(refs)) as IdentityRow[];
  return new Map(rows.map((row) => [row.ref, row]));
}

/**
 * The whole `GET /api/compare` payload, or **null when a requested reference has no race in the
 * archive** — which covers both an unknown slug and one of the 63 drivers of 881 who are in the
 * dataset and never started a Grand Prix.
 *
 * Null becomes the route's 404, and both cases answer it for the same reason: there is no career to
 * compare. The alternative was a nullable `firstSeason`/`lastSeason` on the entity, which would put
 * "this driver has no span" into every consumer of a field that is a span on 818 of 881 drivers.
 * The picker is built from drivers with `races > 0`, so the state is unreachable except by typing a
 * URL, and typing one gets an answer rather than an empty page.
 */
export function readCompare(refs: readonly string[]): CompareData | null {
  const identities = readIdentities(refs);
  const raceRows = Q_COMPARE_RACES().all(jsonRefs(refs)) as CompareRaceRow[];
  const racesByDriver = collapseRaces(raceRows);

  for (const ref of refs) {
    if (!identities.has(ref)) return null;
    if ((racesByDriver.get(ref) ?? []).length === 0) return null;
  }

  const seasonComplete = readSeasonCompleteness();
  const teammateRows = Q_COMPARE_TEAMMATE_TOTALS().all(jsonRefs(refs)) as TeammateTotalRow[];
  const teammateByRef = new Map(teammateRows.map((row) => [row.ref, row]));
  const championshipRows = Q_COMPARE_CHAMPIONSHIPS().all(jsonRefs(refs)) as ChampionshipRow[];
  const championshipsByRef = new Map<string, ChampionshipRow[]>();
  for (const row of championshipRows) {
    const list = championshipsByRef.get(row.ref);
    if (list === undefined) championshipsByRef.set(row.ref, [row]);
    else list.push(row);
  }

  const workings: EntityWorkings[] = refs.map((ref) => {
    const races = racesByDriver.get(ref) ?? [];
    return {
      races,
      entity: buildEntity(
        /* c8 ignore next -- every ref is present: the loop above returned null otherwise. */
        identities.get(ref) ?? { ref, forename: ref, surname: ref, code: null },
        races,
        teammateByRef.get(ref),
        championshipsByRef.get(ref) ?? [],
        seasonComplete,
      ),
    };
  });

  const selectedSameTeam = groupSameTeam(
    Q_COMPARE_SAME_TEAM().all(jsonRefs(refs)) as SameTeamRow[],
  );

  const pairs: ComparePair[] = [];
  for (let i = 0; i < workings.length; i += 1) {
    for (let j = i + 1; j < workings.length; j += 1) {
      const first = workings[i];
      const second = workings[j];
      /* c8 ignore next -- both indices are inside the array by construction. */
      if (first === undefined || second === undefined) continue;
      pairs.push(
        buildPair(
          first,
          second,
          selectedSameTeam.get(pairKey(first.entity.identity.ref, second.entity.identity.ref)) ??
            [],
        ),
      );
    }
  }

  /* A chain is for the pairs that need one: a pair who were directly teammates already has the
   * strongest evidence there is on their own ledger, and a path through a third driver would be a
   * weaker restatement of it. */
  const graph = readTeammateGraph();
  const paths = pairs
    .filter((pair) => pair.relation !== 'teammate')
    .map((pair) => findChain(graph, pair.a, pair.b))
    .filter((path): path is string[] => path !== null && path.length > 1);

  const chainRefs = [...new Set(paths.flat())].sort();
  const chainSameTeam =
    chainRefs.length === 0
      ? new Map<string, SameTeamRow[]>()
      : groupSameTeam(Q_COMPARE_SAME_TEAM().all(jsonRefs(chainRefs)) as SameTeamRow[]);

  const chains: Chain[] = [];
  for (const path of paths) {
    const links = buildChainLinks(path, chainSameTeam);
    /* c8 ignore next -- the graph's edges and this statement come from the same rows. */
    if (links === null) continue;
    chains.push({ a: path[0] ?? '', b: path.at(-1) ?? '', length: links.length, links });
  }

  const people = readIdentities(chainRefs);
  for (const [ref, identity] of identities) people.set(ref, identity);

  return {
    entities: workings.map((working) => working.entity),
    pairs,
    chains,
    people: Object.fromEntries(people),
    archive: buildArchive(),
  };
}
