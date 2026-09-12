import { describe, expect, it } from 'vitest';
import CREDITS_CSS from './credits.css?raw';

/**
 * **The credits panel's stylesheet, asserted as text** — `DESIGN_SYSTEM.md` §7.18.2, §7.19.5.
 *
 * ⚠ **This file could not exist until `credits.css` was added to `vite.config.ts`'s
 * `test.css.include` (2026-09-12).** Vitest replaces every CSS import with the empty string by
 * default and does so **even for an explicit `?raw` request**, silently — so a `.not.toContain()`
 * here would be *vacuously true* against `''`. The guard below is what fails if that entry is ever
 * removed.
 *
 * jsdom performs no layout, so nothing here knows whether a car letterboxes cleanly or whether a
 * white plate reads as a badge. What it decides is the class of defect this round actually
 * produced: **a replaced element given a box it cannot resolve.** Both of those shipped in the same
 * change — one in a flex container, one absolutely positioned — and neither is visible to any
 * rendering test.
 */

const raw = CREDITS_CSS;
if (raw.trim().length === 0) {
  throw new Error(
    'credits.css resolved to the empty string — it is missing from vite.config.ts ' +
      'test.css.include, and every assertion in this file would pass against nothing.',
  );
}
const CSS = raw.replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of the first rule whose selector matches, comments already stripped. */
function ruleBody(selector: string): string {
  const at = CSS.indexOf(selector);
  if (at === -1) throw new Error(`no rule for \`${selector}\``);
  const open = CSS.indexOf('{', at);
  return CSS.slice(open + 1, CSS.indexOf('}', open));
}

describe('the stylesheet is actually here — the check that makes the rest non-vacuous', () => {
  it('resolves to real CSS rather than to an empty string', () => {
    expect(CSS.length).toBeGreaterThan(500);
    expect(CSS).toContain('.credits-panel');
    expect(CSS).toContain('.credits-plates');
  });
});

describe('⛔ §7.19.5 — the mark plate, and the second half of this round’s sizing fault', () => {
  it('insets the mark with padding, never with `inset` plus an auto size', () => {
    /*
     * **The first draft read `inset: 16px; width: auto; height: auto`.** It is wrong, and wrong in
     * the same family as the `.mark-plate` collapse that Rishabh caught in the browser: four insets
     * do **not** resolve the box of an absolutely positioned *replaced* element. CSS 2.2 §10.3.8
     * determines its used `width` as for an inline replaced element — the intrinsic width — and
     * then, being over-constrained, **ignores `right`**. The mark would have been drawn at its
     * intrinsic size, anchored 16px from the top-left, and clipped by the frame's `overflow:
     * hidden`. It would not have looked empty, which is why it would have survived a glance.
     *
     * `padding` is the correct instrument: `box-sizing` is `border-box` product-wide, the base
     * rule's `width`/`height: 100%` stand, and **`object-fit` fits the content box**.
     */
    const body = ruleBody(".credits-plates[data-kind='logo'] .credits-image");
    expect(body).toContain('padding:');
    expect(body).not.toMatch(/inset:/);
    expect(body).not.toMatch(/width:\s*auto/);
    expect(body).not.toMatch(/height:\s*auto/);
  });

  it('keeps the base image rule sizing the box, so the padding has something to inset', () => {
    // `object-fit: contain` on a box of `100%`/`100%` minus padding. Remove either dimension and
    // the padding insets nothing, because there is no box left to inset.
    const body = ruleBody('.credits-image {');
    expect(body).toContain('width: 100%');
    expect(body).toContain('height: 100%');
    expect(body).toContain('object-fit: contain');
  });

  it('grounds a mark on the fixed plate token, never on a themed surface', () => {
    /*
     * Every mark file uses fixed fills rather than `currentColor` and several are solid black, so
     * on `--surface-sunken` in dark mode they would be invisible. A surface token here would
     * silently reintroduce that, and it is the plate's whole purpose (§7.19.4).
     */
    const body = ruleBody(".credits-plates[data-kind='logo'] .credits-frame");
    expect(body).toContain('background-color: var(--mark-plate)');
    expect(body).not.toContain('var(--surface-');
  });
});

describe('§7.19.5 — the car set is the one place a row of cars exists', () => {
  it('frames a car at the source’s own ratio, from the token', () => {
    // Every file is exactly 2:1, so `contain` letterboxes nothing and all eleven are framed
    // identically — the property that makes a row of them comparable rather than merely present.
    const body = ruleBody(".credits-plates[data-kind='car'] .credits-frame");
    expect(body).toContain('aspect-ratio: var(--car-aspect)');
  });

  it('lays the cars out 2-up above 48rem rather than inheriting the drivers’ 3-up', () => {
    // A 3-up column in a 56rem panel draws a 276px car 138px tall.
    expect(CSS).toMatch(
      /\.credits-plates\[data-kind='car'\]\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
    const at = CSS.indexOf("@media (min-width: 48rem) {\n    .credits-plates[data-kind='car']");
    expect(at).toBeGreaterThan(-1);
    expect(CSS.slice(at, at + 220)).toContain('repeat(2, minmax(0, 1fr))');
  });

  it('out-specifies the base plate grid without depending on source order', () => {
    // `.credits-plates[data-kind='car']` is (0,2,0) against `.credits-plates`' (0,1,0), so the
    // 2-up rule wins whether or not a future edit moves it above the base one.
    expect(CSS).toContain('.credits-plates {');
    expect(CSS).toContain(".credits-plates[data-kind='car']");
  });
});
