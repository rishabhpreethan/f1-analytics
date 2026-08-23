/**
 * **The differentiator ladder** (`DESIGN_SYSTEM.md` §6.4 and §6.4a) — the non-colour channels that
 * make the palette safe to ship.
 *
 * Tier B of the entity ramp clears the normal-vision floor and hands its CVD pairs to this module;
 * every cross-source collision lands here too.
 *
 * ⚠ **The dash left the ladder on 2026-08-23** (§6.4a). It is no longer a rung that a collision can
 * switch on: a dash now *means* **the other seat in this car**, unconditionally, in the same way
 * purple means session fastest. So this module assigns it from `EntityColour.seat` and never from a
 * collision, and the collision ladder is three rungs — direct label, marker shape, texture.
 *
 * Nothing here is colour. Nothing here reads a colour. It takes the tokens `entityColor.ts`
 * assigned and answers one question: which non-colour channels does this chart have to switch on.
 */

import { collides, DASH_SEATS, type EntityColour } from '@/lib/entityColor';

/** §6.4 rung 3. Comparison is capped here so the ladder cannot run out: four rungs, four entities. */
export const COMPARISON_CAP = 4;

/** §6.4 rung 2, in the fixed order. Never reordered — the order *is* the assignment. */
export const MARKER_SHAPES = ['circle', 'square', 'triangle', 'diamond'] as const;
export type MarkerShape = (typeof MARKER_SHAPES)[number];

/**
 * §6.4a's **seat** patterns, in the fixed order: seat 0 solid, seat 1 `6 3`, seat 2 `2 3`, seat 3
 * `9 3 2 3`. Not a collision rung — a semantic channel, and the order *is* the assignment.
 */
export const DASH_PATTERNS = ['solid', 'long', 'short', 'dash-dot'] as const;
export type DashPattern = (typeof DASH_PATTERNS)[number];

/**
 * The SVG `stroke-dasharray` for each pattern.
 *
 * **The binding property is the period — dash + gap ≥ 2× the 2px stroke width** (§6.3's stroke).
 * §6.4 originally said the *dash length* had to clear that, which its own `2 3` pattern fails: a
 * 2px dash at a 2px stroke is 1×. The period is what makes a pattern resolvable, `2 3` has a period
 * of 5, and it renders as a dotted line — the most distinguishable of the three, not the weakest.
 * Corrected in DESIGN_SYSTEM §6.4 rather than worked around here.
 *
 * `solid` is `undefined` rather than `'none'` so it can be spread straight onto an SVG element and
 * simply not appear — `stroke-dasharray="none"` is legal but writes an attribute for nothing.
 */
export const DASH_ARRAY: Record<DashPattern, string | undefined> = {
  solid: undefined,
  long: '6 3',
  short: '2 3',
  'dash-dot': '9 3 2 3',
};

/** Which rungs are switched on for the chart as a whole, and why. */
export interface LadderState {
  /** Rung 2 — distinct marker shapes, one per **car**. */
  marker: boolean;
  /** Rung 3 — the 45° hatch. A user control and the print/CVD affordance (§6.5.6), never automatic. */
  texture: boolean;
}

export interface SeriesChannels extends EntityColour {
  marker: MarkerShape;
  dash: DashPattern;
  texture: boolean;
}

export interface LadderResult {
  series: SeriesChannels[];
  state: LadderState;
  /**
   * `true` when more series were passed than the comparison cap. Marker and dash shapes wrap, so
   * two series can share both — which is the point at which the answer is not a taller ladder but
   * **small multiples** (§6.5.4). A caller that ignores this is drawing spaghetti.
   */
  exceedsCap: boolean;
}

export interface LadderOptions {
  /**
   * The rungs already switched on for this chart. **A rung is never withdrawn when a collision
   * clears** (§6.4 rule 2): removing the entity that caused a collision must not restore a plain
   * solid line for the survivor, because that is exactly the repaint §6.2 forbids. The caller holds
   * this across renders and passes the previous `state` back in.
   */
  sticky?: Partial<LadderState>;
  /** The "Patterns" toggle, and `@media print`, which promotes every series to rung 4 (§6.5.6). */
  patterns?: boolean;
}

