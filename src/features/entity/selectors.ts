import type { Meta } from '@schemas/meta';

/**
 * The one derivation the index payloads deliberately do **not** carry, kept pure and in one
 * place because it is the shape of a data trap rather than a formatting choice.
 *
 * Sorting, searching, grouping and the rail geometry are **not** here — they are pure
 * functions of a list with no notion of a payload, and they live in
 * `src/components/entity/indexModel.ts`. Two implementations of a sort is the drift this
 * project consolidated agents to remove.
 *
 * ================================================= why "active" is not a field on the payload
 *
 * `/api/drivers` could have published `isActive` and does not. `/api/meta` already carries
 * `latestSeason.year`, and `server/schemas/meta.ts` states the rule: a second
 * representation of one fact is a second thing to keep honest. A boolean baked into a
 * response that is cached for an hour is also a fact with a clock in it, which is the same
 * mistake `driverCareerSpanSchema` refuses to make with a driver's current age.
 *
 * So the comparison happens once, here, against a season the server states.
 */

/**
 * Whether an entity is still contesting the archive's most recent season.
 *
 * **The test is `lastSeason === latestSeason`, and it is deliberately not a
 * completed-season test.** The archive's most recent season is normally in progress — 2026
 * currently holds 10 of 22 numbered rounds — and a driver racing in it must read as
 * *active*, not as a career that mysteriously ends mid-year. Gating on
 * `meta.latestSeason.isComplete` would flip 22 current drivers, all 10 current teams and
 * every current circuit to "former" for eleven months of every year, and would flip them
 * back the moment the last round loaded.
 *
 * `neverRaced` is a third state rather than a flavour of `former`, because the two are
 * different facts and the index publishes them separately: 63 drivers, 9 teams and 1
 * circuit have a null span and a zero count (`server/schemas/directory.ts`). Collapsing
 * them would put Bernie Ecclestone, who never qualified, in the same bucket as Ayrton
 * Senna.
 *
 * @param lastSeason the entity's last season with a race entry — `lastSeason` on a driver
 *   or team index row, `lastYear` on a circuit row. Null means it never raced.
 * @param latestSeason `meta.latestSeason.year` — the most recent season in the archive.
 */
export type EntityActivity = 'current' | 'former' | 'neverRaced';

export function selectEntityActivity(
  lastSeason: number | null,
  latestSeason: number,
): EntityActivity {
  if (lastSeason === null) return 'neverRaced';
  // `>=` rather than `===` so a database refresh that adds a season before `/api/meta` is
  // re-read cannot report a currently racing driver as retired. The two are read from the
  // same snapshot in practice; this costs nothing and removes a window.
  return lastSeason >= latestSeason ? 'current' : 'former';
}

/** `selectEntityActivity(...) === 'current'`, for a surface that only needs the boolean. */
export function selectIsCurrent(lastSeason: number | null, latestSeason: number): boolean {
  return selectEntityActivity(lastSeason, latestSeason) === 'current';
}

/**
 * The season an index compares against, or null while `/api/meta` has not resolved.
 *
 * Null rather than a fallback year on purpose: a hard-coded `2026` would silently become
 * wrong on the next database refresh, and the index has a loading state for exactly this.
 * A surface that renders activity before meta arrives is showing a guess.
 */
export function selectLatestSeason(meta: Meta | undefined): number | null {
  return meta?.latestSeason.year ?? null;
}
