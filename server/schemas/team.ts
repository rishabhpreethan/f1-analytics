import { z } from 'zod';
import { entityRoundRefSchema } from './entity';
import { seasonYearSchema } from './meta';
import {
  adjustmentSchema,
  championshipPointsSchema,
  entityRefSchema,
  roundNumberSchema,
} from './season';

/**
 * `GET /api/teams/:reference` — CN-1 … CN-4. Shared with the client via `@schemas/*`.
 *
 * This module may import **only** `zod` and its sibling schema modules
 * (ARCHITECTURE.md §3).
 *
 * ==================================================== two kinds of points, never mixed
 *
 * **This payload carries championship points and race points, and they are different
 * quantities with different names.** Conflating them is the defect `DATABASE.md` §5 and
 * trap 4 exist to prevent, and CN-4 makes it unavoidable — an intra-team split has to
 * apportion *something*, and a constructors' championship total cannot be apportioned.
 *
 * | field | source | what it is |
 * |---|---|---|
 * | `season.points` | `team_championship` final snapshot | the constructors' championship total, **already scored by that era's rules** |
 * | `driver.racePoints` | `sum(session_entry.points)` | the driver's own race points while driving for this team that season |
 * | `season.driverRacePointsTotal` | the sum of the above | **only** the denominator of the split |
 *
 * The two are not expected to agree, and the reasons are structural rather than sloppy:
 * several eras counted only a driver's best N results, several counted only the
 * best-placed car of a constructor, and a shared drive credits **both** drivers with the
 * car's points — 1950 R7 pays Serafini and Ascari 3 each for one second place. So
 * `driverRacePointsTotal` is 6 there, and any reading of it as "what the team scored"
 * would be wrong. It exists so `racePointsShare` is internally consistent: the shares of
 * one season's drivers sum to 1 because both halves are the same measure.
 *
 * ============================================ counting a team's results, with shared cars
 *
 * A win is a **race**, a podium is a **podium place**, and neither is a row.
 *
 * - **Wins** are distinct races holding at least one P1 row. Three races have two: the
 *   shared drives of 1951 R4, 1956 R1 and 1957 R5 (trap 16), where one car's two drivers
 *   were both classified first. Counting rows would give Alfa Romeo two wins for the 1951
 *   French Grand Prix.
 * - **Podiums** are distinct `(race, position)` pairs with position 1–3, which credits a
 *   1-2 finish with two and a shared P2 with one. Measured, 20 `(race, position)` pairs in
 *   the archive carry more than one row.
 *
 * ================================================== no brand colour crosses this boundary
 *
 * There is no `primaryColor` field, exactly as in `season.ts` and `race.ts`. `ref` is
 * everything `src/lib/entityColor.ts` needs, and only 12 of 214 teams carry a brand colour
 * anyway (trap 6).
 */

export const teamProfileSchema = z.strictObject({
  ref: entityRefSchema,
  name: z.string().min(1),
  nationality: z.string().min(1).nullable(),
  countryCode: z.string().min(1).max(8).nullable(),
});

/**
 * CN-1's span. `base_team_id` is **not** exposed and no lineage is claimed: the
 * `base_team` table holds 0 rows (trap 5), so Minardi → Toro Rosso → AlphaTauri → RB does
 * not resolve and presenting successive identities as one organisation would be an
 * invention.
 */
export const teamCareerSpanSchema = z.strictObject({
  firstSeason: seasonYearSchema.nullable(),
  lastSeason: seasonYearSchema.nullable(),
  /** Distinct seasons with at least one race entry. Not `lastSeason - firstSeason`. */
  seasonsEntered: z.number().int().nonnegative(),
  firstRace: entityRoundRefSchema.nullable(),
  lastRace: entityRoundRefSchema.nullable(),
});

