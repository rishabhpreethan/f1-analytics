import { z } from 'zod';
import { isoDateSchema, seasonYearSchema } from './meta';
import { entityRefSchema, roundNumberSchema } from './season';

/**
 * The race-page response contracts — `GET /api/seasons/:year/races/:round` and its two
 * lap-scale companions. Shared with the client via `@schemas/*`.
 *
 * This module may import **only** `zod` and its sibling schema modules
 * (ARCHITECTURE.md §3). One server-only import here breaks the browser bundle.
 *
 * ======================================================= why this is three payloads
 *
 * **The reduced page is the common case, not the exception.** Measured across the
 * archive: 484 races predate 1990 and **exactly zero** of them hold a single `lap` row,
 * so for the majority of the addressable pages the only thing this endpoint can return
 * is a classification and a grid. A client that had to receive 1,649 lap rows to learn
 * there are none would pay the flagship page's cost on the page that cannot show it.
 *
 * So `raceSchema` carries `availability.hasLapData` / `availability.hasPitData`, is
 * cheap (no `lap` access beyond one short-circuiting `EXISTS`), and the two lap-scale
 * payloads are fetched **only when those flags say there is something to fetch**.
 *
 * ============================================ the rule this file is written against
 *
 * **No field below lets "absent", "zero" and "not recorded" share a representation.**
 * Three shipped defects in this project came from a default being indistinguishable
 * from a measurement, so every place the data could collide them is split explicitly:
 *
 * | Collision | How it is prevented |
 * |---|---|
 * | `grid = 0` means a pit-lane start, not "no grid position" (trap 9) | `gridStatus` is a three-valued enum; `gridPosition` is null for both `pitLane` and `unknown` and the enum says which |
 * | An empty `classification` could be a future round or missing data | `hasResults` states it |
 * | A lap's first/last number could be inferred from an array's bounds | `firstLap` / `lastLap` are data, at session **and** driver level |
 * | A lap present with no time, versus a lap absent | `timeMs` / `position` are nullable **on a row that exists** |
 * | A session with a placeholder timestamp, versus one at midnight | `startTime` is null when the time is a placeholder; see `raceSessionSchema` |
 *
 * ==================================================== no brand colour crosses here
 *
 * As in `season.ts`: there is no `teamColor` field and its absence is the point.
 * `teamRef` is everything `src/lib/entityColor.ts` needs and everything it gets.
 */

/* ------------------------------------------------------------------ shared fragments */

/**
 * A lap number. Bounded at 200 — the longest race in the data ran 78 laps of pit-stop
 * activity and 200 is comfortably above any Grand Prix distance, so a value beyond it
 * is a schema failure rather than a lap.
 */
export const lapNumberSchema = z.number().int().positive().max(200);

/**
 * A millisecond duration. Non-negative, and bounded at 24 hours so a garbage value
 * fails the schema instead of stretching an axis. **Not `.int()` by accident** — every
 * `time_ms` / `duration_ms` column in this database is an integer and this asserts it.
 */
export const durationMsSchema = z.number().int().nonnegative().max(86_400_000);

/**
 * Where a car started, in three states that cannot be confused with one another.
 *
 * `session_entry.grid` uses **`0` for a pit-lane start** (trap 9), which is the exact
 * shape of collision this file exists to prevent: read as a number it is "position
 * zero", read as a falsy it is "no grid position", and both are wrong. Verified on the
 * data: 267 of 26,093 race entries carry `grid = 0`, and **`grid` is NULL on none of
 * them** — so `'unknown'` is currently unreachable and `queries/race.test.ts` asserts
 * that, which is what turns a refresh introducing NULLs into a failing test rather than
 * 26,093 silent pit-lane starts.
 */
export const gridStatusSchema = z.enum(['grid', 'pitLane', 'unknown']);

