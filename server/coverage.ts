import type { Meta } from './schemas/meta';

/**
 * Data coverage windows. Mirrors `docs/DATABASE.md` §4, re-verified 2026-08-04.
 * `to: null` means "open — through the latest season present".
 *
 * These are **constants, not queries** (ARCHITECTURE.md §10 #10). Deriving the lap
 * window at request time would mean scanning `lap` (717,764 rows) — a trap-7
 * violation on the cheapest endpoint in the application.
 *
 * `docs/DATABASE.md` §9 requires re-verifying this file against §4 after a refresh.
 */
export const COVERAGE: Meta['coverage'] = {
  results: { from: 1950, to: null },
  qualifying: { from: 1994, to: null },
  qualifyingSegments: { from: 2006, to: null },
  laps: { from: 1996, to: null },
  pitStops: { from: 2011, to: null },
  sprint: { from: 2021, to: null },
  sprintQualifying: { from: 2023, to: null },
};
