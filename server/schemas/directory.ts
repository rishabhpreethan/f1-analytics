import { z } from 'zod';
import { seasonYearSchema } from './meta';
import { entityRefSchema } from './season';

/**
 * `GET /api/drivers`, `GET /api/teams`, `GET /api/circuits` — the three **index** payloads.
 * Shared with the client via `@schemas/*`.
 *
 * This module may import **only** `zod` and its sibling schema modules
 * (ARCHITECTURE.md §3).
 *
 * One module for three, unlike the profile schemas, because the three rows differ only in
 * their fields while **the ruling below is identical for all three** — and a ruling copied
 * into three files is a ruling that drifts in two of them.
 *
 * ===================================================== what these are, and what they are not
 *
 * A **directory that can be ranked, stratified and grouped** — enough to render a browsable
 * list that tells a reader something before they click, and links to a profile for the rest.
 *
 * **This is a deliberate reversal.** The first version of this module argued the opposite:
 * "deliberately *not* a dashboard — no wins, no podiums, no championships". That produced
 * a payload with nothing in it to sort by except a name and a race count, so the only page
 * the data permitted was a search box, and the search box was rejected on sight
 * (2026-08-23). The principle was defensible and the result was not: a directory with no
 * achievement in it cannot be designed, only listed. **Do not re-narrow this payload
 * without a page design that works on what is left.**
 *
 * What it is still not: a profile. There is no per-season array, no per-race row and no
 * nested object anywhere — every added field is one integer, so 881 rows cost 22.6 KB
 * gzipped rather than a megabyte. **The rule for anything further is: a scalar, or not at
 * all.**
 *
 * **Every field name and definition matches the profile payload it corresponds to**, so a
 * number does not change when the reader clicks through:
 *
 * | index | profile | definition |
 * |---|---|---|
 * | `driver.races` | `driver.totals.races` | distinct races entered |
 * | `driver.starts` | `driver.totals.starts` | of those, the ones that began |
 * | `driver.wins` / `podiums` | `driver.totals.wins` / `podiums` | races finished 1st / top-three |
 * | `driver.championships` | `driver.totals.championships` | titles — P1 in the **final** standing of a **complete** season |
 * | `driver.firstSeason` / `lastSeason` | `driver.career.firstSeason` / `lastSeason` | first/last season with a race entry |
 * | `team.races` / `wins` / `podiums` / `championships` | `team.totals.*` | the same four |
 * | `circuit.roundsHeld` / `racesWithResults` / `firstYear` / `lastYear` | the same four, top level on `circuit` | see `schemas/circuit.ts` |
 * | `circuit.latitude` / `longitude` | `circuit.circuit.latitude` / `longitude` | as recorded |
 *
 * `bestChampionshipPosition` (both entities) and `lastScheduledYear` (circuits) are the
 * only fields with **no** profile counterpart. Both are derivable from the profile —
 * `min(position)` over complete seasons, and `max(year)` over numbered rounds — and
 * `queries/directory.test.ts` asserts them against the profile's own arrays rather than
 * against a copy of this SQL.
 *
 * Verified against the live database: Alonso 438 races / 435 starts / 32 wins / 106 podiums
 * / 2 titles, Schumacher 308 / 307 / 91 / 155 / 7, Ferrari 250 wins and 16 constructors'
 * titles, Monza `roundsHeld` 76 / `racesWithResults` 75, all matching the profile endpoints.
 * `queries/directory.test.ts` asserts the equality rather than trusting this table.
 *
 * ============================================ a title is not "led the championship once"
 *
 * **`championships` is the trap this project has already shipped once.** The naive query —
 * `SELECT count(DISTINCT driver_id) FROM driver_championship WHERE position = 1` — returns
 * **66** drivers, because `driver_championship` holds a **per-round snapshot** and 66
 * drivers have led a championship at some point in a season. The answer is **35**.
 *
 * Two independent gates produce that, and both are structural rather than remembered:
 *
 * 1. The SQL joins `last_snapshot`, so only the **final** round's standing of each season
 *    can enter the fold at all. A mid-season lead is not in the result set.
 * 2. `foldChampionshipStandings` takes the season-completeness map as a **required
 *    argument**, so a season still being run cannot yield a title. Without it the 2026
 *    data — 10 of 22 rounds — would hand Antonelli a championship and Mercedes a ninth
 *    constructors' title. It is the same gate `queries/drivers.ts` and `queries/teams.ts`
 *    apply for `isChampion`, reading the same memoised map, which is why the index and the
 *    profile cannot disagree.
 *
 * ==================================================== what is deliberately **not** here
 *
 * - **Points.** 24 scoring systems and several best-N-results eras: a career total is not
 *   a comparable number (trap 4). Nothing on this payload sums points.
 * - **Poles.** Measured before rejecting: qualifying classifications exist for **3 of
 *   Senna's 161 races** and 192 of Schumacher's 308, and Clark and Fangio have none at all.
 *   A `poles` column would print 3 next to Senna's name on a page whose whole purpose is
 *   ranking. The profile can carry the figure because it carries `racesWithQualifying`
 *   beside it and the prose to explain the window; a list row cannot.
 * - **Fastest laps.** Present for 1958–59 and 2004+, absent for the 44 seasons between
 *   (trap 18). Same argument.
 * - **Brand colour.** As everywhere: `ref` is what `src/lib/entityColor.ts` needs, and 202
 *   of 214 teams have none (trap 6).
 *
 * ======================================== the index lists the whole archive — the ruling
 *
 * **All 881 drivers, all 214 teams and all 78 circuits appear, including the ones that
 * never raced.** Counted directly:
 *
 * - **63 of 881 drivers hold no race classification row.** They are two distinct groups.
 *   **47 have no session row of any kind** but do hold `round_entry` rows — they entered
 *   Grands Prix and never qualified: Bernie Ecclestone (1958), Giovanna Amati (1992),
 *   Divina Galica, Desiré Wilson, and Claudio Langes, whose 14 entries in 1990 produced 14
 *   failures to pre-qualify. **16 hold FP1 rows only** — 2025–26 reserve and test drivers
 *   (Colton Herta, Felipe Drugovich, Paul Aron, Arthur Leclerc and eleven more), every one
 *   of whom may start a race in the season this data is still recording.
 * - **9 of 214 teams likewise** — Life, McGuire, Kauhsen, Apollon, Eagle and four more,
 *   constructors that entered and never started. `eagle` holds no `team_driver` row at all.
 * - **1 of 78 circuits has a numbered round and no results**: Madring, 2026 R14. That is
 *   trap 13 — a *scheduled* venue, not a gap — and dropping it would hide a new circuit
 *   joining the calendar.
 *
 * The alternative was filtering to `races > 0`, and it was rejected on four grounds.
 * **The index must enumerate exactly what the profile endpoint serves**, or the two
 * disagree about what a driver is; `/api/drivers/ecclestone` answers 200 today. **The
 * product already prints the number 881** to readers (`DriverPage`'s not-found copy), so a
 * directory of 818 is an inconsistency a reader can see. **Excluding is not reversible by
 * the client and including is** — a row carrying `races: 0` can be filtered, grouped or
 * badged, so the editorial decision stays where a human can change it. And **it would go
 * stale by design**, because the 16 FP1 drivers are current.
 *
 * The duty that ruling creates is discharged here: `races` (or `racesWithResults`) is on
 * every row, and `firstSeason` / `firstYear` is null **exactly** when it is 0, so a client
 * can tell an entered-only entity from a racing one **before** the click, without a second
 * request.
 *
 * **`races === 0` is sufficient to separate them and is the field to use.** It is one
 * comparison, it needs nothing from `/api/meta`, and `queries/directory.test.ts` asserts
 * the count it selects (63 drivers, 9 teams) on every run, so a database refresh that
 * changes the population fails a test rather than changing a page quietly. A UI that
 * defaults them out of the main browse and keeps them reachable is the intended use; no
 * second request is needed for either half.
 *
 * ===================================================================== ordering, and why
 *
 * The rows arrive in a documented, deterministic order — drivers by surname then forename
 * then reference, teams and circuits by name then reference — so the payload is stable and
 * an unstyled render is already sensible.
 *
 * **That order is a default, not the answer.** SQLite compares text with BINARY collation,
 * which sorts `Räikkönen` after `Ryan` and `Pérez` after `Piquet`. A reader-facing sort has
 * to be locale-aware, so it is done client-side with `Intl.Collator` in
 * `src/features/entity/selectors.ts`, where it is pure and unit-tested against exactly
 * those names.
 *
 * ============================================================== no `latestSeason` here
 *
 * "Is this driver active?" needs a season to compare `lastSeason` against, and that season
 * is **not** published on these payloads. `/api/meta` already carries it
 * (`latestSeason.year`), and `schemas/meta.ts` states the rule this follows: a second
 * representation of one fact is a second thing to keep honest.
 *
 * The comparison is `lastSeason === meta.latestSeason.year`, **not** a completeness test —
 * 2026 is in progress with 10 of 22 rounds run, and a driver racing in it must read as
 * active rather than as a career that ends mid-year. `selectEntityActivity` in
 * `src/features/entity/selectors.ts` is the one implementation.
 *
 * **So there is no `isCurrent` boolean on any of these rows, and that is the answer to
 * "who is on the current grid" rather than an omission.** It resolves to 22 drivers and 11
 * teams on the present data. Publishing the boolean as well would mean a row that can
 * disagree with `/api/meta` after a refresh, and it would be a *different* answer per
 * entity kind while the rule is one rule. The circuit equivalent is `lastScheduledYear`
 * against the same year, because a venue's round can be scheduled and unrun.
 *
 * ============================================== no brand colour crosses this boundary
 *
 * As in every other payload: no `primaryColor`. `ref` is what `src/lib/entityColor.ts`
 * needs, and 202 of 214 teams have no brand colour anyway (trap 6).
 */