/**
 * `session_entry.status`, decoded through `DATABASE.md` §3 — **the grouping key**.
 *
 * The raw integer is deliberately **not** exposed. §3's decode is the whole value of
 * that column and it was reverse-engineered from the data rather than specified, so
 * decoding it once here is the difference between one authority and every consumer
 * hard-coding `status === 11`. `detail` travels alongside for display, which is §3's
 * other half: *"use `detail` for display; use `status` for grouping"*.
 *
 * | value | `status` | meaning |
 * |---|---|---|
 * | `finished` | 0 | classified, full distance |
 * | `lapped` | 1 | classified, down laps — `detail` reads `+1 Lap` … |
 * | `accident` | 10 | accident, collision, spun off |
 * | `mechanical` | 11 | engine, gearbox, suspension, retired |
 * | `disqualified` | 20 | excluded after the fact; 2 rows read `Finished` |
 * | `didNotStart` | 30 | withdrew, did not start |
 * | `didNotQualify` | 40 | did not qualify, 107% rule |
 * | `unknown` | anything else | a value §3 does not decode — never guessed |
 *
 * **A DNF is `accident` or `mechanical`, never a null position** (trap 3). Verified on
 * race sessions: only 0, 1, 10, 11, 20 and 30 occur — `didNotQualify` is real in the
 * schema and absent from races, and `unknown` exists so a refresh introducing a new
 * value degrades honestly instead of being folded into a neighbour.
 */
export const raceOutcomeSchema = z.enum([
  'finished',
  'lapped',
  'accident',
  'mechanical',
  'disqualified',
  'didNotStart',
  'didNotQualify',
  'unknown',
]);

/**
 * Driver identity, as it may cross this boundary: slugs and names, never an integer id
 * (DL-3, trap 11).
 *
 * **`code` is null far more often than the lap window suggests.** Measured: 40 drivers
 * who have race lap data carry no `driver.abbreviation` at all — Häkkinen, Damon Hill,
 * Frentzen, Irvine, Panis and the rest of the 1996–2004 grid. Since the rank chart
 * identifies its lines by endpoint label (`DESIGN_SYSTEM.md` §6.5.4a), a label built
 * from `code` alone would leave half the 1996 field unlabelled. `surname` is therefore
 * always present and `selectDriverShortLabel` falls back to it — **never to a
 * three-letter code derived from the surname**, which would invent an F1 convention the
 * data does not carry.
 */
export const raceDriverSchema = z.strictObject({
  driverRef: entityRefSchema,
  code: z.string().min(1).nullable(),
  forename: z.string().min(1),
  surname: z.string().min(1),
  teamRef: entityRefSchema,
  teamName: z.string().min(1),
  /**
   * `round_entry.car_number`. Null on 6 of 26,093 race entries.
   *
   * Load-bearing beyond display: **`driverRef` is not unique within a race.** 40 races
   * between 1950 and 1964 classify the same driver twice or three times, because two
   * drivers shared one car and both were classified — 1951 R4 lists Fangio and Fagioli
   * both at P1 in car 8. Counted directly, `(driverRef, carNumber)` is unique in **all
   * 1,173 races** while `driverRef` alone is not, so that pair is the only correct React
   * key for a classification row. None of the 40 races has lap data, which is why the
   * two lap payloads may safely key by `driverRef` alone and say so.
   */
  carNumber: z.number().int().nonnegative().nullable(),
});

/* ------------------------------------- GET /api/seasons/:year/races/:round */

export const raceClassificationRowSchema = raceDriverSchema.extend({
  /**
   * Finishing position. **Null is not a DNF** (trap 3) — it means the entry holds no
   * classified position, and `outcome` plus `isClassified` say why.
   */
  position: z.number().int().positive().nullable(),
  gridPosition: z.number().int().positive().nullable(),
  gridStatus: gridStatusSchema,
  outcome: raceOutcomeSchema,
  /** `session_entry.detail` — the display string. 138 distinct values in the data. */
  detail: z.string().min(1),
  /** `is_classified` — §3's canonical finisher flag, never inferred from `position`. */
  isClassified: z.boolean(),
  isEligibleForPoints: z.boolean(),
  /** Points from this race under that era's system. Never summed across seasons. */
  points: z.number().nonnegative(),
  lapsCompleted: z.number().int().nonnegative(),
  /**
   * Total race time. **Null means no total time was recorded, not zero and not
   * pending.** Measured: present on 8,109 of 8,110 full-distance finishers and on only
   * 364 of 7,814 lapped finishers, because a lapped car's result is a lap deficit
   * rather than a duration — which is why `DESIGN_SYSTEM.md` §6.6.1 requires a lapped
   * row to read `+1 Lap` and not a gap. The single missing finisher is 1950 R7 Ascari.
   */
  totalTimeMs: durationMsSchema.nullable(),
});

