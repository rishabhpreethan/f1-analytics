import type { CoverageKey, Meta } from '@schemas/meta';
import type { Race, RaceClassificationRow } from '@schemas/race';
import { formatDuration, formatGap } from '@/lib/format';
import { selectCoverageNotice } from '@/features/meta/selectors';

/**
 * Where the race page's logic lives. Every function here is pure, synchronous,
 * React-free and unit-tested, and none of them mutates its input (ARCHITECTURE.md §3:
 * chart components never query; shaping lives in selectors).
 *
 * **No function here resolves a colour.** Series carry `colorRef`, a `team.reference` —
 * the one field `src/lib/entityColor.ts` takes — and the mapping to a token is the
 * `designer`'s, in one module, by contract (DESIGN_SYSTEM.md §3.3a.3). Nothing in this
 * file knows a hex exists.
 *
 * **No function here formats a duration of its own.** `formatDuration` and `formatGap` are
 * the only spellings of a lap time in this product (ARCHITECTURE.md §3).
 */

/* --------------------------------------------------------------- resolving the address */

export type ResolvedRaceRef =
  | { status: 'resolved'; year: number; round: number }
  | { status: 'invalid'; reason: 'year' | 'round'; value: string };

/**
 * Turn `:year` and `:round` into a race to fetch, or say which parameter was wrong.
 *
 * **Both patterns mirror the server's exactly**, and that is the point rather than
 * duplication: a client that accepted `01` or `1990.0` would send a request the server
 * answers with a 400, turning a recoverable typo into a failed fetch and a generic error
 * card instead of a sentence naming the problem.
 *
 * Unlike `resolveSeasonYear`, there is **no default to degrade to**. A season hub with a
 * bad year can show the latest season and a notice; there is no "latest race" that a
 * reader who typed a wrong round would have meant. So this reports the invalid parameter
 * and the surface explains it — which still satisfies ARCHITECTURE.md §5's "never a blank
 * page, never a crash", by way of a sentence rather than a substitution.
 */
export function resolveRaceRef(
  yearParam: string | undefined,
  roundParam: string | undefined,
): ResolvedRaceRef {
  const year = yearParam ?? '';
  const round = roundParam ?? '';

  if (!/^\d{4}$/.test(year)) return { status: 'invalid', reason: 'year', value: year };
  const yearNumber = Number(year);
  if (yearNumber < 1950 || yearNumber > 2100) {
    return { status: 'invalid', reason: 'year', value: year };
  }

  // `[1-9][0-9]?` and not `\d{1,2}`: `01` is a second spelling of round 1 and `0` is a
  // round that cannot exist. `server/schemas/race.ts` explains the reasoning once.
  if (!/^[1-9][0-9]?$/.test(round)) return { status: 'invalid', reason: 'round', value: round };
  const roundNumber = Number(round);
  if (roundNumber > 50) return { status: 'invalid', reason: 'round', value: round };

  return { status: 'resolved', year: yearNumber, round: roundNumber };
}

/* ------------------------------------------------------------------------- the states */

/**
 * Why a lap-scale surface has nothing to show — **or that it has something**.
 *
 * Four cases, and the reason they are four rather than one boolean is that they need
 * different sentences and two of them are not faults at all (DESIGN_SYSTEM.md §6.5.3: "a
 * no-coverage state is not an error and must never be painted `caution` or `critical`").
 *
 * | kind | meaning |
 * |---|---|
 * | `available` | there is data; render the chart |
 * | `noCoverage` | the season predates the dataset. **The common case: 484 races.** |
 * | `absent` | inside the window, and this race has none. Reachable once: 2021 R12. |
 * | `notRun` | the race has no classification yet — a scheduled round, not a gap |
 */
export type RaceDataState =
  | { kind: 'available' }
  | { kind: 'noCoverage'; notice: string }
  | { kind: 'absent'; notice: string }
  | { kind: 'notRun'; notice: string };

export interface RaceDataStates {
  /** Results exist 1950+, so this is only ever `available` or `notRun`. */
  results: RaceDataState;
  laps: RaceDataState;
  pits: RaceDataState;
}

