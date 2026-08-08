import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { DB_PATH } from '../config';
import { __resetDb, getDb } from '../db';
import { circuitSchema } from '../schemas/circuit';
import type { CircuitPoleRow, CircuitResultRow, CircuitRoundRow } from './circuits';
import {
  SQL_CIRCUIT_POLES,
  SQL_CIRCUIT_RESULTS,
  SQL_CIRCUIT_ROUNDS,
  TOP_RECORD_LIMIT,
  buildCircuitRaces,
  buildRecords,
  circuitExists,
  pickPole,
  readCircuit,
} from './circuits';

/* ==================================================================================
 * Pure builders — no database, so these run in CI where `data/f1.db` never exists.
 * ================================================================================== */

function poleRow(overrides: Partial<CircuitPoleRow> & { sessionType: string }): CircuitPoleRow {
  return {
    year: 2024,
    round: 1,
    driverRef: 'driver',
    code: null,
    forename: 'A',
    surname: 'Driver',
    ...overrides,
  };
}

describe('pickPole — the pole is the P1 of the highest segment the round ran', () => {
  it('prefers Q3 over Q2 over Q1', () => {
    const rows = [
      poleRow({ sessionType: 'Q1', driverRef: 'sainz' }),
      poleRow({ sessionType: 'Q2', driverRef: 'leclerc' }),
      poleRow({ sessionType: 'Q3', driverRef: 'max_verstappen' }),
    ];
    expect(pickPole(rows)?.session).toBe('Q3');
    expect(pickPole(rows)?.rows.map((row) => row.driverRef)).toEqual(['max_verstappen']);
  });

  it('falls to the single-classification formats when there is no knockout', () => {
    expect(pickPole([poleRow({ sessionType: 'QB' })])?.session).toBe('QB');
    expect(pickPole([poleRow({ sessionType: 'QA' })])?.session).toBe('QA');
  });

  it('is null when the round holds no qualifying classification', () => {
    expect(pickPole([])).toBeNull();
  });

  /**
   * A list rather than a row, because `position` is not a unique key within a session
   * anywhere in this schema (trap 16). No shared pole has been observed; the shape is
   * defensive about the schema rather than about a known case.
   */
  it('returns every P1 of the chosen segment', () => {
    const shared = [
      poleRow({ sessionType: 'QB', driverRef: 'a' }),
      poleRow({ sessionType: 'QB', driverRef: 'b' }),
    ];
    expect(pickPole(shared)?.rows).toHaveLength(2);
  });
});

function resultRow(
  overrides: Partial<CircuitResultRow> & { round: number; driverRef: string },
): CircuitResultRow {
  return {
    year: 1951,
    code: null,
    forename: 'A',
    surname: overrides.driverRef,
    teamRef: 'alfa',
    teamName: 'Alfa Romeo',
    position: null,
    points: 0,
    status: 11,
    ...overrides,
  };
}

function roundRow(overrides: Partial<CircuitRoundRow> & { round: number }): CircuitRoundRow {
  return {
    year: 1951,
    name: 'French Grand Prix',
    date: '1951-07-01',
    entries: 2,
    hasResults: 1,
    hasLapData: 0,
    hasQualifying: 0,
    ...overrides,
  };
}

describe('buildCircuitRaces — CI-2', () => {
  it('keeps both winners of a shared drive', () => {
    const races = buildCircuitRaces(
      [roundRow({ round: 4 })],
      [
        resultRow({ round: 4, driverRef: 'fangio', position: 1, points: 5, status: 0 }),
        resultRow({ round: 4, driverRef: 'fagioli', position: 1, points: 4, status: 0 }),
      ],
      [],
    );
    expect(races[0]?.winners.map((winner) => winner.driverRef)).toEqual(['fangio', 'fagioli']);
    expect(races[0]?.winners.map((winner) => winner.points)).toEqual([5, 4]);
  });

  /**
   * The distinction the payload exists to make. An empty `poleSitters` with
   * `hasQualifying: false` means the dataset holds no qualifying for the round — which is
   * every race before 1994 and most of 1996–2002 — and must not read as "nobody".
   */
  it('reports no pole sitter and says why when the round has no qualifying', () => {
    const races = buildCircuitRaces([roundRow({ round: 4 })], [], []);
    expect(races[0]?.poleSitters).toEqual([]);
    expect(races[0]?.hasQualifying).toBe(false);
  });

  it('attaches the pole from the highest segment the round ran', () => {
    const races = buildCircuitRaces(
      [roundRow({ year: 2024, round: 1, hasQualifying: 1 })],
      [],
      [
        poleRow({ sessionType: 'Q1', driverRef: 'sainz' }),
        poleRow({ sessionType: 'Q3', driverRef: 'max_verstappen' }),
      ],
    );
    expect(races[0]?.poleSitters).toEqual([
      {
        driverRef: 'max_verstappen',
        code: null,
        forename: 'A',
        surname: 'Driver',
        session: 'Q3',
      },
    ]);
  });

  /** Trap 13: a round with no results is a race not yet run, never missing data. */
  it('returns a future round with no winners and hasResults false', () => {
    const races = buildCircuitRaces(
      [roundRow({ year: 2026, round: 13, hasResults: 0, entries: 0 })],
      [],
      [],
    );
    expect(races[0]?.hasResults).toBe(false);
    expect(races[0]?.entries).toBe(0);
    expect(races[0]?.winners).toEqual([]);
  });

  it('does not leak a winner from another round', () => {
    const races = buildCircuitRaces(
      [roundRow({ round: 4 }), roundRow({ year: 1952, round: 6 })],
      [resultRow({ round: 4, driverRef: 'fangio', position: 1, status: 0 })],
      [],
    );
    expect(races[0]?.winners).toHaveLength(1);
    expect(races[1]?.winners).toHaveLength(0);
  });
});