/**
 * One session of the weekend.
 *
 * **`startTime` is null when the recorded timestamp is a placeholder**, and that
 * distinction is measured rather than assumed. Every `session.timestamp` in the
 * database is non-NULL, but before 2005 **every one of them is exactly midnight UTC** —
 * a date with a zero time, not a session that started at midnight. Through 2021 only
 * the race itself carries a real time (2010: 19 of 19 races do, 0 of 19 FP1s do); from
 * 2022 all 860 sessions do. So the discriminator is `00:00:00` in the time component,
 * and it has **zero false positives in 2022–2026**, where every time is known to be
 * real. Publishing the raw value instead would print "FP1 · 00:00" on every practice
 * session before 2022.
 *
 * No local-time conversion happens here. `timezone` is an IANA zone name and the
 * conversion is a presentation concern (RD-11), so the payload states the instant and
 * the zone and lets the surface format them.
 */
export const raceSessionSchema = z.strictObject({
  /** `session.type` — `R`, `Q1`, `FP1`, `SR`, `SQ1` … Not an allowlist: new types are data. */
  type: z.string().min(1).max(8),
  /** `session.number` — the weekend running order. */
  number: z.number().int().nonnegative(),
  /** ISO 8601 with offset, or null when the recorded time is a placeholder. */
  startTime: z.string().min(1).nullable(),
  timezone: z.string().min(1),
  isCancelled: z.boolean(),
  /**
   * Entry rows for the session. **Practice carries no times at all** (trap 2) — 423 FP1
   * sessions hold 698 entries between them — so this is schedule metadata and must never
   * become a practice-results surface.
   */
  entries: z.number().int().nonnegative(),
  /** Lap rows exist for this session. Tested for, never read from `has_time_data`. */
  hasLapData: z.boolean(),
});

export const raceCircuitSchema = z.strictObject({
  ref: entityRefSchema,
  name: z.string().min(1),
  locality: z.string().min(1).nullable(),
  country: z.string().min(1).nullable(),
  countryCode: z.string().min(1).max(8).nullable(),
});

/**
 * What this race can and cannot show, as two booleans **and nothing else**.
 *
 * Deliberately no coverage-boundary years: `DESIGN_SYSTEM.md` §6.5.3 requires the
 * no-coverage copy to be generated from `GET /api/meta`, and duplicating 1996 and 2011
 * here would create a second authority for the one number the copy must not hardcode.
 * `selectRaceDataStates` combines these flags with `/api/meta`'s window to produce the
 * five states, and it is the combination that distinguishes them:
 *
 * - **outside the window** → no-coverage. "Lap data begins in 1996."
 * - **inside the window, flag false** → absent for this race specifically. Reachable
 *   exactly once today: 2021 R12, the Belgian Grand Prix that ran two laps behind the
 *   safety car, has lap rows and **no pit stops**. No 1996-or-later race has results
 *   without lap rows, so the lap-side "absent" state is unreachable on this data and is
 *   implemented anyway, because that is a fact about the dump and not about the schema.
 */
export const raceAvailabilitySchema = z.strictObject({
  hasLapData: z.boolean(),
  hasPitData: z.boolean(),
});

export const raceSchema = z.strictObject({
  year: seasonYearSchema,
  round: roundNumberSchema,
  name: z.string().min(1),
  date: isoDateSchema,
  /** Trap 12: a cancelled round is a fact about the calendar, never a data gap. */
  isCancelled: z.boolean(),
  /** `LEFT JOIN`, so null is tolerated — though no numbered round lacks a circuit today. */
  circuit: raceCircuitSchema.nullable(),
  /**
   * The race session's own start, or null when the timestamp is a placeholder.
   * See `raceSessionSchema`.
   */
  startTime: z.string().min(1).nullable(),
  timezone: z.string().min(1),
  /**
   * **Whether the race has classification rows — the one field that keeps an empty
   * `classification` from meaning two things.** A scheduled future round and a race
   * whose results are missing would both arrive as `[]`; this says which. Never a
   * comparison of `date` against today, which would call a round complete up to two
   * weeks before its results land (`REQUIREMENTS.md` §2.5).
   */
  hasResults: z.boolean(),
  /**
   * The race distance actually run, as `max(laps_completed)` over the classification.
   * Null when there is no classification.
   *
   * **Not `session.scheduled_laps`**, which is populated on 24 of 1,173 race sessions
   * and is therefore unusable.
   */
  raceLaps: z.number().int().nonnegative().nullable(),
  /** Ordered: classified positions ascending, then unclassified. */
  classification: z.array(raceClassificationRowSchema),
  /** The weekend's sessions in running order. Schedule metadata only. */
  weekend: z.array(raceSessionSchema),
  availability: raceAvailabilitySchema,
});

