import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DB_PATH } from './config';
import { DatabaseUnavailableError, __resetDb, getDb, openDatabaseAt } from './db';
import { CANONICAL_VIEW_NAMES } from './views';

const hasDatabase = existsSync(DB_PATH);

if (!hasDatabase) {
  console.warn(
    `[test] skipping database-backed tests: no file at ${path.basename(DB_PATH)}. ` +
      'The database is supplied separately; see README.md.',
  );
}

describe.skipIf(!hasDatabase)('server/db', () => {
  afterAll(() => {
    __resetDb();
  });

  it('opens the database read-only and answers a trivial query', () => {
    const row = getDb().prepare('SELECT 1 AS one').get();
    expect(row).toEqual({ one: 1 });
    expect(getDb().readonly).toBe(true);
  });

  it('returns the identical handle on a second call', () => {
    expect(getDb()).toBe(getDb());
  });

  it('creates v_entry and v_race as temp views at bootstrap', () => {
    const names = getDb()
      .prepare(`SELECT name FROM sqlite_temp_master WHERE type = 'view' ORDER BY name`)
      .all() as { name: string }[];
    expect(names.map((r) => r.name)).toEqual([...CANONICAL_VIEW_NAMES].sort());
  });

  it('v_race returns 20 rows for 2024 round 1', () => {
    const row = getDb()
      .prepare('SELECT count(*) AS n FROM v_race WHERE year = ? AND round_number = ?')
      .get(2024, 1) as { n: number };
    expect(row.n).toBe(20);
  });

  it('refuses a write', () => {
    expect(() => getDb().exec('UPDATE season SET year = year + 1')).toThrowError(/readonly/i);
    expect(() => getDb().exec("INSERT INTO season (year, api_id) VALUES (1899, 'x')")).toThrowError(
      /readonly/i,
    );
  });

  it('refuses further DDL after bootstrap, proving query_only is latched', () => {
    expect(() => getDb().exec('CREATE TEMP VIEW v_probe AS SELECT 1 AS one')).toThrowError();
  });
});

describe('server/db failure mapping', () => {
  const missingPath = path.join(path.dirname(DB_PATH), 'does-not-exist-f0.db');

  /**
   * The fresh-clone case, and the one CI runs on every push: `data/` is gitignored and git
   * does not create empty directories, so on a runner the database file is missing *and so
   * is its parent directory*.
   *
   * This is a separate assertion from the one below rather than a variation of it, because
   * `better-sqlite3` distinguishes the two: an absent file throws `SQLITE_CANTOPEN`, an
   * absent parent directory throws a plain `TypeError` with no `code` at all. Classifying on
   * the code alone reported `unreadable` here, which sends a first-time reader to check
   * directory permissions instead of telling them the file is supplied separately.
   */
  it('maps a path whose parent directory is absent to "missing", not "unreadable"', () => {
    const noSuchDir = path.join(path.dirname(DB_PATH), 'no-such-dir-f1', 'f1.db');
    expect(existsSync(path.dirname(noSuchDir))).toBe(false);
    try {
      openDatabaseAt(noSuchDir);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DatabaseUnavailableError);
      expect((err as DatabaseUnavailableError).reason).toBe('missing');
    }
  });

  it('maps a nonexistent path to reason "missing"', () => {
    expect(() => openDatabaseAt(missingPath)).toThrowError(DatabaseUnavailableError);
    try {
      openDatabaseAt(missingPath);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DatabaseUnavailableError);
      expect((err as DatabaseUnavailableError).reason).toBe('missing');
    }
  });

  it('never puts a filesystem path in the error message (S-6)', () => {
    try {
      openDatabaseAt(missingPath);
      expect.unreachable('should have thrown');
    } catch (err) {
      const { message } = err as DatabaseUnavailableError;
      expect(message).not.toContain('/');
      expect(message).not.toContain(path.basename(missingPath));
      expect(message).not.toMatch(/SQLITE_/);
    }
  });
});
