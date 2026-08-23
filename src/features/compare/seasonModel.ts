import type { SeriesInput, SeriesPoint } from '@/components/charts';
import type { CompareIdentity, CompareSeasonLens, SeasonEntrant } from './types';

/**
 * **The season lens's pure layer** — `DESIGN_SYSTEM.md` §6.6.6.10.
 *
 * Everything here is a function of one `CompareSeasonLens` plus the selection. No React, no
 * colour, no fetching: the shadow-suppression rule and the seat-break rule are the two things most
 * likely to be quietly wrong, and both are decidable in a unit test.
 */

/** A principal and, when there is one, the other seat in the same car. */
export interface SeasonPair {
  principal: SeriesInput;
  /**
   * The other seat, **one series per run of one occupant** — usually exactly one, and empty when
   * the car had no single second seat or when everyone who held it is also a principal.
   *
   * It is a list rather than a single series because a seat that changes hands mid-season is two
   * people's cumulative totals, and one series would **join** them. See `occupancyRuns`.
   */
  shadows: SeriesInput[];
  /** Who occupied the other seat, in round order, for the note under the plot. */
  occupants: string[];
}

/**
 * The team a driver's series is painted in for this season: **the car he raced most rounds in**,
 * ties going to the later one.
 *
 * A series takes one colour and **318 driver-seasons in this archive map one driver to more than
 * one team** — Verstappen raced 4 rounds of 2016 for Toro Rosso and 17 for Red Bull. Picking the
 * majority car is the least wrong single answer; picking it *silently* would not be, which is why
 * `teamChangeNote` exists and the surface prints it.
 */
export function plotTeamFor(entrant: SeasonEntrant): string | null {
  const tally = new Map<string, { count: number; last: number }>();
  entrant.teamAt.forEach((team, index) => {
    if (team === null) return;
    const seen = tally.get(team);
    if (seen === undefined) tally.set(team, { count: 1, last: index });
    else {
      seen.count += 1;
      seen.last = index;
    }
  });
  let best: { team: string; count: number; last: number } | null = null;
  for (const [team, seen] of tally) {
    if (
      best === null ||
      seen.count > best.count ||
      (seen.count === best.count && seen.last > best.last)
    ) {
      best = { team, count: seen.count, last: seen.last };
    }
  }
  return best?.team ?? null;
}

/** `null` when the driver raced for one team all season, which is the usual case. */
export function teamChangeNote(entrant: SeasonEntrant, name: string): string | null {
  const plot = plotTeamFor(entrant);
  if (plot === null) return null;
  const rounds = entrant.teamAt.filter((team) => team !== null).length;
  const inPlot = entrant.teamAt.filter((team) => team === plot).length;
  if (inPlot === rounds) return null;
  return `${name} raced for two teams this season. The line is drawn in the colour of the car he started ${String(inPlot)} of ${String(rounds)} rounds in.`;
}

/** A reading per round, `null` where the driver has no value at that round. */
function pointsSeries(
  rounds: readonly number[],
  values: readonly (number | null)[],
): SeriesPoint[] {
  return rounds.map((round, index) => ({ x: round, y: values[index] ?? null }));
}

/** One contiguous run of rounds held by one named occupant. */
export interface OccupancyRun {
  ref: string;
  /** Indices into the season's round list, inclusive. */
  from: number;
  to: number;
}

/**
 * **The runs of the other seat, one per occupant.** The rule that stops the season lens telling a
 * lie, and it was caught by writing the test rather than by reading the code.
 *
 * 2016 R4: the other Toro Rosso is Sainz on **4** points. 2016 R5: Verstappen is in a Red Bull and
 * the other seat is Ricciardo on **48**. One continuous series would draw a **44-point rise in a
 * single round** for "the other seat" — two different people's running totals glued together, and
 * a rise nobody scored. Every consumer therefore builds one series per run, so the gap between
 * them is a gap and not a stroke.
 *
 * Runs whose occupant is a **selected principal** are dropped: that driver already has his own
 * solid line and drawing him again as somebody's shadow would put the same data on the chart
 * twice. This is why 2016's Hamilton and Rosberg produce no shadow at all.
 */
export function occupancyRuns(
  occupant: readonly (string | null)[],
  exclude: ReadonlySet<string>,
): OccupancyRun[] {
  const runs: OccupancyRun[] = [];
  occupant.forEach((who, index) => {
    if (who === null || exclude.has(who)) return;
    const last = runs.at(-1);
    if (last !== undefined && last.ref === who && last.to === index - 1) last.to = index;
    else runs.push({ ref: who, from: index, to: index });
  });
  return runs;
}

/** Values outside `[from, to]` blanked, so one run draws one segment and nothing joins two. */
function withinRun(values: readonly (number | null)[], run: OccupancyRun): (number | null)[] {
  return values.map((value, index) => (index >= run.from && index <= run.to ? value : null));
}

