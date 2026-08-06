import { describe, expect, it } from 'vitest';
import TOKENS_CSS from '../../styles/tokens.css?raw';
import { DUR_OUTSIDE_INTERACTION_BUDGET, MOTION } from './tokens';
import TOKENS_TS from './tokens.ts?raw';

/**
 * CT-1 … CT-3. The motion token set is the one place a timing value may exist, so these
 * tests guard the two properties that make that claim worth anything: the values are
 * inside the budgets `DESIGN_SYSTEM.md` §4.2 sets, and the CSS half of the mechanism
 * split cannot drift from the JS half.
 */

/**
 * GSAP's named-ease grammar. `back` and `steps` are matched by the pattern but are
 * **not adopted** by this product (§4.3) — the second assertion in CT-2 is what enforces
 * that, because a pattern cannot express "spelled correctly but forbidden".
 */
const GSAP_EASE = /^(none|power[1-4]|circ|expo|sine|back|steps)(\.(in|out|inOut))?(\(.*\))?$/;

/** Overshooting and oscillating eases. This product decelerates like a mechanism. */
const FORBIDDEN_EASES = ['back', 'elastic', 'bounce', 'rough', 'slow', 'steps', 'expoScale'];

describe('CT-1 — durations are finite, positive, and inside the §4.2 budgets', () => {
  it('holds every interaction-path duration at or under 400ms', () => {
    const exempt = Object.keys(DUR_OUTSIDE_INTERACTION_BUDGET);

    for (const [name, value] of Object.entries(MOTION.dur)) {
      expect(Number.isFinite(value), `${name} is finite`).toBe(true);
      expect(value, `${name} is positive`).toBeGreaterThan(0);

      if (exempt.includes(name)) continue;
      // Seconds, GSAP's unit. 0.4 === the 400ms interaction ceiling.
      expect(value, `${name} is on the interaction path and must be ≤ 0.4s`).toBeLessThanOrEqual(
        0.4,
      );
    }
  });

  it('keeps the two exempt durations inside the 900ms single-tween entrance budget', () => {
    // The exemption list is data, not a hard-coded set inside this test, so a new long
    // duration cannot be introduced without also stating its justification.
    expect(Object.keys(DUR_OUTSIDE_INTERACTION_BUDGET).sort()).toEqual(['pointer', 'reveal']);

    for (const name of Object.keys(DUR_OUTSIDE_INTERACTION_BUDGET)) {
      const value = MOTION.dur[name as keyof typeof MOTION.dur];
      expect(value, `${name} is within the entrance budget`).toBeLessThanOrEqual(0.9);
      expect(
        DUR_OUTSIDE_INTERACTION_BUDGET[name as keyof typeof DUR_OUTSIDE_INTERACTION_BUDGET].length,
        `${name} states why it is exempt`,
      ).toBeGreaterThan(0);
    }
  });

  it('keeps every ambient loop period well clear of the interaction path', () => {
    // Ambient loops are unbounded by §4.2, but "unbounded" is not "unchecked": a loop
    // fast enough to read as busy is the failure mode, so the floor is a second.
    for (const [name, value] of Object.entries(MOTION.loop)) {
      expect(Number.isFinite(value), `${name} is finite`).toBe(true);
      expect(value, `${name} is not on an interaction path`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('CT-2 — every ease is a GSAP named ease, and no bézier can re-enter', () => {
  it('matches the GSAP named-ease grammar', () => {
    for (const [name, value] of Object.entries(MOTION.ease)) {
      expect(value, `ease.${name}`).toMatch(GSAP_EASE);
    }
    // The preset pairs carry eases too, and `m.pointer` is the one that names a curve
    // outside the seven — GSAP's own cursor-follow example uses `power3`.
    for (const [name, preset] of Object.entries(MOTION.m)) {
      expect(preset.ease, `m.${name}.ease`).toMatch(GSAP_EASE);
    }
  });

  it('contains no cubic-bézier literal, no CustomEase, and no numeric array', () => {
    // Read as text, because the point is that none of these can be *written* here — a
    // value-level assertion would miss one in a nested object this test does not walk.
    // Comments are stripped first: naming a forbidden construct in order to forbid it is
    // exactly what the documentation in this module is for.
    const code = TOKENS_TS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code).not.toContain('cubic-bezier');
    expect(code).not.toContain('cubic-bézier');
    expect(code).not.toContain('CustomEase');
    expect(code).not.toContain('CustomBounce');
    expect(code).not.toContain('CustomWiggle');
    // A numeric array is the retired library's bézier form; none is legitimate here.
    expect(code).not.toMatch(/\[\s*-?[\d.]+\s*,/);
  });

  it('adopts none of the overshooting or oscillating eases', () => {
    const used = [
      ...Object.values(MOTION.ease),
      ...Object.values(MOTION.m).map((preset) => preset.ease),
    ];
    for (const forbidden of FORBIDDEN_EASES) {
      for (const value of used) {
        expect(value.startsWith(forbidden), `${value} must not use "${forbidden}"`).toBe(false);
      }
    }
  });
});

describe('CT-3 — MOTION.dur agrees with the --dur-* tokens in tokens.css', () => {
  /** Every `--dur-name: Nms;` declaration in the stylesheet. */
  function cssDurations(): Map<string, number> {
    const found = new Map<string, number>();
    const pattern = /--dur-([a-z]+):\s*(\d+)ms;/g;
    for (const match of TOKENS_CSS.matchAll(pattern)) {
      const [, name, ms] = match;
      if (name === undefined || ms === undefined) continue;
      found.set(name, Number(ms));
    }
    return found;
  }

  it('mirrors every CSS duration in seconds', () => {
    const css = cssDurations();
    expect(css.size).toBeGreaterThan(0);

    for (const [name, ms] of css) {
      const seconds = MOTION.dur[name as keyof typeof MOTION.dur];
      expect(seconds, `--dur-${name} has no MOTION.dur counterpart`).toBeDefined();
      // Compared in milliseconds to keep the assertion free of float noise.
      expect(Math.round(seconds * 1000), `--dur-${name}`).toBe(ms);
    }
  });

  it('mirrors every ambient loop period as an --anim-* token', () => {
    // The same drift guard, one mechanism down. MR-1 puts every loop in CSS, so these
    // are the figures that actually run and `MOTION.loop` is the mirror — which makes it
    // the half more likely to rot unnoticed.
    const cssName: Record<keyof typeof MOTION.loop, string> = {
      grid: '--anim-grid',
      orbA: '--anim-orb-a',
      orbB: '--anim-orb-b',
      orbC: '--anim-orb-c',
      comet: '--anim-comet',
      skeleton: '--anim-skeleton',
    };

    for (const [name, seconds] of Object.entries(MOTION.loop)) {
      const token = cssName[name as keyof typeof MOTION.loop];
      const match = new RegExp(`${token}:\\s*(\\d+)ms;`).exec(TOKENS_CSS);
      expect(match, `${token} is missing from tokens.css`).not.toBeNull();
      expect(Number(match?.[1]), token).toBe(Math.round(seconds * 1000));
    }
  });

  it('mirrors every JS duration in CSS except the documented quickTo constant', () => {
    const css = cssDurations();
    for (const name of Object.keys(MOTION.dur)) {
      if (name === 'pointer') {
        // Not a transition duration — it is the `gsap.quickTo` catch-up constant, so
        // there is deliberately no CSS token for it.
        expect(css.has(name)).toBe(false);
        continue;
      }
      expect(css.has(name), `--dur-${name} is missing from tokens.css`).toBe(true);
    }
  });
});
