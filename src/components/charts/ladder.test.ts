import { describe, expect, it } from 'vitest';
import { assignEntityColours, collides, plotToken, type ChartEntity } from '@/lib/entityColor';
import { assignLadder, COMPARISON_CAP, DASH_ARRAY, DASH_PATTERNS } from './ladder';

const entity = (reference: string, teamReference: string): ChartEntity => ({
  reference,
  teamReference,
});

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
    expect(state).toEqual({ marker: false, dash: false, texture: false });
    expect(series.map((s) => s.marker)).toEqual(['circle', 'circle', 'circle']);
    expect(series.map((s) => s.dash)).toEqual(['solid', 'solid', 'solid']);
  });

  it('switches on marker shape when a cross-team pair collides', () => {
    const { state, series } = ladder([entity('a', 'ferrari'), entity('b', 'mclaren')]);
    expect(state.marker).toBe(true);
    expect(series.map((s) => s.marker)).toEqual(['circle', 'square']);
  });

  it('does not escalate to dash for a collision, because four shapes separate four series', () => {
    // Rung 3 exists for the teammate case (§6.4a), where it is mandatory rather than escalated.
    const { state } = ladder([entity('a', 'ferrari'), entity('b', 'mclaren')]);
    expect(state.dash).toBe(false);
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

describe('§6.4a — the teammate treatment is mandatory, not escalated', () => {
  const TEAMMATES = [entity('stroll', 'aston_martin'), entity('alonso', 'aston_martin')];

  it('switches on BOTH marker and dash for a teammate pair, for every team', () => {
    const { state } = ladder(TEAMMATES);
    expect(state.marker).toBe(true);
    expect(state.dash).toBe(true);
  });

  it('gives the lower driver reference circle and solid, whatever order the caller passed', () => {
    const { series } = ladder(TEAMMATES);
    const alonso = series.find((s) => s.reference === 'alonso');
    const stroll = series.find((s) => s.reference === 'stroll');
    expect(alonso?.marker).toBe('circle');
    expect(alonso?.dash).toBe('solid');
    expect(stroll?.marker).toBe('square');
    expect(stroll?.dash).toBe('long');
  });

  it('fires for Sauber too, where the shade pair does not exist at all', () => {
    /*
     * The team that settles the argument. Both drivers carry the identical plotting colour, so
     * marker and dash are the only things separating them — which is the whole reason §6.4a makes
     * them mandatory for every team rather than a fallback for this one.
     */
    const { state, series } = ladder([entity('a', 'sauber'), entity('b', 'sauber')]);
    expect(series[0]?.plot).toBe(series[1]?.plot);
    expect(series.every((s) => s.colourExhausted)).toBe(true);
    expect(state.marker && state.dash).toBe(true);
    expect(series.map((s) => s.marker)).toEqual(['circle', 'square']);
    expect(series.map((s) => s.dash)).toEqual(['solid', 'long']);
  });

  it('keeps all four channels distinct when two teammate pairs share one chart', () => {
    /*
     * §6.4a is written for one pair and says "circle and square, in driver order". Applied
     * literally to two pairs it would hand two series the same shape *and* the same dash, leaving
     * colour as their only separator — the exact thing this module exists to avoid. The indices a
     * team's group holds are kept and redistributed inside the group instead.
     */
    const { series } = ladder([
      entity('russell', 'mercedes'),
      entity('antonelli', 'mercedes'),
      entity('sainz', 'williams'),
      entity('albon', 'williams'),
    ]);
    expect(new Set(series.map((s) => s.marker)).size).toBe(4);
    expect(new Set(series.map((s) => s.dash)).size).toBe(4);
    // and inside each team, the lower reference still takes the earlier rung
    const index = (reference: string) =>
      DASH_PATTERNS.indexOf(series.find((s) => s.reference === reference)?.dash ?? 'solid');
    expect(index('antonelli')).toBeLessThan(index('russell'));
    expect(index('albon')).toBeLessThan(index('sainz'));
  });

  it('still separates three drivers of one team, where colour is exhausted outright', () => {
    // A mid-season replacement. Rungs 1–3 carry the whole distinction (§6.4a property 4).
    const { series } = ladder([
      entity('a', 'ferrari'),
      entity('b', 'ferrari'),
      entity('c', 'ferrari'),
    ]);
    expect(new Set(series.map((s) => s.plot)).size).toBe(1);
    expect(new Set(series.map((s) => s.marker)).size).toBe(3);
    expect(new Set(series.map((s) => s.dash)).size).toBe(3);
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

  it('is withdrawable, unlike rungs 2 and 3 — it is the reader’s own choice', () => {
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
