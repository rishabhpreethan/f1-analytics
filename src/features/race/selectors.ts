import type { CoverageKey, Meta } from '@schemas/meta';
import type { Race, RaceClassificationRow } from '@schemas/race';
import { formatDuration, formatGap, formatLapDeficit } from '@/lib/format';
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
 * What the result column shows for one row.
 *
 * Three kinds, because the sport shows three different things and collapsing them is the
 * defect `DESIGN_SYSTEM.md` §6.6.1 names. A lap deficit is a `status`, not a `gap`: it is a
 * word-and-number like "Retired" or "Engine", set in the text face rather than as a
 * numeral, and it is emphatically **not** a duration.
 */
export type GapDisplay =
  | { kind: 'total'; text: string }
  | { kind: 'gap'; text: string }
  | { kind: 'status'; text: string };

/**
 * The two race-wide figures a single row's result is measured against.
 *
 * **A named object rather than two positional parameters**, because `(row, number | null,
 * number | null)` is a call site where a swap typechecks: a lap count and a millisecond
 * duration are both nullable numbers, and transposing them would produce a wrong result
 * column with no error anywhere.
 */
export interface ClassificationReference {
  /** The winner's total race time, or null when no finisher at P1 carries one. */
  leaderTimeMs: number | null;
  /** The race distance actually run — `max(lapsCompleted)`. Null with no classification. */
  raceLaps: number | null;
}

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
 * The leader's time is taken from the **first finisher at P1 that carries one**, and a row
 * at P1 shows that total rather than a gap to itself. That is what makes a shared drive
 * read correctly: 1951 R4's two P1 rows both show the winning time, where a naive "row 0 is
 * the leader, everyone else is a gap" would print `+0.000` beside Fagioli. Counted, no two
 * P1 rows in the archive carry *different* times, so "the first" is unambiguous.
 *
 * **`outcome === 'finished'` is part of the search, not decoration.** All 1,162 P1 rows in
 * the data are `status = 0` with a time, so the filter changes nothing today — but the
 * reference every other row is measured against must be a car that actually completed the
 * race, and 9 disqualified entries do carry a recorded time. This makes a future P1 row
 * that is not a finisher unusable as the reference rather than silently authoritative.
 */
export function selectClassificationView(race: Race): ClassificationRowView[] {
  const reference: ClassificationReference = {
    leaderTimeMs:
      race.classification.find(
        (row) => row.position === 1 && row.outcome === 'finished' && row.totalTimeMs !== null,
      )?.totalTimeMs ?? null,
    raceLaps: race.raceLaps,
  };

  return race.classification.map((row) => ({
    key: selectClassificationKey(row),
    row,
    label: selectDriverShortLabel(row),
    colorRef: row.teamRef,
    gap: selectGapDisplay(row, reference),
    isRetirement: row.outcome === 'accident' || row.outcome === 'mechanical',
  }));
}

/**
 * Does `detail` already state a lap deficit? **Tested, never parsed** — the number is never
 * read out of it, so `detail` stays the single authority on its own figure and nothing here
 * can disagree with it.
 *
 * Matches the two spellings the data uses and nothing else: `+1 Lap`, `+2 Laps`.
 */
const DETAIL_STATES_LAP_DEFICIT = /^\+\d+ Laps?$/;

/**
 * The label for a car that ran without earning a classified position.
 *
 * **The dataset's own word for this state, not copy chosen here** — 171 rows with
 * `status = 1` and `is_classified = 0` carry exactly this string, 1950 to 2004. Spelled once
 * because two eras spell the same state differently (trap 22) and the column must not.
 */
const NOT_CLASSIFIED = 'Not classified';

