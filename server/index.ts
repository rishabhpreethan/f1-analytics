import { existsSync } from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { app } from './app';
import { DB_PATH, DIST_DIR, IS_PRODUCTION, PORT } from './config';
import { type DatabaseUnavailableError, probeDatabase } from './db';
import { notFound } from './errors';

/**
 * Entry point: probe the database once, report clearly, then serve.
 *
 * The server **starts either way**. If it refused to start when the database is
 * absent, the client would get an opaque proxy failure instead of the designed
 * "no database found" state, and a contributor on a fresh clone would be told
 * nothing useful.
 *
 * The absolute path appears in this console output and nowhere else. S-6 governs
 * response bodies, and no HTTP response ever carries a filesystem path.
 *
 * In production this process also serves `dist/`, so the built client and the API
 * share **one origin** — which is what makes same-origin-by-omission (S-11) and
 * `connect-src 'self'` true of the real artefact and not just of the dev proxy.
 */

function startupReport(problem: DatabaseUnavailableError): string {
  const indent = '      ';
  switch (problem.reason) {
    case 'missing':
      return [
        '[api] The database was not found.',
        '',
        `${indent}Expected at: ${DB_PATH}`,
        '',
        `${indent}data/f1.db is not part of this repository and is supplied separately.`,
        `${indent}Place the file at the path above and restart:  npm run dev`,
        '',
        `${indent}To use a different location, set F1_DB_PATH.`,
        '',
      ].join('\n');
    case 'unreadable':
      return [
        '[api] The database could not be opened.',
        '',
        `${indent}Check that ${path.dirname(DB_PATH)} is readable and writable by this`,
        `${indent}process, then restart. SQLite creates its sidecar files in that`,
        `${indent}directory even to read.`,
        '',
      ].join('\n');
    case 'schema':
      return [
        '[api] The database is present but does not contain the expected tables.',
        '',
        `${indent}Found at: ${DB_PATH}`,
        `${indent}Expected the tables described in docs/DATABASE.md §2.`,
        '',
      ].join('\n');
  }
}

const problem = probeDatabase();
if (problem !== null) {
  // Deliberately the message only — never the stack, never the driver's own text.
  console.error(startupReport(problem));
} else {
  console.log(`[api] database ready: ${DB_PATH}`);
}

/** `/api` and everything under it stays JSON, and never falls through to the SPA. */
function isApiPath(requestPath: string): boolean {
  return requestPath === '/api' || requestPath.startsWith('/api/');
}

if (IS_PRODUCTION) {
  const indexHtml = path.join(DIST_DIR, 'index.html');
  if (!existsSync(indexHtml)) {
    console.error(
      [
        '[api] The built client was not found.',
        '',
        `      Expected at: ${indexHtml}`,
        '',
        '      Run:  npm run build',
        '',
      ].join('\n'),
    );
  }

  // The root is a **fixed** constant resolved at module load, never a value from a
  // request (S-2). `serve-static` additionally refuses `..`, `//` and backslashes, so a
  // traversal attempt is rejected before it reaches the filesystem.
  app.use('*', serveStatic({ root: DIST_DIR }));

  // SPA fallback. Every client route is served the same `index.html`, so a deep link
  // resolves on direct entry — and an unknown `/api/...` path stays a JSON 404 (E14)
  // rather than being answered with a page.
  const serveIndex = serveStatic({ root: DIST_DIR, path: '/index.html' });
  app.get('*', async (c, next) => {
    if (isApiPath(c.req.path)) return notFound(c);
    // `serve-static` resolves to nothing when the file is absent — i.e. an unbuilt
    // `dist/`, which the startup check above has already explained on the console.
    return (await serveIndex(c, next)) ?? notFound(c);
  });
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  const origin = `http://localhost:${String(info.port)}`;
  console.log(
    IS_PRODUCTION ? `[api] serving app + API on ${origin}` : `[api] listening on ${origin}`,
  );
});
