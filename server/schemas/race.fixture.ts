import type { DriverLaps, LapRow, Race, RaceClassificationRow, RaceLaps, RaceStints } from './race';

/**
 * Valid race payloads, used by the schema tests and by the client selector tests.
 *
 * Hand-written rather than captured from a response, for the reason `season.fixture.ts`
 * gives: a fixture captured from the implementation asserts only that the implementation
 * agrees with itself.
 *
 * **Four fixtures. Three span the coverage regimes; the fourth spans a *state* the other
 * three cannot reach** — and that distinction is the whole lesson of the negative-gap
 * defect (`DESIGN_SYSTEM.md` §1.0b):
 *
 * | Fixture | Real race | What it covers |
 * |---|---|---|
 * | `race1988Fixture` | 1988 R1, Brazil | classification only — no laps, no stops. **The common case: 484 races.** |
 * | `race1996Fixture` | 1996 R1, Australia | laps but no stops (pit data begins 2011) |
 * | `race2026Fixture` + `laps2026Fixture` + `stints2026Fixture` | 2026 R1, Australia | everything |
 * | `race2026R6Fixture` | 2026 R6, Monaco | **a non-finisher that carries a recorded time** — the state all three above miss |
 *
 * The first three were chosen by era, which felt like sampling coverage and was not: the
 * state that mattered was "retired, with an elapsed time on the row", and **none of the
 * three had one**. Era is a proxy for state and a bad one.
 *
 * The figures are real. 1988 R1's top five and 2026 R1's pace distribution
 * (82,091 / 85,228 / 98,755 / 122,340 / 1,168,144 ms) were read out of the database, so
 * a reader can check them rather than trust them. The lap **series** are abbreviated —
 * three laps where the race ran 58 — because a fixture's job is to exercise the shape,
 * and 1,003 rows in a source file is a shape nobody can read.
 */

/* --------------------------------------------------------------------------- builders */

/**
 * Build one classification row from a **complete, valid** base.
 *
 * These builders exist because the obvious alternative does not typecheck and the reason
 * is worth keeping: `{ ...fixture.classification[0], position: 2 }` looks like a partial
 * override and is not one. `tsconfig` sets `noUncheckedIndexedAccess`, so an indexed read
 * is `T | undefined`, spreading a possibly-undefined value makes **every** property
 * optional, and the result is no longer assignable to `RaceClassificationRow`. Four tests
 * were written that way and the suite passed while `tsc` failed — a green run and a red
 * typecheck at once, which is precisely why they are separate gates.
 *
 * A builder over a full base is the fix rather than a cast: a cast would silence a
 * disagreement between the fixture and the contract, and this keeps the contract enforced
 * on every variant a test invents. Adding a required field to the schema now breaks
 * *here*, once, instead of at every call site.
 */
export function makeClassificationRow(
  over: Partial<RaceClassificationRow> = {},
): RaceClassificationRow {
  return {
    driverRef: 'russell',
    code: 'RUS',
    forename: 'George',
    surname: 'Russell',
    teamRef: 'mercedes',
    teamName: 'Mercedes',
    carNumber: 63,
    position: 1,
    gridPosition: 1,
    gridStatus: 'grid',
    outcome: 'finished',
    detail: 'Finished',
    isClassified: true,
    isEligibleForPoints: true,
    points: 25,
    lapsCompleted: 58,
    totalTimeMs: 5_212_331,
    ...over,
  };
}

/** As `makeClassificationRow`, for a lap row. */
export function makeLapRow(over: Partial<LapRow> & { lap: number }): LapRow {
  return { position: 1, timeMs: 85_000, isDeleted: false, ...over };
}

/** As `makeClassificationRow`, for one driver's trace. */
export function makeDriverLaps(over: Partial<DriverLaps> = {}): DriverLaps {
  return {
    driverRef: 'russell',
    code: 'RUS',
    surname: 'Russell',
    teamRef: 'mercedes',
    gridPosition: 1,
    gridStatus: 'grid',
    finishPosition: 1,
    firstLap: 1,
    lastLap: 58,
    laps: [makeLapRow({ lap: 1 })],
    ...over,
  };
}

