import { z } from 'zod';
import { isoDateSchema, seasonYearSchema } from './meta';

/**
 * The season-hub response contracts, shared with the client via `@schemas/*`.
 *
 * This module may import **only** `zod` and its sibling schema modules
 * (ARCHITECTURE.md §3). One server-only import here breaks the browser bundle.
 *
 * ---------------------------------------------------------------- three shaping rules
 *
 * **1. No brand colour crosses this boundary.** There is no `teamColor` field anywhere
 * below, and its absence is the point. `src/lib/entityColor.ts` states its own contract:
 * *"what this module needs from the data layer is exactly one field: `reference`"* —
 * whether a plotting variant exists is a property of the generated palette, not of the
 * row. Shipping `team.primary_color` as a hex would create a second source of truth that
 * renders fine while disagreeing with `src/styles/entity.css`, and would put a literal
 * colour one destructure away from a component (DESIGN_SYSTEM.md §3.3). `teamRef` is
 * everything the colour layer needs and everything it gets.
 *
 * **2. Standings are read, never summed.** Every points and position figure below comes
 * from `driver_championship` / `team_championship`, which already apply that era's rules.
 * Summing `session_entry.points` across a best-N season is a defect, not an approximation
 * (DATABASE.md §5, trap 4) — verified: the 1950 table reproduces Farina 30 / Fangio 27 /
 * Fagioli 24, which the sum of their race points does not.
 *
 * **3. A round is identified by its number, and a cancelled round has none.** Trap 15.
 * Cancelled rounds are therefore a *separate list* with no `round` field, rather than
 * rows with a nullable number that every consumer has to remember to filter.
 */

/* ------------------------------------------------------------------ shared fragments */

/**
 * A `driver.reference` or `team.reference` slug — never an internal integer id (DL-3,
 * trap 11). Bounded in length so a schema failure is a schema failure and not an
 * unbounded string reaching a URL.
 */
export const entityRefSchema = z.string().min(1).max(64);

/** A numbered, uncancelled round. Never 0, never null (trap 15). */
export const roundNumberSchema = z.number().int().positive().max(50);

/**
 * Championship points. **`REAL` in the database and not always an integer** — half
 * points have been awarded for shortened races since 1975, so an `.int()` here would
 * reject 1984 (Prost 71.5) and 2021 (Belgian GP). Non-negative: no era has ever
 * subtracted below zero, and a penalty is applied by the snapshot, not by us.
 */
export const championshipPointsSchema = z.number().nonnegative();

/**
 * What happened to an entry the stewards adjusted after the fact.
 *
 * **Derived, not the raw `adjustment_type` enum** — trap 14 forbids displaying an
 * undocumented enum, and this is the honest half of it. The database's own
 * `championship_adjustment` table has three rows and they line up exactly with the three
 * `adjustment_type` values that appear:
 *
 *   1997 michael_schumacher, `adjustment 101` ↔ 17 driver rows with `adjustment_type 101`
 *   2007 mclaren,            `adjustment 102` ↔ 17 team rows with `adjustment_type 102`
 *   2020 racing_point,       `adjustment 1`, `points 15` ↔ 17 team rows with type `1`
 *
 * **The adjustment is already applied in the snapshot**, verified on all three: 2007
 * McLaren reads 0 points and no position beside 8 wins; 2020 Racing Point reads 195,
 * which is the post-penalty figure in the record; 1997 Schumacher keeps his 78 points
 * and loses his position. So the correct handling is to **annotate, never to re-apply** —
 * re-subtracting the penalty would double-count it.
 *
 * `'excluded'` and `'adjusted'` are distinguished by whether a position survives, which
 * is an observable property of the row rather than a reading of the enum's value.
 */
export const adjustmentSchema = z.enum(['none', 'adjusted', 'excluded']);

export const teamRefSchema = z.strictObject({
  ref: entityRefSchema,
  name: z.string().min(1),
});

/* ------------------------------------------------------------ GET /api/seasons */

