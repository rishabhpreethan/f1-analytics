import { z } from 'zod';
import { qualifyingSessionSchema } from './entity';
import { isoDateSchema, seasonYearSchema } from './meta';
import { championshipPointsSchema, entityRefSchema, roundNumberSchema } from './season';

/**
 * `GET /api/circuits/:reference` — CI-1 … CI-3. Shared with the client via `@schemas/*`.
 *
 * This module may import **only** `zod` and its sibling schema modules
 * (ARCHITECTURE.md §3).
 *
 * ============================================================== "pole" is two facts here
 *
 * CI-2 asks for the winner and the pole of every race at the venue. The winner is in the
 * data for all 1,173 races; **the pole is not**, and the payload says so per race rather
 * than leaving a blank column to be read as "nobody".
 *
 * A qualifying classification exists from **1994** and the window is *holed* rather than
 * merely bounded — counted per year, rounds with any qualifying classification run 15/16
 * in 1994 and 17/17 in 1995, then **7, 10, 7, 3, 4, 1 and 2** of ~16 across 1996–2002,
 * then complete from 2003. Monza has hosted 75 Grands Prix; fewer than half of them can
 * name a pole sitter.
 *
 * **`grid = 1` was rejected as a substitute.** It is populated on every race entry in the
 * archive, which makes it tempting, and it is not a qualifying result: it is the slot the
 * car started from after penalties, and measured, **9 races carry more than one `grid = 1`
 * row** — 1952 R8 has two *different* cars there, Ascari's 12 and Moss's 32. Publishing it
 * as "pole" would have produced a complete-looking column that is wrong where nobody could
 * check it.
 *
 * So `poleSitters` is empty exactly when the dataset holds no qualifying classification
 * for that round, and `hasQualifying` states which of the two reasons applies.
 *
 * ============================================== a winner is a list, and so is a pole
 *
 * `position = 1` is not unique within a race (trap 16): **three races have two winners**,
 * the shared drives of 1951 R4, 1956 R1 and 1957 R5. A singular `winner` field would pick
 * one of each pair at the mercy of row order and lose Fagioli, Musso and Brooks silently.
 * `poleSitters` takes the same shape for the same reason rather than because a shared pole
 * has been observed.
 */

/**
 * CI-1. **Every coordinate field is populated** — verified on all 78 circuits: no NULL
 * latitude, longitude, altitude, locality or country. They are published as numbers, not
 * strings, so a map component never parses one.
 *
 * There is no track length and no corner geometry anywhere in this dataset
 * (`REQUIREMENTS.md` §6), so a circuit outline is not renderable from it and this payload
 * does not pretend otherwise.
 */
export const circuitProfileSchema = z.strictObject({
  ref: entityRefSchema,
  name: z.string().min(1),
  locality: z.string().min(1).nullable(),
  country: z.string().min(1).nullable(),
  countryCode: z.string().min(1).max(8).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  /** Metres. Populated on all 78 circuits. */
  altitude: z.number().nullable(),
});

export const circuitWinnerSchema = z.strictObject({
  driverRef: entityRefSchema,
  code: z.string().min(1).nullable(),
  forename: z.string().min(1),
  surname: z.string().min(1),
  teamRef: entityRefSchema,
  teamName: z.string().min(1),
  /** Championship points from this race. Split between the drivers of a shared car. */
  points: championshipPointsSchema,
});

export const circuitPoleSchema = z.strictObject({
  driverRef: entityRefSchema,
  code: z.string().min(1).nullable(),
  forename: z.string().min(1),
  surname: z.string().min(1),
  /**
   * Which session the pole came from. Published because the eras are not the same
   * measurement — `QB` is one hour, `QA` is 2005's two-run aggregate, `Q3` is the third
   * knockout segment.
   */
  session: qualifyingSessionSchema,
});

/** CI-2. One Grand Prix at this venue. */
export const circuitRaceSchema = z.strictObject({
  year: seasonYearSchema,
  round: roundNumberSchema,
  name: z.string().min(1),
  date: isoDateSchema,
  /**
   * Whether the race has classification rows. **The existence of results, never a date
   * comparison** — the dump can lag the calendar by ~2 weeks (`REQUIREMENTS.md` §2.5), so
   * a date test reports a race as run with nothing in it.
   */
  hasResults: z.boolean(),
  /** Lap rows exist. Tested for, never read from `session.has_time_data` (trap 1). */
  hasLapData: z.boolean(),
  /** Classification rows for the race. 0 when it has not been run. */
  entries: z.number().int().nonnegative(),
  /** Usually one; two on the three shared drives. Empty when the race has no results. */
  winners: z.array(circuitWinnerSchema),
  /**
   * Empty when the dataset holds no qualifying classification for the round — which is
   * every race before 1994 and most of 1996–2002. `hasQualifying` distinguishes that from
   * a round that has qualifying with nobody at P1, which does not occur.
   */
  poleSitters: z.array(circuitPoleSchema),
  hasQualifying: z.boolean(),
});

/**
 * CI-3, one entity's record at this venue.
 *
 * `wins` counts **races**, not rows, so a shared drive is one win for each of the two
 * drivers who shared the car and one win for the constructor (trap 16). `podiums` counts
 * top-three finishes.
 */
export const circuitDriverRecordSchema = z.strictObject({
  driverRef: entityRefSchema,
  code: z.string().min(1).nullable(),
  forename: z.string().min(1),
  surname: z.string().min(1),
  starts: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  podiums: z.number().int().nonnegative(),
  bestFinish: z.number().int().positive().nullable(),
});

export const circuitTeamRecordSchema = z.strictObject({
  teamRef: entityRefSchema,
  name: z.string().min(1),
  /** Distinct races entered at this venue. */
  races: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  /** Distinct `(race, position)` pairs in the top three — a 1-2 counts twice. */
  podiums: z.number().int().nonnegative(),
});

export const circuitSchema = z.strictObject({
  circuit: circuitProfileSchema,
  /** Null when the venue has never held a race with results. */
  firstYear: seasonYearSchema.nullable(),
  lastYear: seasonYearSchema.nullable(),
  /** Rounds scheduled at this venue, including any not yet run. */
  roundsHeld: z.number().int().nonnegative(),
  /** Of those, how many have classification rows. */
  racesWithResults: z.number().int().nonnegative(),
  /** Descending by year, most recent first — the order a venue page reads in. */
  races: z.array(circuitRaceSchema),
  /**
   * CI-3. Ordered by wins, then podiums, then starts, then surname, and **capped**: a
   * venue with 75 Grands Prix has hundreds of drivers, almost all with zero wins, and a
   * list of those is not "most successful". The cap is stated in `queries/circuits.ts`.
   */
  topDrivers: z.array(circuitDriverRecordSchema),
  topTeams: z.array(circuitTeamRecordSchema),
});

export type CircuitProfile = z.infer<typeof circuitProfileSchema>;
export type CircuitWinner = z.infer<typeof circuitWinnerSchema>;
export type CircuitPole = z.infer<typeof circuitPoleSchema>;
export type CircuitRace = z.infer<typeof circuitRaceSchema>;
export type CircuitDriverRecord = z.infer<typeof circuitDriverRecordSchema>;
export type CircuitTeamRecord = z.infer<typeof circuitTeamRecordSchema>;
export type Circuit = z.infer<typeof circuitSchema>;
