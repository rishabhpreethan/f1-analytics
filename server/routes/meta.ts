import { Hono } from 'hono';
import { memoize } from '../cache/memo';
import { META_CACHE_TTL_MS } from '../config';
import { apiError } from '../errors';
import { readMeta } from '../queries/meta';
import { metaSchema } from '../schemas/meta';

/**
 * Thin by design (ARCHITECTURE.md §3): validate, call one named query, return.
 *
 * Only `GET` is registered, so any other method falls through to the 404 handler.
 * There is no mutation route anywhere in this application (DL-1).
 *
 * Zod is the **outbound** gate: the payload is parsed before it is sent, so a query
 * that drifts from the contract is a server-side 500 rather than something the client
 * has to render. The issue list is logged and never returned (S-6).
 */

const CACHE_CONTROL = `public, max-age=${String(Math.floor(META_CACHE_TTL_MS / 1000))}`;

export const metaRoutes = new Hono();

// No parameters. A query string is ignored rather than rejected.
metaRoutes.get('/meta', (c) => {
  const payload = memoize('meta', META_CACHE_TTL_MS, readMeta);

  const parsed = metaSchema.safeParse(payload);
  if (!parsed.success) {
    console.error('[api] /api/meta response failed its own schema:', parsed.error.issues);
    throw apiError('INTERNAL');
  }

  c.header('Cache-Control', CACHE_CONTROL);
  return c.json(parsed.data);
});
