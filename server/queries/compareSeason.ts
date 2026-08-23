import type {
  CompareSeasonLens,
  CompareSeasons,
  SeasonEntrant,
  SeasonSeat,
  SeatSegment,
} from '../schemas/compare';
import { readIdentities } from './compare';
import { prepared } from './prepared';
import { readSeasonCompleteness } from './seasons';

/**
 * `GET /api/compare/seasons` — the season lens of the comparison workspace. F7.
 *
 * **One season, round by round, with points**, for every season the selection entered. The shapes
 * are `src/features/compare/types.ts`'s, which the surface wrote before this module existed
 * (`DESIGN_SYSTEM.md` §6.6.5), and `schemas/compare.ts` carries the reasoning behind each field.
 *
 * ================================================================ why one request, not one a year
 *
 * The surface assumed a per-year endpoint — *"choosing a year on the rail is a new request"* — and
 * this is not one, deliberately. `ComparePage` keeps the chosen year in local state and does not
 * publish it, so a per-year endpoint could not be told which year to ask for; and sending every
 * season the selection entered costs little and buys `ARCHITECTURE.md` §8's "chart interaction
 * < 100 ms, **no network**" on the year rail outright. It is bounded by the same parameter the
 * career lens is — four careers, the longest of which is 23 seasons — so the union cannot exceed
 * the archive's 77 years.
 *
 * ==================================================================================== five reads
 *
 * All five are rooted at the **four selected drivers** rather than at a season, which is what keeps
 * a 40-season answer cheap: the widest read in this module is the ~900 race sessions those four
 * appeared in, not the 26,093 rows of the archive.
 *
 * 1. `SQL_SEASON_LENS_ENTRIES` — the selection's own race rows, driver-rooted (~900).
 * 2. `SQL_SEASON_LENS_SEAT` — the other cars in the same team at those same sessions.
 * 3. `SQL_SEASON_LENS_ROUNDS` — the numbered rounds of the years involved.
 * 4. `SQL_SEASON_LENS_SYSTEM` — each year's championship system, for `bestResults`.
 * 5. `SQL_SEASON_LENS_PROGRESSION` — the championship snapshots for the drivers who appear.
 *
 * Read 5 depends on read 2, because the occupants are not known until the seats are resolved. That
 * is one dependent round trip against a local file, and the alternative — reading every driver's
 * snapshots for 40 seasons — is 20× the rows for the same answer.
 *
 * **No `lap` or `pit_stop` access anywhere** (S-10, trap 7).
 *
 * ===================================================================== points, and the one licence
 *
 * Trap 4 forbids summing points across eras. Inside one season there is one points system and one
 * calendar, so this lens may show them — and it is the only surface in the product that may. Even
 * here nothing is summed: every figure is **read** from `driver_championship`, which already
 * applies the era's counting rule and already carries the three recorded adjustments (§2.5).
 * `bestResults` publishes the rule, so the surface can explain why Fangio's 1957 line is flat from
 * round 6 to round 8 despite a second place at Monza.
 */

/* ------------------------------------------------------------------------------------- SQL */

/**
 * The driver-rooted CTE both entry statements start from: every `session_entry` belonging to one of
 * the selected references, resolved through `idx_driver_ref` → `idx_td_driver` → `idx_re_td` →
 * `idx_se_re` rather than by scanning the entries table. Measured at 3.4 ms for four careers
 * against 10.0 ms for the equivalent filter on `v_race`.
 */
const PICKED_CTE = `
picked AS MATERIALIZED (
  SELECT se.id            AS entry_id,
         se.session_id    AS session_id,
         d.reference      AS driver_ref,
         td.team_id       AS team_id,
         se.position      AS position,
         se.status        AS status,
         se.is_classified AS is_classified
  FROM driver d
  JOIN team_driver td   ON td.driver_id = d.id
  JOIN round_entry re   ON re.team_driver_id = td.id
  JOIN session_entry se ON se.round_entry_id = re.id
  WHERE d.reference IN (SELECT value FROM json_each(@refs))
)`;

/** Every race row of the selected drivers, in every season. One row per classification (trap 17). */
export const SQL_SEASON_LENS_ENTRIES = `
WITH ${PICKED_CTE}
SELECT p.driver_ref    AS driverRef,
       s.year          AS year,
       r.number        AS round,
       p.session_id    AS sessionId,
       p.team_id       AS teamId,
       t.reference     AS teamRef,
       p.position      AS position,
       p.status        AS status,
       p.is_classified AS isClassified
FROM picked p
JOIN session ses ON ses.id = p.session_id AND ses.type = 'R'
JOIN round r     ON r.id = ses.round_id AND r.number IS NOT NULL
JOIN season s    ON s.id = r.season_id
JOIN team t      ON t.id = p.team_id
ORDER BY p.driver_ref, s.year, r.number, (p.position IS NULL), p.position, p.entry_id`;

