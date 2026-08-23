import { z } from 'zod';
import { referenceParamSchema } from './entity';
import { seasonYearSchema } from './meta';
import { championshipPointsSchema, entityRefSchema, roundNumberSchema } from './season';

/**
 * `GET /api/compare` and `GET /api/compare/season/:year` — the comparison workspace's two
 * lenses. F7. Shared with the client via `@schemas/*`.
 *
 * This module may import **only** `zod` and its sibling schema modules (ARCHITECTURE.md §3).
 * One server-only import here breaks the browser bundle.
 *
 * =================================================================== where these shapes came from
 *
 * **The surface specified them, field for field, before the schema set.** `DESIGN_SYSTEM.md`
 * §6.6.5's rule is *"when a surface can only be designed one way, check whether the payload is the
 * constraint before accepting the design"*, and the entity indexes were rejected for finding that
 * out too late. So `src/features/compare/types.ts` was written first, as a request, and this
 * module answers it.
 *
 * `types.ts` now **re-exports `z.infer` of the schemas below** rather than restating them. Two
 * hand-written copies of one contract is precisely the translation loss this project keeps paying
 * for: the copy compiles, agrees for a week, and then a field is added to one of them. Every doc
 * comment the surface wrote is preserved here, because the reasoning is the valuable half.
 *
 * ============================================================================ three shaping rules
 *
 * **1. No colour crosses this boundary.** An entity carries `colorTeamRef` and nothing else;
 * `src/lib/entityColor.ts` turns a `team.reference` into a token name and no hex is published
 * (`DESIGN_SYSTEM.md` §3.3a.3, and the same rule `schemas/season.ts` states).
 *
 * **2. Nothing here is a points total except inside one season.** The career lens publishes no
 * points field at all — 24 point systems and six best-N eras make a career total an era artefact
 * (trap 4, `DATABASE.md` §5). The **season** lens does publish points, and it is the one place in
 * this product that honestly can: one season is one points system and one calendar, and every
 * figure is **read** from `driver_championship` rather than summed from race results.
 *
 * **3. A round is its number, and a cancelled round has none** (trap 15). Every round-scoped
 * statement behind these schemas carries `AND r.number IS NOT NULL`, and a season's round count is
 * `max(number)` — 2026 has 24 calendar rows and 22 rounds.
 */

/* ============================================================================ shared fragments */

/** A driver's identity. `code` is null for 774 of 881 drivers and is never derived from a surname. */
export const compareIdentitySchema = z.strictObject({
  ref: entityRefSchema,
  forename: z.string().min(1),
  surname: z.string().min(1),
  code: z.string().min(1).nullable(),
});

/**
 * A two-sided count. **Every head-to-head in this feature is one of these**, and the denominator
 * travels with the numerators for the reason `DESIGN_SYSTEM.md` §6.6.2.2 gives: a rate whose
 * denominator is not printed is a rate a reader cannot check.
 *
 * `rated` is the number of events the comparison could be made on; `pool` is the number it *could
 * have* been made on had everything finished. `rated < pool` is the normal case, not a fault —
 * Senna and Prost shared 16 races in 1988 and both were classified in 12 of them.
 *
 * ⚠ **`tied` is reachable on both ledgers, not only the grid one.** The surface's first draft said
 * otherwise and it is wrong on the data: 85 same-team pairings in the archive have both drivers
 * classified in the **same finishing position**, because a 1950s driver could take over a
 * team-mate's car mid-race and both were classified together — 1951 R4 (Fangio / Fagioli) and 1956
 * R1 (Fangio / Musso) are two of the three races with two P1 rows (trap 16). Recording one of them
 * as the winner of that pairing would be an invention, so it is a tie and `a + b + tied === rated`
 * holds on both ledgers. The grid case is separate and also real: 9 races carry more than one
 * `grid = 1` row (trap 23).
 */
export const ledgerSchema = z.strictObject({
  /** Events where both sides have a comparable result. */
  rated: z.number().int().nonnegative(),
  /** Events both sides took part in at all. `rated <= pool`. */
  pool: z.number().int().nonnegative(),
  a: z.number().int().nonnegative(),
  b: z.number().int().nonnegative(),
  /** Dead heats — a shared drive on the race ledger, a shared front row on the grid one. */
  tied: z.number().int().nonnegative(),
});

/* ================================================================= the career lens: GET /api/compare */

