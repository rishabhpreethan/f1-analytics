import { describe, expect, it } from 'vitest';
import {
  assignEntityColours,
  collides,
  cssVar,
  hashReference,
  identityToken,
  plotToken,
  rampSlot,
  type ChartEntity,
  type PlotToken,
} from './entityColor';
import { PLOT_TOKENS, RAMP_SIZE, RAMP_TIER_A } from './entityColorData';

/**
 * The properties that could actually fail, rather than a restatement of the module.
 *
 * The precedent worth repeating is F1's: a test caught Sauber having a dark-mode shade pair and no
 * light-mode one, which had not been reasoned out. So the assertions below are written against the
 * measured facts of the palette — the two grey teams, the one team with no pair, the tier that
 * colour alone separates — not against the code's own shape.
 */

const HEX = /#[0-9a-fA-F]{3,8}\b/;

/** A team with a brand plotting variant, a colourless team, and the two greys. */
const FERRARI = 'ferrari';
const SAUBER = 'sauber';
const HAAS = 'haas';
const CADILLAC = 'cadillac';
const BRM = 'brm'; // no brand colour: one of the 202

const entity = (reference: string, teamReference: string): ChartEntity => ({
  reference,
  teamReference,
});

describe('§3.3a.3 — the contract is a token NAME, and nothing here is a colour', () => {
  it('never returns a hex value from any entry point', () => {
    /*
     * This is the whole contract in one assertion. A hex leaking out of this module would render
     * correctly in the theme it was generated for and wrongly in the other, with no error — the
     * exact failure mode the generated stylesheet exists to prevent.
     */
    const surface = [
      identityToken(FERRARI),
      identityToken(BRM),
      plotToken(FERRARI),
      plotToken(BRM),
      plotToken(HAAS),
      JSON.stringify(assignEntityColours([entity('a', FERRARI), entity('b', FERRARI)])),
    ].join(' ');
    expect(surface).not.toMatch(HEX);
  });

  it('returns names that are custom properties, and that the palette actually emits', () => {
    // An unknown custom property resolves to the empty string, so `stroke=""` is invisible rather
    // than wrong — the failure with no error message.
    for (const reference of [FERRARI, SAUBER, HAAS, CADILLAC, BRM, 'lotus', 'tyrrell']) {
      expect(plotToken(reference)).toMatch(/^--(team|ramp)-[a-z0-9_]+-plot$/);
      expect(PLOT_TOKENS).toContain(plotToken(reference));
    }
  });

  it('wraps a token as a var() reference and nothing else', () => {
    expect(cssVar('--ramp-3-plot')).toBe('var(--ramp-3-plot)');
  });
});

describe('§3.3a.3 — assignment is deterministic, by identity, never by rank', () => {
  it('is stable: the same reference gives the same slot on every call', () => {
    expect(rampSlot(BRM)).toBe(rampSlot(BRM));
    expect(hashReference('lotus')).toBe(hashReference('lotus'));
  });

  it('pins the slot of eight real team references, so a hash change cannot pass silently', () => {
    /*
     * These are the values `DESIGN_SYSTEM.md` §9.2.4 records against the live 214-team list. If the
     * hash is ever "improved", every colourless team in the product repaints — the exact thing
     * rule 1 of §3.3a.3 forbids — and this is the only place that would notice.
     */
    expect(rampSlot('haas')).toBe(3);
    expect(rampSlot('cadillac')).toBe(7);
    expect(rampSlot('brm')).toBe(5);
    expect(rampSlot('lotus')).toBe(5);
    expect(rampSlot('tyrrell')).toBe(6);
    expect(rampSlot('brabham')).toBe(9);
    expect(rampSlot('ferrari')).toBe(7);
    expect(rampSlot('mclaren')).toBe(4);
  });

  it('stays inside the ramp for any reference, including empty and non-ASCII ones', () => {
    const samples = ['', 'a', 'zzzzzzzzzzzzzzzzzzzz', 'équipe', '普通', 'team-with-a-long-name'];
    for (const reference of samples) {
      const slot = rampSlot(reference);
      expect(slot).toBeGreaterThanOrEqual(1);
      expect(slot).toBeLessThanOrEqual(RAMP_SIZE);
    }
  });

  it('keeps the hash inside 32 unsigned bits — Math.imul is what makes that true', () => {
    // A plain `*` overflows into a double at the third character and stops being FNV-1a.
    const hash = hashReference('a-reasonably-long-team-reference');
    expect(Number.isInteger(hash)).toBe(true);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(2 ** 32);
  });
});

