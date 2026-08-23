import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ZodType } from 'zod';
import { SEASON_CACHE_TTL_MS } from '../config';
import { apiError } from '../errors';
import { readCompare } from '../queries/compare';
import { readCompareSeasons } from '../queries/compareSeason';
import {
  compareDataSchema,
  compareKindParamSchema,
  compareRefsParamSchema,
  compareSeasonsSchema,
} from '../schemas/compare';

/**
 * The comparison workspace's two lenses.
 *
 *   GET /api/compare?kind=driver&e=a,b,c,d      — the career lens
 *   GET /api/compare/seasons?e=a,b,c,d          — the season lens, every season the selection ran
 *
 * Thin by design (ARCHITECTURE.md §3): validate, call one named query, validate the payload against
 * its own schema, return. There is no branch in this file that computes anything about Formula 1.
 * **Only `GET` is registered**, so every other method falls through to the 404 handler.
 *
 * The two patterns cannot collide: `/compare` is one segment and `/compare/seasons` is two, with a
 * literal second segment.
 *
 * **Two routes rather than one with a `lens` parameter**, because their cache lifetimes are
 * independent: flipping the lens must not refetch a career payload that has not changed. They are
 * two TanStack Query keys and the client keeps both.
 *
 * **The season lens sends every season the selection entered in one response**, rather than one
 * year at a time as `src/features/compare/types.ts` assumed. `ComparePage` holds the chosen year in
 * local state and does not publish it, so a per-year endpoint could not be told which year to ask
 * for — and sending them all is what buys §8's "chart interaction < 100 ms, **no network**" on the
 * year rail. The union is bounded by four careers, the longest of which is 23 seasons.
 *
 * ------------------------------------------------------------------------------ S-4 and S-6
 *
 * **This is the first surface in the product to take a query parameter**, so it is the first place
 * S-4 has to be argued rather than noted as vacuous. Two of them exist and each is parsed before it
 * can reach a statement, rejecting rather than coercing:
 *
 * - **`e`** — `compareRefsParamSchema`. The raw string is length-bounded *before* it is split, each
 *   element must match the measured `^[A-Za-z0-9_-]{1,32}$` class, **1 to 4 elements**, and
 *   duplicates are refused. A fifth entity is a 400 and not a silent truncation: truncating would
 *   answer a different question than the URL asked and say nothing about it. `e` missing entirely
 *   is a 400 too — there is no default comparison, and inventing one would put four drivers on a
 *   shareable URL that does not name them.
 * - **`kind`** — an allowlist of one. `ARCHITECTURE.md` §5 promises `driver | team` and the team
 *   lens does not exist, so `?kind=team` is a 400 rather than a driver comparison wearing the wrong
 *   label. Absent means `driver`.
 *
 * The season lens takes **no year parameter at all**, which is the strongest position available:
 * there is nothing to validate because there is nothing a request can say beyond `e`.
 *
 * **400 and 404 stay different answers.** A malformed parameter is a 400. A well-formed reference
 * the archive cannot compare is a **404**, and that covers two cases deliberately joined: a slug no
 * driver holds, and one of the **63 drivers of 881 who are in the dataset and never started a Grand
 * Prix**. Neither has a career to compare, and the alternative — publishing an entity with a null
 * season span — would push "this driver has no span" into every consumer of a field that is a span
 * on the other 818. The picker the surface offers is built from drivers with `races > 0`, so the
 * 404 is only reachable by typing a URL.
 *
 * Nothing here interpolates a request value into a message: every body comes from `ERROR_MESSAGES`,
 * so no branch can emit a slug, a year, a stack frame, SQL text or a path (S-6).
 *
 * ------------------------------------------------------------------------------------- S-10
 *
 * **No `lap` or `pit_stop` access exists behind either route** — not even a short-circuiting
 * `EXISTS`. Every statement is bounded by something the parameters already guarantee, which is
 * ARCHITECTURE.md §6 convention 5's preference for a structural bound over a narrowing parameter:
 *
 * | Statement | Bound | Measured worst case |
 * |---|---|---|
 * | career: the selected drivers' races | 4 references | 897 rows for the four in the fixture; 438 races is the longest career |
 * | career: teammate totals, same-team pairings | 4 references | a few hundred rows |
 * | career: championship snapshots | 4 references | ~80 rows |
 * | career: the teammate graph | whole archive, **memoised for an hour** | 4,678 rows, ~80 ms cold |
 * | season: the selection's entries | 4 references | 897 rows |
 * | season: the other cars in those teams | the ~900 sessions the selection appeared in | ~1,900 rows |
 * | season: rounds and championship systems | the years those careers span, ≤ 77 | ~800 rows |
 * | season: championship snapshots | those years × the drivers who appear | ~7,000 rows |
 *
 * The one whole-relation read is the teammate graph, and it is memoised precisely because it is
 * whole-relation: no request can make it larger and no request but the first in an hour pays for
 * it. There is no `limit`, `sort`, `filter` or range parameter anywhere on this surface, so there
 * is nothing to allowlist beyond the two enums above.
 *
 * ---------------------------------------------------------------------------- not memoised
 *
 * Neither payload is, and that is ARCHITECTURE.md §6 convention 4 applied rather than skipped: the
 * key space is every 1-to-4 subset of 881 drivers, which is not a cache, it is a leak. The two
 * things that *are* global and small — the teammate graph and the season-completeness map — are
 * memoised inside the query layer where both routes share one copy. `Cache-Control` covers the
 * repeat visit, which is the case that recurs.
 */

const CACHE_CONTROL = `public, max-age=${String(Math.floor(SEASON_CACHE_TTL_MS / 1000))}`;

/** Parse `?e=`, or throw the 400. One function, so the two lenses cannot drift. */
function requireRefs(c: Context): string[] {
  const parsed = compareRefsParamSchema.safeParse(c.req.query('e'));
  if (!parsed.success) throw apiError('INVALID_PARAM');
  return parsed.data;
}

/** Parse `?kind=`, or throw the 400. Absent is `driver`; anything else is refused. */
function requireDriverKind(c: Context): void {
  if (!compareKindParamSchema.safeParse(c.req.query('kind')).success) {
    throw apiError('INVALID_PARAM');
  }
}

/**
 * The outbound gate. A payload that fails its own schema is a **500**, not something the client is
 * asked to render: half-rendering a drifted payload is how a wrong number reaches a reader. The
 * issue list is logged and never returned (S-6).
 */
function send<T>(c: Context, schema: ZodType<T>, payload: unknown, route: string): Response {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    console.error(`[api] ${route} response failed its own schema:`, parsed.error.issues);
    throw apiError('INTERNAL');
  }
  c.header('Cache-Control', CACHE_CONTROL);
  return c.json(parsed.data);
}

export const compareRoutes = new Hono();

/* Registered before `/compare` only for readability — two segments and one cannot collide. */
compareRoutes.get('/compare/seasons', (c) => {
  const seasons = readCompareSeasons(requireRefs(c));
  if (seasons === null) throw apiError('NOT_FOUND');
  return send(c, compareSeasonsSchema, seasons, '/api/compare/seasons');
});

compareRoutes.get('/compare', (c) => {
  requireDriverKind(c);
  const data = readCompare(requireRefs(c));
  if (data === null) throw apiError('NOT_FOUND');
  return send(c, compareDataSchema, data, '/api/compare');
});
