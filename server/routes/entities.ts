import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ZodType } from 'zod';
import { SEASON_CACHE_TTL_MS } from '../config';
import { apiError } from '../errors';
import { readCircuit } from '../queries/circuits';
import { readCircuitIndex, readDriverIndex, readTeamIndex } from '../queries/directory';
import { readDriver } from '../queries/drivers';
import { readTeam } from '../queries/teams';
import { circuitSchema } from '../schemas/circuit';
import { circuitListSchema, driverListSchema, teamListSchema } from '../schemas/directory';
import { driverSchema } from '../schemas/driver';
import { referenceParamSchema } from '../schemas/entity';
import { teamSchema } from '../schemas/team';

/**
 * The six entity routes: an **index** and a **profile** for each of drivers, teams and
 * circuits.
 *
 *   GET /api/drivers              GET /api/drivers/:reference
 *   GET /api/teams                GET /api/teams/:reference
 *   GET /api/circuits             GET /api/circuits/:reference
 *
 * One module for all six because they are two handlers three times — and splitting them
 * would mean copies of `requireReference` and `send` drifting apart, which is exactly how
 * one endpoint ends up accepting something its neighbour rejects.
 *
 * Thin by design (ARCHITECTURE.md §3): there is no branch in this file that computes
 * anything about Formula 1. **Only `GET` is registered**, so every other method falls
 * through to the 404 handler.
 *
 * An index and its profiles cannot collide in the router: `/drivers` is one path segment
 * and `/drivers/:reference` is two.
 *
 * ------------------------------------------------------------------------- S-4 and S-6
 *
 * **The three index routes take no input at all** — no path parameter, no query
 * parameter, no header that reaches a statement. There is nothing to validate because
 * there is nothing a request can say, which is a stronger position than a validated
 * parameter and is why they are deliberately kept that way (see "no sort parameter"
 * below). A query string sent to them is ignored rather than interpreted.
 *
 * On the profile routes, `:reference` is parsed by `referenceParamSchema` before it
 * reaches a statement — `^[A-Za-z0-9_-]{1,32}$`, an allowlist, **rejected rather than
 * coerced**. The character class is measured against all 1,173 references in the database
 * and is deliberately not lowercase-only: three driver slugs carry a capital
 * (`scott_Brown`, `Changy`, `Cannoc`) and would 400 under the pattern that reads as
 * obviously right (`schemas/entity.ts`).
 *
 * The two failure modes stay different responses: a malformed reference is **400**, and a
 * well-formed one the dataset does not hold is **404**. The length bound is the format's
 * (32) rather than the data's (20), for the same reason `:year` admits 1950–2100.
 *
 * Nothing here interpolates a request value into a message — every body comes from
 * `ERROR_MESSAGES`, so no branch can emit a slug, a stack frame, SQL text or a path (S-6).
 *
 * ------------------------------------------------------------------------------- S-10
 *
 * No `limit`, `sort`, `filter` or range parameter exists anywhere on this surface, so
 * there is nothing to allowlist and nothing unbounded to bound. **No query behind any of
 * these six routes reads `lap` or `pit_stop` at all.**
 *
 * Each `:reference` selects exactly one entity and the largest result set any profile can
 * produce is fixed by the archive: 438 races for the deepest driver career, 2,500 entries
 * for Ferrari, 1,732 for Monza. Each index returns the whole of one dimension — 881, 214
 * and 78 rows — and takes no parameter, so **no request can make one larger**; the bound
 * is structural rather than validated. `queries/directory.ts` carries the measurements and
 * its tests assert the plans.
 *
 * ---------------------------------------------------------- memoised, and which are not
 *
 * ARCHITECTURE.md §6 convention 4: in-process memoisation is for payloads that are global,
 * small and requested on every navigation.
 *
 * **The three index payloads are all three of those**, so they are memoised in
 * `queries/directory.ts` — no parameter means a key space of exactly one per endpoint, and
 * the whole retained cost is ~180 KB against 20 ms of aggregation per request.
 *
 * **The three profile payloads are none of them** and are not memoised: the key space is
 * 881 drivers, 214 teams and 78 circuits. `Cache-Control` covers the repeat visit, which
 * is the case that recurs. The other memoised value they share is the 77-entry
 * season-completeness map (`queries/seasons.ts`).
 *
 * ------------------------------------------------------------------- no sort parameter
 *
 * The index routes could have taken `?sort=` and `?nationality=`. They deliberately do
 * not, on measurement rather than principle: the largest payload is **18.7 KB gzipped**,
 * it is immutable between database refreshes, and it is cached for an hour — so the client
 * holds the whole directory and sorts or filters it in memory with no round-trip.
 *
 * A server-side sort would add an allowlist to keep correct, a dimension to the cache key,
 * and a network round-trip per click, and it would still be **wrong**: SQLite compares
 * text with BINARY collation, which sorts `Räikkönen` after `Ryan`. The reader-facing sort
 * needs `Intl.Collator` and therefore belongs in `src/features/entity/selectors.ts`, where
 * it is pure and unit-tested. The order the SQL promises is a stable default, nothing more.
 */

const CACHE_CONTROL = `public, max-age=${String(Math.floor(SEASON_CACHE_TTL_MS / 1000))}`;

/** Parse `:reference`, or throw the 400. One function, so the three cannot drift. */
function requireReference(c: Context): string {
  const parsed = referenceParamSchema.safeParse(c.req.param('reference'));
  if (!parsed.success) throw apiError('INVALID_PARAM');
  return parsed.data;
}

/**
 * The outbound gate. A payload that fails its own schema is a **500**, not something the
 * client is asked to render: half-rendering a drifted payload is how a wrong number
 * reaches a reader. The issue list is logged and never returned (S-6).
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

export const entityRoutes = new Hono();

/*
 * The indexes are registered first only for readability. Hono matches on segment count
 * and literal, so `/drivers` and `/drivers/:reference` cannot shadow each other in either
 * order — `routes/entities.test.ts` asserts both directions rather than trusting it.
 */

entityRoutes.get('/drivers', (c) => send(c, driverListSchema, readDriverIndex(), '/api/drivers'));

entityRoutes.get('/teams', (c) => send(c, teamListSchema, readTeamIndex(), '/api/teams'));

entityRoutes.get('/circuits', (c) =>
  send(c, circuitListSchema, readCircuitIndex(), '/api/circuits'),
);

entityRoutes.get('/drivers/:reference', (c) => {
  const driver = readDriver(requireReference(c));
  if (driver === null) throw apiError('NOT_FOUND');
  return send(c, driverSchema, driver, '/api/drivers/:reference');
});

entityRoutes.get('/teams/:reference', (c) => {
  const team = readTeam(requireReference(c));
  if (team === null) throw apiError('NOT_FOUND');
  return send(c, teamSchema, team, '/api/teams/:reference');
});

entityRoutes.get('/circuits/:reference', (c) => {
  const circuit = readCircuit(requireReference(c));
  if (circuit === null) throw apiError('NOT_FOUND');
  return send(c, circuitSchema, circuit, '/api/circuits/:reference');
});
