import { describe, expect, it } from 'vitest';
import {
  assignEntityColours,
  collides,
  cssVar,
  hashReference,
  identityToken,
  plotToken,
  rampSlot,
  shadePair,
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
      JSON.stringify(shadePair(FERRARI)),
      JSON.stringify(shadePair(BRM)),
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

describe('§6.4a — the teammate treatment, and the team that proves colour cannot do it', () => {
  it('splits two drivers of one team into a symmetric pair, lower reference takes deep', () => {
    const [alonso, stroll] = assignEntityColours([
      entity('alonso', 'aston_martin'),
      entity('stroll', 'aston_martin'),
    ]);
    expect(alonso?.plot).toBe('--team-aston_martin-plot-deep');
    expect(stroll?.plot).toBe('--team-aston_martin-plot-bright');
    expect(alonso?.teammate).toBe(true);
    expect(stroll?.teammate).toBe(true);
  });

  it('orders by reference, not by the order the caller passed them in', () => {
    const [stroll, alonso] = assignEntityColours([
      entity('stroll', 'aston_martin'),
      entity('alonso', 'aston_martin'),
    ]);
    expect(alonso?.plot).toBe('--team-aston_martin-plot-deep');
    expect(stroll?.plot).toBe('--team-aston_martin-plot-bright');
  });

  it('gives neither driver the team’s own plot colour — the split is symmetric', () => {
    /*
     * §6.4a property 1. Painting one driver in the team's colour and the other in a derivative
     * implies a number-one / number-two hierarchy the data does not support, and measurably could
     * not reach the ΔE floor from a mid-band anchor.
     */
    const pair = assignEntityColours([entity('a', FERRARI), entity('b', FERRARI)]);
    for (const member of pair) expect(member.plot).not.toBe(plotToken(FERRARI));
  });

  it('separates the two shades — a pair the reader cannot tell apart would be worse than none', () => {
    const pair = shadePair(FERRARI);
    expect(pair).not.toBeNull();
    if (pair !== null) expect(collides(pair.deep, pair.bright)).toBe(false);
  });

  it('has NO pair for Sauber, in either theme, and says so as colourExhausted', () => {
    /*
     * The finding this suite exists to protect. Sauber's brand hue is 143 — inside the reserved
     * green timing band — and in light mode exactly one lightness in the plotting band clears ΔE 15
     * from `--timing-green-ink`. A dark-mode pair exists and is withheld, because an encoding that
     * changed with the theme would have to be unlearned at sunset (§6.4a property 3).
     */
    expect(shadePair(SAUBER)).toBeNull();
    const pair = assignEntityColours([entity('a', SAUBER), entity('b', SAUBER)]);
    expect(pair.map((member) => member.plot)).toEqual(['--team-sauber-plot', '--team-sauber-plot']);
    expect(pair.every((member) => member.teammate && member.colourExhausted)).toBe(true);
  });

  it('exhausts colour outright at three drivers of one team — a designed state', () => {
    // A mid-season replacement driver. §6.4a property 4: one hue supplies at most two shades, and
    // light mode sets the cap, so rungs 1–3 carry the whole distinction beyond two.
    const trio = assignEntityColours([
      entity('a', FERRARI),
      entity('b', FERRARI),
      entity('c', FERRARI),
    ]);
    expect(trio.every((member) => member.plot === plotToken(FERRARI))).toBe(true);
    expect(trio.every((member) => member.colourExhausted)).toBe(true);
  });

  it('gives a colourless team a shade pair too — the ramp is gated on it in both themes', () => {
    const pair = shadePair(BRM);
    expect(pair).not.toBeNull();
    if (pair !== null) {
      expect(pair.deep).toBe(`--ramp-${String(rampSlot(BRM))}-plot-deep`);
      expect(collides(pair.deep, pair.bright)).toBe(false);
    }
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

  it('re-shades only the team whose teammate arrived — the one permitted repaint', () => {
    const solo = assignEntityColours([entity('a', FERRARI), entity('c', BRM)]);
    const withMate = assignEntityColours([
      entity('a', FERRARI),
      entity('c', BRM),
      entity('b', FERRARI),
    ]);
    expect(solo[0]?.plot).toBe(plotToken(FERRARI));
    expect(withMate[0]?.plot).toBe('--team-ferrari-plot-deep');
    expect(withMate[1]?.plot).toBe(solo[1]?.plot); // the unrelated survivor does not move
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
    // 663 of 2016 pairs collide (§9.2.4). A masks array of zeros is the failure this catches.
    let found = 0;
    for (let i = 0; i < PLOT_TOKENS.length; i += 1) {
      for (let j = i + 1; j < PLOT_TOKENS.length; j += 1) {
        if (collides(PLOT_TOKENS[i] as PlotToken, PLOT_TOKENS[j] as PlotToken)) found += 1;
      }
    }
    expect(found).toBe(663);
  });

  it('assumes the worst for a token it does not know', () => {
    // Never the best: an unrecognised colour that silently reports "separated" would suppress the
    // differentiator that was the only thing making the pair readable.
    expect(collides('--not-a-token' as PlotToken, '--ramp-1-plot')).toBe(true);
  });
});
