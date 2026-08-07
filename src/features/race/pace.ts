import type { DriverLaps, LapRow, RaceLaps, RaceStints, Stint } from '@schemas/race';

/**
 * The race page's metric math — pure, and separated from `selectors.ts` because this is
 * the layer where a wrong number is **silent**. A mis-shaped table is visible; a
 * degradation slope computed over in-laps looks entirely plausible and is wrong.
 *
 * Nothing here formats. Nothing here knows a colour exists.
 */

/* ================================================================== the axis ceiling */

/**
 * `DESIGN_SYSTEM.md` §6.3's mandatory lap-time axis ceiling: **`fastest × 1.5`**.
 *
 * **This constant is the one authority for that number, and that placement is a
 * decision.** The server states the *fact* — the session's fastest lap, computed over
 * non-deleted laps across the whole session (`server/schemas/race.ts`,
 * `paceSummarySchema`) — and this applies the *rule*. Two reasons it is here and not in
 * the payload:
 *
 * 1. **The multiple is a design rule.** §6.3 chose 1.5 because a lap 50% slower than the
 *    session's best is not a racing lap, which is a statement about reading a chart, not
 *    about the data. In the payload, changing it would be a server deploy, and there would
 *    be two authorities on one number the moment §6.3 moved.
 * 2. **Drift is prevented by there being one function**, not by moving the arithmetic
 *    across the wire. Both RD-2 and RD-4 call this; neither computes `× 1.5`.
 *
 * What the server placement *does* buy, and why the fastest lap is not derived here: it is
 * a property of the **session**, not of the selection. RD-2 plots ≤ 4 drivers, so a
 * ceiling derived from the rows a chart holds would move when the fourth driver is
 * toggled — the same race showing two axes on two charts, and a moving axis on one.
 *
 * Measured on 2026 R1: fastest 82,091 ms → ceiling **123,137 ms**, which sits just above
 * that race's p99 of 122,340 ms and holds 993 of its 1,003 laps.
 */
export const PACE_CEILING_MULTIPLE = 1.5;

/** Null when the session has no timed lap — never 0, which is a lap time. */
export function paceCeilingMs(fastestMs: number | null): number | null {
  if (fastestMs === null || !Number.isFinite(fastestMs) || fastestMs <= 0) return null;
  return Math.round(fastestMs * PACE_CEILING_MULTIPLE);
}

export interface OffScaleReport {
  /** Laps above the ceiling. **Counted, never dropped silently** (§6.3). */
  count: number;
  /** Their exact values, for the table view — which is what makes clipping honest. */
  laps: { lap: number; timeMs: number }[];
}

/**
 * Which laps sit above the axis ceiling.
 *
 * §6.3: *"Laps above it are never silently dropped: an off-scale caret at the ceiling in
 * the series colour, a count in a note above the plot, and their exact values in the table
 * view."* This returns both the count for the note and the values for the table, so a
 * chart cannot implement the caret without having the numbers to explain it.
 *
 * A null ceiling means no clipping applies, so nothing is off-scale.
 */
export function selectOffScale(laps: readonly LapRow[], ceilingMs: number | null): OffScaleReport {
  if (ceilingMs === null) return { count: 0, laps: [] };
  const above = laps
    .filter((lap): lap is LapRow & { timeMs: number } => lap.timeMs !== null && !lap.isDeleted)
    .filter((lap) => lap.timeMs > ceilingMs)
    .map((lap) => ({ lap: lap.lap, timeMs: lap.timeMs }));
  return { count: above.length, laps: above };
}

/* ================================================================== clean laps, §6.9 */

/**
 * `DATABASE.md` §6.9's clean-lap rule, implemented verbatim.
 *
 * A clean lap excludes:
 *
 * - **an invalidated lap** (`is_deleted`) — trap 8, and the reason this function exists
 *   rather than a `.filter(l => l.timeMs)` at each call site;
 * - **lap 1**, which carries a standing start and is not a measure of pace;
 * - **the in-lap and the out-lap** around every stop — `number BETWEEN p AND p + 1`, which
 *   is §6.9's own expression and covers both in one test. RD-4's note requires exactly
 *   this: *"pit laps and the lap immediately following must be excluded from degradation
 *   fits"*;
 * - **a lap with no recorded time**, which cannot contribute to a pace figure.
 *
 * Safety-car laps are **not** excluded here, because they cannot be identified from one
 * driver's laps — see `selectInferredSafetyCarLaps`, which needs the whole field.
 *
 * @param pitLaps the driver's own pit laps. Another driver's stop does not dirty this
 *                driver's lap, so this must be per-driver and not the race's set.
 */
