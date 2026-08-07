import type { SeriesInput } from '@/components/charts';
import { COMPARISON_CAP } from '@/components/charts';
import { POSITION_TICKS } from '@/components/charts/geometry';
import type { ProgressionSeries, SeriesKind } from './selectors';

/**
 * **The progression chart's own presentation logic** — pure, and separated from the components for
 * the same reason `presenters.ts` is: it is the only part of a chart jsdom can decide.
 *
 * Nothing here computes a championship figure. `selectProgressionSeries`, `selectPositionSeries` and
 * `selectGapToLeader` produce the numbers; this decides which metric is offered, what its axis says,
 * and which four entities are selected by default.
 */

/**
 * The three readings of one season, and each answers a different question. They are **three charts,
 * never one chart with two axes** — §6.2's first non-negotiable, and the reason this is an exclusive
 * choice rather than a set of toggles.
 */
export type ProgressionMetric = 'points' | 'position' | 'gap';

export interface MetricSpec {
  id: ProgressionMetric;
  /** The segmented control's label. */
  label: string;
  /** The chart title. */
  title: string;
  /**
   * The measure axis title. **Carries the unit, and states a non-zero baseline out loud** (§6.3) —
   * being quiet about a truncated axis is what turns it into a lie.
   */
  yTitle: string;
  /** §6.3 — a position axis is inverted, P1 at the top. */
  invertY: boolean;
  /** The gap axis is anchored at zero, because zero *is* the leader and the metric is a distance. */
  zeroBaseline: boolean;
  /** The `aria-label`: the chart's job and its headline reading, never its appearance. */
  ariaJob: string;
  /** Under the plot — the metric's definition, and where its numbers come from. */
  caption: string;
}

/**
 * **`points` is the default, and the caption on all three says the totals are read, not summed.**
 *
 * That sentence is not boilerplate. 1950 reads Farina 30 under the best-4 rule and 2026 reads 30
 * under a different system entirely; the axis is honest only because every value on it came out of
 * `driver_championship` already scored (`DATABASE.md` §7 trap 4).
 */
export const METRICS: Record<ProgressionMetric, MetricSpec> = {
  points: {
    id: 'points',
    label: 'Points',
    title: 'Championship points by round',
    yTitle: 'Cumulative championship points',
    invertY: false,
    zeroBaseline: true,
    ariaJob: 'Cumulative championship points after each round',
    caption:
      'Cumulative championship points as the season’s own scoring rules awarded them, read from the championship record after each round — never summed from race results.',
  },
  position: {
    id: 'position',
    label: 'Position',
    title: 'Championship position by round',
    /* No "does not start at 0" clause needed: the axis is inverted and its ticks are the fixed
     * position set, so there is no baseline to be quiet about. */
    yTitle: 'Championship position',
    invertY: true,
    zeroBaseline: false,
    ariaJob: 'Championship position after each round, with first place at the top',
    caption:
      'Championship standing after each round. A gap in a line is a round the entity held no ranked position in — which is not the same as last place.',
  },
  gap: {
    id: 'gap',
    label: 'Gap to leader',
    title: 'Points behind the leader',
    yTitle: 'Points behind the championship leader — 0 is the leader',
    invertY: false,
    zeroBaseline: true,
    ariaJob: 'Points behind the championship leader after each round',
    caption:
      'Distance to the leader of the whole championship after each round, not to the leader of the entities shown — so two midfielders both sit a long way below zero, which is the point of the metric.',
  },
};

export const METRIC_ORDER: readonly ProgressionMetric[] = ['points', 'position', 'gap'];

/** Drivers or teams. A season before 1958 offers only drivers, because there was no other title. */
export const KIND_LABEL: Record<SeriesKind, string> = { driver: 'Drivers', team: 'Constructors' };

/**
 * The four entities selected when the surface first renders: **the top of the championship**.
 *
 * Four because §6.2 caps comparison at four and §6.5.2 makes direct labels the primary
 * identification at that count — so the default view is the one the design system is strongest at,
 * rather than a 22-series spaghetti chart that would need small multiples (§6.5.4).
 *
 * The series arrive ordered by final standing, so this is a `slice` and **not** a sort: sorting here
 * would make the selection depend on the metric, and switching from points to position would silently
 * change *which* drivers are shown as well as what is plotted.
 */
export function defaultSelection(series: readonly ProgressionSeries[]): string[] {
  return series.slice(0, COMPARISON_CAP).map((entry) => entry.key);
}

