import { describe, expect, it } from 'vitest';
import ENTITY_PAGE_CSS from './entity-page.css?raw';
import TOKENS_CSS from './tokens.css?raw';

/**
 * **The entity pages' stylesheet, asserted as text** — the pattern `index.css.test.ts` and
 * `compare.css.test.ts` establish, applied to `DESIGN_SYSTEM.md` §7.17 and §7.19.
 *
 * ⚠ **This file could not exist until `entity-page.css` was added to `vite.config.ts`'s
 * `test.css.include`.** Vitest replaces every CSS import with the empty string by default and does
 * so **even for an explicit `?raw` request**, silently — §7.17.2 recorded the portrait layer's
 * assertions as vacuous for exactly that reason, and a `.not.toContain()` check is *vacuously true*
 * against `''`. The guard immediately below is what fails if that entry is ever removed.
 *
 * **What this can and cannot decide.** jsdom performs no layout and no compositing, so nothing here
 * knows whether a car is centred in its plate, whether the Williams wordmark is legible at 160×11,
 * or whether a white plate on the dark theme reads as a badge or as a hole. What it decides is the
 * class of defect that has actually shipped in this project: a value in the wrong unit, a
 * declaration in a container that ignores it, and an override that was described in a comment but
 * never written.
 */

const guard = (css: string, name: string) => {
  if (css.trim().length === 0) {
    throw new Error(
      `${name} resolved to the empty string — it is missing from vite.config.ts test.css.include, ` +
        'and every assertion in this file would pass against nothing.',
    );
  }
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
};

const CSS = guard(ENTITY_PAGE_CSS, 'entity-page.css');
const TOKENS = guard(TOKENS_CSS, 'tokens.css');