export function selectCleanLaps(
  laps: readonly LapRow[],
  pitLaps: readonly number[],
): (LapRow & { timeMs: number })[] {
  const pits = new Set(pitLaps);
  return laps.filter((lap): lap is LapRow & { timeMs: number } => {
    if (lap.isDeleted) return false;
    if (lap.timeMs === null) return false;
    if (lap.lap <= 1) return false;
    // §6.9: `l.number BETWEEN p.n AND p.n + 1` — the in-lap and the out-lap.
    return !pits.has(lap.lap) && !pits.has(lap.lap - 1);
  });
}

/* ============================================================== the least-squares fit */

export interface LinearFit {
  /** Milliseconds gained per lap. Positive is degradation; negative is a track ramping up. */
  slopeMsPerLap: number;
  interceptMs: number;
  /** Coefficient of determination, 0…1. **The honesty term** — see below. */
  r2: number;
  /** Laps the fit was computed over. */
  n: number;
}

/**
 * Ordinary least squares of lap time against lap number.
 *
 * **`r2` is returned and is not optional**, because a slope without a goodness-of-fit is
 * the classic way a straight line through noise becomes a claim about tyre wear. A stint
 * of four clean laps will happily produce a confident-looking slope; whether the surface
 * draws the trend line is its call, but it cannot make that call without this number.
 *
 * Null rather than a zero slope when a fit is not defined: **fewer than 3 points**, or no
 * variance in the lap numbers. Three rather than two, because two points define a line
 * exactly and `r2` would be 1 — a perfect fit that means nothing, and the most misleading
 * output this function could produce.
 *
 * `r2` is 1 when the residual sum is 0 *and* the total sum is 0 (every lap identical),
 * which is degenerate rather than perfect; it is reported as 0 in that case, because
 * "explains all of no variation" is not a fit.
 */
export function fitLinear(points: readonly { x: number; y: number }[]): LinearFit | null {
  const n = points.length;
  if (n < 3) return null;

  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let sxx = 0;
  let sxy = 0;
  for (const point of points) {
    const dx = point.x - meanX;
    sxx += dx * dx;
    sxy += dx * (point.y - meanY);
  }
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  let residual = 0;
  let total = 0;
  for (const point of points) {
    const predicted = slope * point.x + intercept;
    residual += (point.y - predicted) ** 2;
    total += (point.y - meanY) ** 2;
  }

  return {
    slopeMsPerLap: slope,
    interceptMs: intercept,
    r2: total === 0 ? 0 : Math.max(0, 1 - residual / total),
    n,
  };
}

/* =================================================================== RD-4, degradation */

export interface StintDegradation {
  stint: Stint;
  /** The clean laps the fit used — so a surface can plot the points it was fitted to. */
  laps: { lap: number; timeMs: number }[];
  /** Null when the stint holds fewer than 3 clean laps. */
  fit: LinearFit | null;
}

/**
 * RD-4: a per-stint linear fit of lap time against lap number.
 *
 * The fit runs over §6.9 clean laps **within the stint**, which is why in-laps and
 * out-laps disappear: the in-lap is the stint's own last lap and the out-lap is the next
 * stint's first, and §6.9's `BETWEEN p AND p + 1` removes both.
 *
 * A stint's clean laps can therefore be empty (a three-lap stint is entirely in-lap,
 * out-lap and lap 1) and its fit can be null while its laps are not. Both are reported
 * rather than collapsed, so a surface can draw the points without a line.
 */
export function selectPaceDegradation(
  driver: DriverLaps,
  stints: readonly Stint[],
  pitLaps: readonly number[],
): StintDegradation[] {
  const clean = selectCleanLaps(driver.laps, pitLaps);

  return stints.map((stint) => {
    const within = clean
      .filter((lap) => lap.lap >= stint.fromLap && lap.lap <= stint.toLap)
      .map((lap) => ({ lap: lap.lap, timeMs: lap.timeMs }));
    return {
      stint,
      laps: within,
      fit: fitLinear(within.map((lap) => ({ x: lap.lap, y: lap.timeMs }))),
    };
  });
}

/* ============================================ RD-4's other honesty requirement: the SC */

export interface InferredSlowLap {
  lap: number;
  /** The field-wide median lap time on this lap. */
  medianMs: number;
  /** How much slower than the race's baseline pace, as a ratio. */
  ratio: number;
}

