import { describe, expect, it } from 'vitest';
import ENTITY_CSS from './entity.css?raw';
import INDEX_CSS from './index.css?raw';

/**
 * `entity.css` is **generated** (`DESIGN_SYSTEM.md` §3.3a), and that is the whole reason this file
 * exists. It asserts properties of the *result* that the emitter could get wrong without any of them
 * being visible in a screenshot: a dark-block token that does not exist (so `var()` silently serves
 * the light value), a series colour that has drifted grey, a retired shade-pair token creeping back
 * into the budget, or the whole layer never being imported.
 *
 * **The byte-identical drift check is in `scripts/entity-tokens.test.mjs`, not here**, because it
 * needs `node:child_process` and `src/**` is compiled by `tsconfig.app.json`, which deliberately
 * carries no `@types/node`.
 *
 * The *perceptual* floors — ΔE 15 normal / 8 CVD, both themes, both CVD models — are gated by
 * `npm run validate:palette` (V-23 … V-29), which CI runs on every push. Duplicating CIEDE2000 and
 * two dichromacy models here would be a second implementation to keep in agreement with the first.
 * What is asserted below is what a *stylesheet* can be wrong about.
 *
 * ⚠ `entity.css` had to be added to `vite.config.ts`'s `test.css.include` allowlist for the import
 * below to return anything. Vitest replaces every CSS import with an empty string by default and
 * does so **even for an explicit `?raw` request**, silently — an earlier draft of this file passed
 * 14 of its 16 assertions against `''`, because a set-equality and a no-duplicates check are
 * vacuously true on an empty string. If a future edit removes that allowlist entry, the guard
 * immediately below is what fails.
 */

const CODE = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const ENTITY = CODE(ENTITY_CSS);

/* ------------------------------------------------------------------ §9.1 arithmetic, inline.
 * Same posture as `tokens.css.test.ts`: the validator is a CLI that prints and a test needs
 * values. The calibration assertion below pins these two helpers to figures the validator reports,
 * so a silent divergence in the maths fails before it can make a floor look satisfied.
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

function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = linearRgb(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const sorted = [lum(a), lum(b)].sort((x, y) => y - x);
  return ((sorted[0] ?? 0) + 0.05) / ((sorted[1] ?? 0) + 0.05);
}

/** OkLab L and C (§9.1 step 2). */
function oklab(hex: string): { L: number; C: number } {
  const [r, g, b] = linearRgb(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    C: Math.hypot(
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ),
  };
}

/**
 * The two theme blocks, split on the selector rather than searched globally — they declare the
 * same names, so one global match would return whichever came first and every "dark" figure below
 * would in fact be measuring the light value.
 */
const DARK_START = ENTITY.indexOf("[data-theme='dark']");

function block(theme: 'light' | 'dark'): string {
  return theme === 'light' ? ENTITY.slice(0, DARK_START) : ENTITY.slice(DARK_START);
}

function names(theme: 'light' | 'dark'): string[] {
  return [...block(theme).matchAll(/(--[a-z0-9_-]+):/g)].map((match) => match[1] ?? '');
}

function tokens(theme: 'light' | 'dark'): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of block(theme).matchAll(/(--[a-z0-9_-]+):\s*(#[0-9a-f]{6})\s*;/g)) {
    map.set(match[1] ?? '', match[2] ?? '');
  }
  return map;
}

/** §3.5. `sunken` is the colour of a plot area, which is why a mark is measured against it. */
const SURFACE = {
  light: { raised: '#ffffff', canvas: '#f7f8fb', sunken: '#eff1f5' },
  dark: { raised: '#1a1c20', canvas: '#0e0f13', sunken: '#08090c' },
} as const;

const THEMES = ['light', 'dark'] as const;

/** The 12 teams that carry a `primary_color`; the other 202 of 214 plot from the ramp (§3.1). */
const BRANDED = [
  'alpine',
  'aston_martin',
  'audi',
  'cadillac',
  'ferrari',
  'haas',
  'mclaren',
  'mercedes',
  'rb',
  'red_bull',
  'sauber',
  'williams',
] as const;

/** Below the 0.05 OkLCh chroma floor, so they have an identity colour and no plotting colour. */
const ACHROMATIC_BRANDS = ['cadillac', 'haas'] as const;

const RAMP_SLOTS = 12;

describe('the arithmetic agrees with scripts/validate-palette.mjs', () => {
  it('reproduces recorded §9.2 figures, so the helpers above can be trusted', () => {
    expect(contrast('#6a6d74', '#eff1f5')).toBeCloseTo(4.58, 2); // V-2, ink-tertiary on light sunken
    expect(oklab('#9c9fa2').C).toBeCloseTo(0.0056, 4); // V-1, Haas chroma
    expect(oklab('#00d7b6').L).toBeCloseTo(0.786, 3); // V-1, Mercedes lightness
  });
});

describe('the stylesheet actually reached this test, and actually reaches the browser', () => {
  it('was not blanked by vitest — every assertion below is vacuous if it was', () => {
    // The guard the docblock describes. A blanked CSS import is the failure mode that makes a whole
    // test file pass while testing nothing, and this project has no visual gate to catch it after.
    expect(ENTITY_CSS.length).toBeGreaterThan(1000);
    expect(DARK_START).toBeGreaterThan(0);
  });

  it('is imported by index.css, so the layer actually ships', () => {
    // Without this, every token below resolves to nothing at runtime and every chart falls back to
    // an inherited colour — while all the other tests in this file still pass.
    expect(INDEX_CSS).toMatch(/@import\s+'\.\/entity\.css'/);
  });
});