/**
 * **Build the pairs the points chart draws.**
 *
 * A principal is always one series. The other seat is **one series per occupancy run**, in the
 * principal's own colour and marker, dashed, at three-quarters of the stroke — so a pair reads as
 * a pair however many people passed through the second car.
 *
 * Where the car had no single other seat there is no shadow at all: 1957's Maserati fielded
 * between four and eleven other cars at every round Fangio started, and the modern two-car team is
 * a convention rather than a rule of the sport.
 */
export function seasonPairs(
  lens: CompareSeasonLens,
  principals: readonly string[],
  nameOf: (ref: string) => string,
): SeasonPair[] {
  const rounds = lens.rounds.map((round) => round.number);
  const selected = new Set(principals);

  return principals.flatMap<SeasonPair>((ref) => {
    const entrant = lens.entrants.find((candidate) => candidate.ref === ref);
    if (entrant === undefined || !entrant.entered) return [];
    const team = plotTeamFor(entrant);
    if (team === null) return [];

    const principal: SeriesInput = {
      reference: ref,
      teamReference: team,
      label: nameOf(ref),
      role: 'principal',
      points: pointsSeries(rounds, entrant.points),
    };

    const runs = occupancyRuns(entrant.seat.occupant, selected);
    const shadows = runs.map((run, index) => ({
      reference: `${ref}::seat${String(index)}`,
      teamReference: team,
      label: seatLabel(nameOf(run.ref), runs.length === 1 ? null : boundsOf(rounds, run)),
      role: 'shadow' as const,
      points: pointsSeries(rounds, withinRun(entrant.seat.points, run)),
    }));

    return [{ principal, shadows, occupants: runs.map((run) => run.ref) }];
  });
}

/** `R1–R4`, for a seat that changed hands. `null` when there is only one run to name. */
function boundsOf(rounds: readonly number[], run: OccupancyRun): string {
  const from = rounds[run.from];
  const to = rounds[run.to];
  return from === to ? `R${String(from)}` : `R${String(from)}–R${String(to)}`;
}

/**
 * The other seat's name in the legend and the table.
 *
 * **Never a team name.** A driver who changed teams mid-season changed the *car* the seat belongs
 * to, so "the other Red Bull" would be false for the first four rounds of Verstappen's 2016. The
 * occupant is the honest label, and it is what a reader wants: the colour beside it already says
 * which car.
 */
export function seatLabel(name: string, bounds: string | null): string {
  return bounds === null ? `Other seat — ${name}` : `Other seat — ${name} ${bounds}`;
}

/** The rounds at which the other seat changed hands. Each is a break in that shadow, never a fall. */
export function seatBreaks(entrant: SeasonEntrant, rounds: readonly number[]): number[] {
  const out: number[] = [];
  entrant.seat.occupant.forEach((who, index) => {
    if (index === 0) return;
    const before = entrant.seat.occupant[index - 1];
    if (who !== null && before !== null && who !== before) {
      const round = rounds[index];
      if (round !== undefined) out.push(round);
    }
  });
  return out;
}

/**
 * **Points against the other seat, round by round** — the purest driver signal on the page and
 * about as simple as a chart gets: one line per principal, above zero means ahead of the car
 * beside him.
 *
 * A difference of two cumulative totals scored under **one** system in **one** season, so it is
 * the one figure in this product that needs no normalisation caveat at all. It is `null` at every
 * round where the seat had no single occupant, which is what keeps 1957 honest instead of drawing
 * Fangio a flat zero he never raced against.
 *
 * **It breaks at a seat change for the same reason the shadow does** — and here the jump would be
 * larger and more misleading, because it is the difference of two levels rather than one: 2016
 * Verstappen goes from +9 on Sainz at R4 to −10 on Ricciardo at R5, and nothing about his racing
 * caused that.
 */
export function seatGapSeries(
  lens: CompareSeasonLens,
  principals: readonly string[],
  nameOf: (ref: string) => string,
): SeriesInput[] {
  const rounds = lens.rounds.map((round) => round.number);
  const selected = new Set(principals);

  return principals.flatMap((ref) => {
    const entrant = lens.entrants.find((candidate) => candidate.ref === ref);
    if (entrant === undefined || !entrant.entered) return [];
    const team = plotTeamFor(entrant);
    if (team === null) return [];

    const gaps = entrant.points.map((mine, index) => {
      const theirs = entrant.seat.points[index];
      if (mine === null || theirs === null || theirs === undefined) return null;
      return mine - theirs;
    });

    const runs = occupancyRuns(entrant.seat.occupant, selected);
    return runs
      .map((run, index) => ({
        reference: runs.length === 1 ? ref : `${ref}::v${String(index)}`,
        teamReference: team,
        label:
          runs.length === 1
            ? nameOf(ref)
            : `${nameOf(ref)} vs ${nameOf(run.ref)} ${boundsOf(rounds, run)}`,
        role: 'principal' as const,
        points: pointsSeries(rounds, withinRun(gaps, run)),
      }))
      .filter((series) => series.points.some((point) => point.y !== null));
  });
}

