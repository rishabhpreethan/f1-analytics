import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { DB_PATH } from '../config';
import { __resetDb, getDb } from '../db';
import { raceLapsSchema, raceSchema, raceStintsSchema } from '../schemas/race';
import type { LapQueryRow, LapSpanRow, PitStopRow } from './race';
import {
  buildDriverLaps,
  buildDriverStints,
  buildPaceSummary,
  buildPitDurationSummary,
  buildRaceLaps,
  decodeOutcome,
  deriveStints,
  percentileNearestRank,
  readRace,
  readRaceLaps,
  readRaceStints,
  roundExists,
  toGrid,
  toStartTime,
} from './race';

/* ==================================================================================
 * Pure builders — no database, so these run in CI where `data/f1.db` never exists.
 * The shaping is where a data trap gets violated silently, so it is tested where the
 * runner can see it.
 * ================================================================================== */

describe('toGrid — `grid = 0` is a pit-lane start, not "no grid position" (trap 9)', () => {
  it('maps a real slot through unchanged', () => {
    expect(toGrid(3)).toEqual({ gridPosition: 3, gridStatus: 'grid' });
  });

  it('maps 0 to a pit-lane start with NO position, so 0 never reaches a reader', () => {
    expect(toGrid(0)).toEqual({ gridPosition: null, gridStatus: 'pitLane' });
  });

  /**
   * The distinction the third enum value exists for. A pit-lane start is excluded from
   * "positions gained"; an unknown grid is excluded from the metric entirely. Collapsing
   * them would make one look like the other.
   */
  it('maps null to unknown — NOT to pitLane', () => {
    expect(toGrid(null)).toEqual({ gridPosition: null, gridStatus: 'unknown' });
    expect(toGrid(null).gridStatus).not.toBe('pitLane');
  });

  it('maps the deepest grid in the data (34) through unchanged', () => {
    expect(toGrid(34)).toEqual({ gridPosition: 34, gridStatus: 'grid' });
  });
});

describe('decodeOutcome — DATABASE.md §3, decoded once', () => {
  it.each([
    [0, 'finished'],
    [1, 'lapped'],
    [10, 'accident'],
    [11, 'mechanical'],
    [20, 'disqualified'],
    [30, 'didNotStart'],
    [40, 'didNotQualify'],
  ])('%i decodes to %s', (status, outcome) => {
    expect(decodeOutcome(status)).toBe(outcome);
  });

  /**
   * The honest branch. A refresh that introduces a status code must not be folded into a
   * neighbour — a new retirement reason silently reading as `mechanical` would put wrong
   * numbers in a reliability metric.
   */
  it.each([2, 12, 21, 31, 41, 99, -1])('%i degrades to unknown, never to a neighbour', (status) => {
    expect(decodeOutcome(status)).toBe('unknown');
  });

  it('groups a DNF as accident or mechanical — never as a null position (trap 3)', () => {
    expect([decodeOutcome(10), decodeOutcome(11)]).toEqual(['accident', 'mechanical']);
  });
});

describe('toStartTime — a midnight-UTC timestamp is a placeholder, not a session at midnight', () => {
  it('returns null for the pre-2005 shape, so no surface prints "00:00"', () => {
    expect(toStartTime('1988-04-03 00:00:00+00:00')).toBeNull();
    expect(toStartTime('1950-05-13 00:00:00+00:00')).toBeNull();
  });

  it('passes a real time through — 2026 R1, read from the database', () => {
    expect(toStartTime('2026-03-08 04:00:00+00:00')).toBe('2026-03-08 04:00:00+00:00');
  });

  it('passes a 2026 practice session through — from 2022 every session has a real time', () => {
    expect(toStartTime('2026-03-06 01:30:00+00:00')).toBe('2026-03-06 01:30:00+00:00');
  });

  /**
   * The heuristic's limit, stated as a test rather than left implicit: a session that
   * genuinely began at midnight UTC would be reported as having no known time. None
   * exists in the data (0 of 860 sessions in 2022–2026, where every time is real).
   */
  it('would discard a genuine midnight-UTC start — the known limit', () => {
    expect(toStartTime('2026-03-08 00:00:00+00:00')).toBeNull();
  });
});

describe('percentileNearestRank', () => {
  const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  it('is the nearest-rank method — sorted[floor(p/100 × n)]', () => {
    expect(percentileNearestRank(sorted, 0)).toBe(10);
    expect(percentileNearestRank(sorted, 50)).toBe(60);
    expect(percentileNearestRank(sorted, 90)).toBe(100);
  });

  it('clamps p100 to the last index rather than reading past the end', () => {
    expect(percentileNearestRank(sorted, 100)).toBe(100);
  });

  it('is null on an empty set — never 0, which is a lap time', () => {
    expect(percentileNearestRank([], 50)).toBeNull();
  });

  it('handles a single value', () => {
    expect(percentileNearestRank([82_091], 99)).toBe(82_091);
  });
});

/* ---------------------------------------------------------------------- pace summary */