/* ----------------------------------------------------------- 1988 R1 — the reduced page */

export const race1988Fixture: Race = {
  year: 1988,
  round: 1,
  name: 'Brazilian Grand Prix',
  date: '1988-04-03',
  isCancelled: false,
  circuit: {
    ref: 'jacarepagua',
    name: 'Autódromo Internacional Nelson Piquet',
    locality: 'Rio de Janeiro',
    country: 'Brazil',
    countryCode: 'BR',
  },
  // Every pre-2005 session timestamp is exactly midnight UTC — a date with a zero time.
  startTime: null,
  timezone: 'America/Sao_Paulo',
  hasResults: true,
  raceLaps: 60,
  classification: [
    {
      driverRef: 'prost',
      // Null on the whole 1988 grid, and on 40 drivers who have lap data.
      code: null,
      forename: 'Alain',
      surname: 'Prost',
      teamRef: 'mclaren',
      teamName: 'McLaren',
      carNumber: 11,
      position: 1,
      gridPosition: 3,
      gridStatus: 'grid',
      outcome: 'finished',
      detail: 'Finished',
      isClassified: true,
      isEligibleForPoints: true,
      points: 9,
      lapsCompleted: 60,
      totalTimeMs: 5_766_857,
    },
    {
      driverRef: 'berger',
      code: null,
      forename: 'Gerhard',
      surname: 'Berger',
      teamRef: 'ferrari',
      teamName: 'Ferrari',
      carNumber: 28,
      position: 2,
      gridPosition: 4,
      gridStatus: 'grid',
      outcome: 'finished',
      detail: 'Finished',
      isClassified: true,
      isEligibleForPoints: true,
      points: 6,
      lapsCompleted: 60,
      totalTimeMs: 5_776_730,
    },
    {
      driverRef: 'satoru_nakajima',
      code: null,
      forename: 'Satoru',
      surname: 'Nakajima',
      teamRef: 'team_lotus',
      teamName: 'Team Lotus',
      carNumber: 2,
      position: 6,
      gridPosition: 10,
      gridStatus: 'grid',
      // A lapped finisher: classified, and with no total time recorded. `detail` carries
      // the deficit, which is why a gap column must not print a duration here.
      outcome: 'lapped',
      detail: '+1 Lap',
      isClassified: true,
      isEligibleForPoints: true,
      points: 1,
      lapsCompleted: 59,
      totalTimeMs: null,
    },
    {
      driverRef: 'senna',
      code: null,
      forename: 'Ayrton',
      surname: 'Senna',
      teamRef: 'mclaren',
      teamName: 'McLaren',
      carNumber: 12,
      // Disqualified from pole. Position null, and `outcome` says why — never a DNF.
      position: null,
      gridPosition: 1,
      gridStatus: 'grid',
      outcome: 'disqualified',
      detail: 'Disqualified',
      isClassified: false,
      isEligibleForPoints: false,
      points: 0,
      lapsCompleted: 31,
      totalTimeMs: null,
    },
  ],
  weekend: [
    {
      type: 'QB',
      number: 1,
      startTime: null,
      timezone: 'America/Sao_Paulo',
      isCancelled: false,
      entries: 31,
      hasLapData: false,
    },
    {
      type: 'R',
      number: 2,
      startTime: null,
      timezone: 'America/Sao_Paulo',
      isCancelled: false,
      entries: 26,
      hasLapData: false,
    },
  ],
  availability: { hasLapData: false, hasPitData: false },
};

/* ------------------------------------------- 1996 R1 — laps, but pit data begins in 2011 */