describe('buildRecords — CI-3, counted over races', () => {
  /**
   * Trap 17 at a venue: 1950 R7 at Monza classifies Ascari twice. A row count gives him
   * two starts at a Grand Prix he entered once.
   */
  it('counts a driver who took over a second car as one start', () => {
    const { topDrivers } = buildRecords([
      resultRow({ year: 1950, round: 7, driverRef: 'ascari', position: 2, status: 0 }),
      resultRow({ year: 1950, round: 7, driverRef: 'ascari', position: 17, status: 11 }),
    ]);
    expect(topDrivers[0]).toMatchObject({
      driverRef: 'ascari',
      starts: 1,
      podiums: 1,
      bestFinish: 2,
    });
  });

  it('credits both drivers of a shared winning car with the win', () => {
    const { topDrivers, topTeams } = buildRecords([
      resultRow({ round: 4, driverRef: 'fangio', position: 1, status: 0 }),
      resultRow({ round: 4, driverRef: 'fagioli', position: 1, status: 0 }),
    ]);
    expect(topDrivers.map((driver) => driver.wins)).toEqual([1, 1]);
    // The constructor entered one race and won it once.
    expect(topTeams[0]).toMatchObject({ races: 1, wins: 1, podiums: 1 });
  });

  it('counts a team 1-2 as two podium places', () => {
    const { topTeams } = buildRecords([
      resultRow({ round: 1, driverRef: 'a', position: 1, status: 0 }),
      resultRow({ round: 1, driverRef: 'b', position: 2, status: 0 }),
    ]);
    expect(topTeams[0]?.podiums).toBe(2);
  });

  it('excludes a did-not-start from starts at the venue', () => {
    const { topDrivers } = buildRecords([
      resultRow({ round: 1, driverRef: 'a', status: 30 }),
      resultRow({ round: 2, driverRef: 'a', position: 5, status: 0 }),
    ]);
    expect(topDrivers[0]?.starts).toBe(1);
  });

  it('orders by wins then podiums then starts, and caps the list', () => {
    const rows = Array.from({ length: TOP_RECORD_LIMIT + 5 }, (_, index) =>
      resultRow({
        round: index + 1,
        driverRef: `d${String(index)}`,
        position: index === 0 ? 1 : 5,
        status: 0,
      }),
    );
    const { topDrivers } = buildRecords(rows);
    expect(topDrivers).toHaveLength(TOP_RECORD_LIMIT);
    expect(topDrivers[0]?.driverRef).toBe('d0');
  });
});

/* ==================================================================================
 * Against the live database. Skipped where `data/f1.db` is absent — CI never has it.
 * ================================================================================== */

const hasDatabase = existsSync(DB_PATH);

