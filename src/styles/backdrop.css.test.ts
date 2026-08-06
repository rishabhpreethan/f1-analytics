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
    // A test that silently checks nothing is worse than no test. G-18 (the lattice drift, shared
    // by both dot layers) and G-20 (the comet). The three orb yoyos are gone with the orbs.
    expect(
      keyframes()
        .map(([name]) => name)
        .sort(),
    ).toEqual(['atmosphere-comet', 'atmosphere-drift']);
  });

  it('holds no `filter` anywhere at all, not just inside a @keyframes', () => {
    // The orbs each carried an 80–100px static `filter: blur()`. Rasterised once it was affordable,
    // but it was also the single most expensive property in the field and the reason the layer had
    // to be documented as "safe because it has no children". The rebuild has none, and this keeps
    // it that way: a blur is how a background stops being cheap (§10 #24).
    expect(CSS).not.toMatch(/[^-]filter\s*:/);
    expect(CSS).not.toMatch(/backdrop-filter\s*:/);
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

  it('sets will-change only on the layers that move', () => {
    /*
     * `will-change` promotes a layer permanently, so it costs memory wherever it is set. §7.7.4:
     * only the two lattice layers, never the racing line, the grain, the vignette or the veil.
     *
     * The two are declared in **one** rule, which is also what makes the drift phase-safe: same
     * animation name, same period, both created in the same React commit, so both start at the same
     * document time. A phase difference between them would render as doubled dots.
     */
    const declarations = [...CSS.matchAll(/((?:\.[\w-]+,?\s*)+)\{([^}]*)\}/g)].filter(
      ([, , body]) => /will-change\s*:/.test(body ?? ''),
    );
    expect(declarations).toHaveLength(1);
    expect(
      (declarations[0]?.[1] ?? '')
        .split(',')
        .map((selector) => selector.trim())
        .sort(),
    ).toEqual(['.atmosphere-dots', '.atmosphere-lamp']);
  });

  it('drives the lattice geometry from tokens, so the two dot layers cannot fall out of pitch', () => {
    // The lamp re-draws the *same* dots brighter. If its pitch or its drift distance differed from
    // the resting layer's by even a pixel the effect would be two overlapping lattices beating
    // against each other — and it would look like a rendering fault, not like a mistake in CSS.
    const cellUses = [...CSS.matchAll(/var\(--size-field-cell\)/g)];
    expect(cellUses.length).toBeGreaterThanOrEqual(4);

    /*
     * Both dot layers' pitch comes from the token, never a literal — asserted on the declarations
     * themselves rather than per-rule, because the two share a rule for their geometry and have
     * separate rules for their paint, so a selector-scoped lookup would match the wrong block.
     *
     * The grain tile's own `background-size: 240px 240px` is a different thing (a raster tile, not
     * a lattice) and is deliberately outside this check.
     */
    const sizes = [...CSS.matchAll(/background-size:\s*([^;]+);/g)].map((match) =>
      (match[1] ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(sizes).toContain(
      'var(--size-field-major) var(--size-field-major), var(--size-field-cell) var(--size-field-cell)',
    );
    expect(sizes).toContain('var(--size-field-cell) var(--size-field-cell)');
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

  it('declares the lamp coordinates in px and its fade unitless (the %-vs-px defect)', () => {
    /*
     * GSAP's CSSPlugin learns a custom property's unit from its current value and appends that unit
     * to an end value that carries none. A resting `--px: 50%` therefore rendered every pointer
     * coordinate as a percentage and put the highlight off the element entirely — that defect
     * shipped once, on the capability card. `--lamp` is the opposite requirement: it multiplies an
     * opacity, so it must stay unitless.
     */
    const root = /\.atmosphere\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(root).toMatch(/--px:\s*0px;/);
    expect(root).toMatch(/--py:\s*0px;/);
    expect(root).toMatch(/--lamp:\s*0;/);
  });

  it('puts the lamp above the veil and the resting lattice below it', () => {
    // The whole point of two lattice layers rather than one masked one: a route attenuates the
    // resting field but not the pointer response, so the background still answers the cursor on a
    // data surface (§7.7.2). Source order inside one stacking context is what decides it.
    const order = ['.atmosphere-dots,', '.atmosphere-veil', '.atmosphere-lamp {'];
    const positions = order.map((selector) => CSS.indexOf(selector));
    expect(
      positions.every((position) => position >= 0),
      order.join(' / '),
    ).toBe(true);
    // The lamp's own rule may be declared anywhere; what matters is that `AtmosphereField` renders
    // it last, which `AtmosphereField.test.tsx` asserts against the DOM.
    expect(positions[0]).toBeLessThan(positions[1] ?? 0);
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