describe('the two theme blocks are structurally identical (§3.5 — dark is designed, not skipped)', () => {
  it('declares exactly the same token names in both', () => {
    /*
     * A token present in `:root` but missing from the dark block does not error: `var()` serves
     * the light value, so a chart in dark mode silently plots a light-mode colour that was never
     * validated against a dark surface. Nothing about that is visible in a diff.
     */
    expect(new Set(names('dark'))).toEqual(new Set(names('light')));
  });

  it('declares no token twice inside one block', () => {
    for (const theme of THEMES) {
      const declared = names(theme);
      expect(new Set(declared).size, `duplicate declaration in the ${theme} block`).toBe(
        declared.length,
      );
    }
  });
});

describe('identity is separate from plotting (§3.3, §3.3a)', () => {
  it('gives all 12 branded teams an identity colour', () => {
    for (const theme of THEMES) {
      for (const team of BRANDED) {
        expect(tokens(theme).get(`--team-${team}`), `--team-${team} in ${theme}`).toMatch(
          /^#[0-9a-f]{6}$/,
        );
      }
    }
  });

  it('keeps the identity colour theme-invariant — a brand colour that moved would stop being it', () => {
    for (const team of BRANDED) {
      expect(tokens('dark').get(`--team-${team}`), team).toBe(
        tokens('light').get(`--team-${team}`),
      );
    }
  });

  it('gives Haas and Cadillac no plotting colour at all', () => {
    /*
     * Both are below the chroma floor (0.0056 / 0.0043), so they read as pure grey and would be
     * confusable with this product's achromatic chart furniture — a worse failure than being
     * confusable with another team. They plot from the ramp. This is the assertion that stops a
     * later pass from "completing the set" out of a sense of symmetry.
     */
    for (const theme of THEMES) {
      for (const team of ACHROMATIC_BRANDS) {
        expect(tokens(theme).has(`--team-${team}-plot`), `--team-${team}-plot`).toBe(false);
      }
    }
  });
});

describe('the fallback ramp covers all 12 slots (§3.3a — 202 of 214 teams need it)', () => {
  it('declares every slot in both themes', () => {
    for (const theme of THEMES) {
      const declared = tokens(theme);
      for (let slot = 1; slot <= RAMP_SLOTS; slot += 1) {
        expect(declared.has(`--ramp-${slot}-plot`), `--ramp-${slot}-plot in ${theme}`).toBe(true);
      }
    }
  });

  it('has no slot beyond 12 — a 13th series is not a generated hue (§6.2)', () => {
    expect(ENTITY).not.toMatch(/--ramp-(?:1[3-9]|[2-9]\d)-/);
  });
});

describe('every plotting colour is usable as a mark', () => {
  const plotting = (theme: 'light' | 'dark') =>
    [...tokens(theme)].filter(([name]) => name.includes('-plot'));

  it('carries real chroma — a grey series reads as the chart furniture, not as data', () => {
    for (const theme of THEMES) {
      for (const [name, hex] of plotting(theme)) {
        expect(oklab(hex).C, `${name} (${hex}) in ${theme}`).toBeGreaterThanOrEqual(0.05);
      }
    }
  });

  it('clears 3:1 against the plot area and the panel it sits on', () => {
    for (const theme of THEMES) {
      for (const [name, hex] of plotting(theme)) {
        for (const surface of ['raised', 'sunken'] as const) {
          expect(
            contrast(hex, SURFACE[theme][surface]),
            `${name} (${hex}) on ${theme} ${surface}`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});

describe('the teammate shade pair is GONE, and must stay gone (§6.4a, §9.2.8)', () => {
  /*
   * 84 `--*-plot-deep` / `-bright` declarations were deleted on 2026-08-23. §6.4a had already
   * withdrawn them from use — colour identifies the car, the dash identifies the seat — and the
   * deletion reclaimed a measured 0.61 KB gzipped of a 25 KB render-blocking CSS budget (§9.2.7).
   *
   * This asserts the *absence*, because absence is what a later change can destroy. Regenerating
   * from an older emitter, or "completing the palette for symmetry", puts them back silently: the
   * stylesheet still parses, every other test here still passes, and the budget quietly loses 2.4
   * points to tokens no component can name.
   */
  it('declares no shade-pair token in either theme', () => {
    for (const theme of THEMES) {
      const shades = [...tokens(theme).keys()].filter(
        (name) => name.endsWith('-plot-deep') || name.endsWith('-plot-bright'),
      );
      expect(shades, `${theme} still declares ${shades.length} shade-pair token(s)`).toEqual([]);
    }
  });

  it('leaves exactly one plotting token per plotting entity — 22, not 64', () => {
    /*
     * The count, not just the suffix, because it is the figure `PLOT_TOKENS` and every
     * `COLLISION_MASKS` index are built from. 10 branded plotting teams (12 brands less the two
     * achromatic ones) plus the 12 ramp slots.
     */
    for (const theme of THEMES) {
      const plotting = [...tokens(theme).keys()].filter((name) => name.endsWith('-plot'));
      expect(plotting, theme).toHaveLength(BRANDED.length - ACHROMATIC_BRANDS.length + RAMP_SLOTS);
    }
  });
});
