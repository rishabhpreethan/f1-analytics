import type { GridStatus, RaceLaps, RaceStints, Stint } from '@schemas/race';
import { paceCeilingMs, selectOffScale } from './pace';
import { selectDriverShortLabel } from './selectors';

/**
 * Chart-ready series for the race page's four lap-scale charts (RD-1, RD-2, RD-7, RD-3).
 *
 * Chart components never query and never shape (ARCHITECTURE.md §3): they take what this
 * produces. Every series carries `colorRef` — a `team.reference` — and never a colour;
 * resolving that to a token is `src/lib/entityColor.ts`'s job and nothing here knows a hex
 * exists.
 */

/* ================================================================= RD-1, the rank chart */

export interface RankSeries {
  driverRef: string;
  label: string;
  /** `team.reference`. Two cars of one team become two shades of one hue (§6.4a). */
  colorRef: string;
  gridPosition: number | null;
  gridStatus: GridStatus;
  finishPosition: number | null;
  /** Ascending by lap. */
  points: { lap: number; position: number }[];
  firstLap: number;
  lastLap: number;
}

export interface RankChartData {
  series: RankSeries[];
  /** The race's lap range, from the payload rather than from any array's bounds. */
  firstLap: number | null;
  lastLap: number | null;
  /**
   * The deepest position anyone held on any lap.
   *
   * §6.3's amended position-axis rule: the **minimum is always P1** and the maximum is the
   * deepest position *in the selection*, snapped up to the next position tick. The snapping
   * is the chart kit's (`geometry.snapToPositionTick`); this supplies the figure it snaps.
   * Null when no lap carries a position.
   */
  deepestPosition: number | null;
}

/**
 * RD-1 — the whole field, one line each. §6.5.4a's permitted many-series line.
 *
 * **Laps whose position was not recorded are dropped from the series**, and that is a
 * decision worth its comment. 16 of 627,025 race lap rows carry a null position — 2008 R4
 * Bourdais lap 6, 2014 R1 Vettel lap 26, 14 others. The alternatives were a visible gap in
 * that driver's line for one lap, or a point at a made-up position. A gap reads as missing
 * data (`REQUIREMENTS.md` §2.2) and would be a far larger claim than the one lap it covers;
 * dropping the vertex lets the line interpolate across a single lap, which cannot be
 * misread and cannot be seen. The row is still in the payload for the table view.
 *
 * Series order is the payload's — finishing position, unclassified last — so the legend and
 * the right-edge labels run in the order a reader expects.
 */
export function selectRankChart(laps: RaceLaps): RankChartData {
  let deepest: number | null = null;

  const series = laps.drivers.map((driver): RankSeries => {
    const points: { lap: number; position: number }[] = [];
    for (const lap of driver.laps) {
      if (lap.position === null) continue;
      points.push({ lap: lap.lap, position: lap.position });
      if (deepest === null || lap.position > deepest) deepest = lap.position;
    }
    return {
      driverRef: driver.driverRef,
      label: selectDriverShortLabel(driver),
      colorRef: driver.teamRef,
      gridPosition: driver.gridPosition,
      gridStatus: driver.gridStatus,
      finishPosition: driver.finishPosition,
      points,
      firstLap: driver.firstLap,
      lastLap: driver.lastLap,
    };
  });

  return {
    // A driver whose every lap lacked a position would contribute an empty line. Dropped
    // here rather than in the chart, so a series always has something to draw.
    series: series.filter((entry) => entry.points.length > 0),
    firstLap: laps.firstLap,
    lastLap: laps.lastLap,
    deepestPosition: deepest,
  };
}

/* =============================================================== RD-2, the lap-time trace */

/**
 * §6.5.2's comparison cap. RD-2's "multi-select" is this cap by another name
 * (`DESIGN_SYSTEM.md` §6.6.1), and §6.5.4a's exemption is for the rank chart alone: a
 * lap-time trace is a continuous measure whose series genuinely occlude one another.
 */
export const MAX_TRACE_SERIES = 4;

export interface LapTimeSeries {
  driverRef: string;
  label: string;
  colorRef: string;
  /** Ascending by lap. Deleted and untimed laps are absent; `deletedLaps` counts them. */
  points: { lap: number; timeMs: number }[];
  /** Laps above the axis ceiling — counted and kept, never dropped (§6.3). */
  offScale: { count: number; laps: { lap: number; timeMs: number }[] };
  /** Invalidated laps excluded from this series. Stated in the note (RD-2). */
  deletedLaps: number;
}

export interface LapTimeChartData {
  series: LapTimeSeries[];
  /** Requested drivers beyond the cap, so a surface can say what it is not showing. */
  omitted: string[];
  /** The session's fastest lap — server-stated, and independent of this selection. */
  fastestMs: number | null;
  /** `fastest × 1.5` (§6.3). Null when the session has no timed lap. */
  ceilingMs: number | null;
  /** Off-scale laps across the whole selection — the figure the note above the plot states. */
  offScaleCount: number;
  /** Invalidated laps across the whole selection. **0 on every race in this data.** */
  deletedCount: number;
}

