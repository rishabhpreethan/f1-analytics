import { describe, expect, it } from 'vitest';
import CHARTS_CSS from './charts.css?raw';

/**
 * Invariants of the chart kit's stylesheet (`DESIGN_SYSTEM.md` §6.3, §6.4a).
 *
 * **`charts.css` had no source test until 2026-08-23, and the reason was a config allowlist.**
 * Vitest replaces every CSS import with `''` — even an explicit `?raw` — unless the file matches
 * `test.css.include` in `vite.config.ts`, and `charts.css` was not in that list. An empty string
 * makes every `toContain` pass, so the first assertion below is that the file was actually read;
 * that is the same guard every other stylesheet test in this directory opens with, and it exists
 * because removing an entry from the allowlist fails **silently**.
 *
 * jsdom performs no layout and no compositing, so nothing here can say a shadow line *looks*
 * lighter than its principal. What it can say is that the rule exists, targets the attribute the
 * component actually writes, and spends stroke width rather than opacity.
 */

/** Comments stripped, so a selector named in prose is never mistaken for a rule. */
const CSS = CHARTS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');

/** Every rule body for a selector, brace-balanced. */
function body(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(^|[},{])\\s*${escaped}\\s*\\{`).exec(CSS);
  expect(match, `no rule for ${selector}`).not.toBeNull();
  /* From the END of the match — see `compare.css.test.ts`: the prefix group swallows the preceding
   * brace, so on the first rule inside an `@layer` this would open at the layer's own brace. */
  const open = (match?.index ?? 0) + (match?.[0].length ?? 1) - 1;
  let depth = 0;
  for (let i = open; i < CSS.length; i += 1) {
    if (CSS[i] === '{') depth += 1;
    else if (CSS[i] === '}') {
      depth -= 1;
      if (depth === 0) return CSS.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced rule for ${selector}`);
}

describe('the file was read at all', () => {
  it('is not the empty string an allowlist miss would have given', () => {
    expect(CSS.length).toBeGreaterThan(2000);
    expect(CSS).toContain('.chart-line');
  });
});

describe('§6.4a — the other seat draws lighter', () => {
  const shadow = () => body(".chart-line[data-role='shadow']");

  it('spends stroke width, never opacity', () => {
    /*
     * An opacity drop moves the mark's measured contrast against the surface, and §6.3's plotting
     * band is gated at 3:1 — at 0.6 opacity six of the eleven brand colours would fall under it in
     * light mode (§9.2 V-8). A thinner stroke is the same colour and stays gated.
     */
    expect(shadow()).toMatch(/stroke-width:/);
    expect(shadow()).not.toMatch(/opacity/);
  });

  it('derives the thinner stroke from the mark-stroke token rather than hardcoding a px', () => {
    expect(shadow()).toContain('var(--size-mark-stroke)');
  });

  it('stays above a hairline, so the dash pattern still resolves', () => {
    // §6.4's period rule: `6 3` has a period of 9, which needs ≥ 2× the stroke. At 0.75 × 2px the
    // stroke is 1.5px and the period is 6× it.
    const factor = /\*\s*([\d.]+)\s*\)/.exec(shadow())?.[1];
    expect(Number(factor)).toBeGreaterThanOrEqual(0.5);
    expect(Number(factor)).toBeLessThan(1);
  });
});

describe('§6.3a — the outcome ramp is a mix of the entity colour, not a second palette', () => {
  it('derives both intermediate steps from --series, so identity survives the ramp', () => {
    /*
     * The whole claim of §6.3a. If either step ever became a literal colour or a neutral token,
     * a driver's bar would stop being his colour halfway along and the row would read as several
     * entities — which is the mistake the mode exists to prevent, and it is invisible in jsdom
     * because a custom property resolves to `''` here and `color-mix()` is never computed.
     */
    for (const tone of ['podium', 'classified']) {
      const rule = body(`.chart-span[data-tone='${tone}']`);
      expect(rule, tone).toMatch(/color-mix\(in oklab, var\(--series\)/);
      expect(rule, tone).toMatch(/var\(--tone-mix-/);
    }
  });

  it('mixes toward --surface-sunken, the surface the mark is actually drawn on', () => {
    /*
     * Not `--surface-raised`, which is the panel *around* the plot: a step mixed toward a surface
     * it does not sit on lands at the wrong lightness, and V-38's 1.27:1 floor for the faintest
     * step against the plot area would be measuring a background that is not there.
     */
    for (const tone of ['podium', 'classified']) {
      expect(body(`.chart-span[data-tone='${tone}']`), tone).toContain('var(--surface-sunken)');
    }
  });

  it('gives the fourth step no entity colour at all', () => {
    // The absence of colour IS the meaning: no result. A tinted step 4 would say "a weak finish".
    const rule = body(".chart-span[data-tone='unclassified']");
    expect(rule).toContain('var(--surface-raised)');
    expect(rule).not.toContain('--series');
  });

  it('has no rule for the win step, because the win step is the base rule', () => {
    // A `[data-tone='win']` override would be a second place the strongest step could drift from
    // `.chart-span`'s own `fill: var(--series)`.
    expect(CSS).not.toContain("data-tone='win'");
  });

  it('steps the step-4 hatch up to --border-strong', () => {
    /*
     * On `--surface-raised` the hatch is the only thing separating a not-classified segment from
     * the panel it is painted on. `--border-subtle` measures 1.24:1 there; `--border-strong` is
     * 1.90:1, which is what V-38 G-38d gates at 1.2.
     */
    expect(body(".chart-hatch-line[data-weight='strong']")).toContain('var(--border-strong)');
  });

  it('draws the legend keys in a neutral, never in an entity colour', () => {
    expect(body('.chart-tone-legend')).toMatch(/--series:\s*var\(--ink-secondary\)/);
  });
});
