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
 * A **directory**: enough to render a browsable, sortable, filterable list that links to a
 * profile. Deliberately *not* a dashboard — no wins, no podiums, no championships. Those
 * are the profile's, and putting them here would mean 881 careers aggregated to answer
 * "which page do I want".
 *
 * **Every field name and definition matches the profile payload it corresponds to**, so a
 * number does not change when the reader clicks through:
 *
 * | index | profile | definition |
 * |---|---|---|
 * | `driver.races` | `driver.totals.races` | distinct races entered |
 * | `driver.firstSeason` / `lastSeason` | `driver.career.firstSeason` / `lastSeason` | first/last season with a race entry |
 * | `team.races` | `team.totals.races` | distinct Grands Prix entered |
 * | `circuit.roundsHeld` / `racesWithResults` / `firstYear` / `lastYear` | the same four, top level on `circuit` | see `schemas/circuit.ts` |
 *
 * Verified against the live database at build time: Alonso 438 races 2001–2026, Schumacher
 * 308, Monza `roundsHeld` 76 / `racesWithResults` 75, all matching the profile endpoints.
 * `queries/directory.test.ts` asserts the equality rather than trusting this table.
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
  /** First season with a race entry. Null **exactly** when `races` is 0. */
  firstSeason: seasonYearSchema.nullable(),
  /**
   * Last season with a race entry. Null exactly when `races` is 0.
   *
   * Compare against `/api/meta`'s `latestSeason.year` to decide "active" — never against a
   * completed-season test, and never against a hard-coded year.
   */
  lastSeason: seasonYearSchema.nullable(),
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
  /** Numbered rounds scheduled at this venue, **including any not yet run**. */
  roundsHeld: z.number().int().nonnegative(),
  /** Of those, how many hold classification rows. */
  racesWithResults: z.number().int().nonnegative(),
  /** First year with results. Null **exactly** when `racesWithResults` is 0. */
  firstYear: seasonYearSchema.nullable(),
  lastYear: seasonYearSchema.nullable(),
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