export const compareEntitySeasonSchema = z.strictObject({
  year: seasonYearSchema,
  /** Every team of a split season, in the order the driver raced for them. 279 seasons have two. */
  teamRefs: z.array(entityRefSchema).min(1),
  starts: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  podiums: z.number().int().nonnegative(),
  dnfs: z.number().int().nonnegative(),
  /** Final championship placing. Null means unranked, never last (`schemas/season.ts`). */
  championshipPosition: z.number().int().positive().nullable(),
  /**
   * **Whether that placing is final, or a standing in a season still being run.**
   *
   * Added by the endpoint, and not optional: on the present data 2026 is 10 rounds of 22, and a
   * surface that printed its `championshipPosition` unqualified would tell a reader that Antonelli
   * is the 2026 champion. That is trap 25's defect one level down, and this project has already
   * shipped it once. The flag is derived from the same season-completeness map that gates
   * `totals.championships`, so the two can never disagree.
   */
  championshipPositionIsFinal: z.boolean(),
});

/** One selected entity. */
export const compareEntitySchema = z.strictObject({
  identity: compareIdentitySchema,
  /** The team whose colour represents this driver: most starts, ties to the most recent. */
  colorTeamRef: entityRefSchema,
  firstSeason: seasonYearSchema,
  lastSeason: seasonYearSchema,
  seasonsEntered: z.number().int().positive(),
  totals: z.strictObject({
    races: z.number().int().nonnegative(),
    starts: z.number().int().nonnegative(),
    wins: z.number().int().nonnegative(),
    podiums: z.number().int().nonnegative(),
    dnfs: z.number().int().nonnegative(),
    classifiedFinishes: z.number().int().nonnegative(),
    championships: z.number().int().nonnegative(),
  }),
  /**
   * The career teammate record — **the one fine-grained metric that spans 1950–2026**, because it
   * is normalised by machinery rather than by era.
   *
   * ⚠ **`rated` and `pool` count pairings, not races.** Fangio's `rated` reads 93 against 51
   * starts, because a 1950s constructor entered as many as 29 cars in one Grand Prix (Kurtis Kraft,
   * 1953 R2) and every same-team pair in a race is one comparison. The surface must say so wherever
   * this number appears; it is not an error.
   */
  teammates: z.strictObject({
    count: z.number().int().nonnegative(),
    race: ledgerSchema,
    grid: ledgerSchema,
  }),
  seasons: z.array(compareEntitySeasonSchema).min(1),
});

/**
 * How two entities are related. **The page's first act is to establish this**, because it decides
 * which evidence is admissible — and refusing an inadmissible comparison out loud is the honesty
 * requirement made visible rather than merely obeyed.
 */
export const relationSchema = z.enum(['teammate', 'contemporary', 'disjoint']);

export const comparePairSchema = z.strictObject({
  a: entityRefSchema,
  b: entityRefSchema,
  relation: relationSchema,
  sharedRaces: z.number().int().nonnegative(),
  sameTeamRaces: z.number().int().nonnegative(),
  sharedSeasons: z.array(seasonYearSchema),
  /**
   * The seasons the two shared a **team**, with that team named. Empty for every pair that was
   * never a teammate pair — which is most of them, and is exactly what `relation` reports.
   *
   * It is an array of seasons rather than a single team because 279 driver-seasons in this archive
   * map one driver to more than one team, so a teammate pairing can legitimately span two
   * identities of one organisation, or two organisations outright.
   */
  sameTeamSeasons: z.array(
    z.strictObject({
      year: seasonYearSchema,
      teamRef: entityRefSchema,
      teamName: z.string().min(1),
    }),
  ),
  /** Whole years between one career ending and the other beginning. `0` when they overlap. */
  yearsApart: z.number().int().nonnegative(),
  /** Both classified, over every race both entered — **whatever car each was in**. */
  race: ledgerSchema,
  /** Both with a starting slot, over the same set. */
  grid: ledgerSchema,
});

/** One measured teammate pairing: the unit of evidence the chain is built from. */
export const chainLinkSchema = z.strictObject({
  from: entityRefSchema,
  to: entityRefSchema,
  firstYear: seasonYearSchema,
  lastYear: seasonYearSchema,
  teams: z.array(
    z.strictObject({
      year: seasonYearSchema,
      teamRef: entityRefSchema,
      teamName: z.string().min(1),
    }),
  ),
  race: ledgerSchema,
  grid: ledgerSchema,
});

