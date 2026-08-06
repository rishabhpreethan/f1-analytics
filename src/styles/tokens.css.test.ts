import { describe, expect, it } from 'vitest';
import INDEX_CSS from './index.css?raw';
import TOKENS_CSS from './tokens.css?raw';

/**
 * The accent's **correctness** rules, mechanically. Not taste — every assertion below is a rule
 * `DESIGN_SYSTEM.md` states as binding, and each one is the kind that a later change breaks
 * silently because the result still looks fine.
 *
 * There is no visual-verification gate in this project any more (CR-006), which makes these the
 * only thing standing between §3.6 and a component that paints a timing semantic in the interface
 * accent, or a "let's warm the accent up a bit" edit that quietly reintroduces a hue.
 *
 * **Rewritten 2026-08-06 for the monochrome accent.** The Signal ramp (OkLCh hue 350) is gone, so
 * the reserved-hue-band test is gone with it — and is replaced by something strictly stronger: the
 * accent must be **achromatic**, which makes a collision with a reserved hue impossible rather
 * than merely distant. The contrast floors are asserted here now too, from the §9.1 arithmetic, so
 * `tokens.css` verifies itself rather than pointing at a validation run recorded in a document.
 */

const CODE = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const TOKENS = CODE(TOKENS_CSS);
const INDEX = CODE(INDEX_CSS);

/* ------------------------------------------------------------------ §9.1 arithmetic, inline.
 * Duplicated from `scripts/validate-palette.mjs` rather than imported: the script is a CLI that
 * prints, and a test needs values. Both derive from §9.1 steps 2 and 3, and the calibration block
 * below pins these helpers to the same figures the validator reports.
 */
function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearRgb(hex: string): [number, number, number] {
  return [
    toLinear(Number.parseInt(hex.slice(1, 3), 16) / 255),
    toLinear(Number.parseInt(hex.slice(3, 5), 16) / 255),
    toLinear(Number.parseInt(hex.slice(5, 7), 16) / 255),
  ];
}

/** WCAG 2.1 relative luminance ratio (§9.1 step 3). */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = linearRgb(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const sorted = [lum(a), lum(b)].sort((x, y) => y - x);
  return ((sorted[0] ?? 0) + 0.05) / ((sorted[1] ?? 0) + 0.05);
}