export const race1996Fixture: Race = {
  year: 1996,
  round: 1,
  name: 'Australian Grand Prix',
  date: '1996-03-10',
  isCancelled: false,
  circuit: {
    ref: 'albert_park',
    name: 'Albert Park Grand Prix Circuit',
    locality: 'Melbourne',
    country: 'Australia',
    countryCode: 'AU',
  },
  startTime: null,
  timezone: 'Australia/Melbourne',
  hasResults: true,
  raceLaps: 58,
  classification: [
    {
      driverRef: 'damon_hill',
      code: null,
      forename: 'Damon',
      surname: 'Hill',
      teamRef: 'williams',
      teamName: 'Williams',
      carNumber: 5,
      position: 1,
      gridPosition: 2,
      gridStatus: 'grid',
      outcome: 'finished',
      detail: 'Finished',
      isClassified: true,
      isEligibleForPoints: true,
      points: 10,
      lapsCompleted: 58,
      totalTimeMs: 5_431_837,
    },
    {
      driverRef: 'villeneuve',
      code: null,
      forename: 'Jacques',
      surname: 'Villeneuve',
      teamRef: 'williams',
      teamName: 'Williams',
      carNumber: 6,
      position: 2,
      gridPosition: 1,
      gridStatus: 'grid',
      outcome: 'finished',
      detail: 'Finished',
      isClassified: true,
      isEligibleForPoints: true,
      points: 6,
      lapsCompleted: 58,
      totalTimeMs: 5_433_875,
    },
  ],
  weekend: [
    {
      type: 'QB',
      number: 1,
      startTime: null,
      timezone: 'Australia/Melbourne',
      isCancelled: false,
      entries: 22,
      hasLapData: false,
    },
    {
      type: 'R',
      number: 2,
      startTime: null,
      timezone: 'Australia/Melbourne',
      isCancelled: false,
      entries: 20,
      hasLapData: true,
    },
  ],
  availability: { hasLapData: true, hasPitData: false },
};

/* ---------------------------------------------------------- 2026 R1 — the complete page */

export const race2026Fixture: Race = {
  year: 2026,
  round: 1,
  name: 'Australian Grand Prix',
  date: '2026-03-08',
  isCancelled: false,
  circuit: {
    ref: 'albert_park',
    name: 'Albert Park Grand Prix Circuit',
    locality: 'Melbourne',
    country: 'Australia',
    countryCode: 'AU',
  },
  // 2022 onward every session carries a real time. Read from the database.
  startTime: '2026-03-08 04:00:00+00:00',
  timezone: 'Australia/Melbourne',
  hasResults: true,
  raceLaps: 58,
  classification: [
    {
      driverRef: 'russell',
      code: 'RUS',
      forename: 'George',
      surname: 'Russell',
      teamRef: 'mercedes',
      teamName: 'Mercedes',
      carNumber: 63,
      position: 1,
      gridPosition: 1,
      gridStatus: 'grid',
      outcome: 'finished',
      detail: 'Finished',
      isClassified: true,
      isEligibleForPoints: true,
      points: 25,
      lapsCompleted: 58,
      totalTimeMs: 5_212_331,
    },
    {
      driverRef: 'max_verstappen',
      code: 'VER',
      forename: 'Max',
      surname: 'Verstappen',
      teamRef: 'red_bull',
      teamName: 'Red Bull',
      carNumber: 1,
      position: 2,
      // A pit-lane start: `grid = 0` in the database, and the two fields together say so
      // without a `0` ever reaching a reader as "position zero".
      gridPosition: null,
      gridStatus: 'pitLane',
      outcome: 'finished',
      detail: 'Finished',
      isClassified: true,
      isEligibleForPoints: true,
      points: 18,
      lapsCompleted: 58,
      totalTimeMs: 5_214_602,
    },
    {
      driverRef: 'leclerc',
      code: 'LEC',
      forename: 'Charles',
      surname: 'Leclerc',
      teamRef: 'ferrari',
      teamName: 'Ferrari',
      carNumber: 16,
      position: null,
      gridPosition: 4,
      gridStatus: 'grid',
      outcome: 'mechanical',
      detail: 'Power unit',
      isClassified: false,
      isEligibleForPoints: false,
      points: 0,
      lapsCompleted: 22,
      totalTimeMs: null,
    },
  ],
  weekend: [
    {
      type: 'FP1',
      number: 1,
      startTime: '2026-03-06 01:30:00+00:00',
      timezone: 'Australia/Melbourne',
      isCancelled: false,
      entries: 21,
      hasLapData: true,
    },
    {
      type: 'Q3',
      number: 6,
      startTime: '2026-03-07 05:00:00+00:00',
      timezone: 'Australia/Melbourne',
      isCancelled: false,
      entries: 10,
      hasLapData: true,
    },
    {
      type: 'R',
      number: 7,
      startTime: '2026-03-08 04:00:00+00:00',
      timezone: 'Australia/Melbourne',
      isCancelled: false,
      entries: 22,
      hasLapData: true,
    },
  ],
  availability: { hasLapData: true, hasPitData: true },
};

