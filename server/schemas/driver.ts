import { z } from 'zod';
import { entityRoundRefSchema, qualifyingSessionSchema } from './entity';
import { gridStatusSchema, raceOutcomeSchema } from './race';
import { isoDateSchema, seasonYearSchema } from './meta';
import {
  adjustmentSchema,
  championshipPointsSchema,
  driverTeamSchema,
  entityRefSchema,
  roundNumberSchema,
} from './season';

/**
 * `GET /api/drivers/:reference` — DR-1 … DR-5. Shared with the client via `@schemas/*`.
 *
 * This module may import **only** `zod` and its sibling schema modules
 * (ARCHITECTURE.md §3).
 *
 * ============================================== what a "start" is, resolved here for good
 *
 * Two canonical documents disagreed, and DR-2's career totals are the first place it is
 * load-bearing. `server/schemas/season.ts` raised it in F2 and deliberately left it open:
 *
 * - `REQUIREMENTS.md` §5.1: *"Start — appearing in race results, regardless of
 *   classification."*
 * - `docs/DATABASE.md` §3: `status IN (30, 40)` — did-not-start, did-not-qualify —
 *   **"exclude from `starts` counts"**.
 *
 * **`DATABASE.md` wins, and `REQUIREMENTS.md` §5.1 is corrected in the same change.** A
 * driver who withdrew did not start; that is what those two status codes exist to encode,
 * and the §5.1 wording reads as imprecise prose rather than a deliberate ruling. Measured
 * on race sessions: `status = 30` on **368 of 26,093** entries and `status = 40` on none,
 * so the resolution moves 368 rows — including one of Michael Schumacher's, which is why
 * his `starts` reads 307 against 308 races entered.
 *
 * ================================ one race, one result — trap 17 and why `entries` exists
 *
 * **`driver.reference` is not unique within a race.** 40 races between 1950 and 1964
 * classify the same driver twice or three times, because a driver took over a second car
 * mid-race and both entries were classified: **83 (driver, race) pairs hold 172 rows**
 * between them, counted directly.
 *
 * 1950 R7 is the shape of it — Ascari appears twice for Ferrari, car 16 (grid 2,
 * `status 11`, "Engine") and car 48 (P2, `status 0`, 3 points). Counted naively that is
 * one start, one podium **and one retirement, in a race he finished second**.
 *
 * So every outcome-derived figure below is computed from **one row per race**: the
 * driver's best-positioned entry, with points summed across the entries. The collapse
 * happens in a pure builder (`collapseRaces` in `queries/drivers.ts`) rather than in SQL,
 * because "best row wins, and the rest is not a separate race" is a rule a reader has to
 * be able to check.
 *
 * `entries` is published beside `races` so the discrepancy is **visible rather than
 * silently absorbed**: they differ for 45 drivers and by 1–2 for each of them.
 *
 * ==================================================== no brand colour crosses this boundary
 *
 * As in `season.ts` and `race.ts`: there is no `teamColor` field and its absence is the
 * point. `teamRef` is everything `src/lib/entityColor.ts` needs and everything it gets.
 */

/* ---------------------------------------------------------------------------- profile */

/**
 * DR-1. Identity, and the two fields that are usually absent.
 *
 * **`code` is null for 774 of 881 drivers** — `driver.abbreviation` exists only for the
 * modern era, so 107 drivers have one. It is `null`, never a placeholder and never
 * derived from the surname: `surname.slice(0, 3).toUpperCase()` would invent a
 * three-letter code the sport never used. `hasCode` is not a separate field because
 * `code === null` already says it exactly once.
 *
 * `permanentCarNumber` is null for 818 of 881 — it is the modern permanent-number scheme,
 * not the number a driver carried in a given season, which lives on `round_entry` and
 * appears per race in `races[]`.
 *
 * `dateOfBirth` and `nationality` are null for 16 drivers each.
 */
export const driverProfileSchema = z.strictObject({
  ref: entityRefSchema,
  code: z.string().min(1).nullable(),
  forename: z.string().min(1),
  surname: z.string().min(1),
  nationality: z.string().min(1).nullable(),
  countryCode: z.string().min(1).max(8).nullable(),
  permanentCarNumber: z.number().int().nonnegative().nullable(),
  dateOfBirth: isoDateSchema.nullable(),
});

/**
 * DR-1's career span, and **its age fields carry no clock**.
 *
 * A payload that computed "age today" would bake the request time into a response the
 * server sends `Cache-Control` for, and — worse — would be **wrong for every driver who
 * has died**, which this dataset has no column for. There is no `dateOfDeath` anywhere in
 * the schema, so a server-computed current age would confidently report Fangio at 114.
 *
 * `ageAtFirstRace` / `ageAtLastRace` are derived from two dates the data holds and are
 * correct forever. A living driver's current age is a **presentation** concern with a
 * clock in it, and `src/features/driver/selectors.ts` exposes `selectAgeYears(dob, on)`
 * for a surface that wants one.
 */