/* ------------------------------- GET /api/seasons/:year/races/:round/laps */

export const lapRowSchema = z.strictObject({
  lap: lapNumberSchema,
  /**
   * Position **on that lap** — the basis of the rank chart.
   *
   * Nullable on a row that exists, which is not the same as the row being absent.
   * Measured: 16 of 627,025 race lap rows carry a null position (2008 R4 Bourdais lap 6,
   * 2014 R1 Vettel lap 26, and 14 others). Every qualifying and practice lap row has a
   * null position, which is why a rank chart is a race-only form.
   */
  position: z.number().int().positive().nullable(),
  /**
   * The lap time. Nullable on a row that exists — currently null on **zero** of the
   * 627,025 race lap rows, asserted in `queries/race.test.ts` so a refresh that
   * introduces nulls is a test failure rather than a gap in a line.
   */
  timeMs: durationMsSchema.nullable(),
  /**
   * The lap was invalidated. **Exposed, not filtered** — the chart needs to distinguish
   * a struck lap from an absent one, while every pace metric must exclude it (trap 8).
   *
   * **Measured, and it matters: `is_deleted = 1` on 2,199 lap rows in the whole table and
   * on NONE of the 627,025 race lap rows.** All 2,199 are practice and qualifying, 2023
   * onward. So on the data as it stands this field is constant `false` on every race
   * page, `pace.deletedLaps` is always 0, and RD-2's "invalidated laps stated in the
   * note" renders nothing. The filter stays mandatory regardless: it is currently a
   * no-op that a single refresh can turn load-bearing, and a pace metric that has to
   * remember to add it later is a pace metric that will not.
   */
  isDeleted: z.boolean(),
});

/**
 * One driver's lap trace. Keyed by `driverRef` alone, which is safe **here and not on
 * the classification**: the 40 races that classify one driver twice all predate 1965 and
 * none of them has a lap row, counted directly.
 */
export const driverLapsSchema = z.strictObject({
  driverRef: entityRefSchema,
  code: z.string().min(1).nullable(),
  surname: z.string().min(1),
  teamRef: entityRefSchema,
  gridPosition: z.number().int().positive().nullable(),
  gridStatus: gridStatusSchema,
  /** Final classified position, for the rank chart's right-edge label. Null if unclassified. */
  finishPosition: z.number().int().positive().nullable(),
  /** First and last lap this driver has a row for — **data, never the array's bounds**. */
  firstLap: lapNumberSchema,
  lastLap: lapNumberSchema,
  /** Ascending by lap. Contiguous in practice; the numbers are authoritative regardless. */
  laps: z.array(lapRowSchema),
});

/**
 * The session's pace facts — **stated by the server so no chart derives its own**.
 *
 * `DESIGN_SYSTEM.md` §6.3 gives a lap-time axis a mandatory ceiling of `fastest × 1.5`,
 * and two charts need it (RD-2's trace and RD-4's degradation fit). Three reasons the
 * fastest lap is computed here rather than by whoever draws an axis:
 *
 * 1. **It is a pace metric, so trap 8 applies**: `is_deleted = 0` belongs in the SQL,
 *    not in a client's memory of it.
 * 2. **It is a property of the session, not of the selection.** RD-2 plots ≤ 4 drivers;
 *    a ceiling derived from those four moves when the fourth is toggled, so the same
 *    race would show two different axes on two charts and a changing axis on one.
 * 3. **It is computed from the same rows as the series.** One query returns every lap
 *    row for the race and one pure builder produces both this summary and the traces,
 *    so they cannot disagree — which is a stronger guarantee than agreeing by rule.
 *
 * **`fastest_lap_rank` is not how this is found, and that is measured.** 578 race
 * sessions have lap rows; only 465 carry an entry with `fastest_lap_rank = 1`, so **133
 * sessions with lap data have no flagged fastest lap**, and 20 sessions carry the flag
 * with no lap rows at all. Worse, on 5 of the 445 sessions where both exist the flagged
 * driver's own fastest lap is **not** the session minimum — 2011 R9 by 1.517 s, 2015 R9
 * by 0.483 s, 2025 R2 by 0.385 s. The `lap` table is the authority.
 *
 * The multiple itself is **not** in this payload. §6.3's ×1.5 is a design rule, so it
 * lives in one exported selector (`paceCeilingMs`) beside the rule it implements; a
 * server field would make a visual change a server change and put two authorities on
 * one number. Drift is prevented by there being exactly one function, not by moving it.
 */