/* ------------------------------- 2026 R6 — the retired-with-a-recorded-time regression */

/**
 * **2026 R6, Monaco — the page the negative-gap defect was reported on.**
 *
 * This fixture exists because the other three could not reproduce the bug. It needs a row
 * that is **both** a non-finisher **and** carries a recorded elapsed time, and
 * `race1988Fixture` has none: those rows are all `totalTimeMs: null`, so the faulty branch
 * was unreachable there and 1988 rendered correctly for the wrong reason
 * (`DESIGN_SYSTEM.md` §1.0b — validate by state, not by era).
 *
 * Every figure is read out of the database. The six retirements below produced, in order,
 * `−9:58.354` · `−57:48.394` · `−1:08:14.482` · `−1:26:54.534` · `−1:46:34.145` ·
 * `−2:02:28.126` — because a retiree's `time_ms` is their elapsed time **when they
 * stopped**, which is *smaller* than the winner's 8,611,243 ms.
 *
 * Abbreviated to nine of the twenty-two entries: the winner, the runner-up, all six
 * retirements that carry a time, and Verstappen, who retired on lap 0 with no time at all
 * and is therefore the control — the one row the original code handled correctly.
 *
 * **Sainz is the interesting row.** `isClassified: true` at 70 laps of 78, so he holds P16
 * — and his `outcome` is `mechanical`, not `lapped`. He must read "Retired": he stopped on
 * lap 70 rather than circulating eight laps down to the flag, so `+8 Laps` would assert
 * something that did not happen. §6.6.1 rules this explicitly.
 *
 * **This race has no lapped finisher at all** — all fifteen finishers completed 78 laps —
 * which is exactly why the `lapped`-with-a-time state cannot be tested from here and is
 * exercised separately against 2026 R1's real rows.
 */