/**
 * The **other** cars in the same team at the same races.
 *
 * Bounded to the sessions the selection actually appeared in, so this is ~900 sessions rather than
 * the archive. It carries every one of them, not one per team: the count is what `carsBeside`
 * publishes, and the occupant is only named when that count is exactly 1.
 *
 * **It does not exclude the selected drivers**, and that is load-bearing rather than lazy. Two
 * selected drivers can be each other's other seat — Hamilton and Rosberg were Mercedes teammates
 * for all 21 rounds of 2016 — so filtering the selection out here would empty both their seats on
 * exactly the comparison the page exists for. The principal is removed per entrant instead, where
 * "the other seat" actually means something.
 */
export const SQL_SEASON_LENS_SEAT = `
WITH ${PICKED_CTE},
seat_key AS (
  SELECT DISTINCT session_id, team_id FROM picked
)
SELECT se.session_id    AS sessionId,
       td.team_id       AS teamId,
       d.reference      AS driverRef,
       se.position      AS position,
       se.is_classified AS isClassified
FROM seat_key k
JOIN session_entry se ON se.session_id = k.session_id
JOIN round_entry re   ON re.id = se.round_entry_id
JOIN team_driver td   ON td.id = re.team_driver_id AND td.team_id = k.team_id
JOIN driver d         ON d.id = td.driver_id
ORDER BY se.session_id, td.team_id, d.reference, (se.position IS NULL), se.position, se.id`;

/**
 * The numbered rounds of every year involved. `AND r.number IS NOT NULL` is trap 15's filter, and
 * it is what makes `rounds.length` equal `max(number)` — 22 for 2026, whose 24 calendar rows
 * include two cancelled rounds with a NULL number.
 */
export const SQL_SEASON_LENS_ROUNDS = `
SELECT s.year   AS year,
       r.number AS number,
       r.name   AS name
FROM round r
JOIN season s ON s.id = r.season_id
WHERE s.year IN (SELECT value FROM json_each(@years)) AND r.number IS NOT NULL
ORDER BY s.year, r.number`;

/**
 * Each year's championship system. `driver_best_results > 0` means only the best N results counted
 * — 1957 counted five of eight — and the name is the system's own, never an undocumented enum
 * (trap 14).
 */
export const SQL_SEASON_LENS_SYSTEM = `
SELECT s.year                AS year,
       cs.name               AS systemName,
       cs.driver_best_results AS bestResults
FROM season s
JOIN championship_system cs ON cs.id = s.championship_system_id
WHERE s.year IN (SELECT value FROM json_each(@years))`;

/**
 * One championship snapshot per round, for the drivers who appear on this lens.
 *
 * `last_of_round` is `DATABASE.md` §6.5's rule generalised to several years at once, and it is
 * load-bearing from 2026: the table carries a snapshot after Q1, Q2 and Q3 as well, so a bare
 * `WHERE year = ?` returns 962 rows for 2026 where the progression has 10, four of them per race
 * carrying identical totals.
 *
 * ⚠ **The join is on `year` and `round_number`, never on `season_id`.** That column is NULL on
 * **32,963 of 36,091 rows (91.3 %)**, and a join through it fails silently and plausibly: it
 * returns only the ~3,128 rows that carry one, which are the final snapshots, so the answer looks
 * like a correct one. `DATABASE.md` §7 trap 26.
 */
export const SQL_SEASON_LENS_PROGRESSION = `
WITH last_of_round AS (
  SELECT year, round_number, max(session_number) AS session_number
  FROM driver_championship
  WHERE year IN (SELECT value FROM json_each(@years))
  GROUP BY year, round_number
)
SELECT d.reference     AS driverRef,
       dc.year         AS year,
       dc.round_number AS round,
       dc.points       AS points,
       dc.position     AS position
FROM driver_championship dc
JOIN last_of_round lr
  ON lr.year = dc.year
 AND lr.round_number = dc.round_number
 AND lr.session_number = dc.session_number
JOIN driver d ON d.id = dc.driver_id
WHERE dc.year IN (SELECT value FROM json_each(@years))
  AND d.reference IN (SELECT value FROM json_each(@refs))`;

