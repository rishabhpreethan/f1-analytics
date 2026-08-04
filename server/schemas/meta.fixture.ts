import type { Meta } from './meta';

/**
 * Test-support fixtures for the `/api/meta` contract.
 *
 * They live beside the schema they exemplify so the server-side contract tests and
 * the client-side selector tests assert against **one** payload rather than two
 * copies that can drift. Type-only import, so the `zod`-only rule for this directory
 * (ARCHITECTURE.md §3) still holds.
 *
 * `META_REAL` is the payload verified against the database on 2026-08-04.
 */

const COVERAGE_OPEN: Meta['coverage'] = {
  results: { from: 1950, to: null },
  qualifying: { from: 1994, to: null },
  qualifyingSegments: { from: 2006, to: null },
  laps: { from: 1996, to: null },
  pitStops: { from: 2011, to: null },
  sprint: { from: 2021, to: null },
  sprintQualifying: { from: 2023, to: null },
};

/** The verified payload: 2026 is in progress, 10 of 22 rounds complete. */
export const META_REAL: Meta = {
  seasons: { firstYear: 1950, latestYear: 2026, count: 77 },
  latestSeason: {
    year: 2026,
    scheduledRounds: 22,
    completedRounds: 10,
    cancelledRounds: 2,
    isComplete: false,
  },
  latestCompletedRound: {
    year: 2026,
    round: 10,
    roundName: 'Belgian Grand Prix',
    date: '2026-07-19',
    circuitRef: 'spa',
    circuitName: 'Circuit de Spa-Francorchamps',
  },
  nextScheduledRound: {
    year: 2026,
    round: 11,
    roundName: 'Hungarian Grand Prix',
    date: '2026-07-26',
    circuitRef: 'hungaroring',
    circuitName: 'Hungaroring',
  },
  coverage: COVERAGE_OPEN,
};

/** E7 — a season that ran to completion, with the next season's opener known. */
export const META_SEASON_COMPLETE: Meta = {
  seasons: { firstYear: 1950, latestYear: 2025, count: 76 },
  latestSeason: {
    year: 2025,
    scheduledRounds: 24,
    completedRounds: 24,
    cancelledRounds: 0,
    isComplete: true,
  },
  latestCompletedRound: {
    year: 2025,
    round: 24,
    roundName: 'Abu Dhabi Grand Prix',
    date: '2025-12-07',
    circuitRef: 'yas_marina',
    circuitName: 'Yas Marina Circuit',
  },
  nextScheduledRound: null,
  coverage: COVERAGE_OPEN,
};

/** E6 — nothing has been run yet. Cannot occur with today's data; must not crash. */
export const META_NO_COMPLETED_ROUND: Meta = {
  seasons: { firstYear: 1950, latestYear: 2026, count: 77 },
  latestSeason: {
    year: 2026,
    scheduledRounds: 22,
    completedRounds: 0,
    cancelledRounds: 2,
    isComplete: false,
  },
  latestCompletedRound: null,
  nextScheduledRound: {
    year: 2026,
    round: 1,
    roundName: 'Australian Grand Prix',
    date: '2026-03-08',
    circuitRef: 'albert_park',
    circuitName: 'Albert Park Grand Prix Circuit',
  },
  coverage: COVERAGE_OPEN,
};

/** A season with no rounds at all — the `ratio: 0`, never `NaN`, case. */
export const META_ZERO_SCHEDULED: Meta = {
  ...META_NO_COMPLETED_ROUND,
  latestSeason: {
    year: 2026,
    scheduledRounds: 0,
    completedRounds: 0,
    cancelledRounds: 0,
    isComplete: false,
  },
  nextScheduledRound: null,
};

/** A closed coverage window, to prove `to` is honoured as an upper bound. */
export const META_CLOSED_COVERAGE: Meta = {
  ...META_REAL,
  coverage: { ...COVERAGE_OPEN, sprint: { from: 2021, to: 2024 } },
};