/** The selected drivers who started no race that season. Named, never silently dropped. */
export function absentFrom(
  lens: CompareSeasonLens,
  principals: readonly string[],
): { ref: string; entrant: SeasonEntrant | undefined }[] {
  return principals
    .map((ref) => ({ ref, entrant: lens.entrants.find((candidate) => candidate.ref === ref) }))
    .filter(({ entrant }) => entrant === undefined || !entrant.entered);
}

/** The last round that has been raced. Equals the round count for a finished season. */
export function racedRounds(lens: CompareSeasonLens): number {
  let last = 0;
  lens.rounds.forEach((round, index) => {
    const anyResult = lens.entrants.some((entrant) => entrant.finish[index] !== null);
    const anySnapshot = lens.entrants.some((entrant) => entrant.points[index] !== null);
    if (anyResult || anySnapshot) last = round.number;
  });
  return last;
}

/** A driver's display name, from whatever identity source the page has. */
export function nameFrom(identity: CompareIdentity | undefined, ref: string): string {
  return identity === undefined ? ref : `${identity.forename} ${identity.surname}`;
}

/* ------------------------------------------------------------------- the finishing strip */

/** One round for one driver. Three states, and they are three different facts. */
export interface FinishCell {
  round: number;
  /** The Grand Prix's name, for the mark's own tooltip and for the table. */
  name: string;
  /** The classified finishing position, or null when there was none. */
  finish: number | null;
  /** `false` when he did not start this round at all — which is not the same as not finishing. */
  started: boolean;
  /** Where the mark sits along the season, 0–1. Computed here because jsdom measures nothing. */
  x: number;
  /** Where it sits down the position axis, 0–1. Null when there is no position to place. */
  y: number | null;
}

export interface FinishRow {
  ref: string;
  name: string;
  cells: FinishCell[];
  /** Rounds started with no classification — the lane below the axis. */
  unclassified: number;
  /** Rounds of the season he did not start. */
  missed: number;
}

export interface FinishStrip {
  rows: FinishRow[];
  /** The deepest position the axis runs to. Never shallower than `FINISH_AXIS_FLOOR`. */
  deepest: number;
  /** The podium line's offset down the axis, 0–1. */
  podium: number;
  first: number;
  last: number;
}

/**
 * The axis never runs shallower than this, however well the selection finished.
 *
 * A strip of four front-runners whose worst result is fourth would otherwise spread P1 to P4 over
 * the whole height and draw a one-place difference as the width of the chart. Ten is a round number
 * and carries **no claim about points** — the points-paying positions have changed many times and
 * this axis is not about them.
 */
export const FINISH_AXIS_FLOOR = 10;

/**
 * **Where each driver finished, round by round.** `DESIGN_SYSTEM.md` §6.6.6.14 D.
 *
 * The points chart above it answers *who was winning the championship*; this answers *what his
 * Sundays actually looked like*, which is a different question and the one a scatter of results
 * answers better than any cumulative line can.
 *
 * ⚠ **Three states per round, not two.** `finish === null` means "no classified position", and the
 * payload uses it for two different situations: he started and was not classified, and he was not
 * there at all. `teamAt[i]` separates them — it is null exactly where the driver did not start —
 * and the distinction is drawn: a start with no classification is a ring in the lane below the
 * axis, and a round he missed has no mark at all. Collapsing them would put a driver who was not
 * in the sport that weekend into the retirement lane.
 */
export function finishStrip(
  lens: CompareSeasonLens,
  principals: readonly string[],
  nameOf: (ref: string) => string,
): FinishStrip {
  const rounds = lens.rounds;
  const span = Math.max(1, rounds.length - 1);

  const entrants = principals
    .map((ref) => lens.entrants.find((candidate) => candidate.ref === ref))
    .filter((entrant): entrant is SeasonEntrant => entrant !== undefined && entrant.entered);

  let deepest = FINISH_AXIS_FLOOR;
  for (const entrant of entrants) {
    for (const finish of entrant.finish) {
      if (finish !== null && finish > deepest) deepest = finish;
    }
  }
  /* Guarded against a one-position axis: `(finish - 1) / (deepest - 1)` divides by zero at 1. */
  const depth = Math.max(1, deepest - 1);

  const rows = entrants.map((entrant) => {
    let unclassified = 0;
    let missed = 0;
    const cells = rounds.map((round, index) => {
      const finish = entrant.finish[index] ?? null;
      const started = (entrant.teamAt[index] ?? null) !== null;
      if (started && finish === null) unclassified += 1;
      if (!started) missed += 1;
      return {
        round: round.number,
        name: round.name,
        finish,
        started,
        x: index / span,
        y: finish === null ? null : Math.min(1, (finish - 1) / depth),
      };
    });
    return { ref: entrant.ref, name: nameOf(entrant.ref), cells, unclassified, missed };
  });

  return {
    rows,
    deepest,
    podium: Math.min(1, 2 / depth),
    first: rounds[0]?.number ?? 1,
    last: rounds.at(-1)?.number ?? 1,
  };
}