export const teamTotalsSchema = z.strictObject({
  /** Distinct Grands Prix entered — the figure normally quoted for a constructor. */
  races: z.number().int().nonnegative(),
  /**
   * Race classification rows across those races. Higher than the number of cars on 71
   * `(race, driver, team)` triples, where a driver took over a second car (trap 17).
   */
  entries: z.number().int().nonnegative(),
  /** Distinct races won. A shared drive is one win, not two — see the module header. */
  wins: z.number().int().nonnegative(),
  /** Distinct `(race, position)` pairs in the top three. A 1-2 counts twice. */
  podiums: z.number().int().nonnegative(),
  /** Distinct drivers who started a race for the team. */
  driversUsed: z.number().int().nonnegative(),
  /**
   * Constructors' Championships won.
   *
   * **Read from `team_championship`, never derived from points** (trap 4, DL-8): a title
   * is `position = 1` in the season's final snapshot, and only when the season is
   * complete. The gate is live, not defensive — this dataset's 2026 snapshot currently
   * ranks Mercedes first with 12 of 22 rounds unrun, so without it Mercedes would read 9
   * titles instead of 8. Verified against the record with the gate applied: Ferrari 16,
   * McLaren 10, Williams 9, Mercedes 8, Red Bull 6.
   *
   * The championship began in **1958**; 1950–57 seasons carry `hasTeamStandings: false`.
   */
  championships: z.number().int().nonnegative(),
});

/**
 * CN-3 and CN-4 — one driver's season with this team.
 *
 * Counts are over **races**, not classification rows: a driver who took a second car
 * mid-race contributed one result, not two (trap 17, and 71 of these triples exist).
 */
export const teamSeasonDriverSchema = z.strictObject({
  driverRef: entityRefSchema,
  /** `driver.abbreviation`, null for 774 of 881 drivers. Never a derived placeholder. */
  code: z.string().min(1).nullable(),
  forename: z.string().min(1),
  surname: z.string().min(1),
  firstRound: roundNumberSchema,
  lastRound: roundNumberSchema,
  /** Classification rows, so a shared drive is visible rather than absorbed. */
  entries: z.number().int().positive(),
  /** Races started — excludes `didNotStart` / `didNotQualify` (`DATABASE.md` §3). */
  starts: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  podiums: z.number().int().nonnegative(),
  bestFinish: z.number().int().positive().nullable(),
  /**
   * CN-4. `sum(session_entry.points)` for this driver in this team's cars this season.
   *
   * **Race points, not championship points** — read the module header before rendering
   * this next to `season.points`. It is the driver's own score, which is why a shared
   * car's points appear in full for both drivers.
   */
  racePoints: championshipPointsSchema,
  /**
   * `racePoints / driverRacePointsTotal`, 0–1. Null when the team scored nothing that
   * season, which is a real and common state and not a division to hide.
   */
  racePointsShare: z.number().min(0).max(1).nullable(),
});

export const teamSeasonSchema = z.strictObject({
  year: seasonYearSchema,
  entries: z.number().int().nonnegative(),
  races: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  podiums: z.number().int().nonnegative(),
  bestFinish: z.number().int().positive().nullable(),
  /**
   * CN-2. Constructors' championship points from the season's final `team_championship`
   * snapshot — **read, never summed** (trap 4).
   *
   * Null when the season has no constructors' championship, which is 1950–1957 and is not
   * a gap: `hasTeamStandings` states it, and the season hub derives the same fact from
   * `championship_system.team_best_results = 0`.
   */
  points: championshipPointsSchema.nullable(),
  position: z.number().int().positive().nullable(),
  /** `win_count` from the same snapshot. Null for a season with no constructors' title. */
  championshipWins: z.number().int().nonnegative().nullable(),
  adjustment: adjustmentSchema,
  /** False for 1950–1957. Derived from the presence of a snapshot, not a hard-coded year. */
  hasTeamStandings: z.boolean(),
  isSeasonComplete: z.boolean(),
  isChampion: z.boolean(),
  /**
   * The sum of `drivers[].racePoints`. **The denominator of the split and nothing else** —
   * see the module header. It is not the constructors' total and will differ from
   * `points` in any best-N era and in any season with a shared drive.
   */
  driverRacePointsTotal: championshipPointsSchema,
  /** Ordered by race points descending, then by first round, then surname. */
  drivers: z.array(teamSeasonDriverSchema),
});

export const teamSchema = z.strictObject({
  team: teamProfileSchema,
  career: teamCareerSpanSchema,
  totals: teamTotalsSchema,
  /** Ascending by year. */
  seasons: z.array(teamSeasonSchema),
});

export type TeamProfile = z.infer<typeof teamProfileSchema>;
export type TeamCareerSpan = z.infer<typeof teamCareerSpanSchema>;
export type TeamTotals = z.infer<typeof teamTotalsSchema>;
export type TeamSeasonDriver = z.infer<typeof teamSeasonDriverSchema>;
export type TeamSeason = z.infer<typeof teamSeasonSchema>;
export type Team = z.infer<typeof teamSchema>;
