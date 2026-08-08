import { describe, expect, it } from 'vitest';
import { laps2026Fixture, stints2026Fixture } from '@schemas/race.fixture';
import type { DriverLaps, LapRow, RaceLaps, RaceStints, Stint } from '@schemas/race';
import {
  PACE_CEILING_MULTIPLE,
  SAFETY_CAR_RATIO,
  fitLinear,
  median,
  paceCeilingMs,
  selectCleanLaps,
  selectDefaultDegradationDriverRef,
  selectDegradationStints,
  selectDriverPaceDegradation,
  selectInferredSafetyCarLaps,
  selectOffScale,
  selectPaceDegradation,
  selectPitLapsByDriver,
} from './pace';

const lap = (over: Partial<LapRow> & { lap: number }): LapRow => ({
  position: 1,
  timeMs: 85_000,
  isDeleted: false,
  ...over,
});

/* ==================================================================================
 * §6.3's mandatory axis ceiling. One authority for the multiple.
 * ================================================================================== */

describe('paceCeilingMs — §6.3, fastest × 1.5, in exactly one place', () => {
  it('is the multiple §6.3 specifies', () => {
    expect(PACE_CEILING_MULTIPLE).toBe(1.5);
  });

  /**
   * The measured case that produced the rule. 2026 R1's fastest lap is 82,091 ms and §6.3
   * records the ceiling as 123.1 s, just above that race's p99 of 122,340 ms.
   */
  it('gives 123,137 ms on 2026 R1 — the figure §6.3 records', () => {
    expect(paceCeilingMs(82_091)).toBe(123_137);
    expect(paceCeilingMs(82_091)).toBeGreaterThan(122_340);
  });

  it('is null when there is no fastest lap — never 0, which is a lap time', () => {
    expect(paceCeilingMs(null)).toBeNull();
    expect(paceCeilingMs(0)).toBeNull();
    expect(paceCeilingMs(Number.NaN)).toBeNull();
  });

  /**
   * The property §6.3 rests the choice of a multiple over a percentile on: the ceiling
   * scales with the circuit, so it means the same thing everywhere.
   */
  it('scales with the circuit — the reason it is a multiple and not a percentile', () => {
    expect(paceCeilingMs(40_000)).toBe(60_000);
    expect(paceCeilingMs(90_000)).toBe(135_000);
  });
});

describe('selectOffScale — clipped laps are counted and their values kept', () => {
  const laps = [
    lap({ lap: 1, timeMs: 95_112 }),
    lap({ lap: 2, timeMs: 86_004 }),
    lap({ lap: 3, timeMs: 1_168_144 }),
  ];

  it('counts what is above the ceiling and returns the exact values for the table', () => {
    const report = selectOffScale(laps, paceCeilingMs(82_091));
    expect(report.count).toBe(1);
    expect(report.laps).toEqual([{ lap: 3, timeMs: 1_168_144 }]);
  });

  /**
   * §6.3: laps above the ceiling are "never silently dropped". The count feeds the note and
   * the values feed the table view, so a chart cannot draw the caret without the numbers
   * that explain it.
   */
  it('reports nothing off-scale when no ceiling applies', () => {
    expect(selectOffScale(laps, null)).toEqual({ count: 0, laps: [] });
  });

  it('ignores a deleted lap — it is not plotted, so it cannot be off-scale', () => {
    const report = selectOffScale(
      [lap({ lap: 3, timeMs: 1_168_144, isDeleted: true })],
      paceCeilingMs(82_091),
    );
    expect(report.count).toBe(0);
  });

  it('treats a lap exactly at the ceiling as on-scale', () => {
    expect(selectOffScale([lap({ lap: 2, timeMs: 123_137 })], 123_137).count).toBe(0);
    expect(selectOffScale([lap({ lap: 2, timeMs: 123_138 })], 123_137).count).toBe(1);
  });
});

/* ==================================================================================
 * DATABASE.md §6.9 — the clean-lap rule.
 * ================================================================================== */