/**
 * RD-2 — lap time against lap number for up to four drivers.
 *
 * **The ceiling comes from the session, not from the selection**, which is the whole reason
 * `pace.fastest` is server-stated: a ceiling derived from the four drivers on screen would
 * move when the fourth is toggled, so one race would show two different axes on its two
 * lap charts and a shifting axis on one of them.
 *
 * Drivers beyond `MAX_TRACE_SERIES` are **reported in `omitted` rather than silently
 * dropped**. A selector that quietly truncated would make an over-limit selection look like
 * a rendering bug.
 */
export function selectLapTimeChart(
  laps: RaceLaps,
  driverRefs: readonly string[],
): LapTimeChartData {
  const byRef = new Map(laps.drivers.map((driver) => [driver.driverRef, driver]));
  const requested = driverRefs.filter((ref) => byRef.has(ref));
  const selected = requested.slice(0, MAX_TRACE_SERIES);
  const ceilingMs = paceCeilingMs(laps.pace.fastest?.timeMs ?? null);

  const series = selected.flatMap((ref): LapTimeSeries[] => {
    const driver = byRef.get(ref);
    if (driver === undefined) return [];
    const points = driver.laps
      .filter(
        (lap): lap is typeof lap & { timeMs: number } => !lap.isDeleted && lap.timeMs !== null,
      )
      .map((lap) => ({ lap: lap.lap, timeMs: lap.timeMs }));
    return [
      {
        driverRef: driver.driverRef,
        label: selectDriverShortLabel(driver),
        colorRef: driver.teamRef,
        points,
        offScale: selectOffScale(driver.laps, ceilingMs),
        deletedLaps: driver.laps.filter((lap) => lap.isDeleted).length,
      },
    ];
  });

  return {
    series,
    omitted: requested.slice(MAX_TRACE_SERIES),
    fastestMs: laps.pace.fastest?.timeMs ?? null,
    ceilingMs,
    offScaleCount: series.reduce((sum, entry) => sum + entry.offScale.count, 0),
    deletedCount: series.reduce((sum, entry) => sum + entry.deletedLaps, 0),
  };
}

/* ================================================================ RD-7, the pit timeline */

/**
 * The pit-duration axis ceiling: **twice the race's median stop**.
 *
 * `DESIGN_SYSTEM.md` §6.6.1 says RD-7 has *"the same outlier problem as the lap trace and
 * the same treatment"*. The problem is the same; **the same rule is wrong**, and this is a
 * deliberate departure from that sentence, measured rather than argued.
 *
 * Applying §6.3's `fastest × 1.5` to pit durations, across all 319 races that hold them:
 * it clips **1,910 of 12,582 stops — 15.2% — in 217 of 319 races**. That is not clipping
 * outliers, it is clipping the data. On 2026 R1 it puts the ceiling at 26,474 ms and throws
 * **7 of 32** stops off-scale, **five of them ordinary 27–36-second stops**.
 *
 * The reason the rule does not transfer is what the two references *mean*. A session's
 * fastest lap is a **capability**: the car went round in that time, so a lap 50% slower is
 * not a racing lap. A race's fastest stop is a single best case, and legitimate stops exceed
 * it widely — `p90 / fastest` has a median of 1.27 across races but a p90 of **1.95**,
 * because `pit_stop.duration_ms` mixes stationary time and pit-lane transit between eras
 * (trap 10) and varies with circuit and traffic.
 *
 * The median is the robust centre, and `median × 2` clips **457 of 12,582 stops — 3.6% — in
 * 79 of 319 races**. On 2026 R1 the median is 19,070 ms, the ceiling 38,140 ms, and it
 * clips **exactly the two red-flag stops** (972,356 and 1,081,553 ms) while keeping that
 * race's p90 of 34,615 ms on scale. That is the behaviour §6.6.1 asks for; `fastest × 1.5`
 * is not.
 *
 * | rule | stops clipped | races affected |
 * |---|---|---|
 * | `fastest × 1.5` | 1,910 / 12,582 (15.2%) | 217 / 319 |
 * | `fastest × 2` | 691 (5.5%) | 111 / 319 |
 * | **`median × 2`** | **457 (3.6%)** | **79 / 319** |
 * | `median × 3` | 385 (3.1%) | 41 / 319 |
 *
 * `median × 3` clips less still, and 2 is preferred because at 3 the ceiling on 2026 R1
 * would be 57,210 ms — nearly double the slowest genuine stop — so most of the axis would
 * be empty. Reported to the designer rather than changed in §6.6.1, which is its file.
 */
export const PIT_CEILING_MEDIAN_MULTIPLE = 2;

