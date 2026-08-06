import { z } from 'zod';

/**
 * `GET /api/meta` — the response contract, shared with the client via `@schemas/*`.
 *
 * This module may import **only** `zod` (ARCHITECTURE.md §3).
 *
 * There is no `dataVintage` field: the vintage *is* `latestCompletedRound`, and a
 * second representation of the same fact would be a second thing to keep honest. The
 * display string is produced by the pure selector `selectDataVintage`.
 *
 * No field names, describes or hints at anything other than the sport's own calendar.
 */

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const seasonYearSchema = z.number().int().min(1950).max(2100);

export const seasonRangeSchema = z.strictObject({
  firstYear: seasonYearSchema,
  latestYear: seasonYearSchema,
  count: z.number().int().positive(),
});

export const roundRefSchema = z.strictObject({
  year: seasonYearSchema,
  /** Never 0 and never null: a cancelled round has no number (trap 15). */
  round: z.number().int().positive(),
  roundName: z.string().min(1),
  date: isoDateSchema,
  /** LEFT JOIN in the query, so null is tolerated. A slug, never an id (DL-3). */
  circuitRef: z.string().min(1).nullable(),
  circuitName: z.string().min(1).nullable(),
});

export const coverageWindowSchema = z.strictObject({
  from: seasonYearSchema,
  /** null means open — through the latest season present. */
  to: seasonYearSchema.nullable(),
});

/**
 * Strict on purpose. There is no `practice` key and there never will be: practice
 * carries no times at all, so the schema makes the feature unrepresentable (trap 2).
 */
export const coverageSchema = z.strictObject({
  results: coverageWindowSchema,
  qualifying: coverageWindowSchema,
  qualifyingSegments: coverageWindowSchema,
  laps: coverageWindowSchema,
  pitStops: coverageWindowSchema,
  sprint: coverageWindowSchema,
  sprintQualifying: coverageWindowSchema,
});

export const latestSeasonSchema = z.strictObject({
  year: seasonYearSchema,
  /** Excludes cancelled rounds (trap 12 + trap 15). */
  scheduledRounds: z.number().int().nonnegative(),
  completedRounds: z.number().int().nonnegative(),
  cancelledRounds: z.number().int().nonnegative(),
  isComplete: z.boolean(),
});

export const metaSchema = z.strictObject({
  seasons: seasonRangeSchema,
  latestSeason: latestSeasonSchema,
  latestCompletedRound: roundRefSchema.nullable(),
  nextScheduledRound: roundRefSchema.nullable(),
  coverage: coverageSchema,
});

export type Meta = z.infer<typeof metaSchema>;
export type RoundRef = z.infer<typeof roundRefSchema>;
export type CoverageKey = keyof Meta['coverage'];