/**
 * The sentence for a dataset that is inside its coverage window and still absent for this
 * particular race.
 *
 * **A different sentence from the no-coverage one, because it is a different fact**, and
 * getting them confused is how a reader is told lap data begins in 1996 about a 2021
 * race. §6.5.3 requires three things of this copy: where the boundary is, which side this
 * request falls on, and what *is* available instead — the third being the one that gets
 * dropped and the only one that helps.
 */
const ABSENT_COPY: Partial<Record<CoverageKey, (from: number) => string>> = {
  laps: (from) =>
    `No lap-by-lap timing is recorded for this race, although lap data is available from ${String(from)} onwards. The classification, grid and championship standings are complete for it.`,
  pitStops: (from) =>
    `No pit stops are recorded for this race, although pit data is available from ${String(from)} onwards. Stints and strategy can't be shown, so the lap charts stand on their own.`,
};

function coverageState(
  meta: Meta,
  key: CoverageKey,
  year: number,
  present: boolean,
): RaceDataState {
  const outside = selectCoverageNotice(meta, key, year);
  if (outside !== null) return { kind: 'noCoverage', notice: outside };
  if (present) return { kind: 'available' };
  return {
    kind: 'absent',
    notice: ABSENT_COPY[key]?.(meta.coverage[key].from) ?? '',
  };
}

/**
 * The five data states for one race page, resolved once so no surface decides for itself.
 *
 * Loading and error are the query's own states and are not modelled here — TanStack Query
 * owns them, and a selector that pretended to know about them would need a payload to
 * describe the absence of a payload. This covers the other three: **empty** (`notRun`),
 * **partial** (results available, one or both lap-scale datasets not) and **no coverage**.
 *
 * The boundary years come from `/api/meta` and are never hardcoded here — §6.5.3 requires
 * exactly that, and it is the reason `server/schemas/race.ts` deliberately does *not*
 * carry them in the race payload.
 */
export function selectRaceDataStates(meta: Meta, race: Race): RaceDataStates {
  const notRun: RaceDataState = {
    kind: 'notRun',
    // Phrased as coverage rather than as a calendar claim: REQUIREMENTS.md §2.5 warns the
    // dump can lag the real calendar by ~2 weeks, so "has not happened yet" is something
    // this code cannot honestly assert. "No results are recorded" is true either way.
    notice: `No results are recorded for this race yet.`,
  };

  if (!race.hasResults) return { results: notRun, laps: notRun, pits: notRun };

  return {
    results: { kind: 'available' },
    laps: coverageState(meta, 'laps', race.year, race.availability.hasLapData),
    pits: coverageState(meta, 'pitStops', race.year, race.availability.hasPitData),
  };
}

/* ----------------------------------------------------------------- identity and labels */

/**
 * The short label a chart endpoint or a table cell uses for a driver.
 *
 * **`code ?? surname`, and never a code derived from the surname.** 40 drivers who have
 * race lap data carry no `driver.abbreviation` — the whole 1996 grid, Häkkinen, Damon
 * Hill, Frentzen, Irvine, Panis — so a label built from `code` alone leaves half of an
 * early lap-data field unlabelled, and `surname.slice(0, 3).toUpperCase()` would invent a
 * three-letter code the sport never used (and would render `HÄK` for a driver the timing
 * screens called `HAK`). Fabricating an F1 convention is worse than a longer label.
 */
export function selectDriverShortLabel(driver: { code: string | null; surname: string }): string {
  return driver.code ?? driver.surname;
}

/**
 * The key a list of classification rows must use.
 *
 * **`driverRef` alone is not unique within a race** — 40 races between 1950 and 1964
 * classify one driver twice or three times, because two drivers shared a car and both
 * were classified. 1951 R4 lists Fangio and Fagioli both at P1 in car 8. Counted
 * directly, `(driverRef, carNumber)` is unique in all 1,173 races.
 *
 * This exists so a React `key` is right by construction rather than by whoever writes the
 * `.map()` remembering a fact about 1951. `key={row.driverRef}` renders fine on every
 * race anyone is likely to open and duplicates keys on forty of them.
 */