function lapRow(over: Partial<LapQueryRow> = {}): LapQueryRow {
  return {
    driverRef: 'russell',
    code: 'RUS',
    surname: 'Russell',
    teamRef: 'mercedes',
    grid: 1,
    finishPosition: 1,
    lap: 1,
    position: 1,
    timeMs: 85_000,
    isDeleted: 0,
    ...over,
  };
}

describe('buildPaceSummary — trap 8 lives here, and the fastest lap is a session fact', () => {
  /**
   * The trap, and the reason the filter is in the builder rather than in the SQL: the
   * chart needs to see that a lap existed and was struck (RD-2), so exposure and
   * exclusion are different operations on the same row.
   */
  it('excludes a deleted lap from every figure while it stays in the series', () => {
    const rows = [
      lapRow({ lap: 1, timeMs: 90_000 }),
      lapRow({ lap: 2, timeMs: 80_000, isDeleted: 1 }),
      lapRow({ lap: 3, timeMs: 95_000 }),
    ];
    const pace = buildPaceSummary(rows);

    expect(pace.deletedLaps).toBe(1);
    expect(pace.timedLaps).toBe(2);
    // 80,000 was the quickest lap on the stopwatch and must not be the fastest lap.
    expect(pace.fastest?.timeMs).toBe(90_000);
    expect(pace.slowestMs).toBe(95_000);

    // …and the row is still there for the chart to strike through.
    const [driver] = buildDriverLaps(rows);
    expect(driver?.laps.map((lap) => lap.isDeleted)).toEqual([false, true, false]);
  });

  it('excludes a lap with no recorded time, and does not count it as deleted', () => {
    const pace = buildPaceSummary([
      lapRow({ lap: 1, timeMs: 90_000 }),
      lapRow({ lap: 2, timeMs: null }),
    ]);
    expect(pace.timedLaps).toBe(1);
    expect(pace.deletedLaps).toBe(0);
  });

  it('names the driver and lap of the fastest lap, tie-broken by the earlier lap', () => {
    const pace = buildPaceSummary([
      lapRow({ driverRef: 'a', lap: 7, timeMs: 82_091 }),
      lapRow({ driverRef: 'b', lap: 3, timeMs: 82_091 }),
    ]);
    expect(pace.fastest).toEqual({ timeMs: 82_091, driverRef: 'b', lap: 3 });
  });

  it('is all-null on a race with no timed lap — never 0, which is a lap time', () => {
    expect(buildPaceSummary([])).toEqual({
      timedLaps: 0,
      deletedLaps: 0,
      fastest: null,
      medianMs: null,
      p90Ms: null,
      p99Ms: null,
      slowestMs: null,
    });
  });

  /**
   * The red-flag lap that forced §6.3's clipped axis. It must survive into `slowestMs`
   * intact: it is not bad data, and a summary that discarded it would make the clipping
   * look unnecessary.
   */
  it('keeps a 19-minute red-flag lap as the slowest rather than treating it as an outlier', () => {
    const pace = buildPaceSummary([
      lapRow({ lap: 1, timeMs: 82_091 }),
      lapRow({ lap: 2, timeMs: 1_168_144 }),
    ]);
    expect(pace.slowestMs).toBe(1_168_144);
    expect(pace.fastest?.timeMs).toBe(82_091);
  });
});

/* ------------------------------------------------------------------------ lap traces */

describe('buildDriverLaps', () => {
  it('groups by driver and reports each range as data, not as the array bounds', () => {
    const drivers = buildDriverLaps([
      lapRow({ driverRef: 'a', finishPosition: 1, lap: 1 }),
      lapRow({ driverRef: 'a', finishPosition: 1, lap: 2 }),
      lapRow({ driverRef: 'b', finishPosition: null, grid: 5, lap: 1 }),
    ]);
    expect(drivers.map((d) => d.driverRef)).toEqual(['a', 'b']);
    expect(drivers[0]).toMatchObject({ firstLap: 1, lastLap: 2 });
    expect(drivers[1]).toMatchObject({ firstLap: 1, lastLap: 1 });
  });

  it('orders by finishing position, unclassified last, then by grid', () => {
    const drivers = buildDriverLaps([
      lapRow({ driverRef: 'dnf-late', finishPosition: null, grid: 9, surname: 'Z' }),
      lapRow({ driverRef: 'p2', finishPosition: 2, grid: 4, surname: 'B' }),
      lapRow({ driverRef: 'dnf-early', finishPosition: null, grid: 2, surname: 'A' }),
      lapRow({ driverRef: 'p1', finishPosition: 1, grid: 1, surname: 'C' }),
    ]);
    expect(drivers.map((d) => d.driverRef)).toEqual(['p1', 'p2', 'dnf-early', 'dnf-late']);
  });

  it('carries a null position on a row that exists — 16 race lap rows do', () => {
    const [driver] = buildDriverLaps([
      lapRow({ lap: 5, position: 4 }),
      lapRow({ lap: 6, position: null }),
    ]);
    expect(driver?.laps[1]).toEqual({ lap: 6, position: null, timeMs: 85_000, isDeleted: false });
  });

  it('translates a pit-lane start rather than reporting grid 0', () => {
    const [driver] = buildDriverLaps([lapRow({ grid: 0 })]);
    expect(driver).toMatchObject({ gridPosition: null, gridStatus: 'pitLane' });
  });

  it('carries a null code — 40 drivers with lap data have no abbreviation', () => {
    const [driver] = buildDriverLaps([lapRow({ code: null, surname: 'Häkkinen' })]);
    expect(driver?.code).toBeNull();
    expect(driver?.surname).toBe('Häkkinen');
  });
});