/** The declarations of the first rule whose selector matches, comments already stripped. */
function ruleBody(css: string, selector: string): string {
  const at = css.indexOf(selector);
  if (at === -1) throw new Error(`no rule for \`${selector}\``);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('the stylesheet is actually here — the check that makes the rest non-vacuous', () => {
  it('resolves to real CSS rather than to an empty string', () => {
    expect(CSS.length).toBeGreaterThan(1000);
    expect(CSS).toContain('.portrait');
    expect(CSS).toContain('.entity-masthead');
  });
});

describe('§7.19.5 — the car plate is `.portrait` at a third shape', () => {
  it('is sized by an aspect ratio, never by a fixed height', () => {
    /*
     * The same argument §7.17.1 makes for the band, and the reason it is a *ratio*: `cover` scales
     * the source to the box width, so a fixed pixel height would frame the car differently in a
     * 416px column and in a 320px one — one photograph framed two ways across two breakpoints.
     * Every source file is exactly 2:1, so a 2/1 plate crops nothing at all.
     */
    const body = ruleBody(CSS, ".portrait[data-shape='plate']");
    expect(body).toContain('aspect-ratio: var(--car-aspect)');
    expect(body).toContain('height: auto');
    expect(body).not.toMatch(/height:\s*\d+px/);
  });

  it('overrides the crop anchor, which is the one thing a comment could claim and not do', () => {
    /*
     * ⚠ **This is the assertion this round exists for.** `.portrait-photo` sets
     * `object-position: var(--portrait-crop)`, which is `top center` — measured for
     * portrait-orientation sources of people. Inherited by a side-on car it anchors the frame to
     * the top of the box and cuts the tyres off. The override is invisible in every rendering test
     * and in every screenshot taken at a width where the crop happens to be zero.
     */
    const body = ruleBody(CSS, ".portrait[data-shape='plate'] .portrait-photo");
    expect(body).toContain('object-position: var(--car-crop)');
  });

  it('out-specifies the plain `.portrait` box rules without depending on source order', () => {
    // `.portrait` is 56/72px square, and the 72px rule lives inside a media query. An attribute
    // selector is (0,2,0) against (0,1,0), so the plate wins at every width regardless of order —
    // the same property §7.17.1 relies on for the band.
    expect(CSS).toContain(".portrait[data-shape='plate']");
    expect(CSS).toContain(".portrait[data-shape='band']");
  });
});

describe('§7.19.4 — the mark plate', () => {
  it('is a fixed ground, not a themed surface, because the marks are theme-blind', () => {
    /*
     * Every mark file uses fixed fills rather than `currentColor` and several are solid black; on
     * `--surface-sunken` in dark mode they would be invisible. `--mark-plate` is white in both
     * themes on purpose, and a surface token here would silently reintroduce the bug.
     */
    const body = ruleBody(CSS, '.mark-plate {');
    expect(body).toContain('background-color: var(--mark-plate)');
    expect(body).not.toContain('var(--surface-');
  });

  it('caps the mark on both axes and fixes it on neither', () => {
    /*
     * The seven marks run 0.91:1 to **14.3:1**. A fixed box draws the Williams wordmark at ~4px
     * tall. Two maxima with `auto` sizes let a replaced element honour both while keeping its
     * intrinsic ratio, which is what makes one rule cover the whole range — and `width: 100%` or a
     * fixed `height` would each break a different end of it.
     */
    const body = ruleBody(CSS, '.mark-plate img');
    expect(body).toContain('max-width: 160px');
    expect(body).toContain('max-height: 28px');
    expect(body).toContain('width: auto');
    expect(body).toContain('height: auto');
    expect(body).not.toMatch(/(^|\s)width:\s*(100%|\d+px)/);
    expect(body).not.toMatch(/(^|\s)height:\s*\d+px/);
  });
});

describe('§7.19.3 — the masthead only becomes two columns when it has two columns of content', () => {
  it('gates the grid on the attribute AND on the 64rem breakpoint', () => {
    /*
     * Two failure modes, both invisible in jsdom. Ungated by the attribute, 203 teams get their
     * name squeezed into `1fr` of `1fr + 26rem` beside an empty column. Ungated by the breakpoint,
     * `Aston Martin` at `--display-lg` gets ~140px on a tablet.
     */
    const at = CSS.indexOf("[data-aside='true']");
    expect(at).toBeGreaterThan(-1);

    /*
     * The nearest `@media` above the rule has to be the 64rem one, **and it must still be open** —
     * a `\n  }` between them would be that block closing, which would put the grid at every width.
     */
    const preamble = CSS.slice(0, at).slice(CSS.slice(0, at).lastIndexOf('@media'));
    expect(preamble).toContain('(min-width: 64rem)');
    expect(preamble).not.toContain('\n  }');

    const body = ruleBody(CSS, ".entity-masthead-head[data-aside='true'] {");
    expect(body).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 26rem)');
  });

  it('never sets a grid on the bare head class, which the index pages also wear', () => {
    // `EntityIndex` writes its own `.entity-masthead-head`. A rule on the bare class would relayout
    // three index pages that have no aside at all.
    expect(CSS).not.toMatch(/\.entity-masthead-head\s*\{[^}]*display:\s*grid/);
  });
});

describe('the tokens behind all of it — §7.19', () => {
  it('publishes the measured set-wide constants', () => {
    expect(TOKENS).toContain('--car-aspect: 2 / 1');
    expect(TOKENS).toContain('--car-crop: center');
    expect(TOKENS).toContain('--mark-plate: #ffffff');
  });

  it('declares `--mark-plate` exactly once, so no theme can helpfully darken it', () => {
    /*
     * ⚠ The regression this guards is a *plausible* one: a dark-mode white rectangle looks like
     * something to fix, and redeclaring this token under `[data-theme='dark']` would make six marks
     * invisible and put a grey box behind Red Bull's opaque white PNG. The marks cannot be
     * recoloured — `invert()` turns Haas's red cyan — so the ground is what has to stay put.
     */
    expect(TOKENS.match(/--mark-plate:/g)).toHaveLength(1);
    expect(TOKENS.match(/--car-crop:/g)).toHaveLength(1);
  });
});