describe('§3.3a.1 — the two grey teams keep an identity colour and plot from the ramp', () => {
  it('gives Haas and Cadillac a brand identity token and a ramp plot token', () => {
    expect(identityToken(HAAS)).toBe('--team-haas');
    expect(identityToken(CADILLAC)).toBe('--team-cadillac');
    expect(plotToken(HAAS)).toBe('--ramp-3-plot');
    expect(plotToken(CADILLAC)).toBe('--ramp-7-plot');
  });

  it('emits no `--team-haas-plot` or `--team-cadillac-plot` to fall back to', () => {
    // The absence is deliberate and must not be "completed for symmetry" (§3.3a.1).
    expect(PLOT_TOKENS).not.toContain('--team-haas-plot');
    expect(PLOT_TOKENS).not.toContain('--team-cadillac-plot');
  });

  it('separates the pair that failed at ΔE 3.8 as raw brand colours', () => {
    /*
     * `#AAAAAD` ↔ `#9C9FA2` is the measured hard failure this whole encoding exists for:
     * indistinguishable even with full colour vision. Plotted, they are two different ramp slots.
     */
    expect(plotToken(HAAS)).not.toBe(plotToken(CADILLAC));
    expect(collides(plotToken(HAAS), plotToken(CADILLAC))).toBe(false);
  });

  it('gives a colourless team a ramp identity swatch, not a token that does not exist', () => {
    expect(identityToken(BRM)).toBe(plotToken(BRM));
    expect(PLOT_TOKENS).toContain(identityToken(BRM) as PlotToken);
  });
});

describe('§6.4a — colour is the car, the dash is the seat (ruled 2026-08-23)', () => {
  it('gives two drivers of one team the SAME colour, and separate seats', () => {
    /*
     * The reversal. Until 2026-08-23 this returned a two-shade split; it now returns one colour
     * twice, because "same colour" is the claim a team-mate comparison actually rests on — same
     * machinery — and the seat is the dash's job (`ladder.ts`).
     */
    const [alonso, stroll] = assignEntityColours([
      entity('alonso', 'aston_martin'),
      entity('stroll', 'aston_martin'),
    ]);
    expect(alonso?.plot).toBe(plotToken('aston_martin'));
    expect(stroll?.plot).toBe(plotToken('aston_martin'));
    expect(alonso?.seat).toBe(0);
    expect(stroll?.seat).toBe(1);
    expect(alonso?.teammate && stroll?.teammate).toBe(true);
  });

  it('orders seats by reference, not by the order the caller passed them in', () => {
    const [stroll, alonso] = assignEntityColours([
      entity('stroll', 'aston_martin'),
      entity('alonso', 'aston_martin'),
    ]);
    expect(alonso?.seat).toBe(0);
    expect(stroll?.seat).toBe(1);
  });

  it('seats every principal before any shadow, whatever the references sort to', () => {
    /*
     * `alonso` < `stroll` alphabetically, so reference order alone would hand seat 0 — the solid
     * line — to the driver the reader did NOT choose. Role is the first key for exactly that
     * reason: a shadow is by definition "the other seat".
     */
    const [stroll, alonso] = assignEntityColours([
      { reference: 'stroll', teamReference: 'aston_martin', role: 'principal' },
      { reference: 'alonso', teamReference: 'aston_martin', role: 'shadow' },
    ]);
    expect(stroll?.seat).toBe(0);
    expect(alonso?.seat).toBe(1);
    expect(stroll?.role).toBe('principal');
    expect(alonso?.role).toBe('shadow');
  });

  it('gives every driver of the car the team’s own plot colour, including the first', () => {
    const pair = assignEntityColours([entity('a', FERRARI), entity('b', FERRARI)]);
    for (const member of pair) expect(member.plot).toBe(plotToken(FERRARI));
  });

  it('treats Sauber exactly like every other car — the team that used to be the exception', () => {
    /*
     * Sauber's brand hue is 143, inside the reserved green timing band, and in light mode exactly
     * one lightness in the plotting band clears ΔE 15 from `--timing-green-ink`. That made a
     * two-shade split impossible and forced §6.4a to be written around a single team's misfortune.
     * Under the seat rule there is nothing to work around: one colour, two seats.
     */
    const pair = assignEntityColours([entity('a', SAUBER), entity('b', SAUBER)]);
    expect(pair.map((member) => member.plot)).toEqual(['--team-sauber-plot', '--team-sauber-plot']);
    expect(pair.map((member) => member.seat)).toEqual([0, 1]);
    expect(pair.some((member) => member.colourExhausted)).toBe(false);
  });

  it('seats three drivers of one team, which two shades never could', () => {
    // A mid-season replacement. The shade pair reported colour exhausted here; the dash ladder is
    // four deep, so a third seat is an ordinary case rather than a designed failure.
    const trio = assignEntityColours([
      entity('a', FERRARI),
      entity('b', FERRARI),
      entity('c', FERRARI),
    ]);
    expect(trio.every((member) => member.plot === plotToken(FERRARI))).toBe(true);
    expect(trio.map((member) => member.seat)).toEqual([0, 1, 2]);
    expect(trio.some((member) => member.colourExhausted)).toBe(false);
  });

  it('reports exhaustion past four seats — 1957 Maserati entered thirteen cars in one race', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((ref) => entity(ref, FERRARI));
    expect(assignEntityColours(many).every((member) => member.colourExhausted)).toBe(true);
  });

  it('offers no shade-pair entry point at all — the palette has 22 tokens, not 64', () => {
    /*
     * `shadePair()` and its 84 declarations were deleted on 2026-08-23 (§9.2.8) for a measured
     * 0.61 KB of the render-blocking CSS budget. Asserted as a property of the token universe
     * rather than as `typeof shadePair === 'undefined'`, which typecheck already refuses to
     * compile: what a later change can actually do is regenerate the emitter from an older
     * revision and put the tokens back, and then `PLOT_TOKENS` grows and every COLLISION_MASKS
     * index shifts under `collides()`.
     */
    expect(PLOT_TOKENS.filter((name) => /-plot-(deep|bright)$/.test(name))).toEqual([]);
    expect(PLOT_TOKENS).toHaveLength(22);
  });
});

