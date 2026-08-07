/**
 * The kit's data contract.
 *
 * **Deliberately not any endpoint's shape.** The kit is built and tested against fixtures, because
 * a chart component that only works against one response shape is not a kit — it is that endpoint's
 * renderer. Feature selectors shape API data into these types (`ARCHITECTURE.md` §3: chart
 * components never query, and shaping lives in pure, unit-testable selectors owned by the engineer).
 */

import type { EntityColour } from '@/lib/entityColor';

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
}

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
