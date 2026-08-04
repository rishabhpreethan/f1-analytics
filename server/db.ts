import Database from 'better-sqlite3';
import { DB_PATH } from './config';
import { CANONICAL_VIEWS } from './views';

/**
 * The single read-only SQLite connection.
 *
 * DL-1 / S-3: the connection is opened `readonly: true` and, once the two canonical
 * temp views exist, latches `PRAGMA query_only = 1`. From that point the process
 * cannot write data and cannot create another database object of any kind.
 *
 * S-6: no `better-sqlite3` error is ever allowed to escape this module, because its
 * message carries the absolute path of the database file. Every failure is mapped to
 * a `DatabaseUnavailableError` whose message is a fixed string.
 */

export type DatabaseUnavailableReason = 'missing' | 'unreadable' | 'schema';

const REASON_MESSAGE: Record<DatabaseUnavailableReason, string> = {
  missing: 'The database file was not found.',
  unreadable: 'The database could not be opened.',
  schema: 'The database does not contain the expected tables.',
};

export class DatabaseUnavailableError extends Error {
  constructor(
    readonly reason: DatabaseUnavailableReason,
    cause?: unknown,
  ) {
    super(REASON_MESSAGE[reason], { cause });
    this.name = 'DatabaseUnavailableError';
  }
}

/** Narrow an unknown throwable to its SQLite result code, if it has one. */
function sqliteCode(err: unknown): string {
  if (err !== null && typeof err === 'object' && 'code' in err) {
    const { code } = err;
    if (typeof code === 'string') return code;
  }
  return '';
}

function classifyOpenFailure(err: unknown): DatabaseUnavailableReason {
  const code = sqliteCode(err);
  if (code === 'SQLITE_CANTOPEN') return 'missing';
  return 'unreadable';
}

function classifyBootstrapFailure(err: unknown): DatabaseUnavailableReason {
  // A readonly-directory failure can surface here rather than at open, because
  // SQLite creates its WAL sidecars lazily (ARCHITECTURE.md §10 #12).
  return sqliteCode(err).startsWith('SQLITE_READONLY') ? 'unreadable' : 'schema';
}

/**
 * Opens a read-only connection at `dbPath`, creates the canonical temp views and
 * latches `query_only`. Exported so a test can exercise the failure paths against a
 * path other than the process-wide `DB_PATH`; application code calls `getDb()`.
 *
 * @throws DatabaseUnavailableError — always this type, never a driver error.
 */
export function openDatabaseAt(dbPath: string): Database.Database {
  let db: Database.Database;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch (err) {
    throw new DatabaseUnavailableError(classifyOpenFailure(err), err);
  }

  try {
    for (const ddl of CANONICAL_VIEWS) db.exec(ddl);
    // Readiness sentinel: resolves the whole join path, so a file with the wrong
    // schema fails here rather than on the first real request.
    db.prepare('SELECT 1 FROM v_race LIMIT 1').get();
    db.pragma('query_only = 1');
  } catch (err) {
    const reason = classifyBootstrapFailure(err);
    db.close();
    throw new DatabaseUnavailableError(reason, err);
  }

  return db;
}

let handle: Database.Database | null = null;

/** Lazily opens the single readonly connection. Idempotent. */
export function getDb(): Database.Database {
  handle ??= openDatabaseAt(DB_PATH);
  return handle;
}

/** Startup readiness probe. Returns null when ready, else the reason. Never throws. */
export function probeDatabase(): DatabaseUnavailableError | null {
  try {
    getDb();
    return null;
  } catch (err) {
    if (err instanceof DatabaseUnavailableError) return err;
    return new DatabaseUnavailableError('unreadable', err);
  }
}

/** Test-only: drop the cached handle. */
export function __resetDb(): void {
  handle?.close();
  handle = null;
}