const Q_ENTRIES = prepared(SQL_SEASON_LENS_ENTRIES);
const Q_SEAT = prepared(SQL_SEASON_LENS_SEAT);
const Q_ROUNDS = prepared(SQL_SEASON_LENS_ROUNDS);
const Q_SYSTEM = prepared(SQL_SEASON_LENS_SYSTEM);
const Q_PROGRESSION = prepared(SQL_SEASON_LENS_PROGRESSION);

/* -------------------------------------------------------------------------------- row shapes */

export interface LensEntryRow {
  driverRef: string;
  year: number;
  round: number;
  sessionId: number;
  teamId: number;
  teamRef: string;
  position: number | null;
  status: number;
  isClassified: number;
}

export interface LensSeatRow {
  sessionId: number;
  teamId: number;
  driverRef: string;
  position: number | null;
  isClassified: number;
}

export interface LensRoundRow {
  year: number;
  number: number;
  name: string;
}

export interface LensSystemRow {
  year: number;
  systemName: string;
  bestResults: number | null;
}

export interface LensProgressionRow {
  driverRef: string;
  year: number;
  round: number;
  points: number;
  position: number | null;
}

/* --------------------------------------------------------- pure builders (no database access) */

/** One driver's race at one round, after their rows for it have been collapsed (trap 17). */
export interface LensEntry {
  driverRef: string;
  year: number;
  round: number;
  sessionId: number;
  teamId: number;
  teamRef: string;
  /** Best **classified** finishing position; null when the driver holds none (trap 3). */
  finish: number | null;
}

/**
 * `status IN (30, 40)` — withdrew, did not start, did not qualify. `DATABASE.md` §3's "never
 * started" grouping.
 */
const NEVER_STARTED = new Set([30, 40]);

function key(...parts: (string | number)[]): string {
  return parts.join(' ');
}

/**
 * Rows → one entry per (driver, year, round).
 *
 * The rows arrive ordered with the outcome row first, so the first row of a race decides the team
 * and the rest only lower the best classified finish.
 *
 * **A round the driver was entered for and did not start produces no entry**, which is the
 * surface's own wording: `teamAt` is *"the team at each round, null where the driver did not start
 * it"* and `entered` is *"false when the driver started no race that season"*. `status IN (30, 40)`
 * is exactly `DATABASE.md` §3's "never started" grouping — 372 withdrew/did-not-start rows and 8
 * did-not-qualify across the archive — so a driver whose only appearance was a failed qualifying
 * attempt reads `entered: false` rather than drawing a line for a race they watched.
 */
export function collapseLensEntries(rows: readonly LensEntryRow[]): LensEntry[] {
  const byKey = new Map<string, LensEntry>();
  for (const row of rows) {
    if (NEVER_STARTED.has(row.status)) continue;
    const id = key(row.driverRef, row.year, row.round);
    const finish = row.isClassified === 1 ? row.position : null;
    const existing = byKey.get(id);
    if (existing === undefined) {
      byKey.set(id, {
        driverRef: row.driverRef,
        year: row.year,
        round: row.round,
        sessionId: row.sessionId,
        teamId: row.teamId,
        teamRef: row.teamRef,
        finish,
      });
      continue;
    }
    if (finish !== null && (existing.finish === null || finish < existing.finish)) {
      existing.finish = finish;
    }
  }
  return [...byKey.values()];
}

/** The other cars, keyed by `(session, team)`, collapsed to one row per driver (trap 17). */
export function collapseSeatRows(
  rows: readonly LensSeatRow[],
): Map<string, { driverRef: string; finish: number | null }[]> {
  type Car = { driverRef: string; finish: number | null };
  const byCar = new Map<string, Map<string, Car>>();
  for (const row of rows) {
    const carKey = key(row.sessionId, row.teamId);
    const drivers: Map<string, Car> = byCar.get(carKey) ?? new Map<string, Car>();
    const finish = row.isClassified === 1 ? row.position : null;
    const existing = drivers.get(row.driverRef);
    if (existing === undefined) drivers.set(row.driverRef, { driverRef: row.driverRef, finish });
    else if (finish !== null && (existing.finish === null || finish < existing.finish)) {
      existing.finish = finish;
    }
    byCar.set(carKey, drivers);
  }
  return new Map([...byCar].map(([carKey, drivers]) => [carKey, [...drivers.values()]]));
}

/** `ref` → `year` → `round` → snapshot. */
export function indexProgression(
  rows: readonly LensProgressionRow[],
): Map<string, LensProgressionRow> {
  const byKey = new Map<string, LensProgressionRow>();
  for (const row of rows) byKey.set(key(row.driverRef, row.year, row.round), row);
  return byKey;
}