/**
 * What the result column shows for one row — **decided by `outcome`, never by whether a
 * time happens to be present.**
 *
 * ## The defect this shape exists to make impossible
 *
 * Live on 2026 R6, six rows read down to `−2:02:28.126`. A retiree's `totalTimeMs` is their
 * elapsed time **when they stopped**, so it is *smaller* than the winner's — Bottas stopped
 * on lap 15 at 1,263,117 ms against a winning 8,611,243 — and `total − leader` went
 * negative. The old branch keyed on `totalTimeMs !== null`, which cannot tell a finisher
 * from a retiree who has a recorded time, so the gap was computed for drivers who never
 * finished.
 *
 * **A `delta < 0` guard would have been the wrong fix**, and measurably so. Counted across
 * race sessions, rows where a non-finisher carries a time:
 *
 * | | rows | pages | how it reads |
 * |---|---|---|---|
 * | time **below** the winner's | 165 | 67 | a negative duration — visible, and reported |
 * | time **above** the winner's | 372 | 67 | `+31.402` — **plausible, meaningless, invisible** |
 *
 * The second group is the larger one and includes **every one of 2026's ten completed
 * rounds** (R1 alone has eleven). A sign guard repairs the first group and leaves the
 * second exactly as wrong, which is why the branch is derived from what the row **is**.
 *
 * ## The table, exhaustive over `raceOutcomeSchema` (§6.6.1)
 *
 * | `outcome` | shows |
 * |---|---|
 * | `finished` at P1, or with no leader time to compare against | the total time |
 * | `finished` otherwise | `+gap` to the leader |
 * | `lapped`, classified | `+N Laps` — never a duration |
 * | everything else, and any row with no recorded time | `detail` |
 *
 * **The `switch` has no `default` on purpose.** With all eight members listed and every arm
 * returning, adding a ninth to `raceOutcomeSchema` makes the end of the function reachable
 * and `tsc` rejects it under `strictNullChecks` — "lacks ending return statement". A
 * `default` arm would silently absorb that ninth member into whichever neighbour it
 * resembled, which is precisely how this class of defect ships (§1.0b).
 */
export function selectGapDisplay(
  row: Pick<
    RaceClassificationRow,
    'position' | 'totalTimeMs' | 'detail' | 'outcome' | 'isClassified' | 'lapsCompleted'
  >,
  reference: ClassificationReference,
): GapDisplay {
  switch (row.outcome) {
    case 'finished':
      return finishedResult(row, reference.leaderTimeMs);

    case 'lapped':
      return lappedResult(row, reference.raceLaps);

    /*
     * No result relative to the winner. A time on one of these rows is not a smaller
     * number, it is a **different quantity** — elapsed time to the point of retirement —
     * and 173 of them carry one. `detail` is §3's display half ("`status` for grouping,
     * `detail` for display") and reads "Retired", "Engine", "Collision", "Did not start".
     */
    case 'accident':
    case 'mechanical':
    case 'disqualified':
    case 'didNotStart':
    case 'didNotQualify':
    case 'unknown':
      return { kind: 'status', text: row.detail };
  }
}

/**
 * A full-distance finisher: the only row a duration is meaningful on.
 *
 * **No sign guard on the subtraction, deliberately.** Every one of the 8,109 finishers
 * carrying a time is at or above the winner's, counted — so a negative here would be
 * upstream data corruption, and `formatGap`'s `−` glyph makes it visible rather than
 * quietly clamping it to something plausible. Suppressing it would hide the one case where
 * a reader should be told the data is wrong.
 *
 * The `null` time is one row in the whole archive — 1950 R7 Ascari, P2, `detail: 'Finished'`
 * — and it falls to `detail` rather than printing an em dash in a column of times.
 */