/** OkLCh chroma (§9.1 step 2). Zero for a pure grey, and that is the whole point here. */
function chroma(hex: string): number {
  const [r, g, b] = linearRgb(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return Math.hypot(a, bb);
}

/**
 * `--name: #hex;` from the `:root` block (light) or the `[data-theme='dark']` block (dark).
 *
 * The file is split on the theme selector rather than searched globally: the two blocks declare
 * the same names, so one global match would silently return whichever appeared first and every
 * "dark" figure below would actually be measuring the light value.
 */
const DARK_START = TOKENS.indexOf("[data-theme='dark']");

function token(name: string, theme: 'light' | 'dark'): string {
  const scope = theme === 'light' ? TOKENS.slice(0, DARK_START) : TOKENS.slice(DARK_START);
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(scope);
  expect(
    match,
    `${name} is missing from the ${theme} block, or is not a 6-digit hex`,
  ).not.toBeNull();
  return (match?.[1] ?? '').toLowerCase();
}

/** The §3.5 surfaces each accent alias is measured against. */
const SURFACE = {
  light: { raised: '#ffffff', canvas: '#f7f8fb', sunken: '#eff1f5', inkPrimary: '#1b1e24' },
  dark: { raised: '#1a1c20', canvas: '#0e0f13', sunken: '#08090c', inkPrimary: '#f5f7f9' },
} as const;

const THEMES = ['light', 'dark'] as const;

const ALIASES = [
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
] as const;

/** Every alias that is a plain hex — `--accent-hairline` is an `rgb()` with alpha, so it is out. */
const HEX_ALIASES = ALIASES.filter((alias) => alias !== 'hairline');

describe('the arithmetic agrees with scripts/validate-palette.mjs', () => {
  it('reproduces three recorded §9.2 figures, so the helpers above can be trusted', () => {
    // If these drift, every figure below is measuring something else. Same posture §9.2.1 takes
    // when it calibrates the validator against the pre-CR-007 record before using it.
    expect(contrast('#6a6d74', '#eff1f5')).toBeCloseTo(4.58, 2); // ink-tertiary on sunken, light
    expect(contrast('#86898f', '#08090c')).toBeCloseTo(5.68, 2); // ink-tertiary on sunken, dark
    expect(chroma('#9c9fa2')).toBeCloseTo(0.0056, 4); // Haas, §9.2 V-1
  });
});

describe('the accent is monochrome (§3.6)', () => {
  it('declares all eleven aliases, in both themes', () => {
    for (const alias of ALIASES) {
      const declarations = [...TOKENS.matchAll(new RegExp(`--accent-${alias}:`, 'g'))];
      expect(declarations.length, `--accent-${alias}`).toBe(2);
    }
  });

  it('carries no hue at all — which is what makes a reserved-semantic collision impossible', () => {
    /*
     * This replaces the retired reserved-hue-band test. That one could only prove the accent was
     * *far from* purple, green and yellow; this proves it has no hue to be near them with.
     *
     * The floor is deliberately tight. §3.5's neutrals are generated at OkLCh hue 264 with chroma
     * up to 0.013 and the accent sits in that family, so anything under 0.02 is "a neutral". A
     * future "let's warm the accent slightly" edit fails here rather than in Rishabh's review.
     */
    for (const theme of THEMES) {
      for (const alias of HEX_ALIASES) {
        const hex = token(`--accent-${alias}`, theme);
        expect(chroma(hex), `--accent-${alias} (${theme}, ${hex}) carries chroma`).toBeLessThan(
          0.02,
        );
      }
    }
  });

  it('is the pole of the neutral scale, not a mid step', () => {
    // The accent's emphasis is contrast, so it has to sit at the *end* of the ramp — beyond
    // `--ink-primary` in both themes. An accent that landed between ink-primary and the surface
    // would just be a quieter heading, which is the failure mode this switch is most exposed to.
    for (const theme of THEMES) {
      expect(
        contrast(token('--accent-ink', theme), SURFACE[theme].raised),
        `--accent-ink (${theme}) must out-contrast --ink-primary`,
      ).toBeGreaterThan(contrast(SURFACE[theme].inkPrimary, SURFACE[theme].raised));
    }
  });

  it('has no trace of the retired Signal ramp', () => {
    // The 11-step hue-350 scale is gone. A leftover `var(--signal-*)` would resolve to nothing and
    // paint `transparent` — visible only as a mark that is not there.
    expect(TOKENS).not.toMatch(/--signal-/);
    expect(INDEX).not.toMatch(/--signal-/);
  });
});

describe('every accent alias clears its measured floor, in both themes (§9.2.2 V-18)', () => {
  it.each(THEMES)('%s — text and mark contrast', (theme) => {
    const S = SURFACE[theme];
    const ink = token('--accent-ink', theme);
    const mark = token('--accent-mark', theme);

    for (const surface of [S.raised, S.canvas, S.sunken]) {
      expect(contrast(ink, surface), `--accent-ink on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mark, surface), `--accent-mark on ${surface}`).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(THEMES)('%s — the ink ON a fill, at rest and on hover', (theme) => {
    const on = token('--accent-on', theme);
    expect(contrast(on, token('--accent-fill', theme))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(on, token('--accent-fill-hover', theme))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)('%s — the wash is a visible field, and its ink reads on it', (theme) => {
    const wash = token('--accent-wash', theme);
    // 1.10:1 is the §3.4.1 timing-wash precedent for "visibly a field rather than the surface".
    expect(contrast(wash, SURFACE[theme].raised)).toBeGreaterThanOrEqual(1.1);
    expect(contrast(token('--accent-wash-ink', theme), wash)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(SURFACE[theme].inkPrimary, wash)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)('%s — the achromatic double focus ring survives an accent fill', (theme) => {
    /*
     * §3.5.1's ring is `2px --ink-primary` at `outline-offset: 2px` **plus** a 2px
     * `--surface-raised` separator ring. With a near-black / near-white accent fill the outer ring
     * has almost no separation from it — light measures 1.19:1 — and it is the inner surface ring
     * that carries the indicator. That is exactly why the ring is doubled, and this assertion is
     * what stops a later "simplify it to one ring".
     */
    const S = SURFACE[theme];
    const fill = token('--accent-fill', theme);
    const better = Math.max(contrast(S.inkPrimary, fill), contrast(S.raised, fill));
    expect(better, 'better of the two focus rings vs --accent-fill').toBeGreaterThanOrEqual(3);
    // And the outer ring has to read on its outward side, against the page.
    expect(contrast(S.inkPrimary, S.canvas)).toBeGreaterThanOrEqual(3);
  });
});

describe('where the accent may not go', () => {
  it('keeps the focus ring achromatic (§3.5.1)', () => {
    // A focus ring must be visible over *every* surface including a team colour; an accent ring
    // cannot promise that, and motion is never a focus indicator.
    const ring = /:focus-visible\s*\{([^}]*)\}/.exec(INDEX)?.[1] ?? '';
    expect(ring).toMatch(/outline:[^;]*var\(--ink-primary\)/);
    expect(ring).not.toMatch(/accent/);
  });

  it('never paints a skeleton or a chip in the accent', () => {
    // §3.6.4: an accent-coloured skeleton implies content that is not there, and an accent on a
    // status or timing chip would compete with a reserved semantic.
    for (const selector of ['.skeleton', '.chip']) {
      const block = new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`).exec(INDEX)?.[1] ?? '';
      expect(block, selector).not.toMatch(/accent/);
    }
  });

  it('leaves the reserved status hues untouched by the monochrome switch', () => {
    /*
     * The switch is a **chrome** change. The reserved semantics are *data* (§3.4) and F3 depends on
     * them; a tidy-up that folded them into the neutral scale would delete the strongest
     * recognition cue this product has with F1 fans.
     *
     * **The three timing tokens are deliberately not asserted here, because they are not in
     * `tokens.css` yet** — §3.4.1 specifies their exact hexes but F0 renders no lap time, so they
     * land with the first surface that shows one (F1/F3). The four status tokens *are* shipped, and
     * they are the same rule, so they are what this can guard today.
     */
    for (const reserved of [
      '--status-info-ink',
      '--status-good-ink',
      '--status-caution-ink',
      '--status-critical-ink',
    ]) {
      for (const theme of THEMES) {
        const hex = token(reserved, theme);
        expect(chroma(hex), `${reserved} (${theme}) must keep its hue`).toBeGreaterThan(0.05);
      }
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
    const value = (name: string) =>
      Number(new RegExp(`${name}:\\s*(\\d+)`).exec(TOKENS)?.[1] ?? '-1');
    expect(value('--z-skip')).toBeGreaterThan(value('--z-dock'));
    expect(value('--z-dock')).toBeGreaterThan(value('--z-header'));
    expect(value('--z-header')).toBeGreaterThan(value('--z-content'));
    expect(value('--z-content')).toBeGreaterThan(value('--z-atmosphere'));
  });
});