/**
 * The teammate chain. Measured on this database: **777 drivers carry at least one round-level
 * teammate pairing, 4,678 distinct pairings join them, and 759 of the 777 are in one connected
 * component** — so almost any two drivers in the archive are joined by a path of real head-to-heads.
 *
 * **It is the path of strongest evidence among the shortest paths**, never an arbitrary one, and
 * the ordering is stated in full in `queries/teammateGraph.ts` because a chain that changed between
 * two page loads would be worthless. The first key is *not* hop count: **2,419 of the 4,678
 * pairings (51.7 %) are unmeasured** — the two drivers never once both finished — so a hop-minimal
 * path can be a chain of links that say nothing, and the search minimises unmeasured links first.
 */
export const chainSchema = z.strictObject({
  a: entityRefSchema,
  b: entityRefSchema,
  /** Number of links. The number of drivers on the chain is `length + 1`. */
  length: z.number().int().positive(),
  links: z.array(chainLinkSchema).min(1),
});

/** One archive season. 77 rows, 1950–2026, and the spine every year-axis on the page shares. */
export const archiveSeasonSchema = z.strictObject({
  year: seasonYearSchema,
  /** `max(number)`, never `count(*)` — 2026 has 24 calendar rows and 22 rounds (trap 15). */
  rounds: z.number().int().nonnegative(),
  /**
   * Every numbered round of the season holds race classification rows. **Not a date comparison** —
   * the dump can lag the calendar by two weeks, so a date test calls a race run with nothing in it
   * (`REQUIREMENTS.md` §2.5). This is the same map that gates `championshipPositionIsFinal`.
   */
  isComplete: z.boolean(),
});

export const compareDataSchema = z.strictObject({
  entities: z.array(compareEntitySchema).min(1).max(4),
  pairs: z.array(comparePairSchema),
  /**
   * A chain per pair that needs one: absent for a pair who were **directly** teammates (the
   * evidence is the pair's own ledger, not a path through anybody) and absent for a pair with no
   * path at all — 18 of the 777 drivers sit outside the main component.
   */
  chains: z.array(chainSchema),
  /** Every driver named anywhere in `chains`, so a link can print a name without a second request. */
  people: z.record(entityRefSchema, compareIdentitySchema),
  archive: z.array(archiveSeasonSchema).min(1),
});
/* ================================================== the season lens: GET /api/compare/seasons */

/**
 * **One season, round by round** — the second lens on `/compare` (`DESIGN_SYSTEM.md` §6.6.6.10).
 *
 * The shapes below answer `src/features/compare/types.ts` **exactly**, field for field, and
 * `schemas/compare.test.ts` asserts that with a mutual-assignability check rather than by
 * inspection: this payload is consumed by a surface that was designed against it, and a field this
 * module renamed would compile here and fail there.
 *
 * ------------------------------------------------------------------ arrays indexed by the round
 *
 * Every per-round array has **one entry per numbered round of the season** — 22 for 2026, whose 24
 * calendar rows include two cancelled rounds carrying a NULL number (trap 15) — so `points[i]`
 * belongs to `rounds[i]` and no consumer has to align two lists. A round that has not been run, and
 * a round the driver missed, are both `null`; the round list itself is what says which is which,
 * and it is the whole season's because a season rail that grew as the year went on would move under
 * the reader.
 *
 * ---------------------------------------------------------------- the one place points may appear
 *
 * Trap 4 forbids summing points **across** eras: 24 point systems, six best-N counting rules and a
 * season length that went from 7 races to 24. None of that applies inside one season, which has
 * exactly one of each — so this lens may show points, and it is the only surface in the product
 * that may.
 *
 * Even here nothing is summed. Every figure is **read** from `driver_championship`, which already
 * applies the era's counting rule, and `bestResults` publishes that rule so the surface can explain
 * the consequence rather than let a reader think the line is broken: **Fangio's 1957 line is flat
 * from round 6 to round 8 while he finished second at Monza**, because only his best five results
 * counted.
 */

/** One numbered round. Cancelled rounds carry `number IS NULL` and are excluded (trap 15). */
export const seasonRoundRefSchema = z.strictObject({
  number: roundNumberSchema,
  name: z.string().min(1),
});

/**
 * A contiguous run of rounds during which one person occupied the other seat.
 *
 * `ref === null` is **not an absence of data** — it is the statement that the car had no single
 * other seat at those rounds, which happens three different ways and all three are real: the team
 * fielded nothing else, the team fielded several other cars, or the round has not been run.
 */
export const seatSegmentSchema = z.strictObject({
  ref: entityRefSchema.nullable(),
  /** The occupant's full name. Empty when `ref` is null, so it is never a name for nobody. */
  label: z.string(),
  fromRound: roundNumberSchema,
  toRound: roundNumberSchema,
});