export const paceSummarySchema = z.strictObject({
  /** Timed, non-deleted laps counted into every figure below. */
  timedLaps: z.number().int().nonnegative(),
  /**
   * Invalidated laps excluded from those figures. **0 on every race in this data** — see
   * `lapRowSchema.isDeleted`. Stated rather than inferred so the note has an input and a
   * zero is a measurement.
   */
  deletedLaps: z.number().int().nonnegative(),
  /** Null when the session has no timed lap at all. */
  fastest: z
    .strictObject({
      timeMs: durationMsSchema,
      driverRef: entityRefSchema,
      lap: lapNumberSchema,
    })
    .nullable(),
  /**
   * Nearest-rank percentiles over the sorted timed laps — `sorted[floor(p/100 × n)]`,
   * clamped to the last index. The method is named because a different one produces
   * different numbers on the same data, and `queries/race.test.ts` pins 2026 R1 to the
   * exact values these produce: fastest 82,091 · p50 85,228 · p90 98,755 · p99 122,340 ·
   * slowest 1,168,144 ms.
   *
   * Present so a caption can state the distribution without the client sorting 1,649
   * numbers per render, and — like `fastest` — so the figures are session-wide and do
   * not move with the driver selection. All null when there is no timed lap.
   */
  medianMs: durationMsSchema.nullable(),
  p90Ms: durationMsSchema.nullable(),
  p99Ms: durationMsSchema.nullable(),
  /**
   * The slowest timed lap. On 2026 R1 this is **1,168,144 ms — a lap spent stationary
   * under a red flag.** Not bad data; it is what the lap took, and it is the whole
   * reason §6.3 clips the axis rather than fitting it.
   */
  slowestMs: durationMsSchema.nullable(),
});

export const raceLapsSchema = z.strictObject({
  year: seasonYearSchema,
  round: roundNumberSchema,
  /**
   * The session's lap range, **as data rather than as the bounds of an array**.
   *
   * Stated because `d3.ticks` does not guarantee the endpoints of a domain — on `[1, 58]`
   * it emits 5, 10 … 55 and drops both lap 1 and the final lap, which are the two a
   * reader most wants labelled. A chart that has to reconstruct where the race began is
   * a chart that will reconstruct it differently from its neighbour. Both null when the
   * race has no lap rows.
   */
  firstLap: lapNumberSchema.nullable(),
  lastLap: lapNumberSchema.nullable(),
  /** Total lap rows returned, across all drivers. */
  lapCount: z.number().int().nonnegative(),
  pace: paceSummarySchema,
  /** Ordered by finishing position, unclassified last — the rank chart's series order. */
  drivers: z.array(driverLapsSchema),
});

/* ----------------------------- GET /api/seasons/:year/races/:round/stints */

export const pitStopSchema = z.strictObject({
  /**
   * `pit_stop.number`. **Present for reference and never used to order** — on 3 race
   * entries it disagrees with the lap order, so stints are derived from lap numbers.
   */
  stopNumber: z.number().int().positive(),
  /** The lap the stop attaches to. `pit_stop` joins a `lap` row, not a lap number. */
  lap: lapNumberSchema,
  /**
   * Stationary or pit-lane time, depending on the era. Nullable on a stop that
   * happened — currently null on **zero** of 12,582 race pit stops, asserted.
   *
   * **Never compared across decades without a caveat** (trap 10, `DATABASE.md` §2.4):
   * the semantics vary between eras. Within one race this is not a risk, which is why
   * the caveat belongs in the copy rather than in the arithmetic.
   */
  durationMs: durationMsSchema.nullable(),
});

/**
 * A stint, derived. `DATABASE.md` §6.7 puts this in application code and this is that
 * code's contract: `[1 … pit₁]`, `(pit₁ … pit₂]`, … `(pitₙ … lastLap]`, so the in-lap
 * belongs to the stint it ends.
 */
export const stintSchema = z.strictObject({
  stint: z.number().int().positive(),
  fromLap: lapNumberSchema,
  toLap: lapNumberSchema,
  /** `toLap - fromLap + 1`. Restated so nothing recomputes it; **1 is a real value** — 494 race pit stops fall on the lap after another one. */
  laps: z.number().int().positive(),
  /** The stop that ended this stint, or null for the one the driver finished on. */
  endedByStop: z.number().int().positive().nullable(),
});

