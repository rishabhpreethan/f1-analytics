import type { Database, Statement } from 'better-sqlite3';
import { getDb } from '../db';

/**
 * Lazily prepares a statement and keeps it for the life of the connection, so the warm
 * path is a prepared-statement execution rather than a parse.
 *
 * Lazy on purpose: preparing at module load would open the database as a side effect of
 * an `import`, which would make every query module unimportable on a fresh clone and
 * would turn the missing-database case into a crash instead of the designed 503.
 *
 * It re-prepares if the handle is replaced, which happens only in tests via `__resetDb`.
 *
 * Extracted from `queries/meta.ts` when the season queries landed — the alternative was a
 * second copy of the handle-identity check, and the identity check is the subtle part.
 */
export function prepared(sql: string): () => Statement {
  let statement: Statement | null = null;
  let owner: Database | null = null;
  return () => {
    const db = getDb();
    if (statement === null || owner !== db) {
      statement = db.prepare(sql);
      owner = db;
    }
    return statement;
  };
}
