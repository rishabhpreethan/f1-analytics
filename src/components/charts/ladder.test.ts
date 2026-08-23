import { describe, expect, it } from 'vitest';
import { assignEntityColours, collides, plotToken, type ChartEntity } from '@/lib/entityColor';
import { assignLadder, COMPARISON_CAP, DASH_ARRAY, DASH_PATTERNS } from './ladder';

const entity = (
  reference: string,
  teamReference: string,
  role: ChartEntity['role'] = 'principal',
): ChartEntity => ({ reference, teamReference, role });

const ladder = (entities: ChartEntity[], options?: Parameters<typeof assignLadder>[1]) =>
  assignLadder(assignEntityColours(entities), options);

/**
 * Three cross-team pairs that the palette **does** separate, measured: Ferrari ↔ Mercedes,
 * Ferrari ↔ Williams and Mercedes ↔ Williams are all clear on both floors in both themes.
 * If a regenerated palette ever moves one of them, the first test below fails rather than
 * quietly asserting the ladder is off for a chart where it should be on.
 */
const SEPARATED = [entity('a', 'ferrari'), entity('b', 'mercedes'), entity('c', 'williams')];

describe('the measured premise these tests rest on', () => {
  it('confirms the three separated teams really are separated', () => {
    expect(collides(plotToken('ferrari'), plotToken('mercedes'))).toBe(false);
    expect(collides(plotToken('ferrari'), plotToken('williams'))).toBe(false);
    expect(collides(plotToken('mercedes'), plotToken('williams'))).toBe(false);
  });

  it('confirms Ferrari ↔ McLaren really do collide', () => {
    // Red against orange. 31 of the 66 pairs among the 2026 grid's plotting colours collide —
    // the brand variants are deliberately not gated against one another (§9.2.3 V-26), which is
    // precisely why this module is a requirement and not an optimisation.
    expect(collides(plotToken('ferrari'), plotToken('mclaren'))).toBe(true);
  });
});

describe('§6.4 — the ladder fires on collision and stays off otherwise', () => {
  it('leaves every rung off when nothing collides', () => {
    const { state, series } = ladder(SEPARATED);
    expect(state).toEqual({ marker: false, texture: false });
    expect(series.map((s) => s.marker)).toEqual(['circle', 'circle', 'circle']);
    expect(series.map((s) => s.dash)).toEqual(['solid', 'solid', 'solid']);
  });

  it('switches on marker shape when a cross-team pair collides', () => {
    const { state, series } = ladder([entity('a', 'ferrari'), entity('b', 'mclaren')]);
    expect(state.marker).toBe(true);
    expect(series.map((s) => s.marker)).toEqual(['circle', 'square']);
  });

  it('never escalates to a dash, because a dash now MEANS something (§6.4a, 2026-08-23)', () => {
    /*
     * The dash left the collision ladder. Two colliding drivers of two different teams are two
     * different cars, so both are seat 0 and both draw solid — if a collision could dash one of
     * them, a reader who had learned "dashed = the other seat in that car" would be lied to by a
     * palette accident.
     */
    const { series } = ladder([entity('a', 'ferrari'), entity('b', 'mclaren')]);
    expect(series.map((s) => s.dash)).toEqual(['solid', 'solid']);
  });

  it('separates every series once a rung fires, not only the colliding pair', () => {
    const { series } = ladder([
      entity('a', 'ferrari'),
      entity('b', 'mclaren'),
      entity('c', 'mercedes'),
      entity('d', 'williams'),
    ]);
    expect(new Set(series.map((s) => s.marker)).size).toBe(4);
  });

  it('never switches a rung back off once it has fired (§6.4 rule 2)', () => {
    /*
     * Removing the entity that caused a collision must not restore a plain solid line for the
     * survivor: that is the repaint §6.2 forbids, and it would teach the reader that a marker
     * shape means something about the *other* series rather than about this one.
     */
    const first = ladder([entity('a', 'ferrari'), entity('b', 'mclaren')]);
    const after = ladder([entity('a', 'ferrari'), entity('c', 'mercedes')], {
      sticky: first.state,
    });
    expect(after.state.marker).toBe(true);
  });
});

