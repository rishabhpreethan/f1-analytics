import { describe, expect, it } from 'vitest';
import type { StandingsProgression } from '@schemas/season';
import {
  METRICS,
  METRIC_ORDER,
  defaultSelection,
  formatPosition,
  formatRound,
  positionDomain,
  roundNamer,
  toSeriesInput,
  toggleSelection,
} from './progression';
import { selectPositionSeries, selectProgressionSeries } from './selectors';

/**
 * The progression chart's decidable half. Everything about the *plot* — the axis position, the tick
 * gutter, the G-28 clip wipe, the direct labels' de-collision, the tooltip flipping side — needs
 * layout, and jsdom has none. Those are named as unverified in the hand-off; this file covers the
 * arithmetic and the copy that decide what the plot is asked to draw.
 */

const PROGRESSION: StandingsProgression = {
  year: 2026,
  rounds: [
    { round: 1, name: 'Australian Grand Prix', date: '2026-03-08', circuitRef: 'albert_park' },
    { round: 2, name: 'Chinese Grand Prix', date: '2026-03-15', circuitRef: 'shanghai' },
  ],
  drivers: [
    {
      driverRef: 'antonelli',
      code: 'ANT',
      forename: 'Andrea Kimi',
      surname: 'Antonelli',
      teams: [{ ref: 'mercedes', name: 'Mercedes', firstRound: 1, lastRound: 2, entries: 2 }],
      adjustment: 'none',
      progression: [
        { round: 1, points: 18, position: 2 },
        { round: 2, points: 47, position: 1 },
      ],
    },
    {
      driverRef: 'hamilton',
      code: 'HAM',
      forename: 'Lewis',
      surname: 'Hamilton',
      teams: [{ ref: 'ferrari', name: 'Ferrari', firstRound: 1, lastRound: 2, entries: 2 }],
      adjustment: 'none',
      progression: [
        { round: 1, points: 25, position: 1 },
        { round: 2, points: 40, position: 2 },
      ],
    },
    {
      driverRef: 'stroll',
      code: 'STR',
      forename: 'Lance',
      surname: 'Stroll',
      teams: [
        { ref: 'aston_martin', name: 'Aston Martin', firstRound: 1, lastRound: 2, entries: 2 },
      ],
      adjustment: 'none',
      progression: [
        { round: 1, points: 0, position: null },
        { round: 2, points: 2, position: 17 },
      ],
    },
  ],
  teams: [],
  scoring: {
    systemRef: 's2026',
    systemName: '2026 - Present Championship',
    driverCounting: 'all',
    driverBestResults: null,
    teamCounting: 'all',
    teamBestResults: null,
  },
};

describe('three metrics, three charts — never one chart with two axes', () => {
  it('offers exactly three, and points is first', () => {
    expect(METRIC_ORDER).toEqual(['points', 'position', 'gap']);
  });

  it('gives every metric its own axis title, carrying the unit', () => {
    for (const id of METRIC_ORDER) {
      expect(METRICS[id].yTitle.length).toBeGreaterThan(0);
    }
    // §6.3 — a non-zero or non-obvious baseline is stated out loud, never left implied.
    expect(METRICS.gap.yTitle).toMatch(/0 is the leader/);
  });

  it('inverts only the position axis', () => {
    expect(METRICS.position.invertY).toBe(true);
    expect(METRICS.points.invertY).toBe(false);
    expect(METRICS.gap.invertY).toBe(false);
  });

  it('says on every caption that the totals are read and not summed', () => {
    // The one claim on this surface that would be an error of fact rather than of taste.
    expect(METRICS.points.caption).toMatch(/never summed/);
  });

  it('says the gap is to the leader of the championship, not of the selection', () => {
    expect(METRICS.gap.caption).toMatch(/not to the leader of the entities shown/);
  });

  it('describes the chart’s job in the aria label, never its appearance', () => {
    for (const id of METRIC_ORDER) {
      expect(METRICS[id].ariaJob).not.toMatch(/chart|line|graph|axis/i);
    }
  });
});

