import { describe, expect, it } from 'vitest';
import {
  laps2026Fixture,
  makeDriverLaps,
  makeLapRow,
  stints2026Fixture,
} from '@schemas/race.fixture';
import type { RaceLaps, RaceStints } from '@schemas/race';
import {
  MAX_TRACE_SERIES,
  PIT_CEILING_MEDIAN_MULTIPLE,
  pitCeilingMs,
  selectLapTimeChart,
  selectPitTimeline,
  selectRankChart,
  selectStintChart,
} from './series';

/* ==================================================================================
 * RD-1 — the rank chart.
 * ================================================================================== */

describe('selectRankChart — §6.5.4a, the whole field', () => {
  it('produces one series per driver, in the payload order', () => {
    const chart = selectRankChart(laps2026Fixture);
    expect(chart.series.map((entry) => entry.driverRef)).toEqual([
      'russell',
      'max_verstappen',
      'leclerc',
    ]);
  });

  it('carries teamRef as the colour reference and nothing resembling a colour', () => {
    const chart = selectRankChart(laps2026Fixture);
    expect(chart.series[0]?.colorRef).toBe('mercedes');
    expect(JSON.stringify(chart)).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  /**
   * 16 of 627,025 race lap rows carry a null position. A visible gap for one lap reads as
   * missing data (REQUIREMENTS §2.2) — a far larger claim than the lap it covers — so the
   * vertex is dropped and the line interpolates across it invisibly. The row is still in the
   * payload for the table view.
   */
  it('drops a lap with no recorded position rather than leaving a gap in the line', () => {
    const leclerc = selectRankChart(laps2026Fixture).series.find(
      (entry) => entry.driverRef === 'leclerc',
    );
    // The fixture's Leclerc has laps 1, 2, 3 with lap 2's position null.
    expect(leclerc?.points.map((point) => point.lap)).toEqual([1, 3]);
    expect(leclerc?.points.every((point) => point.position > 0)).toBe(true);
  });

  it('states the lap range from the payload, not from any array bounds', () => {
    const chart = selectRankChart(laps2026Fixture);
    expect(chart.firstLap).toBe(1);
    expect(chart.lastLap).toBe(58);
  });

  /**
   * §6.3's amended position-axis rule: the minimum is always P1 and the maximum is the
   * deepest position in the selection, snapped up to the next tick. This supplies the
   * figure; the snapping is the chart kit's.
   */
  it('reports the deepest position anyone held, for the axis maximum', () => {
    expect(selectRankChart(laps2026Fixture).deepestPosition).toBe(12);
  });

  it('carries the grid state so the left-edge label can distinguish a pit-lane start', () => {
    const verstappen = selectRankChart(laps2026Fixture).series.find(
      (entry) => entry.driverRef === 'max_verstappen',
    );
    expect(verstappen?.gridStatus).toBe('pitLane');
    expect(verstappen?.gridPosition).toBeNull();
  });

  it('labels a driver with no abbreviation by surname', () => {
    const laps: RaceLaps = {
      ...laps2026Fixture,
      drivers: [makeDriverLaps({ driverRef: 'hakkinen', code: null, surname: 'Häkkinen' })],
    };
    expect(selectRankChart(laps).series[0]?.label).toBe('Häkkinen');
  });

  it('omits a driver whose every lap lacked a position rather than drawing an empty line', () => {
    const laps: RaceLaps = {
      ...laps2026Fixture,
      drivers: [
        makeDriverLaps({ driverRef: 'ghost', laps: [makeLapRow({ lap: 1, position: null })] }),
        makeDriverLaps({ driverRef: 'real', laps: [makeLapRow({ lap: 1, position: 1 })] }),
      ],
    };
    expect(selectRankChart(laps).series.map((entry) => entry.driverRef)).toEqual(['real']);
  });

  it('is empty and null-ranged on a race with no lap rows — the 1988 case', () => {
    const chart = selectRankChart({
      ...laps2026Fixture,
      firstLap: null,
      lastLap: null,
      drivers: [],
    });
    expect(chart).toEqual({ series: [], firstLap: null, lastLap: null, deepestPosition: null });
  });
});

/* ==================================================================================
 * RD-2 — the lap-time trace.
 * ================================================================================== */

describe('selectLapTimeChart — the ceiling is the session’s, not the selection’s', () => {
  it('caps the selection at four series, per §6.5.2', () => {
    expect(MAX_TRACE_SERIES).toBe(4);
  });

  /**
   * The reason `pace.fastest` is server-stated. A ceiling derived from the drivers on
   * screen would move when the fourth is toggled, so the same race would show two axes on
   * its two lap charts.
   */
  it('gives the same ceiling for one driver as for three', () => {
    const one = selectLapTimeChart(laps2026Fixture, ['leclerc']);
    const three = selectLapTimeChart(laps2026Fixture, ['russell', 'max_verstappen', 'leclerc']);
    expect(one.ceilingMs).toBe(123_137);
    expect(three.ceilingMs).toBe(123_137);
    // …even though Leclerc alone never set the session's fastest lap.
    expect(one.fastestMs).toBe(82_091);
  });

  it('reports drivers beyond the cap rather than silently dropping them', () => {
    const laps: RaceLaps = {
      ...laps2026Fixture,
      drivers: ['a', 'b', 'c', 'd', 'e'].map((ref) => makeDriverLaps({ driverRef: ref })),
    };
    const chart = selectLapTimeChart(laps, ['a', 'b', 'c', 'd', 'e']);
    expect(chart.series.map((entry) => entry.driverRef)).toEqual(['a', 'b', 'c', 'd']);
    expect(chart.omitted).toEqual(['e']);
  });

  it('ignores a requested driver who is not in the payload', () => {
    const chart = selectLapTimeChart(laps2026Fixture, ['nobody', 'russell']);
    expect(chart.series.map((entry) => entry.driverRef)).toEqual(['russell']);
    expect(chart.omitted).toEqual([]);
  });

  it('honours the requested order, so colour follows the entity and not the payload order', () => {
    const chart = selectLapTimeChart(laps2026Fixture, ['leclerc', 'russell']);
    expect(chart.series.map((entry) => entry.driverRef)).toEqual(['leclerc', 'russell']);
  });

  /** §6.3: off-scale laps are counted and their values kept, never dropped. */
  it('counts the off-scale laps and keeps their exact values', () => {
    const chart = selectLapTimeChart(laps2026Fixture, ['russell']);
    expect(chart.offScaleCount).toBe(1);
    expect(chart.series[0]?.offScale.laps).toEqual([{ lap: 3, timeMs: 1_168_144 }]);
    // …and the point is still in the series, so the trace is not truncated.
    expect(chart.series[0]?.points).toHaveLength(3);
  });

  /**
   * RD-2: invalidated laps are excluded from the series and stated in the note. On this
   * data the count is always 0 — `is_deleted` is 1 on no race lap row — so the path is
   * exercised with a synthetic row rather than left untested.
   */
  it('excludes a deleted lap from the series and counts it for the note', () => {
    const laps: RaceLaps = {
      ...laps2026Fixture,
      drivers: [
        makeDriverLaps({
          driverRef: 'x',
          laps: [
            makeLapRow({ lap: 2, timeMs: 85_000 }),
            makeLapRow({ lap: 3, timeMs: 84_000, isDeleted: true }),
            makeLapRow({ lap: 4, timeMs: 85_500 }),
          ],
        }),
      ],
    };
    const chart = selectLapTimeChart(laps, ['x']);
    expect(chart.series[0]?.points.map((point) => point.lap)).toEqual([2, 4]);
    expect(chart.deletedCount).toBe(1);
  });

  it('excludes a lap with no recorded time from the series', () => {
    const laps: RaceLaps = {
      ...laps2026Fixture,
      drivers: [
        makeDriverLaps({
          driverRef: 'x',
          laps: [makeLapRow({ lap: 2, timeMs: null }), makeLapRow({ lap: 3, timeMs: 85_000 })],
        }),
      ],
    };
    expect(selectLapTimeChart(laps, ['x']).series[0]?.points.map((p) => p.lap)).toEqual([3]);
  });

  it('has a null ceiling on a race with no timed lap, so nothing is clipped', () => {
    const chart = selectLapTimeChart(
      {
        ...laps2026Fixture,
        drivers: [],
        pace: { ...laps2026Fixture.pace, fastest: null },
      },
      [],
    );
    expect(chart.ceilingMs).toBeNull();
    expect(chart.offScaleCount).toBe(0);
  });
});

/* ==================================================================================
 * RD-7 — the pit timeline. The rule departs from §6.6.1's text, on measurement.
 * ================================================================================== */

describe('pitCeilingMs — median × 2, and NOT §6.3’s fastest × 1.5', () => {
  it('is twice the server-stated median', () => {
    expect(PIT_CEILING_MEDIAN_MULTIPLE).toBe(2);
    expect(pitCeilingMs(20_000)).toBe(40_000);
  });

  /**
   * The measured case. 2026 R1's 32 stops: fastest 17,649, **server-stated median 19,070**,
   * p90 34,615, and two red-flag stops at 972,356 and 1,081,553.
   *
   * `median × 2` = 38,140 clips exactly the two stoppages and keeps the p90 on scale.
   * §6.3's `fastest × 1.5` = 26,474 would clip **7 of the 32** — five of them ordinary
   * 27–36 s stops. Across the archive that rule clips 15.2% of all 12,582 stops in 217 of
   * 319 races.
   */
  it('clips only the stoppages on 2026 R1, where fastest × 1.5 would clip seven stops', () => {
    const stops2026 = [
      17_649, 17_664, 17_741, 17_794, 18_078, 18_118, 18_190, 18_266, 18_404, 18_506, 18_561,
      18_570, 18_672, 18_774, 18_916, 18_951, 19_070, 19_112, 19_859, 20_985, 21_371, 22_469,
      22_619, 25_895, 25_939, 27_733, 30_387, 33_182, 34_615, 36_686, 972_356, 1_081_553,
    ];
    // The figure the server reports for this race — nearest-rank, so an observed stop.
    const ceiling = pitCeilingMs(19_070);
    expect(ceiling).toBe(38_140);
    expect(stops2026.filter((ms) => ms > (ceiling ?? 0))).toEqual([972_356, 1_081_553]);

    // The rule §6.6.1's text would have implied, for contrast.
    const fastestRule = Math.round(17_649 * 1.5);
    expect(fastestRule).toBe(26_474);
    expect(stops2026.filter((ms) => ms > fastestRule)).toEqual([
      27_733, 30_387, 33_182, 34_615, 36_686, 972_356, 1_081_553,
    ]);
    // Five of those seven are ordinary stops, which is the objection.
    expect(stops2026.filter((ms) => ms > fastestRule && ms < 100_000)).toHaveLength(5);
  });

  /**
   * The correction this function's signature carries. Recomputing the median locally gave
   * 38,021 against the server's 38,140 — two definitions of one statistic disagreeing by
   * 119 ms between a chart's axis and its caption, which is the drift the whole
   * server-states-the-fact pattern exists to prevent.
   */
  it('takes the stated median rather than recomputing one that would disagree', () => {
    // 2026 R1's two middle stops are 18,951 and 19,070. Nearest-rank reports the second,
    // an observed stop; averaging them invents 19,010.5, which no stop took.
    const nearestRank = 19_070;
    const averagedMiddle = (18_951 + 19_070) / 2;
    expect(pitCeilingMs(nearestRank)).toBe(38_140);
    expect(pitCeilingMs(averagedMiddle)).toBe(38_021);
    expect(pitCeilingMs(nearestRank)).not.toBe(pitCeilingMs(averagedMiddle));
  });

  it('is null with no timed stop rather than 0', () => {
    expect(pitCeilingMs(null)).toBeNull();
    expect(pitCeilingMs(0)).toBeNull();
  });
});

describe('selectPitTimeline', () => {
  it('lists only drivers who stopped — a row of no bars is a chart of an absence', () => {
    const stints: RaceStints = {
      ...stints2026Fixture,
      drivers: [
        ...stints2026Fixture.drivers,
        {
          driverRef: 'nostop',
          code: 'NST',
          surname: 'Nostop',
          teamRef: 't',
          lastLap: 58,
          stops: [],
          stints: [{ stint: 1, fromLap: 1, toLap: 58, laps: 58, endedByStop: null }],
        },
      ],
    };
    expect(selectPitTimeline(stints).rows.map((row) => row.driverRef)).toEqual([
      'russell',
      'max_verstappen',
    ]);
  });

  /**
   * The fixture's `durations` block holds the **whole race's** figures (32 stops, median
   * 24,318) while its `drivers` array is abbreviated to four stops. That is the shape of the
   * real payload too — the summary is session-wide and the rows may be filtered — and it is
   * why the ceiling comes from the summary rather than from the rows on screen.
   */
  it('takes the ceiling from the session summary, not from the rows it renders', () => {
    const timeline = selectPitTimeline(stints2026Fixture);
    expect(timeline.ceilingMs).toBe(48_636);
    // The two red-flag stops in the abbreviated rows sit above it.
    expect(timeline.offScaleCount).toBe(2);
    const marks = timeline.rows.flatMap((row) => row.stops);
    expect(marks.filter((mark) => mark.isOffScale).map((mark) => mark.durationMs)).toEqual([
      1_081_553, 1_079_002,
    ]);
  });

  it('reports a stop with no recorded duration as neither clipped nor on-scale', () => {
    const stints: RaceStints = {
      ...stints2026Fixture,
      durations: { ...stints2026Fixture.durations, stops: 2, timedStops: 1 },
      drivers: [
        {
          driverRef: 'x',
          code: 'X',
          surname: 'X',
          teamRef: 't',
          lastLap: 58,
          stops: [
            { stopNumber: 1, lap: 10, durationMs: null },
            { stopNumber: 2, lap: 30, durationMs: 20_000 },
          ],
          stints: [],
        },
      ],
    };
    const timeline = selectPitTimeline(stints);
    expect(timeline.untimedCount).toBe(1);
    expect(timeline.rows[0]?.stops[0]).toMatchObject({ durationMs: null, isOffScale: false });
  });

  it('reports the distribution so a caption can state it, from the server’s figures', () => {
    const timeline = selectPitTimeline(stints2026Fixture);
    expect(timeline.fastestMs).toBe(17_649);
    expect(timeline.medianMs).toBe(24_318);
    expect(timeline.slowestMs).toBe(1_081_553);
  });

  it('is empty on a race with no stops — 1996 and 2021 R12', () => {
    const timeline = selectPitTimeline({
      ...stints2026Fixture,
      drivers: [],
      durations: {
        stops: 0,
        timedStops: 0,
        fastestMs: null,
        medianMs: null,
        p90Ms: null,
        slowestMs: null,
      },
    });
    expect(timeline.rows).toEqual([]);
    expect(timeline.ceilingMs).toBeNull();
    expect(timeline.offScaleCount).toBe(0);
    expect(timeline.untimedCount).toBe(0);
  });
});

/* ==================================================================================
 * RD-3 — the stint chart. The opposite inclusion rule from RD-7, deliberately.
 * ================================================================================== */

describe('selectStintChart', () => {
  /**
   * The contrast with `selectPitTimeline` is the point. A driver who never stopped has no
   * bar on a pit timeline and is the most informative row on a strategy chart — one
   * full-length segment. Filtering on `stops.length` here would hide exactly the strategy
   * the chart exists to show.
   */
  it('includes a driver who never stopped, as one full-length stint', () => {
    const stints: RaceStints = {
      ...stints2026Fixture,
      drivers: [
        {
          driverRef: 'nostop',
          code: 'NST',
          surname: 'Nostop',
          teamRef: 't',
          lastLap: 58,
          stops: [],
          stints: [{ stint: 1, fromLap: 1, toLap: 58, laps: 58, endedByStop: null }],
        },
      ],
    };
    const chart = selectStintChart(stints);
    expect(chart.rows.map((row) => row.driverRef)).toEqual(['nostop']);
    expect(chart.rows[0]?.stints).toHaveLength(1);
  });

  it('runs the lap axis to the deepest lastLap so every bar shares one scale', () => {
    const chart = selectStintChart(stints2026Fixture);
    expect(chart.firstLap).toBe(1);
    expect(chart.lastLap).toBe(58);
  });

  it('keeps a one-lap stint, which 494 race stops produce', () => {
    const verstappen = selectStintChart(stints2026Fixture).rows.find(
      (row) => row.driverRef === 'max_verstappen',
    );
    expect(verstappen?.stints.map((stint) => stint.laps)).toEqual([3, 1, 54]);
  });

  it('carries teamRef and no colour', () => {
    const chart = selectStintChart(stints2026Fixture);
    expect(chart.rows[0]?.colorRef).toBe('mercedes');
    expect(JSON.stringify(chart)).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it('is empty and null-ranged with no drivers', () => {
    expect(selectStintChart({ ...stints2026Fixture, drivers: [] })).toEqual({
      rows: [],
      firstLap: null,
      lastLap: null,
    });
  });
});
