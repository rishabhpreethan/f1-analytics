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

export const IS_TEST = process.env.NODE_ENV === 'test';

/**
 * Production serves the built client and the API from one origin (`npm run start`).
 * Development serves the client from Vite and proxies `/api`, which is the same origin
 * as far as the browser is concerned — so same-origin holds in both.
 */
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