export const race2026R6Fixture: Race = {
  year: 2026,
  round: 6,
  name: 'Monaco Grand Prix',
  date: '2026-06-07',
  isCancelled: false,
  circuit: {
    ref: 'monaco',
    name: 'Circuit de Monaco',
    locality: 'Monte Carlo',
    country: 'Monaco',
    countryCode: 'MCO',
  },
  startTime: '2026-06-07 13:00:00+00:00',
  timezone: 'Europe/Monaco',
  hasResults: true,
  raceLaps: 78,
  classification: [
    makeClassificationRow({
      driverRef: 'antonelli',
      code: 'ANT',
      forename: 'Andrea Kimi',
      surname: 'Antonelli',
      teamRef: 'mercedes',
      teamName: 'Mercedes',
      carNumber: 12,
      position: 1,
      gridPosition: 1,
      points: 25,
      lapsCompleted: 78,
      totalTimeMs: 8_611_243,
    }),
    makeClassificationRow({
      driverRef: 'hamilton',
      code: 'HAM',
      forename: 'Lewis',
      surname: 'Hamilton',
      teamRef: 'ferrari',
      teamName: 'Ferrari',
      carNumber: 44,
      position: 2,
      gridPosition: 3,
      points: 18,
      lapsCompleted: 78,
      totalTimeMs: 8_617_514,
    }),
    // Classified at P16 on 70 laps, and still a retirement. `isClassified` decides whether
    // he holds a position; `outcome` decides what the result column says.
    makeClassificationRow({
      driverRef: 'sainz',
      code: 'SAI',
      forename: 'Carlos',
      surname: 'Sainz',
      teamRef: 'williams',
      teamName: 'Williams',
      carNumber: 55,
      position: 16,
      gridPosition: 12,
      outcome: 'mechanical',
      detail: 'Retired',
      isClassified: true,
      points: 0,
      lapsCompleted: 70,
      totalTimeMs: 8_012_889,
    }),
    makeClassificationRow({
      driverRef: 'leclerc',
      code: 'LEC',
      forename: 'Charles',
      surname: 'Leclerc',
      teamRef: 'ferrari',
      teamName: 'Ferrari',
      carNumber: 16,
      position: 17,
      gridPosition: 4,
      outcome: 'mechanical',
      detail: 'Retired',
      isClassified: false,
      points: 0,
      lapsCompleted: 64,
      totalTimeMs: 5_142_849,
    }),
    makeClassificationRow({
      driverRef: 'stroll',
      code: 'STR',
      forename: 'Lance',
      surname: 'Stroll',
      teamRef: 'aston_martin',
      teamName: 'Aston Martin',
      carNumber: 18,
      position: 18,
      gridPosition: 22,
      outcome: 'mechanical',
      detail: 'Retired',
      isClassified: false,
      points: 0,
      lapsCompleted: 56,
      totalTimeMs: 4_516_761,
    }),
    makeClassificationRow({
      driverRef: 'norris',
      code: 'NOR',
      forename: 'Lando',
      surname: 'Norris',
      teamRef: 'mclaren',
      teamName: 'McLaren',
      carNumber: 1,
      position: 19,
      gridPosition: 8,
      outcome: 'mechanical',
      detail: 'Retired',
      isClassified: false,
      points: 0,
      lapsCompleted: 43,
      totalTimeMs: 3_396_709,
    }),
    makeClassificationRow({
      driverRef: 'bearman',
      code: 'BEA',
      forename: 'Oliver',
      surname: 'Bearman',
      teamRef: 'haas',
      teamName: 'Haas F1 Team',
      carNumber: 87,
      position: 20,
      gridPosition: 19,
      outcome: 'mechanical',
      detail: 'Retired',
      isClassified: false,
      points: 0,
      lapsCompleted: 27,
      totalTimeMs: 2_217_098,
    }),
    makeClassificationRow({
      driverRef: 'bottas',
      code: 'BOT',
      forename: 'Valtteri',
      surname: 'Bottas',
      teamRef: 'cadillac',
      teamName: 'Cadillac F1 Team',
      carNumber: 77,
      position: 21,
      gridPosition: 20,
      outcome: 'mechanical',
      detail: 'Retired',
      isClassified: false,
      points: 0,
      lapsCompleted: 15,
      // The worst row on the page: 1,263,117 ms against a winning 8,611,243 rendered
      // `−2:02:28.126`.
      totalTimeMs: 1_263_117,
    }),
    // The control: retired with no recorded time, so the original code reached `detail` and
    // was right. Any fix has to leave this row alone.
    makeClassificationRow({
      driverRef: 'max_verstappen',
      code: 'VER',
      forename: 'Max',
      surname: 'Verstappen',
      teamRef: 'red_bull',
      teamName: 'Red Bull',
      carNumber: 3,
      position: 22,
      gridPosition: 2,
      outcome: 'mechanical',
      detail: 'Retired',
      isClassified: false,
      points: 0,
      lapsCompleted: 0,
      totalTimeMs: null,
    }),
  ],
  weekend: [
    {
      type: 'R',
      number: 7,
      startTime: '2026-06-07 13:00:00+00:00',
      timezone: 'Europe/Monaco',
      isCancelled: false,
      entries: 22,
      hasLapData: true,
    },
  ],
  availability: { hasLapData: true, hasPitData: true },
};

/**
 * 2026 R1's lap payload, abbreviated to three laps per driver.
 *
 * The `pace` block holds the **real measured distribution** of all 1,003 laps, so the
 * selectors that clip an axis against it are tested against the numbers that forced the
 * rule: a ceiling of `82,091 × 1.5 = 123,137 ms`, above which 10 of the 1,003 laps sit.
 */