describe('§6.4a — colour is the car, the dash is the seat', () => {
  const TEAMMATES = [entity('stroll', 'aston_martin'), entity('alonso', 'aston_martin')];

  it('paints both drivers of one car in ONE colour, and separates them on the dash', () => {
    const { series } = ladder(TEAMMATES);
    expect(new Set(series.map((s) => s.plot)).size).toBe(1);
    expect(new Set(series.map((s) => s.dash)).size).toBe(2);
  });

  it('gives one car ONE marker shape, so a pair reads as a pair', () => {
    /*
     * The single most load-bearing assertion of the 2026-08-23 change. If the two series of one
     * car took different shapes, eight series across four cars would read as eight lines rather
     * than four pairs — which is the composition problem the season lens is built around.
     */
    const { state, series } = ladder(TEAMMATES);
    expect(state.marker).toBe(true);
    expect(new Set(series.map((s) => s.marker)).size).toBe(1);
  });

  it('gives the lower driver reference the solid line, whatever order the caller passed', () => {
    const { series } = ladder(TEAMMATES);
    expect(series.find((s) => s.reference === 'alonso')?.dash).toBe('solid');
    expect(series.find((s) => s.reference === 'stroll')?.dash).toBe('long');
  });

  it('never dashes a principal while the shadow beside it is solid', () => {
    /*
     * `reference` order alone would do exactly that here: `alonso` < `stroll`, so a pure
     * alphabetical seat order hands the *shadow* the solid line and the driver the reader chose
     * the dash — inverting the sentence the encoding makes.
     */
    const { series } = ladder([
      entity('stroll', 'aston_martin', 'principal'),
      entity('alonso', 'aston_martin', 'shadow'),
    ]);
    expect(series.find((s) => s.reference === 'stroll')?.dash).toBe('solid');
    expect(series.find((s) => s.reference === 'alonso')?.dash).toBe('long');
  });

  it('works for Sauber too, where no shade pair ever existed', () => {
    /*
     * The team that settled the old argument and is now unremarkable: its brand hue sits in the
     * reserved green timing band and light mode admits exactly one plotting shade, so a two-shade
     * split was impossible. Under the seat rule nothing about Sauber is special — one colour, one
     * shape, two dashes, exactly as for every other car.
     */
    const { series } = ladder([entity('a', 'sauber'), entity('b', 'sauber')]);
    expect(series[0]?.plot).toBe(series[1]?.plot);
    expect(series.map((s) => s.dash)).toEqual(['solid', 'long']);
    expect(series.some((s) => s.colourExhausted)).toBe(false);
  });

  it('keeps two pairs on one chart distinct: two shapes, two dashes, four combinations', () => {
    const { series } = ladder([
      entity('russell', 'mercedes'),
      entity('antonelli', 'mercedes'),
      entity('sainz', 'williams'),
      entity('albon', 'williams'),
    ]);
    expect(new Set(series.map((s) => s.marker)).size).toBe(2);
    expect(new Set(series.map((s) => s.dash)).size).toBe(2);
    expect(new Set(series.map((s) => `${s.marker}/${s.dash}`)).size).toBe(4);
    // and inside each car, the lower reference still takes the solid line
    const index = (reference: string) =>
      DASH_PATTERNS.indexOf(series.find((s) => s.reference === reference)?.dash ?? 'solid');
    expect(index('antonelli')).toBeLessThan(index('russell'));
    expect(index('albon')).toBeLessThan(index('sainz'));
  });

  it('separates three drivers of one car, which the two-shade pair never could', () => {
    // A mid-season replacement. The old shade pair reported colour exhausted at three; the dash
    // ladder is four deep, which is the second reason the pair was withdrawn.
    const { series } = ladder([
      entity('a', 'ferrari'),
      entity('b', 'ferrari'),
      entity('c', 'ferrari'),
    ]);
    expect(new Set(series.map((s) => s.plot)).size).toBe(1);
    expect(new Set(series.map((s) => s.marker)).size).toBe(1);
    expect(series.map((s) => s.dash)).toEqual(['solid', 'long', 'short']);
    expect(series.some((s) => s.colourExhausted)).toBe(false);
  });

  it('reports the dash ladder exhausted past four seats — 1957 Maserati entered thirteen', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((ref) => entity(ref, 'maserati'));
    const { series } = ladder(five);
    expect(series.every((s) => s.colourExhausted)).toBe(true);
    expect(series[4]?.dash).toBe(series[0]?.dash);
  });

  it('counts the cap in CARS, so eight series across four cars is not over it', () => {
    /*
     * Eight series is the season lens at full stretch: four principals, each carrying the other
     * seat in its car. Four shapes and two dashes separate all eight, so the cap is not breached —
     * counting series would have reported it breached and pushed the surface to small multiples
     * for a chart the ladder handles.
     */
    const pairs = ['ferrari', 'mercedes', 'williams', 'alpine'].flatMap((team) => [
      entity(`${team}-1`, team, 'principal'),
      entity(`${team}-2`, team, 'shadow'),
    ]);
    const result = ladder(pairs);
    expect(result.series).toHaveLength(8);
    expect(result.exceedsCap).toBe(false);
    expect(new Set(result.series.map((s) => `${s.marker}/${s.dash}`)).size).toBe(8);
  });
});

