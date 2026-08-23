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
  const open = CSS.indexOf('{', match?.index ?? 0);
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