/**
 * Add or remove an entity, respecting the cap.
 *
 * **A selection at the cap does not silently drop its oldest member.** The chips disable instead
 * (§6.4 rule 3 depends on the cap holding), because a control that quietly evicts something the
 * reader chose is worse than one that plainly says it is full. Order is preserved so the ladder's
 * rung assignment — which is by stable entity order, never by rank — does not shuffle.
 */
export function toggleSelection(selected: readonly string[], key: string): string[] {
  if (selected.includes(key)) return selected.filter((entry) => entry !== key);
  if (selected.length >= COMPARISON_CAP) return [...selected];
  return [...selected, key];
}

/**
 * Turn the selectors' output into the kit's `SeriesInput`.
 *
 * The two shapes are deliberately different — `types.ts` says the kit is built against fixtures
 * rather than an endpoint, *"because a chart component that only works against one response shape is
 * that endpoint's renderer"* — so this is the seam, and it is four lines rather than a leak.
 *
 * `teamReference` is `colorRef`, which is the team's reference for a driver: **a driver plots in
 * their team's colour**, and two drivers of one team is the teammate case §6.4a makes marker and
 * dash mandatory for.
 */
export function toSeriesInput(series: readonly ProgressionSeries[]): SeriesInput[] {
  return series.map((entry) => ({
    reference: entry.key,
    teamReference: entry.colorRef,
    label: entry.label,
    points: entry.points.map((point) => ({ x: point.round, y: point.value })),
  }));
}

/**
 * The measure domain for the **position** metric: **P1, pinned, to just past the deepest position
 * the selection actually reached.**
 *
 * > **Reversed on seeing it, 2026-08-07.** This returned `[1, max(whole field)]`, on the argument
 * > that "the axis is the size of the field, because the reader's question is how close to the front
 * > they were". Rishabh's capture killed that argument: with four title contenders in P1–P4 against
 * > a P1–P20 axis, **about 80% of the plot was empty** and it read as a chart that had failed to
 * > load its lower half. The reasoning was also half wrong — *"how close to the front"* is answered
 * > by **P1 being on the axis**, which pinning the top of the domain guarantees, and not by
 * > rendering fifteen positions nobody in the selection ever held.
 * >
 * > So the rule is now: **the minimum is always P1** — the line the whole chart is read against,
 * > and never derived from the data — and the maximum is the deepest position *in the selection*,
 * > snapped up to the next §6.3 position tick so the axis ends on a labelled gridline rather than on
 * > a data point. A comparison that includes a midfielder still gets a deep axis, because the
 * > selection reaches there; a title fight gets a tight one.
 * >
 * > **This is not the truncation §6.3 forbids.** That rule is about *length* being the encoding —
 * > a bar or an area, where a short axis inflates a difference. Position is an ordinal read off a
 * > labelled axis, and every gridline says `P5`, `P10`. Nothing is exaggerated by the span.
 *
 * `null` when nothing in the selection is ranked, which lets the chart fall back to its derived
 * domain rather than inventing one.
 */
export function positionDomain(series: readonly ProgressionSeries[]): [number, number] | null {
  const values = series.flatMap((entry) =>
    entry.points.map((point) => point.value).filter((value): value is number => value !== null),
  );
  if (values.length === 0) return null;
  return [1, snapToPositionTick(Math.max(...values))];
}

/**
 * The next §6.3 position tick at or above `position`, so the axis ends on a labelled gridline.
 *
 * Beyond the last tick it falls back to the value itself — a 26-car field (1989 had them) must not
 * be clipped to P20 just because the tick set stops there.
 */
export function snapToPositionTick(position: number): number {
  const tick = POSITION_TICKS.find((candidate) => candidate >= position);
  return tick ?? position;
}

/** `R7` for the axis gutter. Terse on purpose — it has to fit `--text-2xs`. */
export function formatRound(round: number): string {
  return `R${String(round)}`;
}

/** `P7`. A position axis reads in the sport's own notation, not as a bare integer. */
export function formatPosition(position: number): string {
  return `P${String(position)}`;
}

/**
 * `R7 · Belgian Grand Prix` for the tooltip and the live region.
 *
 * The second formatter §6.5.1 needed and did not have: at a crosshair the reader is asking *which
 * race*, and the round number alone does not answer it. Falls back to the terse form for a round the
 * progression has no name for, which the payload does not currently produce but which costs nothing
 * to be honest about.
 */
export function roundNamer(rounds: readonly { round: number; name: string }[]) {
  const byRound = new Map(rounds.map((entry) => [entry.round, entry.name]));
  return (round: number): string => {
    const name = byRound.get(round);
    return name === undefined ? formatRound(round) : `${formatRound(round)} · ${name}`;
  };
}