describe('selectCleanLaps — §6.9 verbatim, and RD-4 depends on every clause', () => {
  const laps = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => lap({ lap: n }));

  it('excludes lap 1 — a standing start is not a measure of pace', () => {
    expect(selectCleanLaps(laps, []).map((l) => l.lap)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  /**
   * RD-4's own note: "pit laps and the lap immediately following must be excluded from
   * degradation fits". §6.9 expresses both as `BETWEEN p AND p + 1`.
   */
  it('excludes the in-lap AND the out-lap around a stop', () => {
    expect(selectCleanLaps(laps, [4]).map((l) => l.lap)).toEqual([2, 3, 6, 7, 8]);
  });

  it('excludes both laps around each of several stops', () => {
    expect(selectCleanLaps(laps, [3, 6]).map((l) => l.lap)).toEqual([2, 5, 8]);
  });

  it('excludes an invalidated lap — trap 8', () => {
    const withDeleted = [lap({ lap: 2 }), lap({ lap: 3, isDeleted: true }), lap({ lap: 4 })];
    expect(selectCleanLaps(withDeleted, []).map((l) => l.lap)).toEqual([2, 4]);
  });

  it('excludes a lap with no recorded time', () => {
    const withNull = [lap({ lap: 2 }), lap({ lap: 3, timeMs: null }), lap({ lap: 4 })];
    expect(selectCleanLaps(withNull, []).map((l) => l.lap)).toEqual([2, 4]);
  });

  /**
   * A stop on lap 1 removes lap 2 as its out-lap, and lap 1 was already out. So the
   * earliest clean lap after a lap-1 stop is lap 3.
   */
  it('handles a stop on lap 1 — the minimum pit lap in the archive', () => {
    expect(selectCleanLaps(laps, [1]).map((l) => l.lap)).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('handles stops on consecutive laps, which 494 race stops are', () => {
    expect(selectCleanLaps(laps, [3, 4]).map((l) => l.lap)).toEqual([2, 6, 7, 8]);
  });

  /**
   * The pit laps are the driver's **own**. Another driver stopping does not dirty this
   * driver's lap, and passing the race's whole set would delete most of a race.
   */
  it('narrows the type so a caller cannot read a null time off a clean lap', () => {
    const clean = selectCleanLaps(laps, []);
    // A compile-time guarantee, exercised at runtime so the assertion is not vacuous.
    expect(clean.every((l) => typeof l.timeMs === 'number')).toBe(true);
  });

  it('does not mutate its input', () => {
    const input = [lap({ lap: 2 }), lap({ lap: 3 })];
    const copy = structuredClone(input);
    selectCleanLaps(input, [2]);
    expect(input).toEqual(copy);
  });
});

/* ==================================================================================
 * The fit.
 * ================================================================================== */

describe('fitLinear', () => {
  it('recovers an exact line', () => {
    const fit = fitLinear([
      { x: 1, y: 100 },
      { x: 2, y: 110 },
      { x: 3, y: 120 },
      { x: 4, y: 130 },
    ]);
    expect(fit?.slopeMsPerLap).toBeCloseTo(10, 10);
    expect(fit?.interceptMs).toBeCloseTo(90, 10);
    expect(fit?.r2).toBeCloseTo(1, 10);
    expect(fit?.n).toBe(4);
  });

  it('recovers a negative slope — a track ramping up, not degradation', () => {
    const fit = fitLinear([
      { x: 1, y: 130 },
      { x: 2, y: 120 },
      { x: 3, y: 110 },
    ]);
    expect(fit?.slopeMsPerLap).toBeCloseTo(-10, 10);
  });

  /**
   * Two points define a line exactly and would report `r2: 1` — a perfect fit that means
   * nothing, and the most misleading output this function could produce. So the floor is 3.
   */
  it('refuses fewer than 3 points rather than returning a perfect meaningless fit', () => {
    expect(fitLinear([])).toBeNull();
    expect(fitLinear([{ x: 1, y: 1 }])).toBeNull();
    expect(
      fitLinear([
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ]),
    ).toBeNull();
  });

  it('refuses a set with no variance in the lap numbers', () => {
    expect(
      fitLinear([
        { x: 5, y: 1 },
        { x: 5, y: 2 },
        { x: 5, y: 3 },
      ]),
    ).toBeNull();
  });

  /**
   * `r2` exists so a surface can decline to draw a trend line through noise. A slope
   * without it is how a straight line becomes a claim about tyre wear.
   */
  it('reports a low r2 for noise, so a caller can decline to draw the line', () => {
    const fit = fitLinear([
      { x: 1, y: 100 },
      { x: 2, y: 400 },
      { x: 3, y: 110 },
      { x: 4, y: 390 },
      { x: 5, y: 105 },
    ]);
    expect(fit).not.toBeNull();
    expect(fit?.r2).toBeLessThan(0.2);
  });

  it('reports r2 as 0 when every lap is identical — that is degenerate, not perfect', () => {
    const fit = fitLinear([
      { x: 1, y: 85_000 },
      { x: 2, y: 85_000 },
      { x: 3, y: 85_000 },
    ]);
    expect(fit?.slopeMsPerLap).toBe(0);
    expect(fit?.r2).toBe(0);
  });

  it('never reports an r2 outside 0…1', () => {
    for (const noise of [0, 1, 50, 5_000]) {
      const fit = fitLinear(
        [1, 2, 3, 4, 5, 6].map((x) => ({ x, y: 85_000 + x * 40 + (x % 2) * noise })),
      );
      expect(fit?.r2).toBeGreaterThanOrEqual(0);
      expect(fit?.r2).toBeLessThanOrEqual(1);
    }
  });
});

/* ==================================================================================
 * RD-4.
 * ================================================================================== */

describe('selectPaceDegradation', () => {
  const driver: DriverLaps = {
    driverRef: 'russell',
    code: 'RUS',
    surname: 'Russell',
    teamRef: 'mercedes',
    gridPosition: 1,
    gridStatus: 'grid',
    finishPosition: 1,
    firstLap: 1,
    lastLap: 12,
    // A degrading first stint, a stop on lap 6, a degrading second stint.
    laps: [
      lap({ lap: 1, timeMs: 95_000 }),
      lap({ lap: 2, timeMs: 85_000 }),
      lap({ lap: 3, timeMs: 85_200 }),
      lap({ lap: 4, timeMs: 85_400 }),
      lap({ lap: 5, timeMs: 85_600 }),
      lap({ lap: 6, timeMs: 110_000 }),
      lap({ lap: 7, timeMs: 96_000 }),
      lap({ lap: 8, timeMs: 84_000 }),
      lap({ lap: 9, timeMs: 84_300 }),
      lap({ lap: 10, timeMs: 84_600 }),
      lap({ lap: 11, timeMs: 84_900 }),
      lap({ lap: 12, timeMs: 85_200 }),
    ],
  };
  const stints: Stint[] = [
    { stint: 1, fromLap: 1, toLap: 6, laps: 6, endedByStop: 1 },
    { stint: 2, fromLap: 7, toLap: 12, laps: 6, endedByStop: null },
  ];

  it('fits each stint over its clean laps only', () => {
    const [first, second] = selectPaceDegradation(driver, stints, [6]);
    // Stint 1 loses lap 1 (start) and lap 6 (in-lap): laps 2-5 remain.
    expect(first?.laps.map((l) => l.lap)).toEqual([2, 3, 4, 5]);
    // Stint 2 loses lap 7 (out-lap): laps 8-12 remain.
    expect(second?.laps.map((l) => l.lap)).toEqual([8, 9, 10, 11, 12]);
  });

  /**
   * The in-lap is 110,000 ms and the out-lap 96,000 ms against a stint pace near 85,000.
   * Including either would dominate a four-point fit — this is the whole reason RD-4 names
   * the exclusion.
   */
  it('produces a clean slope because the in-lap and out-lap are gone', () => {
    const [first, second] = selectPaceDegradation(driver, stints, [6]);
    expect(first?.fit?.slopeMsPerLap).toBeCloseTo(200, 6);
    expect(first?.fit?.r2).toBeCloseTo(1, 6);
    expect(second?.fit?.slopeMsPerLap).toBeCloseTo(300, 6);
  });

  it('would be badly wrong if the pit laps were not excluded — the contrast', () => {
    const [first] = selectPaceDegradation(driver, stints, []);
    // With lap 6's 110,000 ms in the set, the slope more than quadruples.
    expect(first?.fit?.slopeMsPerLap ?? 0).toBeGreaterThan(1_000);
  });

  /**
   * A three-lap stint is entirely lap 1, in-lap and out-lap, so it has laps and no fit.
   * Both are reported rather than collapsed, so a surface can plot points without a line.
   */
  it('reports laps with a null fit when a stint is too short to fit', () => {
    const short: Stint[] = [{ stint: 1, fromLap: 1, toLap: 3, laps: 3, endedByStop: 1 }];
    const [only] = selectPaceDegradation(driver, short, [3]);
    expect(only?.laps.map((l) => l.lap)).toEqual([2]);
    expect(only?.fit).toBeNull();
  });

  it('returns one entry per stint, in order, even when a stint is empty', () => {
    const result = selectPaceDegradation(driver, stints, [2, 3, 4, 5, 6]);
    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.stint.stint)).toEqual([1, 2]);
  });
});

describe('selectPitLapsByDriver', () => {
  it('keys each driver to their own stops, in lap order', () => {
    const byDriver = selectPitLapsByDriver(stints2026Fixture);
    expect(byDriver.get('russell')).toEqual([3, 30]);
    expect(byDriver.get('max_verstappen')).toEqual([3, 4]);
  });

  it('is empty for a driver absent from the payload rather than undefined-crashing', () => {
    expect(selectPitLapsByDriver(stints2026Fixture).get('nobody')).toBeUndefined();
  });
});

/* ==================================================================================
 * RD-4's honesty requirement. Every figure here was measured over all 578 races that
 * hold lap data — see the SAFETY_CAR_RATIO comment.
 * ================================================================================== */

describe('median', () => {
  it('is the middle value for an odd count and the mean of two for an even one', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it('is 0 on an empty set', () => {
    expect(median([])).toBe(0);
  });

  it('does not sort the caller array in place', () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe('selectInferredSafetyCarLaps — inferred, and calibrated on 578 races', () => {
  /** A synthetic field: four drivers, one neutralised lap. */
  function field(times: Record<number, number[]>): RaceLaps {
    const drivers: DriverLaps[] = [0, 1, 2, 3].map((index) => ({
      driverRef: `d${String(index)}`,
      code: null,
      surname: `D${String(index)}`,
      teamRef: 't',
      gridPosition: index + 1,
      gridStatus: 'grid',
      finishPosition: index + 1,
      firstLap: 1,
      lastLap: Object.keys(times).length,
      laps: Object.entries(times).map(([lapNumber, perDriver]) =>
        lap({ lap: Number(lapNumber), timeMs: perDriver[index] ?? perDriver[0] ?? 85_000 }),
      ),
    }));
    return { ...laps2026Fixture, drivers, lapCount: 0 };
  }

  it('flags a neutralised lap and reports how much slower it was', () => {
    const found = selectInferredSafetyCarLaps(
      field({
        1: [95_000, 95_100, 95_200, 95_300],
        2: [85_000, 85_100, 85_200, 85_300],
        3: [85_000, 85_100, 85_200, 85_300],
        4: [130_000, 130_100, 130_200, 130_300],
        5: [85_000, 85_100, 85_200, 85_300],
      }),
    );
    expect(found.map((entry) => entry.lap)).toEqual([4]);
    expect(found[0]?.ratio).toBeGreaterThan(1.5);
  });

  /**
   * Measured: lap 1's field-median ratio has a median of 1.131 and a p90 of 1.402 across
   * the archive, and **98 of 578 races would be flagged on lap 1 alone**. A note appearing
   * on a sixth of the archive because races start from a standstill would mean nothing.
   */
  it('never flags lap 1, however slow it was — a standing start is not a safety car', () => {
    const found = selectInferredSafetyCarLaps(
      field({
        1: [200_000, 200_000, 200_000, 200_000],
        2: [85_000, 85_000, 85_000, 85_000],
        3: [85_000, 85_000, 85_000, 85_000],
      }),
    );
    expect(found).toEqual([]);
  });

  /**
   * The reason both levels are medians. One driver's pit stop or spin must not move a
   * lap's figure — here one car takes 3× on an otherwise normal lap.
   */
  it('ignores a single driver stopping — the field median is the signal', () => {
    const found = selectInferredSafetyCarLaps(
      field({
        1: [95_000, 95_000, 95_000, 95_000],
        2: [85_000, 85_000, 85_000, 255_000],
        3: [85_000, 85_000, 85_000, 85_000],
        4: [85_000, 85_000, 85_000, 85_000],
      }),
    );
    expect(found).toEqual([]);
  });

  /** …and the neutralised laps must not drag the baseline they are compared against. */
  it('is not dragged by the neutralised laps themselves', () => {
    const found = selectInferredSafetyCarLaps(
      field({
        1: [95_000, 95_000, 95_000, 95_000],
        2: [85_000, 85_000, 85_000, 85_000],
        3: [130_000, 130_000, 130_000, 130_000],
        4: [130_000, 130_000, 130_000, 130_000],
        5: [85_000, 85_000, 85_000, 85_000],
        6: [85_000, 85_000, 85_000, 85_000],
      }),
    );
    expect(found.map((entry) => entry.lap)).toEqual([3, 4]);
  });

  it('reports nothing on a clean race — 2011 R1 measured 1.072× at its worst', () => {
    const found = selectInferredSafetyCarLaps(
      field({
        1: [95_000, 95_000, 95_000, 95_000],
        2: [85_000, 85_000, 85_000, 85_000],
        3: [86_000, 86_000, 86_000, 86_000],
        4: [91_000, 91_000, 91_000, 91_000],
        5: [85_500, 85_500, 85_500, 85_500],
      }),
    );
    expect(found).toEqual([]);
  });

  it('is the ratio the constant names, and honours an override', () => {
    expect(SAFETY_CAR_RATIO).toBe(1.3);
    const race = field({
      1: [95_000, 95_000, 95_000, 95_000],
      2: [85_000, 85_000, 85_000, 85_000],
      3: [100_000, 100_000, 100_000, 100_000],
      4: [85_000, 85_000, 85_000, 85_000],
    });
    expect(selectInferredSafetyCarLaps(race, 1.3)).toEqual([]);
    expect(selectInferredSafetyCarLaps(race, 1.1).map((entry) => entry.lap)).toEqual([3]);
  });

  /**
   * 2021 R12 holds one lap row per driver — the Belgian Grand Prix run behind the safety
   * car. After lap 1 is excluded there is nothing left to compare, and the answer is an
   * empty list rather than a crash or a division by a zero baseline.
   */
  it('survives a race with only lap 1, which 2021 R12 is', () => {
    expect(selectInferredSafetyCarLaps(field({ 1: [225_449, 225_449, 225_449, 225_449] }))).toEqual(
      [],
    );
  });

  it('survives a race with no lap rows at all', () => {
    expect(selectInferredSafetyCarLaps({ ...laps2026Fixture, drivers: [] })).toEqual([]);
  });

  it('returns candidates in lap order', () => {
    const found = selectInferredSafetyCarLaps(
      field({
        1: [95_000, 95_000, 95_000, 95_000],
        2: [85_000, 85_000, 85_000, 85_000],
        3: [130_000, 130_000, 130_000, 130_000],
        4: [85_000, 85_000, 85_000, 85_000],
        5: [140_000, 140_000, 140_000, 140_000],
        6: [85_000, 85_000, 85_000, 85_000],
        7: [85_000, 85_000, 85_000, 85_000],
      }),
    );
    expect(found.map((entry) => entry.lap)).toEqual([3, 5]);
  });
});

/* ==================================================================================
 * RD-4's opening state. The panel must not demonstrate its own degenerate case first.
 * ================================================================================== */

/** The r² floor `ScatterChart` draws at. Restated here, not imported: see the selector's doc. */
const FLOOR = 0.5;

function driverWith(driverRef: string, times: readonly number[]): DriverLaps {
  return {
    driverRef,
    code: driverRef.slice(0, 3).toUpperCase(),
    surname: driverRef,
    teamRef: 'mercedes',
    gridPosition: 1,
    gridStatus: 'grid',
    finishPosition: 1,
    firstLap: 1,
    lastLap: times.length,
    laps: times.map((timeMs, index) => lap({ lap: index + 1, timeMs })),
  };
}

/** Ten laps rising 200 ms each — a fit of r² 1, comfortably drawn. */
const CLEAN_DEGRADATION = [95_000, 85_000, 85_200, 85_400, 85_600, 85_800, 86_000, 86_200, 86_400];

/** Ten laps alternating about a flat mean — a real slope of ~0 and an r² near 0. */
const SCATTER = [95_000, 85_000, 86_000, 85_000, 86_000, 85_000, 86_000, 85_000, 86_000];

function raceLapsOf(drivers: readonly DriverLaps[]): RaceLaps {
  return { ...laps2026Fixture, drivers: [...drivers] };
}

function stintsOf(entries: Record<string, Stint[]>): RaceStints {
  return {
    ...stints2026Fixture,
    drivers: Object.entries(entries).map(([driverRef, stints]) => ({
      driverRef,
      code: driverRef.slice(0, 3).toUpperCase(),
      surname: driverRef,
      teamRef: 'mercedes',
      lastLap: 9,
      stops: [],
      stints,
    })),
  };
}

describe('selectDegradationStints — the stints a fit runs over', () => {
  it("uses the driver's own stints when the pit payload reaches this race", () => {
    const own: Stint[] = [
      { stint: 1, fromLap: 1, toLap: 5, laps: 5, endedByStop: 1 },
      { stint: 2, fromLap: 6, toLap: 9, laps: 4, endedByStop: null },
    ];
    expect(
      selectDegradationStints(driverWith('russell', SCATTER), stintsOf({ russell: own })),
    ).toEqual(own);
  });

  /**
   * 1996–2010: laps exist and pit stops do not. One implicit stint spanning the race is the
   * honest reduced answer, and RD-4 is available across the whole lap window because of it.
   */
  it('falls back to one implicit stint over the whole race when there are no stints', () => {
    expect(selectDegradationStints(driverWith('russell', SCATTER), null)).toEqual([
      { stint: 1, fromLap: 1, toLap: 9, laps: 9, endedByStop: null },
    ]);
  });

  it('falls back the same way for a driver the stint payload does not carry', () => {
    expect(
      selectDegradationStints(driverWith('hadjar', SCATTER), stintsOf({ russell: [] })),
    ).toEqual([{ stint: 1, fromLap: 1, toLap: 9, laps: 9, endedByStop: null }]);
  });

  /**
   * The degenerate stint this function exists to make unrepresentable: `Math.min()` over no
   * laps is `Infinity`, and a `[Infinity, -Infinity]` stint renders as a *ready* chart with
   * nothing in it rather than the empty state that explains itself.
   */
  it('is empty for a driver with no lap rows — never one Infinity-wide stint', () => {
    expect(selectDegradationStints(driverWith('russell', []), null)).toEqual([]);
  });
});

describe('selectDefaultDegradationDriverRef — RD-4 opens on a driver with a trend to show', () => {
  it('skips a leader whose every stint fits below the floor', () => {
    const laps = raceLapsOf([
      driverWith('russell', SCATTER),
      driverWith('antonelli', CLEAN_DEGRADATION),
    ]);
    expect(selectDefaultDegradationDriverRef(laps, null, FLOOR)).toBe('antonelli');
  });

  /**
   * `raceLapsSchema` orders drivers by finishing position with the unclassified last, so
   * scanning the payload in order is "the best finisher who has something to show" — the
   * reason this imposes no sort of its own.
   */
  it('takes the first drawable driver in finishing order, not merely any drawable one', () => {
    const laps = raceLapsOf([
      driverWith('russell', SCATTER),
      driverWith('antonelli', CLEAN_DEGRADATION),
      driverWith('leclerc', CLEAN_DEGRADATION),
    ]);
    expect(selectDefaultDegradationDriverRef(laps, null, FLOOR)).toBe('antonelli');
  });

  it('keeps the leader when the leader is already drawable', () => {
    const laps = raceLapsOf([
      driverWith('russell', CLEAN_DEGRADATION),
      driverWith('antonelli', CLEAN_DEGRADATION),
    ]);
    expect(selectDefaultDegradationDriverRef(laps, null, FLOOR)).toBe('russell');
  });

  /** A real race, not an error: every fit is weak, so the panel opens where it always did. */
  it('falls back to the first driver when no driver in the race has a drawable fit', () => {
    const laps = raceLapsOf([driverWith('russell', SCATTER), driverWith('antonelli', SCATTER)]);
    expect(selectDefaultDegradationDriverRef(laps, null, FLOOR)).toBe('russell');
  });

  it('is null only when the race has no drivers at all', () => {
    expect(selectDefaultDegradationDriverRef(raceLapsOf([]), null, FLOOR)).toBeNull();
  });

  /**
   * The floor is the surface's to choose, so this must follow it rather than hold its own
   * copy — a second authority on the number is exactly how the two would drift apart.
   */
  it('follows the floor it is given', () => {
    const laps = raceLapsOf([
      driverWith('russell', SCATTER),
      driverWith('antonelli', CLEAN_DEGRADATION),
    ]);
    // At a floor of 0 every fit qualifies, so the leader is kept.
    expect(selectDefaultDegradationDriverRef(laps, null, 0)).toBe('russell');
    // Above 1 nothing can qualify, so the fallback applies — also the leader, by a different route.
    expect(selectDefaultDegradationDriverRef(laps, null, 1.01)).toBe('russell');
  });

  /**
   * **The property the split into `selectDriverPaceDegradation` exists to guarantee.** A
   * driver chosen *because* it has a drawable trend must be drawable when drawn; if the scan
   * and the render derived stints separately, this is the assertion that would break.
   */
  it('names a driver that is genuinely drawable when rendered the same way', () => {
    const stints = stintsOf({
      russell: [{ stint: 1, fromLap: 1, toLap: 9, laps: 9, endedByStop: null }],
      antonelli: [{ stint: 1, fromLap: 1, toLap: 9, laps: 9, endedByStop: null }],
    });
    const field = [driverWith('russell', SCATTER), driverWith('antonelli', CLEAN_DEGRADATION)];
    const laps = raceLapsOf(field);

    const chosenRef = selectDefaultDegradationDriverRef(laps, stints, FLOOR);
    const drawable = field
      .filter((driver) =>
        selectDriverPaceDegradation(driver, stints, selectPitLapsByDriver(stints)).some(
          (entry) => entry.fit !== null && entry.fit.r2 >= FLOOR,
        ),
      )
      .map((driver) => driver.driverRef);

    expect(drawable).toContain(chosenRef);
  });

  /** The whole scan must survive the 1996–2010 window, where there is no stint payload. */
  it('works with no stint payload at all — the 1996 case', () => {
    const field = [driverWith('russell', SCATTER), driverWith('antonelli', CLEAN_DEGRADATION)];
    const chosenRef = selectDefaultDegradationDriverRef(raceLapsOf(field), null, FLOOR);
    const drawable = field
      .filter((driver) =>
        selectDriverPaceDegradation(driver, null, new Map()).some(
          (entry) => entry.fit !== null && entry.fit.r2 >= FLOOR,
        ),
      )
      .map((driver) => driver.driverRef);

    expect(chosenRef).toBe('antonelli');
    expect(drawable).toEqual(['antonelli']);
  });
});