describe('the default selection', () => {
  const field = selectProgressionSeries(PROGRESSION, 'driver');

  it('takes the top of the championship, capped at four', () => {
    expect(defaultSelection(field)).toEqual(['antonelli', 'hamilton', 'stroll']);
  });

  it('is a slice and not a sort, so switching metric cannot change WHICH entities are shown', () => {
    // The same three keys, in the same order, whichever metric built the series.
    const byPosition = selectPositionSeries(PROGRESSION, 'driver');
    expect(defaultSelection(byPosition)).toEqual(defaultSelection(field));
  });

  it('never exceeds the comparison cap', () => {
    const many = Array.from({ length: 22 }, (_, i) => ({ ...field[0], key: `d${String(i)}` }));
    expect(defaultSelection(many as typeof field)).toHaveLength(4);
  });
});

describe('toggling the selection', () => {
  it('adds an entity', () => {
    expect(toggleSelection(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes one that is already selected', () => {
    expect(toggleSelection(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('refuses to add a fifth rather than evicting the oldest', () => {
    // §6.4 rule 3 — four rungs, four entities — depends on the cap holding. A control that quietly
    // drops something the reader chose is worse than one that plainly says it is full.
    const full = ['a', 'b', 'c', 'd'];
    expect(toggleSelection(full, 'e')).toEqual(full);
  });

  it('still allows a removal at the cap', () => {
    expect(toggleSelection(['a', 'b', 'c', 'd'], 'c')).toEqual(['a', 'b', 'd']);
  });

  it('preserves order, so the ladder’s rung assignment does not shuffle', () => {
    expect(toggleSelection(['b', 'a'], 'c')).toEqual(['b', 'a', 'c']);
  });
});

describe('the seam to the chart kit', () => {
  it('plots a driver in their team’s colour reference, not their own', () => {
    const [first] = toSeriesInput(selectProgressionSeries(PROGRESSION, 'driver'));
    expect(first?.reference).toBe('antonelli');
    expect(first?.teamReference).toBe('mercedes');
  });

  it('carries a null reading through as null, never as zero', () => {
    // Stroll holds no ranked position at round 1. A line dipping to the axis would say P0.
    const series = toSeriesInput(selectPositionSeries(PROGRESSION, 'driver', { only: ['stroll'] }));
    expect(series[0]?.points[0]).toEqual({ x: 1, y: null });
    expect(series[0]?.points[1]).toEqual({ x: 2, y: 17 });
  });
});

describe('the position axis', () => {
  it('is the size of the field, not the range the selection occupies', () => {
    // Antonelli and Hamilton ran 1st and 2nd; the axis still reaches Stroll's 17th, because the
    // reader's question is how close to the front they were.
    expect(positionDomain(selectPositionSeries(PROGRESSION, 'driver'))).toEqual([1, 17]);
  });

  it('always starts at P1 — the line the whole chart is read against', () => {
    const domain = positionDomain(
      selectPositionSeries(PROGRESSION, 'driver', { only: ['stroll'] }),
    );
    expect(domain?.[0]).toBe(1);
  });

  it('is null when nothing is ranked, so the chart falls back rather than inventing a domain', () => {
    expect(positionDomain([])).toBeNull();
  });
});

describe('the two x formatters §6.5.1 needed', () => {
  it('keeps the axis tick terse enough for the gutter', () => {
    expect(formatRound(7)).toBe('R7');
  });

  it('answers "which race" in the tooltip and the live region', () => {
    const namer = roundNamer(PROGRESSION.rounds);
    expect(namer(1)).toBe('R1 · Australian Grand Prix');
  });

  it('falls back to the terse form for a round it has no name for', () => {
    expect(roundNamer(PROGRESSION.rounds)(99)).toBe('R99');
  });

  it('reads a position in the sport’s own notation', () => {
    expect(formatPosition(7)).toBe('P7');
  });
});