describe('buildRaceLaps — the session lap range', () => {
  it('states the session range from the widest driver span, not from one driver', () => {
    const payload = buildRaceLaps(2026, 1, [
      lapRow({ driverRef: 'winner', finishPosition: 1, lap: 1 }),
      lapRow({ driverRef: 'winner', finishPosition: 1, lap: 58 }),
      lapRow({ driverRef: 'retired', finishPosition: null, lap: 1 }),
      lapRow({ driverRef: 'retired', finishPosition: null, lap: 22 }),
    ]);
    expect(payload.firstLap).toBe(1);
    expect(payload.lastLap).toBe(58);
    expect(payload.drivers.find((d) => d.driverRef === 'retired')?.lastLap).toBe(22);
  });

  it('is null-ranged and empty on a race with no lap rows — the 1988 case', () => {
    const payload = buildRaceLaps(1988, 1, []);
    expect(payload).toMatchObject({ firstLap: null, lastLap: null, lapCount: 0, drivers: [] });
    expect(raceLapsSchema.safeParse(payload).success).toBe(true);
  });
});

/* ----------------------------------------------------------------------- the stints */

describe('deriveStints — DATABASE.md §6.7, in application code', () => {
  it('gives one full-race stint when the driver never pitted', () => {
    expect(deriveStints([], 58)).toEqual([
      { stint: 1, fromLap: 1, toLap: 58, laps: 58, endedByStop: null },
    ]);
  });

  it('makes the in-lap the last lap of the stint it ends, per §6.7', () => {
    expect(deriveStints([20], 58)).toEqual([
      { stint: 1, fromLap: 1, toLap: 20, laps: 20, endedByStop: 1 },
      { stint: 2, fromLap: 21, toLap: 58, laps: 38, endedByStop: null },
    ]);
  });

  it('handles a two-stop race', () => {
    expect(deriveStints([15, 38], 58).map((s) => [s.fromLap, s.toLap, s.laps])).toEqual([
      [1, 15, 15],
      [16, 38, 23],
      [39, 58, 20],
    ]);
  });

  /**
   * 494 race pit stops fall on the lap immediately after another one, so a one-lap stint
   * is a measurement and not an edge case to guard against.
   */
  it('produces a one-lap stint for stops on consecutive laps', () => {
    const stints = deriveStints([3, 4], 58);
    expect(stints[1]).toEqual({ stint: 2, fromLap: 4, toLap: 4, laps: 1, endedByStop: 2 });
  });

  it('handles a stop on lap 1 — the minimum pit lap in the archive', () => {
    expect(deriveStints([1], 58)[0]).toEqual({
      stint: 1,
      fromLap: 1,
      toLap: 1,
      laps: 1,
      endedByStop: 1,
    });
  });

  /**
   * The disqualification case, which is why the final stint closes at the last **lap
   * row** and not at `laps_completed`: 2024 R21 Hülkenberg reads `laps_completed = 0`
   * with a stop on lap 29. Even so, a stop at or past the last lap must not emit an
   * inverted stint.
   */
  it('omits a trailing stint a stop at the last lap would invert', () => {
    expect(deriveStints([29], 29)).toEqual([
      { stint: 1, fromLap: 1, toLap: 29, laps: 29, endedByStop: null },
    ]);
    for (const stint of deriveStints([29, 40], 29)) {
      expect(stint.toLap).toBeGreaterThanOrEqual(stint.fromLap);
      expect(stint.laps).toBeGreaterThan(0);
    }
  });

  it('never emits a stint whose laps count disagrees with its bounds', () => {
    for (const pits of [[], [1], [20], [3, 4], [1, 2, 3], [10, 20, 30, 40], [57]]) {
      for (const stint of deriveStints(pits, 58)) {
        expect(stint.laps).toBe(stint.toLap - stint.fromLap + 1);
        expect(stint.laps).toBeGreaterThan(0);
      }
    }
  });

  it('covers the race contiguously from lap 1 to the last lap', () => {
    const stints = deriveStints([12, 30, 45], 58);
    expect(stints[0]?.fromLap).toBe(1);
    expect(stints[stints.length - 1]?.toLap).toBe(58);
    for (const [index, stint] of stints.entries()) {
      if (index === 0) continue;
      expect(stint.fromLap).toBe((stints[index - 1]?.toLap ?? 0) + 1);
    }
  });
});

