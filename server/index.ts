import path from 'node:path';
import { serve } from '@hono/node-server';
import { app } from './app';
import { DB_PATH, PORT } from './config';
import { type DatabaseUnavailableError, probeDatabase } from './db';

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

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[api] listening on http://localhost:${String(info.port)}`);
});
