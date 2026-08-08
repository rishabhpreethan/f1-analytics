import { describe, expect, it } from 'vitest';
import type { Meta } from '@schemas/meta';
import { META_REAL } from '@schemas/meta.fixture';
import { selectEntityActivity, selectIsCurrent, selectLatestSeason } from './selectors';

/**
 * The 2026-in-progress trap, which is the only reason this module exists.
 *
 * Every case below is a *data* case: what an entity's last season means when the archive's
 * most recent season is half-run. None of it is observable in a rendering test — jsdom
 * performs no layout — and all of it is wrong in a way that still looks like a plausible
 * list.
 */

describe('selectEntityActivity', () => {
  it('reads an entity racing in the latest season as current', () => {
    expect(selectEntityActivity(2026, 2026)).toBe('current');
  });

  /**
   * **The load-bearing case.** 2026 holds 10 of 22 numbered rounds in this data. A test
   * gated on `isComplete` would report all 22 current drivers as former for eleven months
   * of the year, then flip them back when the last round loaded.
   */
  it('does not depend on whether the latest season has finished', () => {
    expect(META_REAL.latestSeason.isComplete).toBe(false);
    expect(META_REAL.latestSeason.completedRounds).toBeLessThan(
      META_REAL.latestSeason.scheduledRounds,
    );
    expect(selectEntityActivity(META_REAL.latestSeason.year, META_REAL.latestSeason.year)).toBe(
      'current',
    );
  });

  it('reads an entity whose last season has passed as former', () => {
    expect(selectEntityActivity(2021, 2026)).toBe('former');
    expect(selectEntityActivity(1950, 2026)).toBe('former');
  });

  /**
   * A third state, not a flavour of `former`. 63 drivers, 9 teams and 1 circuit reach it,
   * and collapsing it would put Ecclestone — who entered a Grand Prix and never qualified
   * — in the same bucket as Senna.
   */
  it('reads a null span as neverRaced rather than as former', () => {
    expect(selectEntityActivity(null, 2026)).toBe('neverRaced');
  });

  /**
   * The window a `===` would leave: a refreshed database can hold a season newer than the
   * `/api/meta` payload already in the query cache, and reporting a currently racing driver
   * as retired is the wrong way to be wrong.
   */
  it('reads a season newer than the stated latest as current, not former', () => {
    expect(selectEntityActivity(2027, 2026)).toBe('current');
  });
});

describe('selectIsCurrent', () => {
  it.each([
    [2026, 2026, true],
    [2025, 2026, false],
    [null, 2026, false],
  ])('lastSeason %s against %s is %s', (lastSeason, latestSeason, expected) => {
    expect(selectIsCurrent(lastSeason, latestSeason)).toBe(expected);
  });
});

describe('selectLatestSeason', () => {
  it('reads the season from meta', () => {
    expect(selectLatestSeason(META_REAL)).toBe(META_REAL.latestSeason.year);
  });

  /**
   * Null rather than a fallback year. A hard-coded 2026 would go silently wrong at the next
   * database refresh, and a surface rendering activity before meta arrives is showing a
   * guess rather than a measurement.
   */
  it('is null while meta has not resolved, rather than guessing a year', () => {
    expect(selectLatestSeason(undefined)).toBeNull();
  });

  it('follows meta rather than a constant', () => {
    const shifted: Meta = {
      ...META_REAL,
      latestSeason: { ...META_REAL.latestSeason, year: 2031 },
    };
    expect(selectLatestSeason(shifted)).toBe(2031);
    expect(selectEntityActivity(2026, selectLatestSeason(shifted) ?? 0)).toBe('former');
  });
});