describe('buildDriverStints', () => {
  const span = (over: Partial<LapSpanRow> = {}): LapSpanRow => ({
    driverRef: 'russell',
    code: 'RUS',
    surname: 'Russell',
    teamRef: 'mercedes',
    finishPosition: 1,
    grid: 1,
    firstLap: 1,
    lastLap: 58,
    ...over,
  });
  const stop = (over: Partial<PitStopRow> = {}): PitStopRow => ({
    driverRef: 'russell',
    stopNumber: 1,
    lap: 20,
    durationMs: 23_000,
    ...over,
  });

  /**
   * The reason the spans drive this rather than the stops: a stint chart that omitted
   * the driver who ran the whole race without stopping would be missing the most
   * interesting row on it.
   */
  it('includes a driver with no stops, as one full-race stint', () => {
    const [driver] = buildDriverStints([span({ driverRef: 'nostop' })], []);
    expect(driver?.stops).toEqual([]);
    expect(driver?.stints).toHaveLength(1);
  });

  it('orders drivers by finishing position, unclassified last', () => {
    const drivers = buildDriverStints(
      [
        span({ driverRef: 'dnf', finishPosition: null, grid: 7, surname: 'B' }),
        span({ driverRef: 'p1', finishPosition: 1, surname: 'A' }),
      ],
      [],
    );
    expect(drivers.map((d) => d.driverRef)).toEqual(['p1', 'dnf']);
  });

  it('keeps a stop whose duration was not recorded, and excludes it from the statistics', () => {
    const rows = [stop({ durationMs: null }), stop({ stopNumber: 2, lap: 40 })];
    expect(buildPitDurationSummary(rows)).toMatchObject({
      stops: 2,
      timedStops: 1,
      fastestMs: 23_000,
      slowestMs: 23_000,
    });
    const [driver] = buildDriverStints([span()], rows);
    expect(driver?.stops).toHaveLength(2);
  });

  it('derives stints from lap order, so a mis-numbered stop cannot reorder them', () => {
    // `pit_stop.number` disagrees with the lap order on 3 race entries. The rows arrive
    // ordered by lap (the SQL guarantees it) and the derivation uses that order only.
    const [driver] = buildDriverStints(
      [span()],
      [stop({ stopNumber: 2, lap: 15 }), stop({ stopNumber: 1, lap: 38 })],
    );
    expect(driver?.stints.map((s) => [s.fromLap, s.toLap])).toEqual([
      [1, 15],
      [16, 38],
      [39, 58],
    ]);
  });
});

describe('buildPitDurationSummary', () => {
  it('is all-null with zero stops rather than reporting 0 ms', () => {
    expect(buildPitDurationSummary([])).toEqual({
      stops: 0,
      timedStops: 0,
      fastestMs: null,
      medianMs: null,
      p90Ms: null,
      slowestMs: null,
    });
  });

  it('keeps the 18-minute red-flag stop as the slowest — 2026 R1 really ran 17.6s to 1081.6s', () => {
    const rows: PitStopRow[] = [17_649, 24_318, 1_081_553].map((durationMs, index) => ({
      driverRef: `d${String(index)}`,
      stopNumber: 1,
      lap: 10 + index,
      durationMs,
    }));
    expect(buildPitDurationSummary(rows)).toMatchObject({
      fastestMs: 17_649,
      slowestMs: 1_081_553,
    });
  });
});

/* ==================================================================================
 * Against the live database. Skipped where `data/f1.db` is absent — which is CI, and
 * the reporter prints the skip so a conditional pass cannot look like a green run.
 *
 * These exist to pin the measurements the schema comments and the design system's
 * rules are built on. If a refresh moves one of them, the number in the document is
 * wrong and this is where that becomes visible.
 * ================================================================================== */

const hasDatabase = existsSync(DB_PATH);

