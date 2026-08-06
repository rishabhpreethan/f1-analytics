import { describe, expect, it } from 'vitest';
import BACKDROP_CSS from './backdrop.css?raw';

/**
 * **CT-9, and CT-10's second half.** Stylesheet assertions, read as text.
 *
 * They are cheap and they are the only automated guard on a set of properties that make the
 * difference between a background that costs the main thread nothing and one that competes
 * with the §8 chart-interaction budget for the entire session. A `filter` that crept into a
 * `@keyframes`, or a `width` animation, would look identical in a screenshot and cost a
 * re-rasterisation every frame — and there is no E2E gate any more (CR-006) and no
 * performance gate at all.
 */

/** Comments are stripped: naming a forbidden property in order to forbid it is what the
 * documentation in that file is for. */
const CSS = BACKDROP_CSS.replace(/\/\*[\s\S]*?\*\//g, '');

/** Every `@keyframes` block, as `[name, body]`. */
function keyframes(): Array<[string, string]> {
  const found: Array<[string, string]> = [];
  const pattern = /@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g;
  for (const match of CSS.matchAll(pattern)) {
    const [, name, body] = match;
    if (name === undefined || body === undefined) continue;
    found.push([name, body]);
  }
  return found;
}

describe('CT-9 — only composited properties are animated', () => {
  it('finds the keyframes it is meant to be checking', () => {
    // A test that silently checks nothing is worse than no test. G-18, G-19 ×3, G-20.
    expect(
      keyframes()
        .map(([name]) => name)
        .sort(),
    ).toEqual([
      'atmosphere-comet',
      'atmosphere-grid-drift',
      'atmosphere-orb-a',
      'atmosphere-orb-b',
      'atmosphere-orb-c',
    ]);
  });

  it('animates transform, opacity and offset-distance — and nothing else', () => {
    /*
     * `offset-distance` is the **one documented exception** in `DESIGN_SYSTEM.md` §4.2: it is
     * composited, triggers no layout, and is what lets G-20 run a motion path without
     * `MotionPathPlugin` (9.7 KB gz). The Technical Spec's CT-9 names only transform and
     * opacity because it was written before the Design Spec chose native CSS motion path;
     * allowing exactly this third property, and no other, is the reconciliation. Reported.
     */
    const allowed = new Set(['transform', 'opacity', 'offset-distance']);

    for (const [name, body] of keyframes()) {
      const properties = [...body.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]);
      expect(properties.length, `${name} animates nothing`).toBeGreaterThan(0);
      for (const property of properties) {
        expect(allowed.has(property ?? ''), `${name} animates "${String(property)}"`).toBe(true);
      }
    }
  });

  it('never animates a filter, and never animates a layout property', () => {
    for (const [name, body] of keyframes()) {
      expect(body, `${name}`).not.toMatch(/\bfilter\s*:/);
      expect(body, `${name}`).not.toMatch(/\bbackdrop-filter\s*:/);
      // A blurred layer that re-rasterises per frame is the one way to make a CSS background
      // expensive (§10 #24); a layout property in a loop is worse.
      for (const property of ['width', 'height', 'top', 'left', 'margin', 'background-position']) {
        expect(body, `${name} animates ${property}`).not.toMatch(new RegExp(`\\b${property}\\s*:`));
      }
    }
  });

  it('makes no network request of any kind beyond the one local texture', () => {
    // The atmosphere must not fetch. `url(http…)` would be a third-party origin, which
    // `ARCHITECTURE.md` §7.3's CSP forbids outright and DL-2 forbids on principle.
    expect(CSS).not.toMatch(/url\(\s*['"]?https?:/i);
    expect(CSS).not.toMatch(/@import/);

    const urls = [...CSS.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((match) => match[1]);
    // The SVG gradient reference is a same-document fragment, not a request.
    expect(urls.filter((url) => url?.startsWith('#') === false)).toEqual(['/textures/grain.svg']);
  });

  it('carries at most one data: URI, under 2 KB', () => {
    const dataUris = [...CSS.matchAll(/url\(\s*['"]?(data:[^'")]+)/g)].map((match) => match[1]);
    expect(dataUris.length).toBeLessThanOrEqual(1);
    for (const uri of dataUris) expect((uri ?? '').length).toBeLessThan(2048);
  });

  it('sets will-change only on the two layers that move', () => {
    // `will-change` promotes a layer permanently, so it costs memory wherever it is set.
    // §7.7.4: layers 1 and 2 only, never the grain or the plate.
    const declarations = [...CSS.matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)].filter(([, , body]) =>
      /will-change\s*:/.test(body ?? ''),
    );
    expect(declarations.map(([, selector]) => selector).sort()).toEqual([
      'atmosphere-grid',
      'atmosphere-orbs',
    ]);
  });

  it('keeps the container inert, contained, and out of print', () => {
    const container = /\.atmosphere\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(container).toMatch(/position:\s*fixed/);
    expect(container).toMatch(/pointer-events:\s*none/);
    expect(container).toMatch(/contain:\s*strict/);
    expect(container).toMatch(/z-index:\s*var\(--z-atmosphere\)/);
    expect(CSS).toMatch(/@media print\s*\{\s*\.atmosphere\s*\{\s*display:\s*none/);
  });

  it('removes every layer at data-bg="off" rather than merely dimming it', () => {
    expect(CSS).toMatch(/html\[data-bg='off'\]\s*\.atmosphere-layer\s*\{\s*display:\s*none/);
  });

  it('hides the comet under reduced motion by CSS, not by JavaScript', () => {
    // By CSS so it is absent even before hydration (§7.7.3). The static stroke remains: the
    // reduced state is a composed still image, not a blank field.
    expect(CSS).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.atmosphere-comet\s*\{\s*display:\s*none/,
    );
  });
});

describe('CT-10 — every animation-name resolves to a @keyframes block', () => {
  it('has no dangling animation reference', () => {
    // A typo here is silent: the element simply never moves, and nothing logs.
    const declared = new Set(keyframes().map(([name]) => name));
    const used = [...CSS.matchAll(/animation:\s*([\w-]+)/g)].map((match) => match[1]);

    expect(used.length).toBeGreaterThan(0);
    for (const name of used) {
      expect(declared.has(name ?? ''), `animation "${String(name)}" has no @keyframes`).toBe(true);
    }
  });

  it('drives every loop period from a token, so JS and CSS cannot drift (CT-3)', () => {
    const periods = [...CSS.matchAll(/animation:\s*[\w-]+\s+([^\s]+)/g)].map((match) => match[1]);
    expect(periods.length).toBeGreaterThan(0);
    for (const period of periods) {
      expect(period, 'a literal duration in backdrop.css').toMatch(/^var\(--anim-[\w-]+\)$/);
    }
  });

  it('starts every keyframe sequence at the authored resting state (MR-2)', () => {
    // The reduced-motion chokepoint stops the animation dead, so whatever `from` holds is
    // what a reduced-motion user sees. If `from` were the displaced position, the "still
    // image" would be a composition nobody designed.
    for (const [name, body] of keyframes()) {
      if (name === 'atmosphere-comet') {
        expect(body).toMatch(/from\s*\{\s*offset-distance:\s*0%/);
        continue;
      }
      expect(body, `${name} does not rest at its authored position`).toMatch(
        /from\s*\{\s*transform:\s*translate3d\(0,\s*0,\s*0\)/,
      );
    }
  });
});