export const laps2026Fixture: RaceLaps = {
  year: 2026,
  round: 1,
  firstLap: 1,
  lastLap: 58,
  lapCount: 9,
  pace: {
    timedLaps: 1003,
    deletedLaps: 0,
    fastest: { timeMs: 82_091, driverRef: 'russell', lap: 44 },
    medianMs: 85_228,
    p90Ms: 98_755,
    p99Ms: 122_340,
    slowestMs: 1_168_144,
  },
  drivers: [
    {
      driverRef: 'russell',
      code: 'RUS',
      surname: 'Russell',
      teamRef: 'mercedes',
      gridPosition: 1,
      gridStatus: 'grid',
      finishPosition: 1,
      firstLap: 1,
      lastLap: 58,
      laps: [
        { lap: 1, position: 1, timeMs: 95_112, isDeleted: false },
        { lap: 2, position: 1, timeMs: 86_004, isDeleted: false },
        // The red-flag lap: 1,168,144 ms is 19.5 minutes, and it is what the lap took.
        { lap: 3, position: 1, timeMs: 1_168_144, isDeleted: false },
      ],
    },
    {
      driverRef: 'max_verstappen',
      code: 'VER',
      surname: 'Verstappen',
      teamRef: 'red_bull',
      gridPosition: null,
      gridStatus: 'pitLane',
      finishPosition: 2,
      firstLap: 1,
      lastLap: 58,
      laps: [
        { lap: 1, position: 12, timeMs: 99_430, isDeleted: false },
        { lap: 2, position: 9, timeMs: 87_221, isDeleted: false },
        { lap: 3, position: 8, timeMs: 1_170_002, isDeleted: false },
      ],
    },
    {
      driverRef: 'leclerc',
      code: 'LEC',
      surname: 'Leclerc',
      teamRef: 'ferrari',
      gridPosition: 4,
      gridStatus: 'grid',
      // Retired: no classified position, and the trace simply stops at lap 22.
      finishPosition: null,
      firstLap: 1,
      lastLap: 22,
      laps: [
        { lap: 1, position: 4, timeMs: 96_880, isDeleted: false },
        // A lap row that exists with no recorded position — 16 such rows in the archive.
        { lap: 2, position: null, timeMs: 86_540, isDeleted: false },
        { lap: 3, position: 5, timeMs: 1_169_001, isDeleted: false },
      ],
    },
  ],
};

/** 2026 R1's stints. Durations are the real extremes: 17,649 ms and 1,081,553 ms. */
export const stints2026Fixture: RaceStints = {
  year: 2026,
  round: 1,
  drivers: [
    {
      driverRef: 'russell',
      code: 'RUS',
      surname: 'Russell',
      teamRef: 'mercedes',
      lastLap: 58,
      stops: [
        { stopNumber: 1, lap: 3, durationMs: 1_081_553 },
        { stopNumber: 2, lap: 30, durationMs: 22_104 },
      ],
      stints: [
        { stint: 1, fromLap: 1, toLap: 3, laps: 3, endedByStop: 1 },
        { stint: 2, fromLap: 4, toLap: 30, laps: 27, endedByStop: 2 },
        { stint: 3, fromLap: 31, toLap: 58, laps: 28, endedByStop: null },
      ],
    },
    {
      driverRef: 'max_verstappen',
      code: 'VER',
      surname: 'Verstappen',
      teamRef: 'red_bull',
      lastLap: 58,
      stops: [
        { stopNumber: 1, lap: 3, durationMs: 1_079_002 },
        // Two stops on consecutive laps — a stint of exactly one lap. 494 such stops
        // exist in the archive, so `laps: 1` is a real value and not a guard case.
        { stopNumber: 2, lap: 4, durationMs: 17_649 },
      ],
      stints: [
        { stint: 1, fromLap: 1, toLap: 3, laps: 3, endedByStop: 1 },
        { stint: 2, fromLap: 4, toLap: 4, laps: 1, endedByStop: 2 },
        { stint: 3, fromLap: 5, toLap: 58, laps: 54, endedByStop: null },
      ],
    },
  ],
  durations: {
    stops: 32,
    timedStops: 32,
    fastestMs: 17_649,
    medianMs: 24_318,
    p90Ms: 31_002,
    slowestMs: 1_081_553,
  },
};