/* --------------------------------------------------------------------------- drivers */

/**
 * One row of `GET /api/drivers`. 881 of them.
 *
 * **`code` is null for 774 of 881** and is never synthesised (`schemas/driver.ts`):
 * `surname.slice(0, 3).toUpperCase()` would invent a three-letter code the sport never
 * used. `nationality` is null for 16; `countryCode` is populated on all 881 today and is
 * nullable anyway, matching `driverProfileSchema` — a payload that fails its own schema is
 * a 500, so tightening a field the schema does not enforce would let one refreshed row
 * take the whole directory offline.
 */
export const driverListItemSchema = z.strictObject({
  ref: entityRefSchema,
  code: z.string().min(1).nullable(),
  forename: z.string().min(1),
  surname: z.string().min(1),
  nationality: z.string().min(1).nullable(),
  countryCode: z.string().min(1).max(8).nullable(),
  /**
   * Distinct races entered — identical to `totals.races` on the profile, and therefore
   * **not** a count of classification rows (trap 17: 45 drivers hold more rows than races).
   *
   * **0 for 63 drivers**, and that is a measurement rather than a gap. See the module
   * header for what those 63 are.
   */
  races: z.number().int().nonnegative(),
  /**
   * Of those races, the ones that **began** — `totals.starts` on the profile, so a race
   * classified `didNotStart` (status 30) or `didNotQualify` (status 40) is excluded.
   *
   * Never greater than `races`, and different from it for **241 drivers** (Alonso 438/435,
   * Schumacher 308/307). The pair exists because both are real career figures and a page
   * that labels `races` as "starts" would be wrong for all 241.
   */
  starts: z.number().int().nonnegative(),
  /** Races won — `totals.wins`. **116 of 881 drivers are non-zero**; 702 who raced are 0. */
  wins: z.number().int().nonnegative(),
  /** Races finished in the top three — `totals.podiums`. Never less than `wins`. */
  podiums: z.number().int().nonnegative(),
  /**
   * Drivers' titles — `totals.championships`. **35 drivers are non-zero.**
   *
   * P1 in the **final** standing of a **complete** season, both halves load-bearing: see
   * the module header for the 66-vs-35 trap this guards.
   */
  championships: z.number().int().nonnegative(),
  /**
   * Career-best drivers' championship position, over complete seasons only.
   *
   * **Null for 498 of 881** — the 63 who never raced, plus 435 who raced and never held a
   * classified position in a final standing (no points under a system that ranked only
   * scorers). Null therefore means "never placed", not "unknown", and it is the honest
   * bottom of the ladder rather than a large number.
   *
   * It exists because `wins` and `championships` are zero for the overwhelming majority —
   * 702 of the 818 who raced never won a race — so without it most of the list is flat.
   * Non-null for **383**: 35 at 1, 36 best 2–3, 103 best 4–10, 161 best 11–20, 48 at 21+.
   *
   * Both fields come from the same filtered rows, so `bestChampionshipPosition === 1` and
   * `championships > 0` are equivalent **by construction** — asserted on all 881 rows
   * rather than left as an intention. Neither reads a title from an in-progress season.
   */
  bestChampionshipPosition: z.number().int().positive().nullable(),
  /** First season with a race entry. Null **exactly** when `races` is 0. */
  firstSeason: seasonYearSchema.nullable(),
  /**
   * Last season with a race entry. Null exactly when `races` is 0.
   *
   * Compare against `/api/meta`'s `latestSeason.year` to decide "active" — never against a
   * completed-season test, and never against a hard-coded year.
   */
  lastSeason: seasonYearSchema.nullable(),
  /**
   * **The team whose colour represents this driver: most starts, ties to the most recent.**
   * Null exactly when `races` is 0.
   *
   * A reference, never a hex — `src/lib/entityColor.ts` turns it into a token name and no colour
   * crosses this boundary (`DESIGN_SYSTEM.md` §3.3a.3). Added in F7 for `/compare`'s picker, which
   * has to make a bay recognisable *before* it is filled and so cannot ask the comparison endpoint
   * for a driver who is not in the comparison yet.
   *
   * The tiebreak is recency rather than the alphabet, and it is load-bearing on a split career:
   * Hamilton's 246 races in silver should not lose to Ferrari's 34 because `ferrari < mercedes`.
   * A driver whose every entry was a non-start has no *start* to count, so the fallback is the team
   * of their first race — an entry with no start is still an entry by a team.
   */
  colorTeamRef: entityRefSchema.nullable(),
});