export const seasonSummarySchema = z.strictObject({
  year: seasonYearSchema,
  /**
   * `max(round.number)` — **never `count(*)`** (trap 15). 2026 has 24 `round` rows and
   * 22 numbered rounds.
   */
  rounds: z.number().int().nonnegative(),
  /** Rounds with race classification rows. Existence of entries, never a date compare. */
  completedRounds: z.number().int().nonnegative(),
  cancelledRounds: z.number().int().nonnegative(),
  isComplete: z.boolean(),
  /**
   * False for 1950–1957: the Constructors' Championship began in 1958. Derived per
   * season from `championship_system.team_best_results`, not from a hard-coded year.
   */
  hasTeamStandings: z.boolean(),
});

export const seasonListSchema = z.strictObject({
  seasons: z.array(seasonSummarySchema),
});

/* ------------------------------------------------------- GET /api/seasons/:year */

/**
 * How a season decided its championship, from `championship_system`. Present so a
 * surface can **state the normalization it used** (REQUIREMENTS.md §5.2, §5.3) rather
 * than presenting 1950's 30 points and 2026's as the same kind of number.
 *
 * The decode is deliberately partial, and the partiality is the honest part:
 *
 * | value | meaning | verified against |
 * |---|---|---|
 * | `> 0` | only the best N results counted | 1950–53 → 4, 1954–57 → 5, 1958 → 6, 1979 → 4, 1981–90 → 11 — all match the sport's actual rules |
 * | `-1` | every result counted | 1991 onward, which is correct |
 * | `0` (team only) | **no Constructors' Championship that season** | exact: the systems carrying 0 are 1950–57, and `team_championship` holds no row before 1958 |
 * | anything else | a limit applied that this dataset does not quantify | 1967–78 carries `-2` with a `season_split`, and the real rule was best-N *per half* with an N the value does not give |
 *
 * `championship_system.eligibility`, `driver_season_split` and `team_season_split` are
 * **not** exposed. They are undocumented enums (trap 14) and their values do not map
 * onto the historical rules unambiguously — 1979 and 1980 both carry `season_split = 3`
 * for seasons split into two halves. Guessing would be worse than silence.
 */
export const countingSchema = z.enum(['all', 'bestN', 'limited', 'none']);

export const scoringSchema = z.strictObject({
  systemRef: z.string().min(1),
  systemName: z.string().min(1),
  driverCounting: countingSchema.exclude(['none']),
  /** N when `driverCounting` is `bestN`; null otherwise. */
  driverBestResults: z.number().int().positive().nullable(),
  teamCounting: countingSchema,
  teamBestResults: z.number().int().positive().nullable(),
});

export const roundWinnerSchema = z.strictObject({
  driverRef: entityRefSchema,
  /** `driver.abbreviation`. Null for most of the sport's history. */
  code: z.string().min(1).nullable(),
  forename: z.string().min(1),
  surname: z.string().min(1),
  team: teamRefSchema,
  /** Championship points from this race. Split between the drivers of a shared car. */
  points: championshipPointsSchema,
});

export const seasonRoundSchema = z.strictObject({
  round: roundNumberSchema,
  name: z.string().min(1),
  date: isoDateSchema,
  /** `LEFT JOIN` in the query, so null is tolerated. A slug, never an id. */
  circuitRef: entityRefSchema.nullable(),
  circuitName: z.string().min(1).nullable(),
  /**
   * Whether the race has classification rows. **This is what "completed" means here** —
   * a comparison against today's date would call a round complete two weeks before its
   * results land (REQUIREMENTS.md §2.2, §2.5).
   */
  hasResults: z.boolean(),
  /** A sprint session exists for this round. 2021+ in practice; derived, not assumed. */
  hasSprint: z.boolean(),
  /**
   * Lap rows exist for the race. **Tested for, never read from `session.has_time_data`**,
   * which disagrees with reality in both directions (trap 1, DATABASE.md §6.4). This is
   * the field a "lap-by-lap unavailable" state is built on — 0 of the 484 races before
   * 1990 have lap data.
   */
  hasLapData: z.boolean(),
  /**
   * **An array, and that is not defensive over-engineering — three races really have two
   * winners.** Shared drives: 1951 French GP (Fangio / Fagioli), 1956 Argentine GP
   * (Fangio / Musso), 1957 British GP (Moss / Brooks). Both drivers of the shared car are
   * classified P1 and split the win's points, which is why `points` is on the row and why
   * the 1951 pair reads 5 and 4 rather than 8 and 8.
   *
   * Queried, not remembered: `position = 1` returns two rows for exactly three `round_id`
   * values across all 1,173 races. A singular `winner` field would have picked one of each
   * pair at the mercy of row order and lost Fagioli, Musso and Brooks silently.
   *
   * Ordered by points descending, then surname — so the driver credited with the greater
   * share leads, and the order does not depend on the database's row order. Empty when the
   * race has no classification yet; there is no null case to remember.
   */
  winners: z.array(roundWinnerSchema),
});

