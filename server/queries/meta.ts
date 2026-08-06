import type { Database, Statement } from 'better-sqlite3';
import { COVERAGE } from '../coverage';
import { DatabaseUnavailableError, getDb } from '../db';
import type { Meta, RoundRef } from '../schemas/meta';

/**
 * ALL SQL for `/api/meta` (ARCHITECTURE.md §3). Every statement is parameterised or
 * constant; nothing is composed from a request value.
 *
 * Traps handled, and why each filter is here:
 *   12 + 15 — `is_cancelled = 0 AND r.number IS NOT NULL`. Cancelled rounds carry a
 *             NULL `number`, and SQLite sorts NULL first, so a bare ORDER BY would put
 *             them at the top and they are not addressable by round number.
 *   13      — "completed" is the existence of `session_entry` rows, never a comparison
 *             of a date against today (REQUIREMENTS.md §2.2).
 *    1      — `session.has_time_data` is never read. This endpoint asks about results,
 *             so it tests for entry rows.
 *   11      — only `circuit.reference` leaves the query. No integer id is selected.
 *    7      — nothing here touches `lap`.
 */

const SQL_SEASON_RANGE = `
SELECT min(year) AS firstYear, max(year) AS latestYear, count(*) AS seasonCount
FROM season`;

const SQL_LATEST_COMPLETED_ROUND = `
SELECT s.year        AS year,
       r.number      AS roundNumber,
       r.name        AS roundName,
       r.date        AS roundDate,
       c.reference   AS circuitRef,
       c.name        AS circuitName
FROM round r
JOIN season  s   ON s.id  = r.season_id
JOIN session ses ON ses.round_id = r.id AND ses.type = 'R'
LEFT JOIN circuit c ON c.id = r.circuit_id
WHERE r.is_cancelled = 0
  AND r.number IS NOT NULL
  AND EXISTS (SELECT 1 FROM session_entry se WHERE se.session_id = ses.id)
ORDER BY s.year DESC, r.number DESC
LIMIT 1`;

const SQL_NEXT_SCHEDULED_ROUND = `
SELECT s.year        AS year,
       r.number      AS roundNumber,
       r.name        AS roundName,
       r.date        AS roundDate,
       c.reference   AS circuitRef,
       c.name        AS circuitName
FROM round r
JOIN season  s   ON s.id  = r.season_id
JOIN session ses ON ses.round_id = r.id AND ses.type = 'R'
LEFT JOIN circuit c ON c.id = r.circuit_id
WHERE r.is_cancelled = 0
  AND r.number IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM session_entry se WHERE se.session_id = ses.id)
ORDER BY s.year ASC, r.number ASC
LIMIT 1`;

/**
 * `sum(CASE …)` rather than `count(…) FILTER (…)`, so the SQL carries no assumption
 * about the SQLite version bundled with the driver. Bounded to one season.
 */
const SQL_LATEST_SEASON_PROGRESS = `
SELECT s.year AS year,
  sum(CASE WHEN r.is_cancelled = 0 THEN 1 ELSE 0 END) AS scheduledRounds,
  sum(CASE WHEN r.is_cancelled = 1 THEN 1 ELSE 0 END) AS cancelledRounds,
  sum(CASE WHEN r.is_cancelled = 0 AND EXISTS (
        SELECT 1 FROM session ses
        JOIN session_entry se ON se.session_id = ses.id
        WHERE ses.round_id = r.id AND ses.type = 'R'
      ) THEN 1 ELSE 0 END) AS completedRounds
FROM round r
JOIN season s ON s.id = r.season_id
WHERE s.year = (SELECT max(year) FROM season)
GROUP BY s.year`;

/**
 * Lazily prepares a statement and keeps it for the life of the connection, so the
 * warm path is a prepared-statement execution. Re-prepares if the handle is replaced
 * (only happens in tests, via `__resetDb`).
 */
function prepared(sql: string): () => Statement {
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

export const Q_SEASON_RANGE = prepared(SQL_SEASON_RANGE);
export const Q_LATEST_COMPLETED_ROUND = prepared(SQL_LATEST_COMPLETED_ROUND);
export const Q_NEXT_SCHEDULED_ROUND = prepared(SQL_NEXT_SCHEDULED_ROUND);
export const Q_LATEST_SEASON_PROGRESS = prepared(SQL_LATEST_SEASON_PROGRESS);

interface SeasonRangeRow {
  firstYear: number | null;
  latestYear: number | null;
  seasonCount: number;
}

interface RoundRow {
  year: number;
  roundNumber: number;
  roundName: string;
  roundDate: string;
  circuitRef: string | null;
  circuitName: string | null;
}

interface ProgressRow {
  year: number;
  scheduledRounds: number;
  cancelledRounds: number;
  completedRounds: number;
}

function toRoundRef(row: RoundRow | undefined): RoundRef | null {
  if (row === undefined) return null;
  return {
    year: row.year,
    round: row.roundNumber,
    roundName: row.roundName,
    date: row.roundDate,
    circuitRef: row.circuitRef,
    circuitName: row.circuitName,
  };
}

export function readSeasonRange(): Meta['seasons'] {
  const row = Q_SEASON_RANGE().get() as SeasonRangeRow | undefined;
  // E5 — an aggregate always returns a row, but an empty `season` table makes every
  // column NULL. That is a database without the expected content, not an empty result.
  if (row === undefined || row.firstYear === null || row.latestYear === null) {
    throw new DatabaseUnavailableError('schema');
  }
  return { firstYear: row.firstYear, latestYear: row.latestYear, count: row.seasonCount };
}

export function readLatestCompletedRound(): RoundRef | null {
  return toRoundRef(Q_LATEST_COMPLETED_ROUND().get() as RoundRow | undefined);
}

export function readNextScheduledRound(): RoundRef | null {
  return toRoundRef(Q_NEXT_SCHEDULED_ROUND().get() as RoundRow | undefined);
}

export function readLatestSeasonProgress(latestYear: number): Meta['latestSeason'] {
  const row = Q_LATEST_SEASON_PROGRESS().get() as ProgressRow | undefined;
  const scheduledRounds = row?.scheduledRounds ?? 0;
  const completedRounds = row?.completedRounds ?? 0;
  return {
    year: row?.year ?? latestYear,
    scheduledRounds,
    completedRounds,
    cancelledRounds: row?.cancelledRounds ?? 0,
    // E7. Guarded on `scheduledRounds > 0` so a season with no rounds at all is not
    // reported as complete — 0 of 0 is "not started", not "finished".
    isComplete: scheduledRounds > 0 && completedRounds === scheduledRounds,
  };
}

/** The whole `/api/meta` payload. The route handler adds no logic of its own. */
export function readMeta(): Meta {
  const seasons = readSeasonRange();
  return {
    seasons,
    latestSeason: readLatestSeasonProgress(seasons.latestYear),
    latestCompletedRound: readLatestCompletedRound(),
    nextScheduledRound: readNextScheduledRound(),
    coverage: COVERAGE,
  };
}
