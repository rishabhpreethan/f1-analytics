import {
  META_CLOSED_COVERAGE,
  META_NO_COMPLETED_ROUND,
  META_REAL,
  META_SEASON_COMPLETE,
  META_ZERO_SCHEDULED,
} from '@schemas/meta.fixture';
import type { Meta } from '@schemas/meta';
import { describe, expect, it } from 'vitest';
import {
  isSeasonInCoverage,
  selectCoverageDetail,
  selectCoverageNotice,
  selectDataVintage,
  selectDefaultSeason,
  selectSeasonOptions,
  selectSeasonProgress,
} from './selectors';

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

describe('selectDataVintage', () => {
  it('reports the latest completed round', () => {
    const vintage = selectDataVintage(META_REAL);
    expect(vintage).not.toBeNull();
    expect(vintage?.round).toBe(10);
    expect(vintage?.year).toBe(2026);
    expect(vintage?.isoDate).toBe('2026-07-19');
    expect(vintage?.roundName).toBe('Belgian Grand Prix');
  });

  it('builds a label carrying the round name and the formatted date', () => {
    const vintage = selectDataVintage(META_REAL);
    expect(vintage?.label).toBe(
      'Complete results through 2026 Round 10 — Belgian Grand Prix, 19 Jul 2026',
    );
    expect(vintage?.progressLabel).toBe('10 of 22 rounds complete');
  });

  it('returns null when nothing has been completed', () => {
    expect(selectDataVintage(META_NO_COMPLETED_ROUND)).toBeNull();
  });
});

describe('selectCoverageDetail', () => {
  it('states coverage of the calendar, verbatim per the Design Spec', () => {
    const detail = selectCoverageDetail(META_REAL);
    expect(detail?.triggerName).toBe(
      'Data coverage: 2026 season, 10 of 22 rounds complete. Show detail.',
    );
    expect(detail?.coverageLine).toBe(
      'Complete results through Round 10 of 22 — Belgian Grand Prix, 19 Jul 2026.',
    );
    expect(detail?.scheduledLine).toBe('Rounds 11–22 are scheduled and have no results yet.');
    expect(detail?.cancelledLine).toBe('2 rounds on the 2026 calendar were cancelled.');
    expect(detail?.seasonsLine).toBe('Seasons available: 1950–2026.');
    expect(detail?.footerEcho).toBe('Complete results through 2026 Round 10 · Seasons 1950–2026');
  });

  it('omits the scheduled and cancelled lines when they do not apply (E7)', () => {
    const detail = selectCoverageDetail(META_SEASON_COMPLETE);
    expect(detail?.scheduledLine).toBeNull();
    expect(detail?.cancelledLine).toBeNull();
    expect(detail?.coverageLine).toBe(
      'Complete results through Round 24 of 24 — Abu Dhabi Grand Prix, 7 Dec 2025.',
    );
  });

  it('reads grammatically when exactly one round was cancelled', () => {
    const one: Meta = {
      ...META_REAL,
      latestSeason: { ...META_REAL.latestSeason, cancelledRounds: 1 },
    };
    expect(selectCoverageDetail(one)?.cancelledLine).toBe(
      '1 round on the 2026 calendar was cancelled.',
    );
  });

  it('returns null when nothing has been completed (E6)', () => {
    expect(selectCoverageDetail(META_NO_COMPLETED_ROUND)).toBeNull();
  });

  it('names no origin for the data, in any line', () => {
    const detail = selectCoverageDetail(META_REAL);
    expect(detail).not.toBeNull();
    const prose = Object.values(detail ?? {})
      .join(' ')
      .toLowerCase();
    // The vocabulary is coverage / complete / scheduled / available. A word for a
    // refresh, an import or a fetch event has no place in it (Design Spec §5.1).
    for (const banned of ['updated', 'update', 'refresh', 'import', 'fetched', 'sync', 'ago']) {
      expect(prose).not.toContain(banned);
    }
  });
});

