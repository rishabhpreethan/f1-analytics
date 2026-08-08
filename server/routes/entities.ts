import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ZodType } from 'zod';
import { SEASON_CACHE_TTL_MS } from '../config';
import { apiError } from '../errors';
import { readCircuit } from '../queries/circuits';
import { readDriver } from '../queries/drivers';
import { readTeam } from '../queries/teams';
import { circuitSchema } from '../schemas/circuit';
import { driverSchema } from '../schemas/driver';
import { referenceParamSchema } from '../schemas/entity';
import { teamSchema } from '../schemas/team';

/**
 * `GET /api/drivers/:reference`, `/api/teams/:reference`, `/api/circuits/:reference`.
 *
 * One module for the three because they are the same handler three times — validate one
 * parameter, call one named query, validate the payload, return — and splitting them
 * would mean three copies of `requireReference` drifting apart, which is exactly how one
 * endpoint ends up accepting something its neighbour rejects.
 *
 * Thin by design (ARCHITECTURE.md §3): there is no branch in this file that computes
 * anything about Formula 1. **Only `GET` is registered**, so every other method falls
 * through to the 404 handler.
 *
 * ------------------------------------------------------------------------- S-4 and S-6
 *
 * `:reference` is parsed by `referenceParamSchema` before it reaches a statement —
 * `^[A-Za-z0-9_-]{1,32}$`, an allowlist, **rejected rather than coerced**. The character
 * class is measured against all 1,173 references in the database and is deliberately not
 * lowercase-only: three driver slugs carry a capital (`scott_Brown`, `Changy`, `Cannoc`)
 * and would 400 under the pattern that reads as obviously right (`schemas/entity.ts`).
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
 * No `limit`, `sort`, `filter` or range parameter exists on this surface, so there is
 * nothing to allowlist and nothing unbounded to bound. **No query behind these three
 * routes reads `lap` or `pit_stop` at all.** Each `:reference` selects exactly one entity
 * and the largest result set any of them can produce is fixed by the archive: 438 races
 * for the deepest driver career, 2,500 entries for Ferrari, 1,732 for Monza. The query
 * modules carry the measurements and their tests assert the plans.
 *
 * ---------------------------------------------------------------------- not memoised
 *
 * Following ARCHITECTURE.md §6 convention 4: in-process memoisation is for payloads that
 * are global, small and requested on every navigation. These are none of those — the key
 * space is 881 drivers, 214 teams and 78 circuits. `Cache-Control` covers the repeat
 * visit, which is the case that recurs. The one thing that *is* memoised is the 77-entry
 * season-completeness map they share (`queries/seasons.ts`).
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