export const driverCareerSpanSchema = z.strictObject({
  firstSeason: seasonYearSchema.nullable(),
  lastSeason: seasonYearSchema.nullable(),
  /** Distinct seasons with at least one race entry. Not `lastSeason - firstSeason`. */
  seasonsEntered: z.number().int().nonnegative(),
  firstRace: entityRoundRefSchema.nullable(),
  lastRace: entityRoundRefSchema.nullable(),
  /** Whole years at the first/last race. Null when the date of birth is not recorded. */
  ageAtFirstRace: z.number().int().nonnegative().nullable(),
  ageAtLastRace: z.number().int().nonnegative().nullable(),
});

/* ----------------------------------------------------------------------------- totals */

/**
 * DR-2. Every figure is a count of **races**, except `entries`, which counts rows.
 *
 * Read the module header first: the two are not the same number, and the difference is
 * trap 17 rather than an inconsistency.
 */
export const driverTotalsSchema = z.strictObject({
  /**
   * Race classification rows. **Not a start count** — 45 drivers hold more rows than
   * races because they took over a second car mid-race (trap 17). Published so the
   * discrepancy with `races` is visible rather than absorbed.
   */
  entries: z.number().int().nonnegative(),
  /** Distinct races entered, including those the driver never started. */
  races: z.number().int().nonnegative(),
  /**
   * Races started — `races` minus the ones where every entry was `didNotStart` /
   * `didNotQualify` (`DATABASE.md` §3). See the module header for the doc conflict this
   * resolves.
   */
  starts: z.number().int().nonnegative(),
  /** `races - starts`. Stated so a zero is a measurement and not an absent field. */
  nonStarts: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  /** Finishing position 1–3 (`REQUIREMENTS.md` §5.1). */
  podiums: z.number().int().nonnegative(),
  /**
   * `points > 0` for the event — **not "top 10"**, because the points-paying range
   * changed repeatedly (§5.1). Points are summed across the driver's entries in one race,
   * so a shared drive counts once.
   */
  pointsFinishes: z.number().int().nonnegative(),
  /**
   * Races where the driver's **overall qualifying classification was P1**.
   *
   * **Coverage-limited, and severely — read `racesWithQualifying` beside it or the number
   * is misleading.** Qualifying classification rows exist only from 1994, and the window
   * is *holed*, not merely bounded: counted per year, rounds with any qualifying
   * classification run 15/16 in 1994 and 17/17 in 1995, then **7, 10, 7, 3, 4, 1 and 2**
   * of ~16 for 1996–2002, then complete from 2003. So Senna reads 0 poles and Häkkinen
   * reads far fewer than the record shows, and that is the data, not a defect.
   *
   * **`grid = 1` was rejected as a substitute**, though it is populated on all 1,173
   * races. It is a starting slot, not a qualifying result — and measured, it is not even
   * reliably one car: **9 races carry more than one `grid = 1` row**, and 1952 R8 has two
   * *different* cars there (Ascari's 12 and Moss's 32). Publishing it as "poles" would
   * have produced a complete-looking number that is wrong in a way nobody could see.
   */
  poles: z.number().int().nonnegative(),
  /**
   * How many of the driver's races have a qualifying classification at all. The
   * denominator `poles` is honest against; see above.
   */
  racesWithQualifying: z.number().int().nonnegative(),
  /**
   * `session_entry.fastest_lap_rank = 1` on the driver's row.
   *
   * **Coverage-limited in a shape no window can express**, which is why
   * `racesWithFastestLapData` travels beside it. Counted by year: the flag is present on
   * every race of **1958 and 1959** (20 races), on **none** from 1960 to 2003, and on
   * every race from **2004** onward bar one in the 2020s. §5.1's "2004+ only" is right
   * about the modern boundary and silent about the 1958–59 island, so a career total for
   * Clark or Stewart is 0 where the record says 28 and 15.
   *
   * The `lap` table is a better authority for a *session's* fastest lap (trap 18) and is
   * deliberately not used here: answering this for a 438-race career would mean an
   * aggregate over hundreds of thousands of lap rows on a profile request (DL-5, S-10).
   */
  fastestLaps: z.number().int().nonnegative(),
  racesWithFastestLapData: z.number().int().nonnegative(),
  /**
   * Races whose result was a retirement — `status IN (10, 11)` on the driver's best row
   * for that race, **never `position IS NULL`** (trap 3).
   *
   * The "best row" rule is what keeps 1950 R7 out of Ascari's DNF count: he retired one
   * car and finished second in another, and the race's result is the second place.
   */
  dnfs: z.number().int().nonnegative(),
  /** `status = 11`. The reliability half of a DNF. */
  mechanicalDnfs: z.number().int().nonnegative(),
  /** `status = 10`. Accident, collision, spun off. */
  accidentDnfs: z.number().int().nonnegative(),
  /** `status = 20`. 162 race entries in the whole archive. */
  disqualifications: z.number().int().nonnegative(),
  /**
   * Drivers' Championships won.
   *
   * **Read from `driver_championship`, never derived from points** (trap 4, DL-8): 24
   * point systems and several best-N eras mean a championship total is not the sum of
   * race points. A title is `position = 1` in the season's **final** snapshot — and only
   * when the season is complete, which is not a formality: the 2026 snapshot in this data
   * currently ranks Antonelli first with 12 of 22 rounds unrun. Verified against the
   * record: Schumacher 7, Hamilton 7, Fangio 5, Prost 4, Vettel 4, Verstappen 4.
   */
  championships: z.number().int().nonnegative(),
});

