/**
 * The kit's data contract.
 *
 * **Deliberately not any endpoint's shape.** The kit is built and tested against fixtures, because
 * a chart component that only works against one response shape is not a kit — it is that endpoint's
 * renderer. Feature selectors shape API data into these types (`ARCHITECTURE.md` §3: chart
 * components never query, and shaping lives in pure, unit-testable selectors owned by the engineer).
 */

import type { EntityColour, SeriesRole } from '@/lib/entityColor';

/**
 * One reading. `y === null` means **no datum at this x**, which is not the same as zero and must
 * never be drawn as zero: a driver who did not start a round has no points-per-round value, and a
 * line that dips to the axis says he scored nothing, which is a different claim.
 */
export interface SeriesPoint {
  x: number;
  y: number | null;
}

/** One entity's series, before colour and before the ladder. */
export interface SeriesInput {
  /** `driver.reference` or `team.reference`. The stable identity, used for ordering and keys. */
  reference: string;
  /** The team this entity plots as. For a team series, its own reference. */
  teamReference: string;
  /** The display name, for the direct label, the legend and the table header. Never abbreviated. */
  label: string;
  points: readonly SeriesPoint[];
  /**
   * §6.4a. **`'shadow'` is the other seat in a principal's car** — a series the surface added
   * rather than one the reader chose. It never consumes a comparison slot, it takes the car's
   * colour and marker shape and is separated by the seat dash, and it draws at three-quarters of
   * the mark stroke so a pair reads principal-forward. Defaults to `'principal'`.
   */
  role?: SeriesRole;
}

/**
 * **§6.3a — the four ordinal steps of a result**, strongest first.
 *
 * A *tone* is not a colour. It is a position in a ramp applied to whatever plotting colour the row
 * already carries, so identity is constant across the row and the ramp carries the **order**. That
 * is the opposite job to §6.4a's deleted shade pair, which spent the same channel — lightness — on
 * identity and asked a reader to learn that two colours were one team.
 *
 * The four are exhaustive and mutually exclusive over a driver's starts: a start is a win, or a
 * podium that is not a win, or a classified finish that is not a podium, or not classified at all.
 *
 * It lives here rather than in `ShareChart.tsx` because it is the kit's contract and not one
 * component's — and because a component module that also exports a constant loses fast refresh.
 */
export type OutcomeTone = 'win' | 'podium' | 'classified' | 'unclassified';

/** The ramp, strongest to weakest. Left to right on every row, always (§6.3a rule 2). */
export const OUTCOME_TONES: readonly OutcomeTone[] = [
  'win',
  'podium',
  'classified',
  'unclassified',
];

/** One categorical bar. */
export interface BarDatum {
  /** Stable key — the reference where the bar is an entity, the category key otherwise. */
  key: string;
  label: string;
  value: number;
  /** Present when the bar is an entity, which is what lets it take an entity colour. */
  teamReference?: string;
}

/**
 * §6.5.3 — five states, and only one of them is a fault.
 *
 * `no-coverage` is the one this product needs most and the one most likely to be got wrong: absent
 * lap data before 1996 is a property of the sport's history, so it is neutral, never a status
 * colour, and its copy always says three things — where the boundary is, which side this request
 * falls on, and **what is available instead**. The third is the one that gets dropped and the only
 * one that helps.
 */
export type PlotState = 'ready' | 'loading' | 'empty' | 'error' | 'no-coverage';

/** What the frame renders in its two view modes (§6.5.5). */
export type ChartView = 'chart' | 'table';

/** A series after `assignEntityColours` and `assignLadder`, which is what every mark component takes. */
export type ResolvedSeries = EntityColour & {
  label: string;
  points: readonly SeriesPoint[];
  marker: 'circle' | 'square' | 'triangle' | 'diamond';
  dash: 'solid' | 'long' | 'short' | 'dash-dot';
  texture: boolean;
};