/**
 * **The other seat in one principal's car, across one season.**
 *
 * A seat, not a person — Rishabh's model, and the truthful one. Measured on race entries rather
 * than on the roster: **only 1,266 of the 3,148 driver-seasons that hold a race (40.2 %) have
 * exactly one teammate.** 234 have none and 1,648 have two or more, so nominating a "primary
 * teammate" would be wrong more often than right and would make every mid-season swap a special
 * case.
 *
 * Three rules decide the occupant, and all three fall out of the model rather than being exceptions
 * to it:
 *
 * 1. **A mid-season team change moves the seat with the principal.** The occupant at round *n* is
 *    the other driver in whichever team the principal raced for at round *n*, so no special case
 *    exists — 2016 Verstappen reads Sainz for rounds 1–4 and Ricciardo for 5–21.
 * 2. **A team that fielded more than one other car has no single other seat**, and the occupant is
 *    `null` there rather than a guess. `carsBeside` says how many there were, so the surface can
 *    state the fact instead of drawing a gap: 1957's Maserati entered between four and eleven other
 *    cars at every round Fangio started, and the Indianapolis 500 — a championship round from 1950
 *    to 1960 — once had 29 Kurtis Krafts in it.
 * 3. **A round the principal did not start has no seat at all**, because the seat is defined
 *    relative to their car.
 *
 * ⚠ **The occupant's points are their own, so the line steps when the seat changes hands.** Each
 * figure is a real championship total for the driver named on it. Accumulating what the *seat*
 * scored would draw a continuous line and would be a sum of `session_entry.points` — not a
 * championship total in any best-N season, and so not honestly placeable on the same axis as the
 * principal's line beside it. `segments` is what lets the surface label the change.
 */
export const seasonSeatSchema = z.strictObject({
  /** Who held the seat at each round; `null` where there was no single other car. */
  occupant: z.array(entityRefSchema.nullable()),
  /** That occupant's **own** cumulative championship points at that round. */
  points: z.array(championshipPointsSchema.nullable()),
  /** That occupant's finishing position at that round; `null` if unclassified or absent. */
  finish: z.array(z.number().int().positive().nullable()),
  /** The occupant runs, in round order. One entry per contiguous run, including the null runs. */
  segments: z.array(seatSegmentSchema),
  /** How many other cars the team fielded at each round. `> 1` is the 1950s works-team case. */
  carsBeside: z.array(z.number().int().nonnegative().nullable()),
});

/** One selected driver's season, round by round. Arrays are indexed by the season's round list. */
export const seasonEntrantSchema = z.strictObject({
  ref: entityRefSchema,
  /**
   * `false` when the driver entered no race that season — **a designed state, not an empty array.**
   * "Fangio did not race in 2026" and "the payload failed" look identical from an absent entrant,
   * and only one of them should reach a reader, so the entrant is present with every array null.
   */
  entered: z.boolean(),
  /** Every team the driver raced for that season, in round order. 279 driver-seasons have two. */
  teamRefs: z.array(entityRefSchema),
  /**
   * The team at each round, `null` where the driver did not start it.
   *
   * Present as well as `teamRefs` because a series takes **one** colour and a driver who changed
   * teams mid-season has two; a de-duplicated list cannot say which car he was in at round 5.
   */
  teamAt: z.array(entityRefSchema.nullable()),
  /** Cumulative championship points after each round, **net of dropped scores** where they apply. */
  points: z.array(championshipPointsSchema.nullable()),
  /** Championship position after each round. Null means unranked, never last. */
  standing: z.array(z.number().int().positive().nullable()),
  /**
   * Finishing position at each round; `null` if unclassified or absent.
   *
   * Gated on `is_classified`, never on `position IS NULL`: `position` is populated on **all 26,093
   * race rows** in this database, 9,683 of them unclassified, where it records a retirement order
   * rather than a result (trap 3).
   */
  finish: z.array(z.number().int().positive().nullable()),
  seat: seasonSeatSchema,
});

