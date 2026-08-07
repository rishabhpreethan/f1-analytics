/**
 * **The differentiator ladder** (`DESIGN_SYSTEM.md` §6.4 and §6.4a) — the non-colour channels that
 * make the palette safe to ship.
 *
 * Tier B of the entity ramp clears the normal-vision floor and hands its CVD pairs to this module;
 * every cross-source collision lands here too; and a teammate comparison arrives here *always*,
 * because two drivers of one team is the case where colour is weakest and the most valuable
 * comparison in the sport. Sauber settles the argument on its own: its brand hue sits in the
 * reserved green timing band and no two-shade split exists in light mode, so **marker shape, dash
 * and direct label are mandatory for every team** and the shade pair is a redundant fourth channel.
 *
 * Nothing here is colour. Nothing here reads a colour. It takes the tokens `entityColor.ts`
 * assigned and answers one question: which non-colour channels does this chart have to switch on.
 */

import { collides, type EntityColour } from '@/lib/entityColor';

/** §6.4 rung 3. Comparison is capped here so the ladder cannot run out: four rungs, four entities. */
export const COMPARISON_CAP = 4;

/** §6.4 rung 2, in the fixed order. Never reordered — the order *is* the assignment. */
export const MARKER_SHAPES = ['circle', 'square', 'triangle', 'diamond'] as const;
export type MarkerShape = (typeof MARKER_SHAPES)[number];

/** §6.4 rung 3, in the fixed order. */
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
  /** Rung 2 — distinct marker shapes. */
  marker: boolean;
  /** Rung 3 — distinct dash patterns. */
  dash: boolean;
  /** Rung 4 — the 45° hatch. A user control and the print/CVD affordance (§6.5.6), never automatic. */
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
 * §6.4 describes the ladder pairwise — "a colliding pair takes the lowest rung not already used by
 * either member" — and that is how the escalation is decided below. What is deliberately not done
 * is applying the resulting channel to the colliding pair alone. A chart where two of four series
 * carry a marker shape and two do not reads as an accident rather than as an encoding, the legend
 * has to explain a distinction that applies to half the rows, and §6.5.6's Patterns toggle already
 * sets the precedent that a rung is a property of the chart. So when a rung fires, every series
 * takes its value from that rung's fixed order.
 *
 * One consequence worth stating: at ≤ 4 series, rung 2 alone separates every pair, because four
 * distinct shapes is four distinct series. Rung 3 therefore only ever fires because a **teammate**
 * comparison is present, where §6.4a makes both marker and dash mandatory rather than escalated.
 */
export function assignLadder(
  entities: readonly EntityColour[],
  options: LadderOptions = {},
): LadderResult {
  const hasTeammate = entities.some((entity) => entity.teammate);
  const hasCollision = anyCollision(entities);

  const state: LadderState = {
    marker: (options.sticky?.marker ?? false) || hasCollision || hasTeammate,
    dash: (options.sticky?.dash ?? false) || hasTeammate,
    texture: options.patterns ?? options.sticky?.texture ?? false,
  };

  const rungIndex = assignRungIndices(entities);

  return {
    state,
    exceedsCap: entities.length > COMPARISON_CAP,
    series: entities.map((entity, i) => {
      const index = (rungIndex[i] ?? i) % MARKER_SHAPES.length;
      return {
        ...entity,
        marker: state.marker ? (MARKER_SHAPES[index] ?? 'circle') : 'circle',
        dash: state.dash ? (DASH_PATTERNS[index] ?? 'solid') : 'solid',
        texture: state.texture,
      };
    }),
  };
}

/** Any pair the palette never promised to separate. Teammates are handled separately and always. */
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
 * The rung index each series takes, which is its position in the **stable entity order** — §6.4
 * rule 1: two entities that collide today must get the same two rungs tomorrow, so the index can
 * never come from rank, z-order, or the order a query happened to return.
 *
 * With one exception, and it is §6.4a's: **within one team, the indices are redistributed by
 * `driver.reference` ascending.** The set of indices the group holds does not change — so every
 * series in the chart still has a distinct one — but which member holds which does, so the lower
 * reference takes circle and solid regardless of the order the compare tray passed them in. That
 * is what makes "the team's two drivers take circle and square, in driver order" true without
 * duplicating a shape when a second team's pair is on the same chart.
 *
 * `reference` is used because it is the only driver identifier with 100% coverage:
 * `permanent_car_number` covers 63 of 881 and `abbreviation` 107 of 881 (queried).
 */
function assignRungIndices(entities: readonly EntityColour[]): number[] {
  const out = entities.map((_, i) => i);

  const groups = new Map<string, number[]>();
  entities.forEach((entity, i) => {
    const group = groups.get(entity.teamReference);
    if (group === undefined) groups.set(entity.teamReference, [i]);
    else group.push(i);
  });

  for (const positions of groups.values()) {
    if (positions.length < 2) continue;
    const indices = [...positions].sort((a, b) => a - b);
    const byReference = [...positions].sort((a, b) =>
      (entities[a]?.reference ?? '') < (entities[b]?.reference ?? '') ? -1 : 1,
    );
    byReference.forEach((position, rank) => {
      out[position] = indices[rank] ?? position;
    });
  }

  return out;
}