export const driverListSchema = z.strictObject({
  /** Ascending by surname, then forename, then reference. See the module header. */
  drivers: z.array(driverListItemSchema),
});

/* ----------------------------------------------------------------------------- teams */

/**
 * One row of `GET /api/teams`. 214 of them.
 *
 * No lineage: `base_team` holds 0 rows (trap 5), so Minardi → Toro Rosso → AlphaTauri → RB
 * does not resolve and each identity is its own row, exactly as on the profile.
 */
export const teamListItemSchema = z.strictObject({
  ref: entityRefSchema,
  name: z.string().min(1),
  nationality: z.string().min(1).nullable(),
  countryCode: z.string().min(1).max(8).nullable(),
  /** Distinct Grands Prix entered — `totals.races` on the profile. **0 for 9 teams.** */
  races: z.number().int().nonnegative(),
  /**
   * Grands Prix won — `totals.wins`. **47 of 214 teams are non-zero.**
   *
   * Distinct **races**, not winning cars: three races in the archive hold two P1 rows
   * (trap 16), so a row count would give Alfa Romeo two wins for the 1951 French Grand Prix.
   */
  wins: z.number().int().nonnegative(),
  /**
   * Podium **places** — `totals.podiums`, and deliberately not the same shape as the
   * driver field. A 1–2 finish is two podiums for the team and one for each driver, so this
   * counts distinct `(race, position)` slots: Ferrari 845 from 1,134 races.
   */
  podiums: z.number().int().nonnegative(),
  /**
   * Constructors' titles — `totals.championships`. **17 teams are non-zero**: Ferrari 16,
   * McLaren 10, Williams 9, Mercedes 8, Red Bull 6.
   *
   * **0 is correct for a team that dominated before 1958** — Alfa Romeo won the first two
   * drivers' titles and has 0 here, because the constructors' championship did not exist
   * yet. `bestChampionshipPosition` is null for exactly those teams, which is the signal to
   * render "no constructors' championship" rather than "never won one".
   */
  championships: z.number().int().nonnegative(),
  /**
   * Career-best constructors' championship position, over complete seasons only.
   *
   * **Non-null for 95 of 214.** Null covers the 9 that never started, every team whose
   * whole life predates 1958, and every team that never held a classified position in a
   * final constructors' standing.
   */
  bestChampionshipPosition: z.number().int().positive().nullable(),
  /** Null **exactly** when `races` is 0. */
  firstSeason: seasonYearSchema.nullable(),
  lastSeason: seasonYearSchema.nullable(),
});