/* --------------------------------------------------------------------------- seasons */

/**
 * DR-3, one row per season.
 *
 * **`teams` is an array, and that is the requirement rather than a convenience.** 318
 * driver-seasons in this data map one driver to more than one team, counted directly on
 * `team_driver`. A season row carrying a single `team` would have to pick one, and
 * "whichever came last" quietly rewrites Räikkönen's 2001 or any of the other 317. The
 * shape is `driverTeamSchema`, reused verbatim from the season hub (`season.ts`), so a
 * surface that already renders a mid-season change on the standings table renders it the
 * same way here.
 *
 * The rounds each team spans are on the element, so "Ferrari (R1–R9), McLaren (R10–R17)"
 * is renderable without a second request.
 */
export const driverSeasonSchema = z.strictObject({
  year: seasonYearSchema,
  teams: z.array(driverTeamSchema),
  entries: z.number().int().nonnegative(),
  starts: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  podiums: z.number().int().nonnegative(),
  /** Best finishing position of the season, from the race rows. Null if never classified. */
  bestFinish: z.number().int().positive().nullable(),
  /**
   * Championship points as **that era's rules scored them**, from the season's final
   * `driver_championship` snapshot. Never a sum of `session_entry.points` (trap 4) — the
   * 1950 table reads Farina 30, which the sum of his race points is not.
   *
   * Null when the season holds no snapshot for this driver. Not reachable on the present
   * data (every driver who raced appears in their season's final snapshot — verified on
   * 1976, 2005, 2024 and on Alonso's 23 seasons), so a null here means a refresh changed
   * something and the surface should say so rather than print 0.
   */
  points: championshipPointsSchema.nullable(),
  /** Final championship position. Null means unranked, **not** last (season.ts). */
  position: z.number().int().positive().nullable(),
  /** `win_count` from the same snapshot. May differ from `wins` if a refresh disagrees. */
  championshipWins: z.number().int().nonnegative().nullable(),
  adjustment: adjustmentSchema,
  /**
   * Whether every numbered round of the season has results. **`isChampion` depends on
   * it**, and the dependency is live rather than theoretical — see `championships`.
   */
  isSeasonComplete: z.boolean(),
  isChampion: z.boolean(),
});

/* ----------------------------------------------------------------------------- races */

/**
 * One race in the driver's career — the row DR-4 and DR-5 are both computed from, and the
 * one a season-by-season table drills into.
 *
 * Already collapsed to one row per race (module header). `entries` on the row says how
 * many classification rows were folded into it, so a shared drive is visible.
 */
