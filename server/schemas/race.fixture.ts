import type { Race, RaceLaps, RaceStints } from './race';

/**
 * Valid race payloads, used by the schema tests and by the client selector tests.
 *
 * Hand-written rather than captured from a response, for the reason `season.fixture.ts`
 * gives: a fixture captured from the implementation asserts only that the implementation
 * agrees with itself.
 *
 * **Three fixtures, because the race page spans three coverage regimes** and each one is
 * a state the surface has to render:
 *
 * | Fixture | Real race | Regime |
 * |---|---|---|
 * | `race1988Fixture` | 1988 R1, Brazil | classification only — no laps, no stops. **The common case: 484 races.** |
 * | `race1996Fixture` | 1996 R1, Australia | laps but no stops (pit data begins 2011) |
 * | `race2026Fixture` + `laps2026Fixture` + `stints2026Fixture` | 2026 R1, Australia | everything |
 *
 * The figures are real. 1988 R1's top five and 2026 R1's pace distribution
 * (82,091 / 85,228 / 98,755 / 122,340 / 1,168,144 ms) were read out of the database, so
 * a reader can check them rather than trust them. The lap **series** are abbreviated —
 * three laps where the race ran 58 — because a fixture's job is to exercise the shape,
 * and 1,003 rows in a source file is a shape nobody can read.
 */

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