/**
 * A cancelled round. **No `round` field, because it has no number** (trap 15) and is not
 * addressable. Kept in the payload rather than dropped: a cancelled round is a fact about
 * the calendar, not a data gap, and hiding it is how "20 of 22" silently becomes wrong.
 */
export const cancelledRoundSchema = z.strictObject({
  name: z.string().min(1),
  date: isoDateSchema,
  circuitRef: entityRefSchema.nullable(),
  circuitName: z.string().min(1).nullable(),
});

/**
 * One team a driver raced for in a season, in the order they raced for them.
 *
 * The count is named `entries` and not `starts` **because the two canonical documents
 * disagree about what a start is** and F2 is not the place to settle it:
 * `REQUIREMENTS.md` §5.1 says *"appearing in race results, regardless of
 * classification"*, while `DATABASE.md` §3 says `status IN (30, 40)` — withdrew, did not
 * start, did not qualify — must be *excluded* from starts counts. `DATABASE.md` is the
 * better answer on the merits and it is a **career-metric** decision that belongs with
 * DR-2, where it will be load-bearing. Here the count exists only to order a driver's
 * teams and pick their principal one, so it says what it actually counts — race entry
 * rows — and cannot be misread as a career statistic. Raised for DR-2 rather than
 * resolved silently.
 */
export const driverTeamSchema = z.strictObject({
  ref: entityRefSchema,
  name: z.string().min(1),
  firstRound: roundNumberSchema,
  lastRound: roundNumberSchema,
  entries: z.number().int().positive(),
});

export const driverStandingSchema = z.strictObject({
  /**
   * Null is **not** "did not finish" and **not** missing data. It means the driver holds
   * no ranked position in this snapshot — either they scored nothing (`is_eligible = 0`,
   * which is exactly co-extensive with a null position on 13,701 of 13,718 rows) or they
   * were excluded by an adjustment (the other 17, all 1997 Schumacher).
   */
  position: z.number().int().positive().nullable(),
  driverRef: entityRefSchema,
  code: z.string().min(1).nullable(),
  forename: z.string().min(1),
  surname: z.string().min(1),
  nationality: z.string().min(1).nullable(),
  points: championshipPointsSchema,
  wins: z.number().int().nonnegative(),
  /** `highest_finish` — the best finishing position of the season. Null if never ranked. */
  bestFinish: z.number().int().positive().nullable(),
  /**
   * Every team the driver raced for this season, earliest first. An array rather than a
   * single team because a mid-season change is ordinary (1976 alone has 59 driver-team
   * pairs across 23 drivers), and collapsing it to "their last team" quietly rewrites
   * history. A surface that wants one team takes the last element.
   */
  teams: z.array(driverTeamSchema),
  adjustment: adjustmentSchema,
});

export const teamStandingSchema = z.strictObject({
  position: z.number().int().positive().nullable(),
  teamRef: entityRefSchema,
  name: z.string().min(1),
  nationality: z.string().min(1).nullable(),
  points: championshipPointsSchema,
  wins: z.number().int().nonnegative(),
  bestFinish: z.number().int().positive().nullable(),
  adjustment: adjustmentSchema,
});

export const seasonStandingsSchema = z.strictObject({
  /**
   * The round the standings are current to — the latest round with a snapshot. Null when
   * the season has none at all, which is the empty state rather than a fault.
   */
  asOfRound: roundNumberSchema.nullable(),
  drivers: z.array(driverStandingSchema),
  teams: z.array(teamStandingSchema),
});

export const seasonSchema = z.strictObject({
  year: seasonYearSchema,
  /** Numbered rounds, ascending. Cancelled rounds are not in here. */
  rounds: z.array(seasonRoundSchema),
  cancelledRounds: z.array(cancelledRoundSchema),
  /** `rounds.length`, restated so a client need not count to render "10 of 22". */
  scheduledRounds: z.number().int().nonnegative(),
  completedRounds: z.number().int().nonnegative(),
  /**
   * False for a season in progress. **The partial state, and it is the default view** —
   * 2026 is 10 of 22 (REQUIREMENTS.md SC-8).
   */
  isComplete: z.boolean(),
  scoring: scoringSchema,
  standings: seasonStandingsSchema,
});

