import {
  META_NO_COMPLETED_ROUND,
  META_REAL,
  META_SEASON_COMPLETE,
  META_ZERO_SCHEDULED,
} from '@schemas/meta.fixture';
import { describe, expect, it } from 'vitest';
import { selectCoverageBands, selectHeroFigures, selectRulerTicks } from './selectors';

/**
 * CT-14 … CT-17. The landing page's figures are the ones a reader will most readily believe,
 * which makes them the ones a wrong number damages most.
 *
 * CT-14's second half — the hard-coded-statistic grep — lives in `Landing.test.tsx`, beside
 * the component it reads.
 */

describe('CT-14 — selectHeroFigures over the verified /api/meta body', () => {
  it('shapes every figure the hero renders', () => {
    const figures = selectHeroFigures(META_REAL);

    // Em dash, not a hyphen and not an en dash (Design Spec §3.2).
    expect(figures.seasonSpan).toBe('1950—2026');
    expect(figures.seasonCount).toBe(77);
    expect(figures.roundProgress).toEqual({ completed: 10, scheduled: 22 });
    expect(figures.lapTimingFrom).toBe(1996);
    expect(figures.state).toBe('inSeason');
    expect(figures.latestRound).toEqual({
      round: 10,
      roundName: 'Belgian Grand Prix',
      circuitRef: 'spa',
      circuitName: 'Circuit de Spa-Francorchamps',
      isoDate: '2026-07-19',
    });
    expect(figures.nextRound?.roundName).toBe('Hungarian Grand Prix');
  });

  it('reports 22 scheduled rounds for 2026, not 24 — and never adds cancelled back', () => {
    // Trap 15, mitigated upstream in `Q_LATEST_SEASON_PROGRESS`. The fixture carries
    // `cancelledRounds: 2`; a selector that "corrected" the total would produce 24, which
    // would contradict every other surface in the product.
    expect(META_REAL.latestSeason.cancelledRounds).toBe(2);
    expect(selectHeroFigures(META_REAL).roundProgress.scheduled).toBe(22);
  });

  it('exposes slugs for links, never an integer id', () => {
    const figures = selectHeroFigures(META_REAL);
    expect(figures.latestRound?.circuitRef).toBe('spa');
    expect(figures.latestRound?.circuitRef).not.toMatch(/^\d+$/);
  });
});

describe('CT-15 — no completed round is "preseason", with no last-race figure', () => {
  it('omits the last round rather than rendering a placeholder for it', () => {
    const figures = selectHeroFigures(META_NO_COMPLETED_ROUND);
    expect(figures.state).toBe('preseason');
    expect(figures.latestRound).toBeNull();
    // Round progress is still correct and still shown: "0 of 22" is a fact, not an absence.
    expect(figures.roundProgress).toEqual({ completed: 0, scheduled: 22 });
    expect(figures.nextRound?.round).toBe(1);
  });
});

describe('CT-16 — a finished season is "complete", with no next-race figure', () => {
  it('reports c of c and drops the next round', () => {
    const figures = selectHeroFigures(META_SEASON_COMPLETE);
    expect(figures.state).toBe('complete');
    expect(figures.nextRound).toBeNull();
    expect(figures.roundProgress).toEqual({ completed: 24, scheduled: 24 });
    expect(figures.latestRound?.roundName).toBe('Abu Dhabi Grand Prix');
  });
});

describe('CT-17 — seasonCount comes from the count, never from the year range', () => {
  it('is not recomputed by subtraction', () => {
    // The fixture is deliberately inconsistent: 2026 − 1950 + 1 = 77, so `META_REAL` cannot
    // distinguish the two implementations. This one can.
    const meta = { ...META_REAL, seasons: { firstYear: 1950, latestYear: 2026, count: 70 } };
    expect(meta.seasons.latestYear - meta.seasons.firstYear + 1).toBe(77);
    expect(selectHeroFigures(meta).seasonCount).toBe(70);
  });
});

describe('selectCoverageBands', () => {
  it('derives every band from meta.coverage, with nothing hard-coded', () => {
    const bands = selectCoverageBands(META_REAL);
    expect(bands.map((band) => band.label)).toEqual([
      'Results',
      'Qualifying positions',
      'Lap-by-lap timing',
      'Q1 / Q2 / Q3',
      'Pit stops',
      'Sprint races',
    ]);
    expect(bands.map((band) => band.from)).toEqual([1950, 1994, 1996, 2006, 2011, 2021]);

    // Results cover the whole domain; laps start 46/76 of the way along it.
    expect(bands[0]).toEqual({ label: 'Results', from: 1950, offset: 0, extent: 1 });
    const laps = bands[2];
    expect(laps?.offset).toBeCloseTo(46 / 76, 10);
    expect(laps?.extent).toBeCloseTo(1 - 46 / 76, 10);
  });

  it('honours a closed window rather than implying coverage to the present', () => {
    const meta = {
      ...META_REAL,
      coverage: { ...META_REAL.coverage, sprint: { from: 2021, to: 2024 } },
    };
    const sprint = selectCoverageBands(meta).at(-1);
    expect(sprint?.offset).toBeCloseTo(71 / 76, 10);
    expect(sprint?.extent).toBeCloseTo(3 / 76, 10);
  });

  it('never divides by zero on a single-season domain', () => {
    const meta = { ...META_REAL, seasons: { firstYear: 2026, latestYear: 2026, count: 1 } };
    for (const band of selectCoverageBands(meta)) {
      expect(Number.isFinite(band.offset)).toBe(true);
      expect(Number.isFinite(band.extent)).toBe(true);
    }
  });

  it('clamps rather than overflowing when a window starts before the domain', () => {
    // Not reachable from today's data, but a `from` outside the domain must not produce a
    // negative offset, which would draw the bar off the left edge of its track.
    const meta = { ...META_REAL, seasons: { firstYear: 2000, latestYear: 2026, count: 27 } };
    for (const band of selectCoverageBands(meta)) {
      expect(band.offset).toBeGreaterThanOrEqual(0);
      expect(band.offset + band.extent).toBeLessThanOrEqual(1);
    }
  });
});

describe('selectRulerTicks', () => {
  it('places the dense set at ≥768 and the sparse set below it', () => {
    expect(selectRulerTicks(META_REAL, true).map((tick) => tick.year)).toEqual([
      1950, 1970, 1990, 2010, 2026,
    ]);
    expect(selectRulerTicks(META_REAL, false).map((tick) => tick.year)).toEqual([1950, 1990, 2026]);
    expect(selectRulerTicks(META_REAL, true).at(0)?.at).toBe(0);
    expect(selectRulerTicks(META_REAL, true).at(-1)?.at).toBe(1);
  });

  it('drops a tick outside the domain instead of drawing it off the track', () => {
    const meta = {
      ...META_ZERO_SCHEDULED,
      seasons: { firstYear: 2000, latestYear: 2026, count: 27 },
    };
    expect(selectRulerTicks(meta, true).map((tick) => tick.year)).toEqual([2010, 2026]);
  });

  it('does not repeat the latest year when it is already a decade tick', () => {
    const meta = { ...META_REAL, seasons: { firstYear: 1950, latestYear: 2010, count: 61 } };
    expect(selectRulerTicks(meta, true).map((tick) => tick.year)).toEqual([1950, 1970, 1990, 2010]);
  });
});