export const driverRaceSchema = z.strictObject({
  year: seasonYearSchema,
  round: roundNumberSchema,
  name: z.string().min(1),
  date: isoDateSchema,
  circuitRef: entityRefSchema.nullable(),
  circuitName: z.string().min(1).nullable(),
  teamRef: entityRefSchema,
  teamName: z.string().min(1),
  /** `round_entry.car_number` of the entry this row's result came from. */
  carNumber: z.number().int().nonnegative().nullable(),
  /** How many classification rows this race contributed. `2` or `3` on 83 driver-races. */
  entries: z.number().int().positive(),
  /**
   * Where the car started, in three states that cannot be confused (trap 9). `0` in the
   * database means a **pit-lane start**, which is why `gridPosition` is null for both
   * `pitLane` and `unknown` and the enum says which.
   */
  gridPosition: z.number().int().positive().nullable(),
  gridStatus: gridStatusSchema,
  /** Finishing position. **Null is not a DNF** (trap 3); `outcome` says what happened. */
  position: z.number().int().positive().nullable(),
  outcome: raceOutcomeSchema,
  /** `session_entry.detail`. Display only — not a stable vocabulary across eras (trap 22). */
  detail: z.string().min(1),
  isClassified: z.boolean(),
  /** Points from this race under that era's system. **Never summed across seasons.** */
  points: championshipPointsSchema,
  lapsCompleted: z.number().int().nonnegative(),
  /**
   * DR-5. The driver's **overall** qualifying classification — the position from the
   * highest segment they reached, which is the overall result rather than a rank within
   * one segment (`entity.ts`, `qualifyingSessionSchema`).
   *
   * Null and `qualifyingSession: null` when the driver has no qualifying row for the
   * weekend. `roundHasQualifying` distinguishes the two reasons that can happen: the
   * dataset holds no qualifying for the round at all (the common case before 2003), or it
   * does and this driver is absent from it.
   */
  qualifyingPosition: z.number().int().positive().nullable(),
  qualifyingSession: qualifyingSessionSchema.nullable(),
  roundHasQualifying: z.boolean(),
  /** `fastest_lap_rank = 1` on this driver's row for the race. */
  hasFastestLap: z.boolean(),
  /** Any entry in the race carries the flag. False for every race 1960–2003. */
  roundHasFastestLapData: z.boolean(),
  /**
   * DR-4, per race. `grid - position`, positive when places were gained.
   *
   * **Null rather than 0 when the metric does not apply**, which §5.1 requires and which
   * three separate conditions trigger: the driver did not finish with a classified
   * position, the car started from the pit lane (`grid = 0` — 267 race entries), or the
   * grid is unknown. A 0 here means the car finished exactly where it started, and
   * nothing else.
   */
  positionsGained: z.number().int().nullable(),
});

/* -------------------------------------------------------------------------- aggregates */

/**
 * DR-4's career figure, with **its own exclusions counted**.
 *
 * A mean over "the races where the metric applies" is only honest if the reader can see
 * how many races that was and why the others left. `excluded` is not diagnostics — it is
 * the caption: 61 of Senna's 161 races ended in a retirement, so a mean position change
 * computed over the remaining 100 is a different claim from one over 161.
 */
export const gridVsFinishSchema = z.strictObject({
  racesCounted: z.number().int().nonnegative(),
  /** Mean of `positionsGained` over the counted races. Null when none qualify. */
  meanPositionsGained: z.number().nullable(),
  /** The single best gain and worst loss, as signed place counts. */
  bestGain: z.number().int().nullable(),
  worstLoss: z.number().int().nullable(),
  gained: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  held: z.number().int().nonnegative(),
  excluded: z.strictObject({
    /** Ended without a classified finishing position — the largest group. */
    unclassified: z.number().int().nonnegative(),
    /** `grid = 0`, a pit-lane start (trap 9). */
    pitLaneStarts: z.number().int().nonnegative(),
    /** `grid` is NULL. Zero on the present data; the case exists so it cannot be silent. */
    unknownGrid: z.number().int().nonnegative(),
  }),
});

/**
 * DR-5's career figure. `qualifyingPosition - position`, positive when places were gained
 * from the grid slot they qualified for.
 *
 * Distinct from `gridVsFinish` and not a duplicate of it: the grid is what the car
 * actually started from **after penalties**, and the qualifying classification is what
 * the driver earned. On a weekend with a grid drop the two differ, and the difference is
 * the point of having both.
 */
export const qualifyingVsRaceSchema = z.strictObject({
  racesCounted: z.number().int().nonnegative(),
  meanDelta: z.number().nullable(),
  /** Races where the driver has a qualifying classification, whatever the race outcome. */
  racesWithQualifying: z.number().int().nonnegative(),
  /** Mean qualifying classification over those races. Null when there are none. */
  meanQualifyingPosition: z.number().nullable(),
});

/* --------------------------------------------------------------- the whole payload */

export const driverSchema = z.strictObject({
  driver: driverProfileSchema,
  career: driverCareerSpanSchema,
  totals: driverTotalsSchema,
  /** Ascending by year. */
  seasons: z.array(driverSeasonSchema),
  /** Ascending by year then round. One entry per race, never per classification row. */
  races: z.array(driverRaceSchema),
  gridVsFinish: gridVsFinishSchema,
  qualifyingVsRace: qualifyingVsRaceSchema,
});

export type DriverProfile = z.infer<typeof driverProfileSchema>;
export type DriverCareerSpan = z.infer<typeof driverCareerSpanSchema>;
export type DriverTotals = z.infer<typeof driverTotalsSchema>;
export type DriverSeason = z.infer<typeof driverSeasonSchema>;
export type DriverRace = z.infer<typeof driverRaceSchema>;
export type GridVsFinish = z.infer<typeof gridVsFinishSchema>;
export type QualifyingVsRace = z.infer<typeof qualifyingVsRaceSchema>;
export type Driver = z.infer<typeof driverSchema>;