describe('§6.2 — a filter that changes the series count must not repaint the survivors', () => {
  it('leaves every unrelated entity’s token untouched when a fourth is added', () => {
    const three = [entity('a', FERRARI), entity('b', 'mclaren'), entity('c', BRM)];
    const before = assignEntityColours(three);
    const after = assignEntityColours([...three, entity('d', 'williams')]);
    expect(after.slice(0, 3).map((member) => member.plot)).toEqual(
      before.map((member) => member.plot),
    );
  });

  it('repaints NOTHING when a team-mate arrives — the last permitted repaint is gone', () => {
    /*
     * §6.2 used to carry one named exception: adding a team-mate re-shaded that team's pair. The
     * seat rule removes it. Adding a second Ferrari changes the first Ferrari's `seat`, and not
     * one token anywhere on the chart.
     */
    const solo = assignEntityColours([entity('a', FERRARI), entity('c', BRM)]);
    const withMate = assignEntityColours([
      entity('a', FERRARI),
      entity('c', BRM),
      entity('b', FERRARI),
    ]);
    expect(withMate.slice(0, 2).map((member) => member.plot)).toEqual(
      solo.map((member) => member.plot),
    );
    expect(withMate[0]?.seat).toBe(0);
    expect(withMate[2]?.seat).toBe(1);
  });

  it('preserves input order, because the ladder assigns rungs in that order', () => {
    const input = [entity('z', BRM), entity('a', FERRARI), entity('m', 'mclaren')];
    expect(assignEntityColours(input).map((member) => member.reference)).toEqual(['z', 'a', 'm']);
  });
});

describe('§6.4 — collision lookup', () => {
  it('is reflexive and symmetric across the whole token universe', () => {
    for (const token of PLOT_TOKENS) expect(collides(token, token)).toBe(true);
    for (let i = 0; i < PLOT_TOKENS.length; i += 7) {
      for (let j = 0; j < PLOT_TOKENS.length; j += 5) {
        const a = PLOT_TOKENS[i] as PlotToken;
        const b = PLOT_TOKENS[j] as PlotToken;
        expect(collides(a, b)).toBe(collides(b, a));
      }
    }
  });

  it('finds NO collision anywhere in tier A — colour alone separates those, for every viewer', () => {
    /*
     * §3.3a.2's tier A guarantee, asserted rather than trusted: mutually ΔE ≥ 15 normal-vision and
     * ≥ 8 CVD in both themes. Six slots is more than the comparison cap of four, so any admissible
     * four-subset is fully separated by colour and the ladder never has to fire.
     */
    for (let a = 1; a <= RAMP_TIER_A; a += 1) {
      for (let b = a + 1; b <= RAMP_TIER_A; b += 1) {
        expect(
          collides(
            `--ramp-${String(a)}-plot` as PlotToken,
            `--ramp-${String(b)}-plot` as PlotToken,
          ),
          `ramp ${String(a)} vs ${String(b)}`,
        ).toBe(false);
      }
    }
  });

  it('does find collisions somewhere — a table of all-false would pass every test above', () => {
    /*
     * 87 of the 231 pairs collide, regenerated 2026-08-23 when the shade pair was deleted (§9.2.8);
     * it read 663 of 2016 while the palette carried 64 tokens (§9.2.4). A masks array of zeros is
     * the failure this catches — every "these two are separated" assertion above passes vacuously
     * against one.
     */
    let found = 0;
    for (let i = 0; i < PLOT_TOKENS.length; i += 1) {
      for (let j = i + 1; j < PLOT_TOKENS.length; j += 1) {
        if (collides(PLOT_TOKENS[i] as PlotToken, PLOT_TOKENS[j] as PlotToken)) found += 1;
      }
    }
    expect(found).toBe(87);
  });

  it('assumes the worst for a token it does not know', () => {
    // Never the best: an unrecognised colour that silently reports "separated" would suppress the
    // differentiator that was the only thing making the pair readable.
    expect(collides('--not-a-token' as PlotToken, '--ramp-1-plot')).toBe(true);
  });
});
