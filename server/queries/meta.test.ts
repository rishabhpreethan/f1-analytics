import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { DB_PATH } from '../config';
import { __resetDb, getDb } from '../db';
import { metaSchema } from '../schemas/meta';
import {
  readLatestCompletedRound,
  readLatestSeasonProgress,
  readMeta,
  readNextScheduledRound,
  readSeasonRange,
} from './meta';

const hasDatabase = existsSync(DB_PATH);

describe.skipIf(!hasDatabase)('server/queries/meta', () => {
  afterAll(() => {
    __resetDb();
  });

  it('reports the season range 1950 / 2026 / 77', () => {
    expect(readSeasonRange()).toEqual({ firstYear: 1950, latestYear: 2026, count: 77 });
  });

  it('reports the latest completed round as 2026 R10 at spa', () => {
    expect(readLatestCompletedRound()).toEqual({
      year: 2026,
      round: 10,
      roundName: 'Belgian Grand Prix',
      date: '2026-07-19',
      circuitRef: 'spa',
      circuitName: 'Circuit de Spa-Francorchamps',
    });
  });

  it('reports latest-season progress as 22 scheduled / 2 cancelled / 10 completed', () => {
    expect(readLatestSeasonProgress(2026)).toEqual({
      year: 2026,
      scheduledRounds: 22,
      cancelledRounds: 2,
      completedRounds: 10,
      isComplete: false,
    });
  });

  it('reports the next scheduled round as 2026 R11 at hungaroring', () => {
    expect(readNextScheduledRound()).toEqual({
      year: 2026,
      round: 11,
      roundName: 'Hungarian Grand Prix',
      date: '2026-07-26',
      circuitRef: 'hungaroring',
      circuitName: 'Hungaroring',
    });
  });

  it('exposes no integer id in any returned row (DL-3)', () => {
    const rows = [readLatestCompletedRound(), readNextScheduledRound()];
    for (const row of rows) {
      expect(row).not.toBeNull();
      const keys = Object.keys(row ?? {});
      expect(keys).toEqual(['year', 'round', 'roundName', 'date', 'circuitRef', 'circuitName']);
      for (const key of keys) {
        expect(key).not.toMatch(/(^|_)id$|Id$/);
      }
    }
    const meta = readMeta();
    expect(JSON.stringify(meta)).not.toMatch(/"[a-zA-Z]*[iI]d"\s*:/);
  });

  it('never selects a cancelled round as latest or next', () => {
    // Both cancelled 2026 rounds are unnumbered, so neither can be reached by number.
    const cancelled = getDb()
      .prepare(
        `SELECT r.name AS name, r.date AS date FROM round r
         JOIN season s ON s.id = r.season_id
         WHERE r.is_cancelled = 1`,
      )
      .all() as { name: string; date: string }[];
    expect(cancelled.length).toBeGreaterThan(0);

    const names = new Set(cancelled.map((r) => r.name));
    const dates = new Set(cancelled.map((r) => r.date));
    for (const row of [readLatestCompletedRound(), readNextScheduledRound()]) {
      expect(row).not.toBeNull();
      expect(names.has(row?.roundName ?? '')).toBe(false);
      expect(dates.has(row?.date ?? '')).toBe(false);
    }

    // Trap 15 in both directions — the equivalence that licenses the number filter.
    const counts = getDb()
      .prepare(
        `SELECT (SELECT count(*) FROM round WHERE is_cancelled = 1 AND number IS NOT NULL) AS cancelledButNumbered,
                (SELECT count(*) FROM round WHERE is_cancelled = 0 AND number IS NULL)      AS numberedGap,
                (SELECT count(*) FROM round WHERE is_cancelled IS NULL)                     AS cancelledUnknown`,
      )
      .get() as { cancelledButNumbered: number; numberedGap: number; cancelledUnknown: number };
    expect(counts).toEqual({ cancelledButNumbered: 0, numberedGap: 0, cancelledUnknown: 0 });
  });

  it('produces a payload that satisfies metaSchema', () => {
    const parsed = metaSchema.safeParse(readMeta());
    expect(parsed.success).toBe(true);
  });
});