describe('season options and default', () => {
  it('lists every season, newest first', () => {
    const years = selectSeasonOptions(META_REAL);
    expect(years).toHaveLength(META_REAL.seasons.count);
    expect(years[0]).toBe(2026);
    expect(years.at(-1)).toBe(1950);
    expect([...years].sort((a, b) => b - a)).toEqual(years);
  });

  it('defaults to the season of the latest completed round', () => {
    expect(selectDefaultSeason(META_REAL)).toBe(2026);
  });

  it('falls back to the latest season present when nothing is completed', () => {
    expect(selectDefaultSeason(META_NO_COMPLETED_ROUND)).toBe(2026);
    const older: Meta = {
      ...META_NO_COMPLETED_ROUND,
      seasons: { firstYear: 1950, latestYear: 1975, count: 26 },
    };
    expect(selectDefaultSeason(older)).toBe(1975);
  });
});

describe('isSeasonInCoverage', () => {
  it('honours the lap-data boundary at 1996', () => {
    expect(isSeasonInCoverage(META_REAL, 'laps', 1995)).toBe(false);
    expect(isSeasonInCoverage(META_REAL, 'laps', 1996)).toBe(true);
    expect(isSeasonInCoverage(META_REAL, 'laps', 2026)).toBe(true);
    expect(isSeasonInCoverage(META_REAL, 'laps', 1975)).toBe(false);
  });

  it('honours the pit-stop boundary at 2011', () => {
    expect(isSeasonInCoverage(META_REAL, 'pitStops', 2010)).toBe(false);
    expect(isSeasonInCoverage(META_REAL, 'pitStops', 2011)).toBe(true);
  });

  it('honours the qualifying boundary at 1994', () => {
    expect(isSeasonInCoverage(META_REAL, 'qualifying', 1993)).toBe(false);
    expect(isSeasonInCoverage(META_REAL, 'qualifying', 1994)).toBe(true);
  });

  it('honours a closed window as an upper bound', () => {
    expect(isSeasonInCoverage(META_CLOSED_COVERAGE, 'sprint', 2024)).toBe(true);
    expect(isSeasonInCoverage(META_CLOSED_COVERAGE, 'sprint', 2025)).toBe(false);
    expect(isSeasonInCoverage(META_CLOSED_COVERAGE, 'sprint', 2020)).toBe(false);
  });
});

describe('selectCoverageNotice', () => {
  it('is null inside the window and an explanation outside it', () => {
    expect(selectCoverageNotice(META_REAL, 'laps', 2000)).toBeNull();

    const notice = selectCoverageNotice(META_REAL, 'laps', 1976);
    expect(notice).toBe(
      "Lap-by-lap timing isn't available for 1976. Lap data begins in 1996. " +
        '1976 has full race classifications, grids and championship standings.',
    );

    expect(selectCoverageNotice(META_REAL, 'pitStops', 2005)).toContain('Pit data begins in 2011');
    expect(selectCoverageNotice(META_CLOSED_COVERAGE, 'sprint', 2025)).toContain(
      'Sprint races begin in 2021',
    );
  });
});

describe('selectSeasonProgress', () => {
  it('reports completed, scheduled and their ratio', () => {
    expect(selectSeasonProgress(META_REAL)).toEqual({
      completed: 10,
      scheduled: 22,
      ratio: 10 / 22,
    });
  });

  it('returns ratio 0, never NaN, when nothing is scheduled', () => {
    const progress = selectSeasonProgress(META_ZERO_SCHEDULED);
    expect(progress.ratio).toBe(0);
    expect(Number.isNaN(progress.ratio)).toBe(false);
  });
});

describe('purity', () => {
  it('mutates no input, even a deeply frozen one', () => {
    const frozen = deepFreeze(structuredClone(META_REAL));
    const before = JSON.stringify(frozen);

    expect(() => {
      selectDataVintage(frozen);
      selectCoverageDetail(frozen);
      selectSeasonOptions(frozen);
      selectDefaultSeason(frozen);
      isSeasonInCoverage(frozen, 'laps', 1996);
      selectCoverageNotice(frozen, 'laps', 1976);
      selectSeasonProgress(frozen);
      // Twice, so a selector that caches into its argument would be caught.
      selectDataVintage(frozen);
      selectSeasonOptions(frozen);
    }).not.toThrow();

    expect(JSON.stringify(frozen)).toBe(before);
  });
});
