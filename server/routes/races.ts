import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ZodType } from 'zod';
import { SEASON_CACHE_TTL_MS } from '../config';
import { apiError } from '../errors';
import { readRace, readRaceLaps, readRaceStints } from '../queries/race';
import { raceLapsSchema, raceSchema, raceStintsSchema, roundParamSchema } from '../schemas/race';
import { yearParamSchema } from '../schemas/season';

/**
 * `GET /api/seasons/:year/races/:round` and its two lap-scale companions.
 *
 * Thin by design (ARCHITECTURE.md §3): validate both parameters, call one named query,
 * validate the payload against its own schema, return. There is no branch in this file
 * that computes anything about Formula 1 — the reduced-page decision, the stint
 * derivation and the pace summary are all in the query layer, where they are pure and
 * tested without a server.
 *
 * **Only `GET` is registered**, so every other method falls through to the 404 handler.
 *
 * ---------------------------------------------------------------------- the three paths
 *
 * The path is `/api/seasons/:year/races/:round`, matching ARCHITECTURE.md §6's API
 * surface and the client route `/seasons/:year/races/:round`. `DESIGN_SYSTEM.md` §6.6.1
 * calls it `/api/races/:year/:round`; that reference is stale and the hierarchical form
 * is the one §6 has specified since F0 — a race is addressed *within* a season, exactly
 * as the two shipped season endpoints are.
 *
 * ------------------------------------------------------------------------ S-4 and S-6
 *
 * **Two parameters now, and both are parsed as the strings they arrived as** (S-4:
 * reject, do not coerce). `:year` reuses `yearParamSchema`; `:round` is
 * `roundParamSchema`, `/^[1-9][0-9]?$/` then a parse — deliberately not `/^\d{1,2}$/`,
 * which would make `01` a second spelling of round 1 and `0` a round that cannot exist.
 * `z.coerce.number()` would additionally accept `''`, `' 1 '`, `'1.0'` and `'0x1'`.
 *
 * The two failure modes stay different responses: a malformed parameter is **400**, and a
 * well-formed one the dataset does not hold — round 40, year 2027 — is **404**. Both
 * parameters' ranges are therefore the *format's* (1950–2100, 1–50) and not the data's.
 *
 * Nothing here interpolates a request value into a message. Every body comes from
 * `ERROR_MESSAGES`, so no branch can emit a year, a round, a stack frame, SQL text or a
 * path (S-6).
 *
 * ------------------------------------------------------------------------------- S-10
 *
 * There is no `limit`, `sort`, `filter`, `drivers` or `fromLap` parameter on this
 * surface, so there is nothing to allowlist and nothing unbounded to bound. Both
 * parameters are constrained integers, and the pair addresses at most one race session —
 * whose largest lap result set in the archive is 1,649 rows. `queries/race.ts` carries
 * the measurements and `queries/race.test.ts` asserts the bound and the query plan.
 *
 * -------------------------------------------------------------------- not memoised
 *
 * None of the three is memoised, following ARCHITECTURE.md §6 convention 4: in-process
 * memoisation is for payloads that are global, small and requested on every navigation.
 * These are none of those — the key space is every race in 77 seasons, and the lap
 * payload is the largest in the product. `Cache-Control` covers the repeat visit, which
 * is the case that actually recurs.
 */

const CACHE_CONTROL = `public, max-age=${String(Math.floor(SEASON_CACHE_TTL_MS / 1000))}`;

/**
 * Parse both parameters, or throw the 400.
 *
 * One function rather than three inline blocks, so the handlers cannot drift into
 * disagreeing about what a valid round is — which is exactly how one endpoint ends up
 * accepting something its neighbour rejects.
 */
function requireRaceRef(c: Context): { year: number; round: number } {
  const year = yearParamSchema.safeParse(c.req.param('year'));
  const round = roundParamSchema.safeParse(c.req.param('round'));
  if (!year.success || !round.success) throw apiError('INVALID_PARAM');
  return { year: year.data, round: round.data };
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

export const raceRoutes = new Hono();

raceRoutes.get('/seasons/:year/races/:round', (c) => {
  const { year, round } = requireRaceRef(c);
  const race = readRace(year, round);
  if (race === null) throw apiError('NOT_FOUND');
  return send(c, raceSchema, race, '/api/seasons/:year/races/:round');
});

/**
 * The lap traces. A round that exists with no lap rows answers with an **empty payload,
 * not a 404**: "does this race have lap data" has the answer "no", which is a designed
 * state (`DESIGN_SYSTEM.md` §6.5.3) and not a missing resource. A well-behaved client
 * never asks — the spine's `availability.hasLapData` says so first — but the endpoint
 * still has to be honest when it does.
 */
raceRoutes.get('/seasons/:year/races/:round/laps', (c) => {
  const { year, round } = requireRaceRef(c);
  const laps = readRaceLaps(year, round);
  if (laps === null) throw apiError('NOT_FOUND');
  return send(c, raceLapsSchema, laps, '/api/seasons/:year/races/:round/laps');
});

raceRoutes.get('/seasons/:year/races/:round/stints', (c) => {
  const { year, round } = requireRaceRef(c);
  const stints = readRaceStints(year, round);
  if (stints === null) throw apiError('NOT_FOUND');
  return send(c, raceStintsSchema, stints, '/api/seasons/:year/races/:round/stints');
});