export const compareSeasonLensSchema = z.strictObject({
  year: seasonYearSchema,
  /**
   * Every numbered round holds race classification rows. **Not a date comparison** — the dump can
   * lag the calendar by two weeks, so a date test calls a race run with nothing in it
   * (`REQUIREMENTS.md` §2.5). 2026 has raced 10 of its 22 numbered rounds.
   */
  complete: z.boolean(),
  /**
   * `> 0` when only the best N results counted toward the championship that season, `null`
   * otherwise. 1957 counted the best **5 of 8**. From `championship_system.driver_best_results`.
   */
  bestResults: z.number().int().positive().nullable(),
  /** The championship system's own name, for the copy. Never an undocumented enum (trap 14). */
  systemName: z.string().min(1),
  rounds: z.array(seasonRoundRefSchema),
  entrants: z.array(seasonEntrantSchema),
});

/**
 * **Every season the selection entered, in one response.**
 *
 * One request rather than one per year, and that is a departure from what the surface assumed
 * ("choosing a year on the rail is a new request"). The reason is that `ComparePage` owns the
 * chosen year as local state and does not publish it, so a per-year endpoint could not be told
 * which year to fetch — and the fix that costs nothing is to send them all, which is also what
 * `ARCHITECTURE.md` §8 wants of a chart interaction: **no network on the year rail at all.**
 *
 * It is bounded by the same parameter the career lens is: at most four careers, the longest of
 * which is 23 seasons, so the union cannot exceed the archive's 77. Measured on the four drivers
 * the surface was designed against — 40 seasons, and the figures are in `routes/compare.ts`.
 */
export const compareSeasonsSchema = z.strictObject({
  seasons: z.array(compareSeasonLensSchema),
});

/* ============================================================================= request parameters */

/**
 * `?e=` — the comparison's entities, **1 to 4 slugs, comma-separated, order preserved**.
 *
 * S-4, and every clause is a rejection rather than a coercion:
 *
 * - The **raw string is bounded first** — `max(131)`, which is four 32-character references and
 *   three commas exactly — so an oversized parameter is refused before anything splits it.
 * - Each element is `referenceParamSchema` — `^[A-Za-z0-9_-]{1,32}$`, the measured class, which is
 *   deliberately not lowercase-only because three real driver slugs carry a capital
 *   (`scott_Brown`, `Changy`, `Cannoc`). An empty element, from `e=a,,b`, fails it.
 * - **Four is the cap**, from `ARCHITECTURE.md` §4's direct-label rule and `DESIGN_SYSTEM.md`'s
 *   four-entity comparison ceiling. A fifth is a 400, not a silent truncation: truncating would
 *   answer a different question than the URL asked and the reader would not be told.
 * - **Duplicates are rejected**, because comparing a driver with themself is not a comparison and
 *   the surface's ladder keys on the reference.
 *
 * The order is the reader's and is preserved: the surface assigns colour and ladder position by
 * selection order, so sorting here would repaint the page for the same URL.
 */
export const compareRefsParamSchema = z
  .string()
  .min(1)
  .max(131)
  .transform((raw) => raw.split(','))
  .pipe(z.array(referenceParamSchema).min(1).max(4))
  .refine((refs) => new Set(refs).size === refs.length, {
    message: 'references must be distinct',
  });

/**
 * `?kind=` — `driver` only, and absent means `driver`.
 *
 * `ARCHITECTURE.md` §5 promises `driver | team`. **The team lens is not built**, and this is an
 * allowlist of one rather than a value that is quietly ignored: `?kind=team` answering with a
 * driver comparison would be the URL contract lying, and the URL is the shareable state. It is a
 * 400 until the team lens exists, at which point this enum gains its second member.
 */
export const compareKindParamSchema = z.enum(['driver']).default('driver');

export type CompareIdentity = z.infer<typeof compareIdentitySchema>;
export type Ledger = z.infer<typeof ledgerSchema>;
export type CompareSeason = z.infer<typeof compareEntitySeasonSchema>;
export type CompareEntity = z.infer<typeof compareEntitySchema>;
export type Relation = z.infer<typeof relationSchema>;
export type ComparePair = z.infer<typeof comparePairSchema>;
export type ChainLink = z.infer<typeof chainLinkSchema>;
export type Chain = z.infer<typeof chainSchema>;
export type ArchiveSeason = z.infer<typeof archiveSeasonSchema>;
export type CompareData = z.infer<typeof compareDataSchema>;
export type SeasonRoundRef = z.infer<typeof seasonRoundRefSchema>;
export type SeatSegment = z.infer<typeof seatSegmentSchema>;
export type SeasonSeat = z.infer<typeof seasonSeatSchema>;
export type SeasonEntrant = z.infer<typeof seasonEntrantSchema>;
export type CompareSeasonLens = z.infer<typeof compareSeasonLensSchema>;
export type CompareSeasons = z.infer<typeof compareSeasonsSchema>;
