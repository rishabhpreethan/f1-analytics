import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ZodType } from 'zod';
import { memoize } from '../cache/memo';
import { SEASON_CACHE_TTL_MS } from '../config';
import { apiError } from '../errors';
import { readSeason, readSeasonList, readStandingsProgression } from '../queries/seasons';
import {
  seasonListSchema,
  seasonSchema,
  standingsProgressionSchema,
  yearParamSchema,
} from '../schemas/season';

/**
 * `GET /api/seasons`, `/api/seasons/:year`, `/api/seasons/:year/standings`.
 *
 * Thin by design (ARCHITECTURE.md §3): validate the parameter, call one named query,
 * validate the payload against its own schema, return. There is no branch in this file
 * that computes anything about Formula 1.
 *
 * **Only `GET` is registered**, so every other method falls through to the 404 handler.
 * There is no mutation route anywhere in this application (DL-1).
 *
 * ------------------------------------------------------------------------- S-4 and S-6
 *
 * `:year` is the first real route parameter in this product, which is where S-4 stops
 * being vacuous. It is parsed by `yearParamSchema` — a four-digit regex, then a parse —
 * and **rejected rather than coerced**: `''`, `'0x7c6'`, `' 1990 '` and `'1990.0'` all
 * produce a 400, where `z.coerce.number()` would have turned every one of them into a
 * successful request for a different URL.
 *
 * The two failure modes are deliberately different responses, because they are different
 * facts: a malformed year is **400**, and a well-formed year the dataset does not hold —
 * 2027, 1949 — is **404**. Collapsing them would tell a reader who typed 2027 that they
 * made a syntax error.
 *
 * Nothing here interpolates a request value into a message. Every body comes from
 * `ERROR_MESSAGES`, so no branch can emit a year, a stack frame, SQL text or a path
 * (S-6).
 *
 * ------------------------------------------------------------------------------ S-10
 *
 * There is no `limit`, `sort` or `filter` parameter on this surface, so there is nothing
 * to allowlist and nothing unbounded to bound. Every query is scoped to one season by a
 * value already constrained to 1950–2100, and the only `lap` access in the query layer is
 * a short-circuiting `EXISTS` through one round's session entries.
 */

const CACHE_CONTROL = `public, max-age=${String(Math.floor(SEASON_CACHE_TTL_MS / 1000))}`;

/**
 * Parse `:year`, or throw the 400.
 *
 * A function rather than three inline blocks so the two handlers cannot drift into
 * disagreeing about what a valid year is — which is precisely how one endpoint ends up
 * accepting something its neighbour rejects.
 */
function requireYear(c: Context): number {
  const parsed = yearParamSchema.safeParse(c.req.param('year'));
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

export const seasonRoutes = new Hono();

// Registered before `/seasons/:year` so the static segment is unambiguous regardless of
// the router Hono selects at runtime.
seasonRoutes.get('/seasons', (c) =>
  send(
    c,
    seasonListSchema,
    memoize('seasons', SEASON_CACHE_TTL_MS, readSeasonList),
    '/api/seasons',
  ),
);

seasonRoutes.get('/seasons/:year', (c) => {
  const season = readSeason(requireYear(c));
  if (season === null) throw apiError('NOT_FOUND');
  return send(c, seasonSchema, season, '/api/seasons/:year');
});

seasonRoutes.get('/seasons/:year/standings', (c) => {
  const progression = readStandingsProgression(requireYear(c));
  if (progression === null) throw apiError('NOT_FOUND');
  return send(c, standingsProgressionSchema, progression, '/api/seasons/:year/standings');
});