function finishedResult(
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
 * A car classified some laps down. Its result **is** a lap deficit, so this never returns a
 * duration however much timing the row carries.
 *
 * ## Where the number comes from, and why it is two sources rather than one
 *
 * `detail` states the deficit itself on every lapped finisher up to 2022 — and on **none**
 * from 2023, where the upstream data switched to the bare word `"Lapped"`. Counted by
 * season: `+N Laps` on 7,279 rows, all 2022 and earlier; `"Lapped"` on 363, all 2023–2026,
 * and those are almost exactly the 364 that carry a time.
 *
 * So neither source alone is right:
 *
 * - **`detail` alone** leaves 2026 R1 showing eleven consecutive rows reading "Lapped"
 *   while 1988 shows "+1 Lap" — the same column behaving differently either side of a
 *   boundary in the *dataset's spelling*, which has nothing to do with the sport.
 * - **Deriving always** contradicts `detail` on 23 of the 7,279 rows that state a figure,
 *   and on one of them would print `+0 Laps` (`detail: '+5 Laps'` with equal lap counts).
 *   `lapsCompleted` is the unreliable half of that disagreement: it differs from the
 *   driver's own lap rows on 105 of 11,720 entries, by up to 57 laps.
 *
 * **Precedence: what the data says wins; we derive only where it is silent.** That is one
 * authority with a documented fallback, not two competing ones — `DETAIL_STATES_LAP_DEFICIT`
 * only *tests*, so no figure is ever read out of `detail` and re-rendered.
 *
 * The derivation is verified on exactly the rows it is used for. For all 363: lap rows
 * exist; `raceLaps` equals the winner's own lap count on 363 of 363; and the deficit agrees
 * with a lap-table-derived one on 362 of 363. **The exception is 2026 R9 Sainz**, whose
 * `lapsCompleted` reads 51 against 52 lap rows, so his deficit may render one lap large.
 * Fixing that would mean putting lap rows into the classification payload — an extra query
 * on all 484 pre-1990 pages that have none — to correct a single row, so it is recorded
 * here instead.
 *
 * ## Why `isClassified` decides, and why it is never `detail` that decides
 *
 * A deficit relative to the winner is a statement about a car that **holds a position**
 * (§6.6.1: *"`isClassified` decides whether he holds a position"*), so an unclassified car
 * has no deficit to state and must not be given a derived one — `+15 Laps` for a car that
 * stopped is the same false assertion as `+8 Laps` for Sainz.
 *
 * **`detail` is never returned unless it states a figure, and that is the rule this
 * function is built on.** `session_entry.detail` is a *display* string but not a stable
 * vocabulary (trap 22), and on the modern rows it degenerates into the category name
 * `"Lapped"` — which is the `outcome` enum's own spelling, restated where a magnitude
 * belongs. Rendering it put one row reading `Lapped` directly beneath ten reading
 * `+1 Lap` / `+2 Laps` / `+3 Laps` on 2026 R1.
 *
 * The `status = 1` rows are **exhaustively** three `detail` shapes against two
 * `isClassified` values, counted, and each of the six has its own answer:
 *
 * | `detail` | classified | rows | shows | why |
 * |---|---|---|---|---|
 * | `+N Laps` | yes | 7,253 | that string | the data states the figure |
 * | `+N Laps` | no | 26 | that string | **still a figure**, so still the data's own answer |
 * | `Lapped` | yes | 361 | a derived `+N Laps` | classified, and the data is silent |
 * | `Lapped` | **no** | **2** | `Not classified` | unclassified: no deficit to claim, and the category name must not ship |
 * | `Not classified` | no | 171 | `Not classified` | the same state, in the data's older words |
 * | `Not classified` | yes | 1 | a derived `+N Laps` | 1972 R12 Lauda, self-contradictory at source |
 *
 * **`Not classified` is the dataset's own wording for that exact state**, not copy invented
 * here: 171 rows with `status = 1` and `isClassified = 0` carry it verbatim, 1950–2004. The
 * two 2026 rows are the identical state under the newer spelling, so mapping them onto it
 * normalises two spellings of one state — the same thing this function already does for
 * `+N Laps` versus `Lapped`, and for the same reason.
 *
 * Both are real and both are genuinely unclassified: **2026 R1 Stroll at 43 of 58 laps
 * (74.1%) and 2026 R7 Albon at 55 of 66 (83.3%)**, each below the sport's 90% threshold. So
 * where `status` and `isClassified` disagree on these rows, `isClassified` is the one that
 * matches the distance actually covered.
 */
function lappedResult(
  row: Pick<RaceClassificationRow, 'detail' | 'isClassified' | 'lapsCompleted'>,
  raceLaps: number | null,
): GapDisplay {
  // 1. The data states the deficit — pass it through verbatim, whatever `isClassified` says.
  //    A figure is the data's own answer and nothing here can improve on it.
  if (DETAIL_STATES_LAP_DEFICIT.test(row.detail)) {
    return { kind: 'status', text: row.detail };
  }

  // 2. No classified position, so no deficit to state. **Checked before the derivation**,
  //    which is the whole fix: it is the branch a `detail` of "Lapped" used to fall through.
  if (!row.isClassified) {
    return { kind: 'status', text: NOT_CLASSIFIED };
  }

  // 3. Classified, and the data is silent on the figure — derive it.
  if (raceLaps !== null) {
    const deficit = raceLaps - row.lapsCompleted;
    if (deficit >= 1) return { kind: 'status', text: formatLapDeficit(deficit) };
  }

  /*
   * 4. Classified, silent, and no derivable deficit. **Unreachable on this data** — the
   *    minimum derived deficit across all 362 rows that reach step 3 is 1 — and reachable
   *    only by a row that contradicts itself: `status` says "down laps" while `lapsCompleted`
   *    claims the winner's distance, or a classification row exists with no race distance.
   *    An em dash is the product's existing "we cannot state this", and it is the honest
   *    answer where every alternative would either fabricate a figure or print the category
   *    name this function exists to keep off the screen.
   */
  return { kind: 'status', text: formatLapDeficit(0) };
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