/**
 * Contiguous runs of one occupant, in round order — including the runs where there was nobody.
 *
 * The null runs are carried rather than dropped because they are a statement the surface makes:
 * *this car had no single other seat over these rounds*, whether because the team fielded nothing
 * else, fielded several, or because the rounds have not been run.
 */
export function seatSegments(
  occupant: readonly (string | null)[],
  label: (ref: string) => string,
): SeatSegment[] {
  const segments: SeatSegment[] = [];
  for (let i = 0; i < occupant.length; i += 1) {
    const ref = occupant[i] ?? null;
    const last = segments.at(-1);
    if (last !== undefined && last.ref === ref) {
      last.toRound = i + 1;
      continue;
    }
    segments.push({
      ref,
      label: ref === null ? '' : label(ref),
      fromRound: i + 1,
      toRound: i + 1,
    });
  }
  return segments;
}

const EMPTY_SEAT = (rounds: number): SeasonSeat => ({
  occupant: new Array<string | null>(rounds).fill(null),
  points: new Array<number | null>(rounds).fill(null),
  finish: new Array<number | null>(rounds).fill(null),
  segments: rounds === 0 ? [] : [{ ref: null, label: '', fromRound: 1, toRound: rounds }],
  carsBeside: new Array<number | null>(rounds).fill(null),
});

export interface LensInputs {
  year: number;
  roundCount: number;
  complete: boolean;
  systemName: string;
  bestResults: number | null;
  rounds: { number: number; name: string }[];
  /** The selection's entries in this season, keyed `<ref> <year> <round>`. */
  entries: ReadonlyMap<string, LensEntry>;
  /** The other cars, keyed `<sessionId> <teamId>`. */
  cars: ReadonlyMap<string, { driverRef: string; finish: number | null }[]>;
  progression: ReadonlyMap<string, LensProgressionRow>;
  label: (ref: string) => string;
}

/**
 * One driver's season. Every array is `roundCount` long and indexed by round − 1, so `points[i]`
 * belongs to `rounds[i]` and the surface never has to align two lists.
 *
 * A driver who entered no race that season gets `entered: false` and every array null — **a state
 * the surface is given rather than one it infers**, because an absent entrant and a failed request
 * look identical from an empty array.
 */
export function buildEntrant(ref: string, inputs: LensInputs): SeasonEntrant {
  const { roundCount } = inputs;
  const teamAt = new Array<string | null>(roundCount).fill(null);
  const points = new Array<number | null>(roundCount).fill(null);
  const standing = new Array<number | null>(roundCount).fill(null);
  const finish = new Array<number | null>(roundCount).fill(null);
  const occupant = new Array<string | null>(roundCount).fill(null);
  const seatPoints = new Array<number | null>(roundCount).fill(null);
  const seatFinish = new Array<number | null>(roundCount).fill(null);
  const carsBeside = new Array<number | null>(roundCount).fill(null);
  const teamRefs: string[] = [];
  let entered = false;

  for (let i = 0; i < roundCount; i += 1) {
    const round = i + 1;
    const snapshot = inputs.progression.get(key(ref, inputs.year, round));
    if (snapshot !== undefined) {
      points[i] = snapshot.points;
      standing[i] = snapshot.position;
    }

    const entry = inputs.entries.get(key(ref, inputs.year, round));
    if (entry === undefined) continue;
    entered = true;
    teamAt[i] = entry.teamRef;
    finish[i] = entry.finish;
    if (!teamRefs.includes(entry.teamRef)) teamRefs.push(entry.teamRef);

    /* Everyone in that car, the principal removed here rather than in SQL — two selected drivers
     * can be each other's other seat. */
    const beside = (inputs.cars.get(key(entry.sessionId, entry.teamId)) ?? []).filter(
      (car) => car.driverRef !== ref,
    );
    carsBeside[i] = beside.length;
    /* One other car is a seat; several are not. Naming one of eleven Maseratis "the other seat"
     * would be a choice this data cannot support, so the occupant is null and `carsBeside` says
     * how many there were. */
    const only = beside.length === 1 ? beside[0] : undefined;
    if (only !== undefined) {
      occupant[i] = only.driverRef;
      seatFinish[i] = only.finish;
      seatPoints[i] =
        inputs.progression.get(key(only.driverRef, inputs.year, round))?.points ?? null;
    }
  }

  const seat: SeasonSeat = entered
    ? {
        occupant,
        points: seatPoints,
        finish: seatFinish,
        segments: seatSegments(occupant, inputs.label),
        carsBeside,
      }
    : EMPTY_SEAT(roundCount);

  return entered
    ? { ref, entered, teamRefs, teamAt, points, standing, finish, seat }
    : {
        ref,
        entered: false,
        teamRefs: [],
        teamAt,
        points: new Array<number | null>(roundCount).fill(null),
        standing: new Array<number | null>(roundCount).fill(null),
        finish,
        seat,
      };
}