describe.skipIf(!hasDatabase)('circuit queries against the live database', () => {
  afterAll(() => {
    __resetDb();
  });

  it('answers 404-shaped for a well-formed reference the data does not hold', () => {
    expect(circuitExists('not_a_circuit')).toBe(false);
    expect(readCircuit('not_a_circuit')).toBeNull();
  });

  /**
   * CI-1. Every coordinate is populated on all 78 circuits — asserted so a refresh that
   * dropped one fails here rather than putting a marker at (0, 0).
   */
  it('every circuit carries a full set of coordinates', () => {
    const row = getDb()
      .prepare(
        `SELECT count(*) AS n FROM circuit
         WHERE latitude IS NULL OR longitude IS NULL OR altitude IS NULL
            OR locality IS NULL OR country IS NULL`,
      )
      .get() as { n: number };
    expect(row.n).toBe(0);
  });

  it('reads Monza`s profile as numbers, not strings', () => {
    const circuit = readCircuit('monza')?.circuit;
    expect(typeof circuit?.latitude).toBe('number');
    expect(typeof circuit?.longitude).toBe('number');
    expect(circuit?.country).toBe('Italy');
  });

  /** The record: Senna won at Monaco six times, Schumacher five. */
  it('names the most successful drivers at Monaco', () => {
    const top = readCircuit('monaco')?.topDrivers ?? [];
    expect(top[0]).toMatchObject({ driverRef: 'senna', wins: 6 });
    expect(top.length).toBeLessThanOrEqual(TOP_RECORD_LIMIT);
  });

  it('lists Monza most recent first, with a scheduled round carrying no results', () => {
    const circuit = readCircuit('monza');
    const years = (circuit?.races ?? []).map((race) => race.year * 1000 + race.round);
    expect(years).toEqual([...years].sort((a, b) => b - a));
    expect(circuit?.roundsHeld).toBeGreaterThanOrEqual(circuit?.racesWithResults ?? 0);
    const scheduled = (circuit?.races ?? []).filter((race) => !race.hasResults);
    for (const race of scheduled) {
      expect(race.winners).toEqual([]);
      expect(race.entries).toBe(0);
    }
  });

  /**
   * The coverage hole, live. Monza has hosted a Grand Prix since 1950 and fewer than half
   * of those races can name a pole sitter.
   */
  it('has no pole sitter for a pre-1994 race and says why', () => {
    const race = (readCircuit('monza')?.races ?? []).find((row) => row.year === 1950);
    expect(race?.hasResults).toBe(true);
    expect(race?.hasQualifying).toBe(false);
    expect(race?.poleSitters).toEqual([]);
  });

  it('names a pole sitter for a modern race', () => {
    const race = (readCircuit('monza')?.races ?? []).find(
      (row) => row.year === 2024 && row.hasQualifying,
    );
    expect(race?.poleSitters.length).toBeGreaterThan(0);
    expect(race?.poleSitters[0]?.session).toBe('Q3');
  });

  it('produces a payload that passes its own schema for a spread of venues', () => {
    for (const ref of ['monza', 'monaco', 'jeddah', 'bahrain', 'silverstone']) {
      const parsed = circuitSchema.safeParse(readCircuit(ref));
      expect(parsed.success, `${ref}: ${JSON.stringify(parsed.error?.issues.slice(0, 3))}`).toBe(
        true,
      );
    }
  });

  /**
   * S-10. The only `lap` access in this module is a short-circuiting `EXISTS` per round;
   * a plan that turned it into a scan of 717,764 rows would still return correct data.
   */
  it('the lap EXISTS reaches idx_lap_entry and never scans the lap table', () => {
    const plan = getDb()
      .prepare(`EXPLAIN QUERY PLAN ${SQL_CIRCUIT_ROUNDS}`)
      .all({ ref: 'monza' }) as { detail: string }[];
    const details = plan.map((step) => step.detail);
    expect(
      details.some((detail) => /SEARCH l USING (COVERING )?INDEX idx_lap_entry/.test(detail)),
    ).toBe(true);
    expect(details.filter((detail) => /SCAN .*\blap\b/.test(detail))).toEqual([]);
  });

  /**
   * Both statements must enter through the venue. The only `SCAN`s allowed are of the
   * **materialized CTEs** — `cr` (76 rounds at Monza) and `ce` (1,732 rows) — which are
   * bounded by their own index-driven build. A scan of a base table would not be, and
   * that is the distinction this asserts rather than "no scans at all".
   */
  it.each([
    ['SQL_CIRCUIT_RESULTS', SQL_CIRCUIT_RESULTS],
    ['SQL_CIRCUIT_POLES', SQL_CIRCUIT_POLES],
  ])('%s plans through the circuit index and scans no base table', (_name, sql) => {
    const plan = getDb().prepare(`EXPLAIN QUERY PLAN ${sql}`).all({ ref: 'monza' }) as {
      detail: string;
    }[];
    const details = plan.map((step) => step.detail);
    expect(
      details.some((detail) => /SEARCH c USING (COVERING )?INDEX idx_circuit_ref/.test(detail)),
    ).toBe(true);
    expect(
      details.some((detail) => /SEARCH r USING (COVERING )?INDEX idx_round_circuit/.test(detail)),
    ).toBe(true);
    const scans = details.filter((detail) => /^SCAN /.test(detail));
    expect(scans.every((detail) => /^SCAN (cr|ce)$/.test(detail))).toBe(true);
  });

  /**
   * The one plan choice that is not obvious from reading the SQL, pinned so a refresh or a
   * SQLite upgrade that changed it fails here. `CROSS JOIN` forces the venue-first order
   * on the results statement; without it the planner walked all 1,173 race sessions.
   */
  it('SQL_CIRCUIT_RESULTS reaches sessions by round, not by session type', () => {
    const details = (
      getDb().prepare(`EXPLAIN QUERY PLAN ${SQL_CIRCUIT_RESULTS}`).all({ ref: 'monza' }) as {
        detail: string;
      }[]
    ).map((step) => step.detail);
    expect(
      details.some((detail) => /SEARCH ses USING (COVERING )?INDEX idx_session_round/.test(detail)),
    ).toBe(true);
    expect(details.some((detail) => /idx_session_type/.test(detail))).toBe(false);
  });
});