export const teamListSchema = z.strictObject({
  /** Ascending by name, then reference. */
  teams: z.array(teamListItemSchema),
});

/* -------------------------------------------------------------------------- circuits */

/**
 * One row of `GET /api/circuits`. 78 of them.
 *
 * **`roundsHeld` and `racesWithResults` are two numbers because they are two facts**, and
 * they carry the same meaning as on the circuit profile. A round is *held* when the
 * calendar numbers it; it has *results* when classification rows exist. Monza reads 76 and
 * 75 — the 76th is 2026's, not yet run — and Madring reads 1 and 0.
 *
 * The difference is never a date comparison: the dataset can lag the real calendar by ~2
 * weeks (`REQUIREMENTS.md` §2.5), so a date test would report a race as run with nothing
 * in it.
 */
export const circuitListItemSchema = z.strictObject({
  ref: entityRefSchema,
  name: z.string().min(1),
  locality: z.string().min(1).nullable(),
  country: z.string().min(1).nullable(),
  countryCode: z.string().min(1).max(8).nullable(),
  /**
   * As recorded on the circuit, identical to `circuit.latitude` / `longitude` on the
   * profile. Populated on all 78 today and nullable anyway, matching `circuitSchema`.
   *
   * Published because a circuit index is a **map**, and a map is the one design a list of
   * 78 venues actually wants. They are decimal degrees, WGS 84, and are the venue's
   * location — not a track outline, which this dataset does not hold.
   */
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  /** Numbered rounds scheduled at this venue, **including any not yet run**. */
  roundsHeld: z.number().int().nonnegative(),
  /** Of those, how many hold classification rows. */
  racesWithResults: z.number().int().nonnegative(),
  /** First year with results. Null **exactly** when `racesWithResults` is 0. */
  firstYear: seasonYearSchema.nullable(),
  lastYear: seasonYearSchema.nullable(),
  /**
   * The last year this venue holds a **numbered round**, run or not. Null exactly when
   * `roundsHeld` is 0 (no circuit today).
   *
   * **This is the field that answers "is it still on the calendar", and `lastYear` is
   * not.** Compare it against `/api/meta`'s `latestSeason.year`: 25 circuits reach 2025 or
   * later, 22 of them are on the 2026 calendar, and 53 are retired. Madring reads
   * `lastScheduledYear` 2026 with `lastYear` null — a venue joining the calendar, which
   * `lastYear` alone would file under "never raced" (trap 13). Monza reads 2026 and 2025:
   * still current, this year's round not yet run.
   *
   * Never less than `lastYear`, asserted on all 78 rows.
   */
  lastScheduledYear: seasonYearSchema.nullable(),
});

export const circuitListSchema = z.strictObject({
  /** Ascending by name, then reference. */
  circuits: z.array(circuitListItemSchema),
});

export type DriverListItem = z.infer<typeof driverListItemSchema>;
export type DriverList = z.infer<typeof driverListSchema>;
export type TeamListItem = z.infer<typeof teamListItemSchema>;
export type TeamList = z.infer<typeof teamListSchema>;
export type CircuitListItem = z.infer<typeof circuitListItemSchema>;
export type CircuitList = z.infer<typeof circuitListSchema>;