/**
 * The threshold above the race's baseline pace at which a lap becomes a **candidate**
 * neutralised lap.
 *
 * **Calibrated by measurement over all 578 races in the archive that hold lap data**, not
 * chosen by feel. The distribution of each race's *maximum* field-median ratio, excluding
 * lap 1:
 *
 * ```
 *   p10 1.020   p25 1.028   p50 1.270   p75 1.600   p90 1.755   p95 4.987   max 75.13
 * ```
 *
 * It is close to bimodal: a quarter of races never exceed 1.03×, and the upper half runs
 * away to 75×. **1.3 sits in the trough between the two modes**, and it is the number
 * whose consequence matches the sport: at 1.3× **284 of 577 races (49%) carry at least one
 * candidate lap**, and a safety car appears in roughly half of all Grands Prix. That
 * agreement with a known base rate is the actual justification — not a separation the data
 * hands over cleanly, because it does not.
 *
 * Two sampled races, both pinned in `pace.test.ts`:
 *
 * - **2011 R1**, a clean race: maximum 1.072× outside lap 1, so this reports **nothing**.
 *   That is the case a lower threshold gets wrong.
 * - **2026 R1**, red-flagged: maximum **1.392× at lap 12**, and laps 12, 13 and 19 clear
 *   1.3×. Note how modest that is — the race contains a 1,168,144 ms lap, 13× the median,
 *   but only the cars actually stationary recorded it, so the **field median** on that lap
 *   is nowhere near as extreme as the worst lap on it. A per-driver threshold would read
 *   that race completely differently, which is exactly why this works on the field median.
 *
 * The ratio is to the race's **own** median pace, so it means the same thing on a
 * 40-second oval and a 90-second street circuit — the reasoning §6.3 uses for its multiple.
 *
 * **Lap 1 is excluded from candidacy entirely.** A standing start makes it slower on every
 * race ever run: median 1.131×, p90 1.402×, maximum 31.2×, and **98 of 578 races would be
 * flagged on lap 1 alone** at this threshold. Including it would put an "inferred safety
 * car" note on a sixth of the archive for the ordinary fact that races start from a
 * standstill.
 *
 * **What this cannot do, stated because the output is a label on a chart:** it cannot
 * separate a safety car from a red flag, a virtual safety car, a wet restart or a lap
 * behind a recovery vehicle. All of them mean "the field was not racing", which is the
 * property that disqualifies a lap from a pace metric, and none of them is in the data.
 * There is no ground truth here to compute a false-positive rate against.
 */
export const SAFETY_CAR_RATIO = 1.3;

/**
 * Candidate neutralised laps, **labelled inferred and never as fact**.
 *
 * `REQUIREMENTS.md` RD-4 and `DATABASE.md` §6.9 both say the same thing: there is no
 * safety-car flag anywhere in the data, so this is a heuristic and its output must be
 * presented as one (`DESIGN_SYSTEM.md` §6.6.1 puts it in a `--status-info` note). The
 * function is named for what it produces — *inferred* slow laps — so a caller cannot
 * accidentally treat it as a record of what happened.
 *
 * The method: take the **median** lap time across the field on each lap, then compare it
 * to the **median of those medians** over the race. Medians at both levels rather than
 * means, twice deliberately — one driver's pit stop or spin must not move a lap's figure,
 * and the neutralised laps must not drag the baseline they are being compared against.
 *
 * It cannot distinguish a safety car from a red flag, a formation-lap restart or heavy
 * rain, and it does not try: all of them are "the field was not racing", which is the
 * property that disqualifies a lap from a pace metric.
 */
export function selectInferredSafetyCarLaps(
  raceLaps: RaceLaps,
  ratio: number = SAFETY_CAR_RATIO,
): InferredSlowLap[] {
  const byLap = new Map<number, number[]>();
  for (const driver of raceLaps.drivers) {
    for (const lap of driver.laps) {
      if (lap.isDeleted || lap.timeMs === null) continue;
      const times = byLap.get(lap.lap) ?? [];
      times.push(lap.timeMs);
      byLap.set(lap.lap, times);
    }
  }

  const medians = new Map<number, number>();
  for (const [lap, times] of byLap) medians.set(lap, median(times));
  if (medians.size === 0) return [];

  const baseline = median([...medians.values()]);
  if (baseline <= 0) return [];

  return (
    [...medians.entries()]
      // A standing start makes lap 1 slower on every race ever run: median 1.131×, p90
      // 1.402×, and 98 of 578 races would be flagged on lap 1 alone at the default ratio.
      .filter(([lap]) => lap > 1)
      .map(([lap, medianMs]) => ({ lap, medianMs, ratio: medianMs / baseline }))
      .filter((candidate) => candidate.ratio >= ratio)
      .sort((a, b) => a.lap - b.lap)
  );
}

/** The median of an unsorted array. Copies rather than sorting the caller's data. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/* ------------------------------------------------------------------------ convenience */

/**
 * Every driver's pit laps, keyed by `driverRef` — the input `selectCleanLaps` and
 * `selectPaceDegradation` both need.
 *
 * Keyed by `driverRef` alone, which is safe on a lap-scale payload: the 40 races that
 * classify one driver twice all predate 1965 and none of them has a lap row.
 */
export function selectPitLapsByDriver(stints: RaceStints): Map<string, number[]> {
  const byDriver = new Map<string, number[]>();
  for (const driver of stints.drivers) {
    byDriver.set(
      driver.driverRef,
      driver.stops.map((stop) => stop.lap),
    );
  }
  return byDriver;
}