export const driverStintsSchema = z.strictObject({
  driverRef: entityRefSchema,
  code: z.string().min(1).nullable(),
  surname: z.string().min(1),
  teamRef: entityRefSchema,
  /**
   * The last lap this driver has a `lap` row for — what closes the final stint.
   *
   * **Not `laps_completed`**, and that is measured: the two disagree on 105 of 11,720
   * race entries with lap data, by as much as 57 laps in either direction, and a
   * disqualified entry reads `laps_completed = 0` while holding a pit stop on lap 29
   * (2024 R21 Hülkenberg, 2025 R2 Leclerc / Hamilton / Gasly, 2025 R4 Hülkenberg). A
   * final stint closed at `laps_completed` would be negative-length on every one of them.
   */
  lastLap: lapNumberSchema,
  /** Ascending by lap. */
  stops: z.array(pitStopSchema),
  /** Ascending. Always at least one when the driver has a lap row. */
  stints: z.array(stintSchema),
});

/**
 * The pit-duration distribution, for the same reason `paceSummarySchema` exists: RD-7
 * has the same outlier problem as the lap trace and needs the same clipped axis, so the
 * figures it clips against are stated once here rather than derived per chart.
 *
 * On 2026 R1: 32 stops, fastest **17,649 ms**, slowest **1,081,553 ms** — an 18-minute
 * "stop" under a red flag. Null when the race has no stop with a duration.
 */
export const pitDurationSummarySchema = z.strictObject({
  stops: z.number().int().nonnegative(),
  timedStops: z.number().int().nonnegative(),
  fastestMs: durationMsSchema.nullable(),
  medianMs: durationMsSchema.nullable(),
  p90Ms: durationMsSchema.nullable(),
  slowestMs: durationMsSchema.nullable(),
});

export const raceStintsSchema = z.strictObject({
  year: seasonYearSchema,
  round: roundNumberSchema,
  /** Ordered by finishing position, unclassified last. */
  drivers: z.array(driverStintsSchema),
  durations: pitDurationSummarySchema,
});

export type GridStatus = z.infer<typeof gridStatusSchema>;
export type RaceOutcome = z.infer<typeof raceOutcomeSchema>;
export type RaceDriver = z.infer<typeof raceDriverSchema>;
export type RaceClassificationRow = z.infer<typeof raceClassificationRowSchema>;
export type RaceSession = z.infer<typeof raceSessionSchema>;
export type RaceCircuit = z.infer<typeof raceCircuitSchema>;
export type RaceAvailability = z.infer<typeof raceAvailabilitySchema>;
export type Race = z.infer<typeof raceSchema>;
export type LapRow = z.infer<typeof lapRowSchema>;
export type DriverLaps = z.infer<typeof driverLapsSchema>;
export type PaceSummary = z.infer<typeof paceSummarySchema>;
export type RaceLaps = z.infer<typeof raceLapsSchema>;
export type PitStop = z.infer<typeof pitStopSchema>;
export type Stint = z.infer<typeof stintSchema>;
export type DriverStints = z.infer<typeof driverStintsSchema>;
export type PitDurationSummary = z.infer<typeof pitDurationSummarySchema>;
export type RaceStints = z.infer<typeof raceStintsSchema>;

/* --------------------------------------------------------------- request parameters */

/**
 * `:round` — the second route parameter in this product, and it follows `:year`'s rule
 * exactly (ARCHITECTURE.md §6, S-4: **reject, do not coerce**).
 *
 * `/^[1-9][0-9]?$/` rather than `/^\d{1,2}$/`, because the looser pattern accepts `01`
 * and `0`: `01` would be a second spelling of round 1 and `0` a round that cannot
 * exist. One resource, one URL. `z.coerce.number()` would additionally accept `''`,
 * `' 1 '`, `'1.0'` and `'0x1'`.
 *
 * The ceiling is `roundNumberSchema`'s 50 — the **format's** range, not the data's, so a
 * well-formed round the season does not hold is a 404 and only a malformed one is a 400.
 * The longest season in the data has 24 numbered rounds.
 */
export const roundParamSchema = z
  .string()
  .regex(/^[1-9][0-9]?$/)
  .transform(Number)
  .pipe(roundNumberSchema);