describe.skipIf(!hasDatabase)('race queries against the live database', () => {
  afterAll(() => {
    __resetDb();
  });

  it('rejects a well-formed round the season does not hold, so it can be a 404', () => {
    expect(roundExists(2026, 1)).toBe(true);
    expect(roundExists(2026, 40)).toBe(false);
    expect(roundExists(1949, 1)).toBe(false);
  });

  /* ------------------------------------------------- the four coverage regimes */

  it('1988 R1 — classification only, and the payload says so rather than implying it', () => {
    const race = readRace(1988, 1);
    expect(race).not.toBeNull();
    const parsed = raceSchema.safeParse(race);
    expect(parsed.error?.issues ?? []).toEqual([]);

    expect(race?.availability).toEqual({ hasLapData: false, hasPitData: false });
    expect(race?.hasResults).toBe(true);
    expect(race?.classification).toHaveLength(26);
    // Every pre-2005 timestamp is a midnight-UTC placeholder.
    expect(race?.startTime).toBeNull();
    // Winner: Prost, from P3. Read out of the database, not remembered.
    expect(race?.classification[0]).toMatchObject({
      driverRef: 'prost',
      position: 1,
      gridPosition: 3,
      outcome: 'finished',
    });
    // The whole 1988 grid carries no abbreviation.
    expect(race?.classification.every((row) => row.code === null)).toBe(true);
  });

  it('1996 R1 — laps, and no pit data at all (pit stops begin in 2011)', () => {
    const race = readRace(1996, 1);
    expect(race?.availability).toEqual({ hasLapData: true, hasPitData: false });

    const laps = readRaceLaps(1996, 1);
    expect(laps?.lapCount).toBe(812);
    expect(laps?.firstLap).toBe(1);
    expect(raceLapsSchema.safeParse(laps).error?.issues ?? []).toEqual([]);

    const stints = readRaceStints(1996, 1);
    expect(stints?.durations.stops).toBe(0);
    // Every driver with a lap row still gets one full-race stint, so the surface has a
    // designed empty state rather than an empty array.
    expect(stints?.drivers.length).toBeGreaterThan(0);
    expect(stints?.drivers.every((d) => d.stints.length === 1)).toBe(true);
    expect(raceStintsSchema.safeParse(stints).error?.issues ?? []).toEqual([]);
  });

  it('2011 R1 — everything', () => {
    const race = readRace(2011, 1);
    expect(race?.availability).toEqual({ hasLapData: true, hasPitData: true });
    expect(readRaceLaps(2011, 1)?.lapCount).toBe(1083);
    expect(readRaceStints(2011, 1)?.durations.stops).toBe(45);
  });

  /**
   * The numbers `DESIGN_SYSTEM.md` §6.3 derives its mandatory axis ceiling from. If a
   * refresh moves any of them, that section's arithmetic is stale and this fails.
   */
  it('2026 R1 — the pace distribution §6.3 is built on, to the millisecond', () => {
    const laps = readRaceLaps(2026, 1);
    expect(laps?.lapCount).toBe(1003);
    expect(laps?.firstLap).toBe(1);
    expect(laps?.lastLap).toBe(58);
    expect(laps?.pace).toMatchObject({
      timedLaps: 1003,
      deletedLaps: 0,
      medianMs: 85_228,
      p90Ms: 98_755,
      p99Ms: 122_340,
      slowestMs: 1_168_144,
    });
    expect(laps?.pace.fastest?.timeMs).toBe(82_091);

    // §6.3's ceiling is `fastest × 1.5` = 123,137 ms, and 10 of the 1,003 laps sit above
    // it — not the "two stoppage laps" §6.3 states. Reported to the designer.
    const ceiling = Math.round(82_091 * 1.5);
    const above = (laps?.drivers ?? []).flatMap((driver) =>
      driver.laps.filter((lap) => lap.timeMs !== null && lap.timeMs > ceiling),
    );
    expect(ceiling).toBe(123_137);
    expect(above).toHaveLength(10);
  });

  it('2026 R1 — the pit-duration spread that forces the same treatment on RD-7', () => {
    const stints = readRaceStints(2026, 1);
    expect(stints?.durations).toMatchObject({
      stops: 32,
      timedStops: 32,
      fastestMs: 17_649,
      slowestMs: 1_081_553,
    });
  });

  /* ----------------------------------------------- the states, and the empty ones */

  /**
   * The one race in the data that is inside the pit-stop window and still has no stops —
   * 2021 R12, the Belgian Grand Prix run behind the safety car. This is the "absent
   * rather than out of coverage" state, and it is reachable exactly once.
   */
  it('2021 R12 — inside the pit window with no stops: absent, not out of coverage', () => {
    const race = readRace(2021, 12);
    expect(race?.availability).toEqual({ hasLapData: true, hasPitData: false });
    expect(readRaceStints(2021, 12)?.durations.stops).toBe(0);
  });

  it('a scheduled future round has no results, and says so rather than sending []', () => {
    const race = readRace(2026, 22);
    expect(race).not.toBeNull();
    expect(race?.hasResults).toBe(false);
    expect(race?.classification).toEqual([]);
    expect(race?.raceLaps).toBeNull();
    expect(raceSchema.safeParse(race).error?.issues ?? []).toEqual([]);
  });

  it('returns null for a round the season does not hold, so the route can 404', () => {
    expect(readRace(2026, 40)).toBeNull();
    expect(readRaceLaps(2026, 40)).toBeNull();
    expect(readRaceStints(2026, 40)).toBeNull();
  });

  /* --------------------------------- the assumptions this feature rests on */

  /**
   * `toGrid`'s `'unknown'` branch is unreachable today, and this is what keeps it that
   * way honestly: if a refresh introduces a NULL `grid`, this fails rather than the null
   * quietly rendering as a pit-lane start on every affected row.
   */
  it('`grid` is NULL on no race entry — the assumption `toGrid` rests on', () => {
    const row = getDb()
      .prepare(
        `SELECT sum(se.grid IS NULL) AS nulls, sum(se.grid = 0) AS pitLane, count(*) AS total
         FROM session_entry se JOIN session ses ON ses.id = se.session_id
         WHERE ses.type = 'R'`,
      )
      .get() as { nulls: number; pitLane: number; total: number };
    expect(row).toMatchObject({ nulls: 0, pitLane: 267, total: 26_093 });
  });

  it('no race lap row has a NULL time, and none is deleted — the two nullable fields', () => {
    const row = getDb()
      .prepare(
        `SELECT count(*) AS total, sum(l.time_ms IS NULL) AS nullTime,
                sum(l.position IS NULL) AS nullPosition, sum(l.is_deleted = 1) AS deleted
         FROM lap l JOIN session_entry se ON se.id = l.session_entry_id
         JOIN session ses ON ses.id = se.session_id WHERE ses.type = 'R'`,
      )
      .get() as { total: number; nullTime: number; nullPosition: number; deleted: number };
    // Stated as measurements rather than as "should be 0": the schema tolerates all three
    // and the comments claim these counts.
    expect(row).toMatchObject({ total: 627_025, nullTime: 0, nullPosition: 16, deleted: 0 });
  });

  /**
   * S-10's bound, asserted rather than asserted-about. The largest addressable lap
   * result set in the archive is one race session's, and this is its size.
   */
  it('the largest single race session holds 1,649 lap rows — the S-10 bound', () => {
    const row = getDb()
      .prepare(
        `SELECT max(n) AS worst FROM (
           SELECT count(*) AS n FROM lap l
           JOIN session_entry se ON se.id = l.session_entry_id
           JOIN session ses ON ses.id = se.session_id
           WHERE ses.type = 'R' GROUP BY se.session_id)`,
      )
      .get() as { worst: number };
    expect(row.worst).toBe(1649);
    expect(readRaceLaps(2010, 18)?.lapCount).toBe(1649);
  });

  /**
   * Every `lap` access must reach `idx_lap_entry`. A plan containing `SCAN lap` is an
   * unbounded scan of 717,764 rows — the trap-7 / S-10 defect — and it would still return
   * correct data, which is exactly why it needs a test rather than a reading.
   */
  it('no lap access plans a SCAN of the lap table', () => {
    const sql = `
      SELECT ve.driver_ref, l.number, l.position, l.time_ms, l.is_deleted
      FROM v_race ve JOIN lap l ON l.session_entry_id = ve.entry_id
      WHERE ve.year = @year AND ve.round_number = @round
      ORDER BY ve.driver_ref, l.number`;
    const plan = getDb().prepare(`EXPLAIN QUERY PLAN ${sql}`).all({ year: 2026, round: 1 }) as {
      detail: string;
    }[];
    const details = plan.map((step) => step.detail);
    expect(
      details.some((detail) => /SEARCH l USING (COVERING )?INDEX idx_lap_entry/.test(detail)),
    ).toBe(true);
    expect(details.filter((detail) => /^SCAN /.test(detail))).toEqual([]);
  });

  /**
   * `driverRef` keys the two lap payloads and cannot key the classification. The safety
   * of that split is a fact about the data, so it is measured here rather than inferred
   * from the 1996 coverage boundary.
   */
  it('no race with a repeated driverRef has a lap row — what lets the lap payloads key by it', () => {
    const rows = getDb()
      .prepare(
        `SELECT count(*) AS n FROM (
           SELECT session_id FROM v_race GROUP BY session_id, driver_ref HAVING count(*) > 1) d
         WHERE EXISTS (SELECT 1 FROM v_race ve JOIN lap l ON l.session_entry_id = ve.entry_id
                       WHERE ve.session_id = d.session_id)`,
      )
      .get() as { n: number };
    expect(rows.n).toBe(0);
  });

  it('1951 R4 classifies two drivers at P1, and the list keeps both (trap 16)', () => {
    const race = readRace(1951, 4);
    const winners = (race?.classification ?? []).filter((row) => row.position === 1);
    expect(winners.map((row) => row.driverRef)).toEqual(['fangio', 'fagioli']);
    // `points DESC` credits the greater share first: Fangio 5, Fagioli 4.
    expect(winners.map((row) => row.points)).toEqual([5, 4]);
    // And the pair that makes a correct React key: driverRef alone repeats, with carNumber
    // it does not.
    expect(winners.every((row) => row.carNumber === 8)).toBe(true);
  });

  /**
   * **This test used to be named for a conclusion it does not support**, and the rename is
   * the point. It asserted that a lapped finisher carries no total time "so a gap column
   * cannot print a duration" — true of 1988 R1, false of the archive, and the false half
   * shipped a defect. 364 lapped finishers **do** carry a time, and every one of them is
   * 2023 or later. What 1988 actually demonstrates is the *older* of the two `detail`
   * spellings (trap 22).
   */
  it('1988 R1 — a lapped finisher whose `detail` states the deficit and carries no time', () => {
    const race = readRace(1988, 1);
    const lapped = (race?.classification ?? []).find((row) => row.outcome === 'lapped');
    expect(lapped?.isClassified).toBe(true);
    expect(lapped?.totalTimeMs).toBeNull();
    expect(lapped?.detail).toMatch(/^\+\d+ Lap/);
  });

  /* --------------------------------------------- trap 22, and the RESULT column's basis */

  /**
   * **The four measurements the result column is built on.** `DESIGN_SYSTEM.md` §6.6.1 keys
   * that column on `outcome`, and `src/features/race/selectors.ts` derives a lap deficit for
   * the rows where `detail` no longer states one. Both rest on facts about this dump rather
   * than on anything the schema enforces, so a refresh that moves one of them must fail
   * here — that is what this section of the file is for.
   *
   * The selector itself is tested against fixtures, not against the database: it lives in
   * the client project and importing it here would pull the SQLite driver into that graph.
   * These assertions cover the other half — that the data still looks the way the selector
   * assumes.
   */
  it('trap 22 — `detail` states the lap deficit up to 2022 and never from 2023', () => {
    const rows = getDb()
      .prepare(
        `SELECT sea.year AS year, se.detail AS detail, COUNT(*) AS n
           FROM session_entry se
           JOIN session s ON s.id = se.session_id
           JOIN round ro ON ro.id = s.round_id
           JOIN season sea ON sea.id = ro.season_id
          WHERE s.type = 'R' AND se.status = 1
          GROUP BY sea.year, se.detail`,
      )
      .all() as { year: number; detail: string; n: number }[];

    let statesDeficit = 0;
    let bareWord = 0;
    for (const row of rows) {
      if (/^\+\d+ Laps?$/.test(row.detail)) {
        // A `+N Laps` spelling from 2023 onward would mean the split has moved.
        expect(row.year).toBeLessThanOrEqual(2022);
        statesDeficit += row.n;
      } else if (row.detail === 'Lapped') {
        expect(row.year).toBeGreaterThanOrEqual(2023);
        bareWord += row.n;
      }
    }
    expect(statesDeficit).toBe(7279);
    expect(bareWord).toBe(363);
  });

  /**
   * **The `detail` shapes for `status = 1` are a closed set of three, and the selector has an
   * answer for each against both `isClassified` values.** A fourth shape appearing in a
   * refresh would reach `src/features/race/selectors.ts`'s `lapped` branch with no handling
   * written for it — which is exactly how the bare word `"Lapped"` reached the screen on
   * 2026 R1 — so the set is pinned here rather than assumed.
   */
  it('trap 22 — three `detail` shapes for a lapped row, and nothing else', () => {
    const rows = getDb()
      .prepare(
        `SELECT se.detail AS detail, se.is_classified AS isClassified, COUNT(*) AS n
           FROM session_entry se JOIN session s ON s.id = se.session_id
          WHERE s.type = 'R' AND se.status = 1
          GROUP BY se.detail, se.is_classified`,
      )
      .all() as { detail: string; isClassified: number; n: number }[];

    const shape = (detail: string) => (/^\+\d+ Laps?$/.test(detail) ? 'states a figure' : detail);

    const tally = new Map<string, number>();
    for (const row of rows) {
      const key = `${shape(row.detail)} | classified=${String(row.isClassified)}`;
      tally.set(key, (tally.get(key) ?? 0) + row.n);
    }

    // Six combinations, exhaustive. `Lapped | classified=0` is the pair that leaked: two
    // rows, 2026 R1 Stroll and 2026 R7 Albon, both below the 90% distance threshold.
    expect(Object.fromEntries([...tally].sort())).toEqual({
      'Lapped | classified=0': 2,
      'Lapped | classified=1': 361,
      'Not classified | classified=0': 171,
      'Not classified | classified=1': 1,
      'states a figure | classified=0': 26,
      'states a figure | classified=1': 7253,
    });
  });

  /**
   * The two rows that leaked are genuinely unclassified, so `isClassified` is the field to
   * trust where it disagrees with `status`. Both covered less than the sport's 90% of the
   * winner's distance, which is the threshold that decides classification.
   */
  it('the two unclassified-but-lapped rows are both below the 90% distance threshold', () => {
    const rows = getDb()
      .prepare(
        `WITH mx AS (
           SELECT se.session_id AS sid, MAX(se.laps_completed) AS ml
             FROM session_entry se JOIN session s ON s.id = se.session_id
            WHERE s.type = 'R' GROUP BY se.session_id
         )
         SELECT se.laps_completed AS lc, mx.ml AS raceLaps
           FROM session_entry se
           JOIN session s ON s.id = se.session_id
           JOIN mx ON mx.sid = se.session_id
          WHERE s.type = 'R' AND se.status = 1
            AND se.detail = 'Lapped' AND se.is_classified = 0`,
      )
      .all() as { lc: number; raceLaps: number }[];

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.lc / row.raceLaps).toBeLessThan(0.9);
    }
  });

  /**
   * The derivation's basis: `raceLaps` is `max(laps_completed)`, and for it to be a lap
   * deficit against the winner it has to *be* the winner's lap count. Trap 21 makes
   * `laps_completed` unreliable in general, so this is asserted rather than assumed — and it
   * is asserted only over the rows the derivation actually runs on.
   */
  it('the race distance is the winner’s own lap count on every row the deficit is derived for', () => {
    const row = getDb()
      .prepare(
        `WITH mx AS (
           SELECT se.session_id AS sid, MAX(se.laps_completed) AS ml
             FROM session_entry se JOIN session s ON s.id = se.session_id
            WHERE s.type = 'R' GROUP BY se.session_id
         ),
         win AS (
           SELECT se.session_id AS sid, se.laps_completed AS wlc
             FROM session_entry se JOIN session s ON s.id = se.session_id
            WHERE s.type = 'R' AND se.position = 1
         )
         SELECT COUNT(*) AS n,
                SUM(mx.ml = win.wlc) AS winnerIsMax,
                MIN(mx.ml - se.laps_completed) AS minDeficit
           FROM session_entry se
           JOIN mx ON mx.sid = se.session_id
           JOIN win ON win.sid = se.session_id
          WHERE se.status = 1 AND se.is_classified = 1 AND se.detail NOT LIKE '+%Lap%'`,
      )
      .get() as { n: number; winnerIsMax: number; minDeficit: number };

    expect(row.n).toBe(362);
    expect(row.winnerIsMax).toBe(row.n);
    // A deficit of zero or less would mean rendering `+0 Laps` for a lapped car.
    expect(row.minDeficit).toBeGreaterThanOrEqual(1);
  });

  /**
   * The leader reference: every P1 row is a **finisher** carrying a time, so the winning
   * time is never taken from a disqualified or retired entry. 9 disqualified entries do
   * carry a recorded time, which is why the selector filters on `outcome` and not on
   * `position === 1` alone.
   */
  it('every P1 row in the archive is a finisher with a recorded time', () => {
    const row = getDb()
      .prepare(
        `SELECT COUNT(*) AS n,
                SUM(se.status = 0) AS finishers,
                SUM(se.time_ms IS NOT NULL) AS withTime
           FROM session_entry se JOIN session s ON s.id = se.session_id
          WHERE s.type = 'R' AND se.position = 1`,
      )
      .get() as { n: number; finishers: number; withTime: number };

    expect(row.n).toBe(1162);
    expect(row.finishers).toBe(row.n);
    expect(row.withTime).toBe(row.n);
  });

  /**
   * **The invariant the negative-gap defect violated**, stated as data rather than as
   * behaviour: a full-distance finisher's time is never below the winner's, so the one
   * subtraction the selector still performs cannot go negative — while **537 non-finishers
   * carry a time**, which is why that subtraction must never be reached for them.
   */
  it('no finisher’s time is below the winner’s, and 537 non-finishers carry a time anyway', () => {
    const row = getDb()
      .prepare(
        `WITH lead AS (
           SELECT se.session_id AS sid, MIN(se.time_ms) AS t
             FROM session_entry se JOIN session s ON s.id = se.session_id
            WHERE s.type = 'R' AND se.position = 1 AND se.time_ms IS NOT NULL
            GROUP BY se.session_id
         )
         SELECT SUM(se.status = 0 AND se.time_ms < l.t) AS finisherBelowLeader,
                SUM(se.status <> 0 AND se.time_ms IS NOT NULL) AS nonFinishersWithTime,
                SUM(se.status <> 0 AND se.time_ms IS NOT NULL AND se.time_ms <  l.t) AS wouldReadNegative,
                SUM(se.status <> 0 AND se.time_ms IS NOT NULL AND se.time_ms >= l.t) AS wouldReadPlausible
           FROM session_entry se JOIN lead l ON l.sid = se.session_id`,
      )
      .get() as {
      finisherBelowLeader: number;
      nonFinishersWithTime: number;
      wouldReadNegative: number;
      wouldReadPlausible: number;
    };

    expect(row.finisherBelowLeader).toBe(0);
    expect(row.nonFinishersWithTime).toBe(537);
    // The two halves of the defect: the visible one that was reported, and the larger
    // invisible one a `delta < 0` guard would have left in place.
    expect(row.wouldReadNegative).toBe(165);
    expect(row.wouldReadPlausible).toBe(372);
  });

  it('the weekend list is schedule metadata, and practice carries almost nothing', () => {
    const race = readRace(2026, 1);
    const types = (race?.weekend ?? []).map((session) => session.type);
    expect(types).toEqual(['FP1', 'FP2', 'FP3', 'Q1', 'Q2', 'Q3', 'R']);
    // From 2022 every session has a real time.
    expect((race?.weekend ?? []).every((session) => session.startTime !== null)).toBe(true);
    const fp1 = (race?.weekend ?? []).find((session) => session.type === 'FP1');
    expect(fp1?.entries).toBe(21);
  });

  it('every stop returned is counted by the duration summary — the inner JOIN is safe', () => {
    for (const [year, round] of [
      [2011, 1],
      [2026, 1],
    ] as const) {
      const stints = readRaceStints(year, round);
      const attached = (stints?.drivers ?? []).reduce((sum, d) => sum + d.stops.length, 0);
      expect(attached).toBe(stints?.durations.stops);
    }
  });
});