/* --------------------------------------------- GET /api/seasons/:year/standings */

export const progressionPointSchema = z.strictObject({
  round: roundNumberSchema,
  /** Cumulative championship points after this round, as the era's rules scored them. */
  points: championshipPointsSchema,
  position: z.number().int().positive().nullable(),
});

/**
 * One entity's line on the progression chart.
 *
 * `teams` is here as well as on the standings row so a chart can label and colour a
 * series without a second request; `teamRef` is what `entityColor` needs and the only
 * identity field a mark ever reads.
 */
export const driverSeriesSchema = z.strictObject({
  driverRef: entityRefSchema,
  code: z.string().min(1).nullable(),
  forename: z.string().min(1),
  surname: z.string().min(1),
  teams: z.array(driverTeamSchema),
  adjustment: adjustmentSchema,
  progression: z.array(progressionPointSchema),
});

export const teamSeriesSchema = z.strictObject({
  teamRef: entityRefSchema,
  name: z.string().min(1),
  adjustment: adjustmentSchema,
  progression: z.array(progressionPointSchema),
});

export const standingsProgressionSchema = z.strictObject({
  year: seasonYearSchema,
  /**
   * The rounds that carry a snapshot — the chart's category axis. A round with no
   * snapshot (a future round) is **absent**, not a null point: a gap in a line is read as
   * missing data, and a race that has not happened is not missing data
   * (REQUIREMENTS.md §2.2).
   */
  rounds: z.array(
    z.strictObject({
      round: roundNumberSchema,
      name: z.string().min(1),
      date: isoDateSchema,
      circuitRef: entityRefSchema.nullable(),
    }),
  ),
  /** Ordered by final position, unranked entities last. */
  drivers: z.array(driverSeriesSchema),
  /** Empty for 1950–1957. `scoring.teamCounting === 'none'` explains why. */
  teams: z.array(teamSeriesSchema),
  scoring: scoringSchema,
});

export type SeasonSummary = z.infer<typeof seasonSummarySchema>;
export type SeasonList = z.infer<typeof seasonListSchema>;
export type Scoring = z.infer<typeof scoringSchema>;
export type Counting = z.infer<typeof countingSchema>;
export type Adjustment = z.infer<typeof adjustmentSchema>;
export type SeasonRound = z.infer<typeof seasonRoundSchema>;
export type CancelledRound = z.infer<typeof cancelledRoundSchema>;
export type DriverTeam = z.infer<typeof driverTeamSchema>;
export type DriverStanding = z.infer<typeof driverStandingSchema>;
export type TeamStanding = z.infer<typeof teamStandingSchema>;
export type Season = z.infer<typeof seasonSchema>;
export type ProgressionPoint = z.infer<typeof progressionPointSchema>;
export type DriverSeries = z.infer<typeof driverSeriesSchema>;
export type TeamSeries = z.infer<typeof teamSeriesSchema>;
export type StandingsProgression = z.infer<typeof standingsProgressionSchema>;

/* --------------------------------------------------------------- request parameters */

/**
 * `:year` — the only route parameter F2 introduces, and the reason S-4 stops being
 * vacuous on this feature.
 *
 * **A regex on the raw string, then a parse — never `z.coerce.number()`** (S-4: reject,
 * do not coerce). `z.coerce.number()` accepts `''` as 0, `' 1990 '` as 1990, `'1990.0'`
 * as 1990 and `'0x7c6'` as 1990, each of which is a different URL rendering the same
 * page — a soft 404 and four spellings of one resource. Four literal digits is the only
 * shape a year is ever written in.
 *
 * The upper bound is `seasonYearSchema`'s 2100, not the latest season present: a year in
 * range but absent from the data is a **404 on a well-formed request**, which is
 * different from a malformed one and says so (ARCHITECTURE.md §6).
 */
export const yearParamSchema = z
  .string()
  .regex(/^\d{4}$/)
  .transform(Number)
  .pipe(seasonYearSchema);