/**
 * The ceiling, from the **server-stated** median — `durations.medianMs`.
 *
 * It takes the figure rather than the durations, and that is a correction to this function's
 * first version rather than a preference. Recomputing the median here produced **38,021 ms**
 * on 2026 R1 where the server reports **38,140**, because the two used different definitions
 * of a median on an even-sized set: `paceSummarySchema`'s nearest-rank picks an *observed*
 * value (19,070 ms, a stop that happened), and averaging the two middle values invents one
 * (19,010.5 ms, which no stop took). Nearest-rank is right for the server, because
 * `durations.medianMs` is displayed and a median lap time nobody ran is a wrong number on a
 * page.
 *
 * That is the same drift the axis ceiling is designed to prevent, one level down: two
 * definitions of one statistic, disagreeing by 119 ms, in a chart's axis and its caption. So
 * there is one definition, it lives in the query layer, and this consumes it — exactly as
 * `paceCeilingMs` consumes the server's fastest lap.
 */
export function pitCeilingMs(medianMs: number | null): number | null {
  if (medianMs === null || !Number.isFinite(medianMs) || medianMs <= 0) return null;
  return Math.round(medianMs * PIT_CEILING_MEDIAN_MULTIPLE);
}

export interface PitStopMark {
  stopNumber: number;
  lap: number;
  durationMs: number | null;
  /** Above the ceiling — drawn as a caret at it, with the exact value in the table (§6.3). */
  isOffScale: boolean;
}

export interface PitTimelineRow {
  driverRef: string;
  label: string;
  colorRef: string;
  stops: PitStopMark[];
}

export interface PitTimelineData {
  rows: PitTimelineRow[];
  ceilingMs: number | null;
  fastestMs: number | null;
  medianMs: number | null;
  slowestMs: number | null;
  offScaleCount: number;
  /** Stops that happened with no recorded duration. **0 on every race in this data.** */
  untimedCount: number;
}

/**
 * RD-7 — one horizontal bar per stop, length = duration, `scaleBand` by driver.
 *
 * Only drivers who actually stopped get a row: a pit timeline listing eighteen drivers with
 * no bars is a chart of an absence. That is the opposite choice from `selectStintChart`,
 * where a driver who never stopped is the most interesting row on the plot.
 */
export function selectPitTimeline(stints: RaceStints): PitTimelineData {
  // Every distribution figure is the server's (`buildPitDurationSummary`), not recomputed.
  // One definition of a median, in the query layer — see `pitCeilingMs`.
  const { fastestMs, medianMs, slowestMs, stops, timedStops } = stints.durations;
  const ceilingMs = pitCeilingMs(medianMs);

  let offScaleCount = 0;

  const rows = stints.drivers
    .filter((driver) => driver.stops.length > 0)
    .map((driver): PitTimelineRow => ({
      driverRef: driver.driverRef,
      label: selectDriverShortLabel(driver),
      colorRef: driver.teamRef,
      stops: driver.stops.map((stop) => {
        const isOffScale =
          ceilingMs !== null && stop.durationMs !== null && stop.durationMs > ceilingMs;
        if (isOffScale) offScaleCount += 1;
        return {
          stopNumber: stop.stopNumber,
          lap: stop.lap,
          durationMs: stop.durationMs,
          isOffScale,
        };
      }),
    }));

  return {
    rows,
    ceilingMs,
    fastestMs,
    medianMs,
    slowestMs,
    offScaleCount,
    untimedCount: stops - timedStops,
  };
}

/* ================================================================ RD-3, the stint chart */

export interface StintChartRow {
  driverRef: string;
  label: string;
  colorRef: string;
  lastLap: number;
  stints: Stint[];
}

export interface StintChartData {
  rows: StintChartRow[];
  /** The lap axis the stacked bars run along. Null when nobody has a lap row. */
  firstLap: number | null;
  lastLap: number | null;
}

/**
 * RD-3 — a stacked horizontal bar per driver, segments = stints.
 *
 * **Every driver with a lap row gets a row, including one who never stopped.** A no-stop
 * run is a single full-length segment and is the most informative row a strategy chart can
 * carry; omitting it — which filtering on `stops.length` would do, as `selectPitTimeline`
 * deliberately does for a different reason — would hide the strategy the chart exists to
 * show. `server/queries/race.ts` drives the stint query off lap spans rather than off stops
 * for exactly this.
 *
 * The lap axis runs to the **deepest** `lastLap` in the payload, so a retirement's bar
 * stops short against a common scale rather than each row having its own.
 */
export function selectStintChart(stints: RaceStints): StintChartData {
  const rows = stints.drivers
    .filter((driver) => driver.stints.length > 0)
    .map((driver): StintChartRow => ({
      driverRef: driver.driverRef,
      label: selectDriverShortLabel(driver),
      colorRef: driver.teamRef,
      lastLap: driver.lastLap,
      stints: driver.stints,
    }));

  let firstLap: number | null = null;
  let lastLap: number | null = null;
  for (const row of rows) {
    for (const stint of row.stints) {
      if (firstLap === null || stint.fromLap < firstLap) firstLap = stint.fromLap;
      if (lastLap === null || stint.toLap > lastLap) lastLap = stint.toLap;
    }
  }

  return { rows, firstLap, lastLap };
}
