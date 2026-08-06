import { describe, expect, it } from 'vitest';
import INDEX_CSS from './index.css?raw';
import TOKENS_CSS from './tokens.css?raw';

/**
 * The accent's **correctness** rules, mechanically. Not taste — every assertion below is a rule
 * `DESIGN_SYSTEM.md` states as binding, and each one is the kind that a later change breaks
 * silently because the result still looks fine.
 *
 * There is no visual-verification gate in this project any more (CR-006), which makes these the
 * only thing standing between §3.6 and a component that reaches for a raw ramp step or paints a
 * timing semantic in the interface accent.
 */

const CODE = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const TOKENS = CODE(TOKENS_CSS);
const INDEX = CODE(INDEX_CSS);

/**
 * The F1 timing convention's reserved hues (§3.4) — **never reusable as an interface colour**.
 * Purple is session-fastest, green a personal best, yellow below a personal best. A magenta at
 * OkLCh hue 350 is nowhere near any of them, which is the point: this test is what stops a future
 * "let's make the accent violet" from passing review, because violet measures ΔE 1.10 from the
 * reserved purple (§9.2.1 V-10).
 */
const RESERVED_HUE_BANDS = [
  { name: 'timing purple', from: 265, to: 340 },
  { name: 'timing green / teal', from: 140, to: 195 },
  { name: 'timing yellow / amber', from: 30, to: 140 },
];

/** sRGB hex → OkLCh hue, in degrees. The same arithmetic `scripts/validate-palette.mjs` uses. */
function hue(hex: string): number {
  const toLinear = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

  const r = toLinear(Number.parseInt(hex.slice(1, 3), 16) / 255);
  const g = toLinear(Number.parseInt(hex.slice(3, 5), 16) / 255);
  const b = toLinear(Number.parseInt(hex.slice(5, 7), 16) / 255);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const degrees = (Math.atan2(bb, a) * 180) / Math.PI;
  return degrees < 0 ? degrees + 360 : degrees;
}

/** Every `--signal-NNN: #hex;` in the ramp. */
function ramp(): Array<[string, string]> {
  return [...TOKENS.matchAll(/(--signal-\d+):\s*(#[0-9a-fA-F]{6})/g)].map((match) => [
    match[1] ?? '',
    match[2] ?? '',
  ]);
}

describe('the Signal ramp', () => {
  it('has all eleven steps', () => {
    expect(ramp()).toHaveLength(11);
  });

  it('sits at OkLCh hue 350 ± 2 at every chromatic step', () => {
    for (const [token, hex] of ramp()) {
      // The near-white and near-black ends carry almost no chroma, so their hue is numerically
      // unstable and meaningless — they are excluded rather than the tolerance being widened.
      if (['--signal-50', '--signal-900'].includes(token)) continue;
      expect(hue(hex), `${token} (${hex})`).toBeGreaterThan(348);
      expect(hue(hex), `${token} (${hex})`).toBeLessThan(352);
    }
  });

  it('is nowhere near a reserved F1 timing hue', () => {
    for (const [token, hex] of ramp()) {
      const h = hue(hex);
      for (const band of RESERVED_HUE_BANDS) {
        expect(
          h > band.from && h < band.to,
          `${token} (${hex}, hue ${h.toFixed(1)}) is inside the reserved ${band.name} band`,
        ).toBe(false);
      }
    }
  });
});

describe('the accent aliases', () => {
  it('defines all eleven, in both themes', () => {
    const aliases = [
      'ink',
      'ink-strong',
      'fill',
      'fill-hover',
      'on',
      'mark',
      'border',
      'wash',
      'wash-ink',
      'glow',
      'hairline',
    ];
    // Light in `:root`, dark under `[data-theme='dark']` — two declarations each.
    for (const alias of aliases) {
      const declarations = [...TOKENS.matchAll(new RegExp(`--accent-${alias}:`, 'g'))];
      expect(declarations.length, `--accent-${alias}`).toBe(2);
    }
  });

  it('is the only way a component reaches the accent — never a raw ramp step', () => {
    // §3.6.2: `--signal-*` is the raw scale and the aliases are the API. A component consuming a
    // raw step would break the light/dark split, because which step each theme uses is exactly
    // what the aliases decide.
    const rawUses = [...INDEX.matchAll(/var\(--signal-\d+\)/g)].map((match) => match[0]);
    expect(rawUses, `index.css consumes ${rawUses.join(', ')}`).toEqual([]);
  });

  it('keeps the focus ring achromatic (§3.5.1)', () => {
    // A focus ring must be visible over *every* surface including a team colour; an accent ring
    // cannot promise that, and motion is never a focus indicator.
    const ring = /:focus-visible\s*\{([^}]*)\}/.exec(INDEX)?.[1] ?? '';
    expect(ring).toMatch(/outline:[^;]*var\(--ink-primary\)/);
    expect(ring).not.toMatch(/accent/);
  });

  it('never paints a skeleton, a chip or a status in the accent', () => {
    // §3.6.4: an accent-coloured skeleton implies content that is not there, and an accent on a
    // status or timing chip would compete with a reserved semantic.
    for (const selector of ['.skeleton', '.chip']) {
      const block = new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`).exec(INDEX)?.[1] ?? '';
      expect(block, selector).not.toMatch(/accent/);
    }
  });
});

describe('the z-index scale (§5.2a)', () => {
  it('is the only source of stacking order', () => {
    const literals = [...INDEX.matchAll(/z-index:\s*(-?\d+)/g)].map((match) => match[1]);
    expect(literals, `index.css hard-codes z-index ${literals.join(', ')}`).toEqual([]);
  });

  it('puts the skip link above the dock', () => {
    // At ≥1024 the rail sits at 40 over the top-left corner. A skip link below it would be
    // announced and then covered — the one place the ordering is an accessibility requirement.
    const value = (token: string) =>
      Number(new RegExp(`${token}:\\s*(\\d+)`).exec(TOKENS)?.[1] ?? '-1');
    expect(value('--z-skip')).toBeGreaterThan(value('--z-dock'));
    expect(value('--z-dock')).toBeGreaterThan(value('--z-header'));
    expect(value('--z-header')).toBeGreaterThan(value('--z-content'));
    expect(value('--z-content')).toBeGreaterThan(value('--z-atmosphere'));
  });
});