/**
 * Rung activation is **chart-wide**; the channel *value* is per series.
 *
 * §6.4 describes the collision ladder pairwise — "a colliding pair takes the lowest rung not
 * already used by either member" — and that is how the escalation is decided below. What is
 * deliberately not done is applying the resulting channel to the colliding pair **alone**: a chart
 * where two of four series carry a marker shape and two do not reads as an accident rather than as
 * an encoding, and the legend then has to explain a distinction that applies to half its rows.
 * §6.5.6's Patterns toggle already sets the precedent that a rung is a property of the chart.
 *
 * **Two channels, two rules, and they are not the same rule** (§6.4a, 2026-08-23):
 *
 * | Channel | Fires | Value |
 * |---|---|---|
 * | **marker** | on collision, or whenever any car carries more than one series | one shape **per car**, by the car's position in the stable order |
 * | **dash** | **always** | the entity's `seat` within its car |
 *
 * The marker being per *car* rather than per *series* is what makes eight series read as four
 * pairs: a principal and the seat beside him share a colour and a shape, and differ only in the
 * dash. It also keeps two team-mate pairs on one chart fully distinct — pair A is circle, pair B is
 * square, and each pair is solid-then-dashed inside itself.
 */
export function assignLadder(
  entities: readonly EntityColour[],
  options: LadderOptions = {},
): LadderResult {
  const hasTeammate = entities.some((entity) => entity.teammate);
  const hasCollision = anyCollision(entities);

  const state: LadderState = {
    marker: (options.sticky?.marker ?? false) || hasCollision || hasTeammate,
    texture: options.patterns ?? options.sticky?.texture ?? false,
  };

  const carIndex = assignCarIndices(entities);

  return {
    state,
    exceedsCap: carIndex.cars > COMPARISON_CAP,
    series: entities.map((entity, i) => {
      const index = (carIndex.of[i] ?? i) % MARKER_SHAPES.length;
      return {
        ...entity,
        marker: state.marker ? (MARKER_SHAPES[index] ?? 'circle') : 'circle',
        dash: DASH_PATTERNS[entity.seat % DASH_SEATS] ?? 'solid',
        texture: state.texture,
      };
    }),
  };
}

/** Any pair the palette never promised to separate. One car's own seats are the dash's business. */
function anyCollision(entities: readonly EntityColour[]): boolean {
  for (let i = 0; i < entities.length; i += 1) {
    for (let j = i + 1; j < entities.length; j += 1) {
      const a = entities[i];
      const b = entities[j];
      if (a === undefined || b === undefined) continue;
      if (a.teamReference === b.teamReference) continue; // §6.4a's case, not §6.4's
      if (collides(a.plot, b.plot)) return true;
    }
  }
  return false;
}

/**
 * The marker index each series takes: **its car's position in the stable entity order**, so every
 * series of one car gets the same shape and two cars never share one.
 *
 * Keyed on the car and not on the series because §6.4a's whole claim is that colour and shape
 * together say *"this machinery"* while the dash says *"which seat"*. Indexing per series would
 * hand a principal a circle and the seat beside him a square, and the pair would stop reading as a
 * pair — the exact failure the eight-series season lens exists to avoid.
 *
 * §6.4 rule 1 still holds: the index comes from the order the caller passed, never from rank or
 * z-order, so a car that is a triangle today is a triangle tomorrow for the same selection.
 *
 * `exceedsCap` is reported on the **car** count rather than the series count for the same reason:
 * eight series across four cars is four shapes and four dashes, which is exactly what the ladder
 * promises to separate. Nine series across five cars is not.
 */
function assignCarIndices(entities: readonly EntityColour[]): { of: number[]; cars: number } {
  const order = new Map<string, number>();
  const of = entities.map((entity) => {
    const seen = order.get(entity.teamReference);
    if (seen !== undefined) return seen;
    const next = order.size;
    order.set(entity.teamReference, next);
    return next;
  });
  return { of, cars: order.size };
}
