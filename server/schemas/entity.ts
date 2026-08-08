import { z } from 'zod';
import { isoDateSchema, seasonYearSchema } from './meta';
import { entityRefSchema, roundNumberSchema } from './season';

/**
 * Fragments shared by the three entity pages — driver (F4), team (F5), circuit (F6).
 *
 * This module may import **only** `zod` and its sibling schema modules
 * (ARCHITECTURE.md §3). One server-only import here breaks the browser bundle.
 *
 * ==================================================== the `:reference` route parameter
 *
 * The third parameter shape in this product, after `:year` and `:round`, and it follows
 * the same rule (S-4: **reject, do not coerce**): an allowlisted character class and a
 * bounded length, checked before the value is ever bound to a statement.
 *
 * **The character class is measured, not guessed, and lowercase-only would be wrong.**
 * Counted across all 881 driver, 214 team and 78 circuit references: every one matches
 * `[A-Za-z0-9_-]`, and **three driver references carry an uppercase letter** —
 * `scott_Brown` (Archie Scott Brown), `Changy` (Alain de Changy) and `Cannoc` (John
 * Cannon). A `^[a-z0-9_-]+$` pattern reads as obviously right and would answer 400 on
 * three real drivers, which is the kind of defect that never surfaces because nobody
 * types those URLs by hand.
 *
 * Hyphens are real too — `campbell-jones`, `lewis-evans`, `brabham-alfa_romeo` — so the
 * class carries both separators.
 *
 * The length bound is 32 against a measured maximum of 20 (`brabham-alfa_romeo` and its
 * neighbours). Like `:year`'s 1950–2100, this is the **format's** range and not the
 * data's: a well-formed reference the dataset does not hold is a **404**, and only a
 * malformed one is a 400 (ARCHITECTURE.md §6 convention 2).
 */
export const referenceParamSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,32}$/)
  .pipe(entityRefSchema);

/**
 * A round, as an entity page refers to one: enough to render a link and a label, never
 * an internal id (DL-3, trap 11).
 *
 * `circuitRef` / `circuitName` are nullable because `v_entry` reaches `circuit` through a
 * `LEFT JOIN`; no numbered round lacks a circuit today.
 */
export const entityRoundRefSchema = z.strictObject({
  year: seasonYearSchema,
  round: roundNumberSchema,
  name: z.string().min(1),
  date: isoDateSchema,
  circuitRef: entityRefSchema.nullable(),
  circuitName: z.string().min(1).nullable(),
});

/**
 * Which qualifying session a driver's qualifying classification came from.
 *
 * Exposed rather than hidden because the eras are not the same measurement: `QB` is a
 * single one-hour session, `QA` is 2005's two-run aggregate, and `Q1`/`Q2`/`Q3` are the
 * knockout segments — where **the position is the driver's overall classification**, not
 * a rank within the segment. That last point is the reason the enum is here at all: each
 * segment ranks every driver who took part in it, so the drivers knocked out in Q1 hold
 * positions 16–20 in Q1, those knocked out in Q2 hold 11–15 in Q2, and the Q3 runners
 * hold 1–10 in Q3. Taking the position from **the highest segment the driver reached** is
 * therefore the overall qualifying result, and taking it from Q1 for everyone would be a
 * different, meaningless number.
 *
 * Verified on 2024 R1: Q1 ranks all 20 (Sainz 1st, Gasly 20th), Q2 ranks the surviving
 * 15, Q3 ranks 10 — and Verstappen, 3rd in Q1, is P1 overall from Q3.
 */
export const qualifyingSessionSchema = z.enum(['Q3', 'Q2', 'Q1', 'QA', 'QB']);

export type EntityRoundRef = z.infer<typeof entityRoundRefSchema>;
export type QualifyingSession = z.infer<typeof qualifyingSessionSchema>;
