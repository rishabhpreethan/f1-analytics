import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Configuration. Everything here is read from `process.env` **once, at module load**
 * — never per request (S-2). `F1_DB_PATH` is operator configuration and can never
 * originate in an HTTP request.
 *
 * There are no secrets in this application (S-5): it reads one local SQLite file and
 * makes no third-party network call.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PORT = Number(process.env.PORT ?? 8787);

/** Absolute path to the database. Resolved once; never derived from a request. */
export const DB_PATH = path.resolve(process.env.F1_DB_PATH ?? path.join(REPO_ROOT, 'data/f1.db'));

/** Static root for production serving. A fixed path, never user-supplied (S-2). */
export const DIST_DIR = path.join(REPO_ROOT, 'dist');

export const RATE_LIMIT = {
  windowMs: 60_000,
  max: 120,
  maxTrackedClients: 10_000,
} as const;

export const META_CACHE_TTL_MS = 300_000;

/**
 * How long a season response may be treated as fresh by a client cache.
 *
 * An hour rather than `/api/meta`'s five minutes because the two age differently: meta
 * carries the data-vintage indicator, which is the one thing that should refresh soon
 * after a database refresh, while a completed season's calendar and standings are
 * immutable and 1950's have been for 76 years.
 *
 * **Only `GET /api/seasons` is memoised in-process; the per-year payloads are not**, and
 * that is measured rather than assumed. Warm, `/api/seasons/2026` reads in 2.5 ms and the
 * heaviest progression (1953, 671 snapshot rows) in 4.1 ms, against a 50 ms p95 budget —
 * so a server-side cache buys ~4 ms and costs up to ~15 MB of retained JSON across the
 * bounded key space (`yearParamSchema` admits 151 years × 2 endpoints). The list is
 * memoised because it is 8 KB, immutable, and fetched by every navigation.
 */
export const SEASON_CACHE_TTL_MS = 3_600_000;

export const IS_TEST = process.env.NODE_ENV === 'test';

/**
 * Production serves the built client and the API from one origin (`npm run start`).
 * Development serves the client from Vite and proxies `/api`, which is the same origin
 * as far as the browser is concerned — so same-origin holds in both.
 */
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