export function selectClassificationKey(row: {
  driverRef: string;
  carNumber: number | null;
}): string {
  return `${row.driverRef}#${row.carNumber === null ? 'x' : String(row.carNumber)}`;
}

/* --------------------------------------------------------------- RD-10, classification */

/**
 * What the gap column shows for one row.
 *
 * Three kinds, because the sport shows three different things and collapsing them is the
 * defect `DESIGN_SYSTEM.md` §6.6.1 names: *"gaps come from the recorded time, and a lapped
 * finisher shows `+1 Lap`, not a duration"*.
 */
export type GapDisplay =
  | { kind: 'total'; text: string }
  | { kind: 'gap'; text: string }
  | { kind: 'status'; text: string };

export interface ClassificationRowView {
  key: string;
  row: RaceClassificationRow;
  label: string;
  /** `team.reference` — the only identity field a colour ever reads. */
  colorRef: string;
  gap: GapDisplay;
  /** `status IN (10, 11)` — a retirement, never inferred from a null position (trap 3). */
  isRetirement: boolean;
}

/**
 * Shape the classification for RD-10.
 *
 * The leader's time is taken from the **first row at P1 that carries one**, and a row at
 * P1 shows that total rather than a gap to itself. That is what makes a shared drive read
 * correctly: 1951 R4's two P1 rows both show the winning time, where a naive "row 0 is the
 * leader, everyone else is a gap" would print `+0.000` beside Fagioli.
 *
 * A row with no recorded total time falls back to `detail`, which is where `+1 Lap` comes
 * from — 7,450 of 7,814 lapped finishers have no duration, so this is the ordinary path
 * and not an edge case.
 */
export function selectClassificationView(race: Race): ClassificationRowView[] {
  const leaderTimeMs =
    race.classification.find((row) => row.position === 1 && row.totalTimeMs !== null)
      ?.totalTimeMs ?? null;

  return race.classification.map((row) => ({
    key: selectClassificationKey(row),
    row,
    label: selectDriverShortLabel(row),
    colorRef: row.teamRef,
    gap: selectGapDisplay(row, leaderTimeMs),
    isRetirement: row.outcome === 'accident' || row.outcome === 'mechanical',
  }));
}

export function selectGapDisplay(
  row: Pick<RaceClassificationRow, 'position' | 'totalTimeMs' | 'detail'>,
  leaderTimeMs: number | null,
): GapDisplay {
  if (row.totalTimeMs === null) return { kind: 'status', text: row.detail };
  if (row.position === 1 || leaderTimeMs === null) {
    return { kind: 'total', text: formatDuration(row.totalTimeMs) };
  }
  return { kind: 'gap', text: formatGap(row.totalTimeMs - leaderTimeMs) };
}

/**
 * The counts a race header states, each derived from `status` rather than from a null
 * position (trap 3).
 *
 * `finishers` is `is_classified`, §3's canonical flag — **not** `status === 0`, because a
 * lapped car is classified and finished the race. `retirements` is `status IN (10, 11)`,
 * and `nonStarters` is `status IN (30, 40)`, which §3 requires be excluded from "starts"
 * counts and which is therefore counted separately rather than folded into either.
 */
export function selectRaceCounts(race: Race): {
  entries: number;
  starters: number;
  finishers: number;
  retirements: number;
  disqualified: number;
  nonStarters: number;
} {
  let starters = 0;
  let finishers = 0;
  let retirements = 0;
  let disqualified = 0;
  let nonStarters = 0;

  for (const row of race.classification) {
    const neverStarted = row.outcome === 'didNotStart' || row.outcome === 'didNotQualify';
    if (neverStarted) nonStarters += 1;
    else starters += 1;
    if (row.isClassified) finishers += 1;
    if (row.outcome === 'accident' || row.outcome === 'mechanical') retirements += 1;
    if (row.outcome === 'disqualified') disqualified += 1;
  }

  return {
    entries: race.classification.length,
    starters,
    finishers,
    retirements,
    disqualified,
    nonStarters,
  };
}