export function buildLens(refs: readonly string[], inputs: LensInputs): CompareSeasonLens {
  return {
    year: inputs.year,
    complete: inputs.complete,
    bestResults: inputs.bestResults,
    systemName: inputs.systemName,
    rounds: inputs.rounds,
    entrants: refs.map((ref) => buildEntrant(ref, inputs)),
  };
}

/* -------------------------------------------------------------------------- read functions */

const refsParam = (refs: readonly string[]): { refs: string } => ({ refs: JSON.stringify(refs) });
const yearsParam = (years: readonly number[]): { years: string } => ({
  years: JSON.stringify(years),
});

/**
 * Every season the selection entered, oldest first — or **null when a requested reference has no
 * race in the archive**, which covers an unknown slug and the 63 drivers of 881 who are in the
 * dataset and never started a Grand Prix. Null becomes the route's 404, for the same reason the
 * career lens returns it: there is no season to show.
 *
 * A driver who raced *somewhere* but not in a given season is a different case entirely and is not
 * an error: they appear in that season's `entrants` with `entered: false`.
 */
export function readCompareSeasons(refs: readonly string[]): CompareSeasons | null {
  const identities = readIdentities(refs);
  for (const ref of refs) if (!identities.has(ref)) return null;

  const refParam = refsParam(refs);
  const entries = collapseLensEntries(Q_ENTRIES().all(refParam) as LensEntryRow[]);

  /* The same 404 rule the career lens applies, for the same reason: a driver with no race in the
   * archive has no season to show. The picker only offers the 818 who have one, so this is only
   * reachable by typing a URL. A driver who raced but not in *this* season is a different case and
   * is not an error — they appear with `entered: false`. */
  const raced = new Set(entries.map((entry) => entry.driverRef));
  for (const ref of refs) if (!raced.has(ref)) return null;

  const years = [...new Set(entries.map((entry) => entry.year))].sort((x, y) => x - y);
  const yearParam = yearsParam(years);

  const cars = collapseSeatRows(Q_SEAT().all(refParam) as LensSeatRow[]);

  /* The occupants are only known once the seats are resolved, so the snapshot read waits for
   * them — 40 seasons of every driver's standings would be twenty times the rows for the same
   * answer. */
  const people = new Set<string>(refs);
  for (const list of cars.values()) {
    for (const ref of refs) {
      if (!list.some((car) => car.driverRef === ref)) continue;
      const others = list.filter((car) => car.driverRef !== ref);
      const only = others.length === 1 ? others[0] : undefined;
      if (only !== undefined) people.add(only.driverRef);
    }
  }
  const progression = indexProgression(
    Q_PROGRESSION().all({
      ...refsParam([...people].sort()),
      ...yearParam,
    }) as LensProgressionRow[],
  );

  const roundsByYear = new Map<number, { number: number; name: string }[]>();
  for (const row of Q_ROUNDS().all(yearParam) as LensRoundRow[]) {
    const list = roundsByYear.get(row.year);
    const round = { number: row.number, name: row.name };
    if (list === undefined) roundsByYear.set(row.year, [round]);
    else list.push(round);
  }

  const systemByYear = new Map<number, LensSystemRow>();
  for (const row of Q_SYSTEM().all(yearParam) as LensSystemRow[]) systemByYear.set(row.year, row);

  const entryByKey = new Map(
    entries.map((entry) => [key(entry.driverRef, entry.year, entry.round), entry]),
  );
  const names = readIdentities([...people].sort());
  const label = (ref: string): string => {
    const identity = names.get(ref);
    return identity === undefined ? ref : `${identity.forename} ${identity.surname}`;
  };
  const complete = readSeasonCompleteness();

  const seasons = years.map((year) => {
    const rounds = roundsByYear.get(year) ?? [];
    const system = systemByYear.get(year);
    return buildLens(refs, {
      year,
      roundCount: rounds.length,
      complete: complete.get(year) === true,
      /* Every one of the 77 seasons carries a system; the fallback exists so a database missing
       * one degrades to a name rather than throwing inside a map. */
      systemName: system?.systemName ?? `${String(year)} Championship`,
      bestResults:
        system?.bestResults !== undefined && system.bestResults !== null && system.bestResults > 0
          ? system.bestResults
          : null,
      rounds,
      entries: entryByKey,
      cars,
      progression,
      label,
    });
  });

  return { seasons };
}