describe('§6.5.6 — rung 4 is a control, not an escalation', () => {
  it('is off by default even when the chart is colliding', () => {
    expect(ladder([entity('a', 'ferrari'), entity('b', 'mclaren')]).state.texture).toBe(false);
  });

  it('promotes every series at once when the Patterns toggle is on', () => {
    const { state, series } = ladder(SEPARATED, { patterns: true });
    expect(state.texture).toBe(true);
    expect(series.every((s) => s.texture)).toBe(true);
  });

  it('is withdrawable, unlike rung 2 — it is the reader’s own choice', () => {
    expect(ladder(SEPARATED, { patterns: false, sticky: { texture: true } }).state.texture).toBe(
      false,
    );
  });
});

describe('§6.4 rule 3 — four rungs, four entities', () => {
  it('reports when a caller exceeds the comparison cap instead of inventing a fifth shape', () => {
    const five = ['ferrari', 'mclaren', 'mercedes', 'williams', 'alpine'].map((team, i) =>
      entity(`d${String(i)}`, team),
    );
    const result = ladder(five);
    expect(result.exceedsCap).toBe(true);
    // Shapes wrap rather than being generated — §6.2 forbids a cycled palette, and the answer at
    // this point is small multiples (§6.5.4), which is what `exceedsCap` is for.
    expect(result.series[4]?.marker).toBe(result.series[0]?.marker);
  });

  it('does not report the cap at exactly four', () => {
    const four = ['ferrari', 'mclaren', 'mercedes', 'williams'].map((team, i) =>
      entity(`d${String(i)}`, team),
    );
    expect(ladder(four).exceedsCap).toBe(false);
    expect(COMPARISON_CAP).toBe(4);
  });
});

describe('the dash patterns survive at the 2px stroke this product draws', () => {
  it('gives every pattern a period of at least 2× the stroke width', () => {
    /*
     * §6.4 said "dash lengths are ≥ 2× stroke width", which its own `2 3` pattern fails — a 2px
     * dash is 1× the stroke. The property that actually matters is the **period**: dash + gap ≥ 4px
     * is what makes the pattern resolvable at 2px, and `2 3` (period 5) clears it comfortably while
     * rendering as a dotted line, which is the most distinguishable of the three. Corrected in
     * DESIGN_SYSTEM §6.4 rather than defended.
     */
    for (const pattern of DASH_PATTERNS) {
      const array = DASH_ARRAY[pattern];
      if (array === undefined) continue;
      const lengths = array.split(' ').map(Number);
      expect(lengths.every((n) => Number.isFinite(n) && n > 0)).toBe(true);
      for (let i = 0; i + 1 < lengths.length; i += 2) {
        expect(
          (lengths[i] ?? 0) + (lengths[i + 1] ?? 0),
          `${pattern} period`,
        ).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('leaves `solid` without a dasharray attribute rather than writing "none"', () => {
    expect(DASH_ARRAY.solid).toBeUndefined();
  });
});
