import { describe, expect, it } from 'vitest';
import INDEX_CSS from './entity-index.css?raw';
import TOKENS_CSS from './tokens.css?raw';

/**
 * The invariants of the entity-index stylesheet (`DESIGN_SYSTEM.md` §6.6.4, §7.12, §7.13).
 *
 * **jsdom performs no layout and no compositing**, so nothing here can assert that the rail lands
 * where it should or that the console actually sticks. What it *can* assert is every rule whose
 * violation renders something wrong while throwing no error and logging nothing — a token that does
 * not exist and therefore resolves to the empty string, two grids that disagree about a column
 * width, a reduced-motion clause that was never written, a `display: none` that takes a radio out
 * of the tab order. With no visual gate in this project (CR-006), a source assertion is the only
 * thing that catches those before Rishabh does.
 */

const CODE = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const CSS = CODE(INDEX_CSS);
const TOKENS = CODE(TOKENS_CSS);

/**
 * Every rule body for a selector, brace-balanced, in source order.
 *
 * A regex `selector\s*{([^}]*)}` would stop at the first `}` and therefore read a *nested*
 * at-rule's body as the selector's own, which is how an assertion of this kind passes against the
 * wrong text.
 */
function bodies(css: string, selector: string): string[] {
  const found: string[] = [];
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const needle = new RegExp(`(^|[},])\\s*${escaped}\\s*\\{`, 'g');
  let match: RegExpExecArray | null;
  while ((match = needle.exec(css)) !== null) {
    const open = css.indexOf('{', match.index);
    let depth = 0;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          found.push(css.slice(open + 1, i));
          break;
        }
      }
    }
  }
  return found;
}

/**
 * **Every** `@media` block matching the query, brace-balanced and joined.
 *
 * All of them, not the first: this stylesheet declares four separate `(min-width: 48rem)` blocks —
 * one per section — and a helper that stopped at the first would silently assert against the
 * page's padding rule while claiming to check the row grid.
 */
function mediaBlocks(css: string, query: string): string {
  const found: string[] = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(query, from);
    if (start < 0) break;
    const open = css.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          found.push(css.slice(open + 1, i));
          from = i + 1;
          break;
        }
      }
    }
    if (depth !== 0) throw new Error(`unbalanced braces after ${query}`);
  }
  if (found.length === 0) throw new Error(`missing media query: ${query}`);
  return found.join('\n');
}

const flat = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * How many tracks a `grid-template-columns` value declares.
 *
 * Splitting on whitespace would count `minmax(0,` and `1fr)` as two, and splitting on `) ` would
 * mis-count for a different reason — so the depth counter is the only honest way to do it.
 */
function trackCount(template: string): number {
  let depth = 0;
  let tracks = 0;
  let inTrack = false;
  for (const character of template) {
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    if (depth === 0 && /\s/.test(character)) {
      inTrack = false;
    } else if (!inTrack) {
      inTrack = true;
      tracks += 1;
    }
  }
  return tracks;
}

/**
 * The vacuous-pass guard `vite.config.ts` asks every stylesheet test to open with. Vitest
 * substitutes an empty string for a CSS import that is not in `test.css.include`, **even for an
 * explicit `?raw`** — and set-equality and absence assertions all pass against `''`.
 *
 * This file is covered by the existing `/index\.css/` entry, which matches `entity-index.css` as a
 * substring. That is luck rather than design, which is exactly why this assertion is here.
 */
describe('the stylesheet actually loaded', () => {
  it('is not the empty string', () => {
    expect(INDEX_CSS.length).toBeGreaterThan(2000);
    expect(TOKENS_CSS.length).toBeGreaterThan(2000);
  });
});

describe('tokens — a name that does not exist renders as nothing at all', () => {
  /**
   * An unknown custom property resolves to the empty string, so `width: var(--size-index-rail)`
   * against a misspelt token silently produces a zero-width column and no error anywhere. Every
   * `--size-*` this stylesheet consumes must therefore be declared.
   */
  it('declares every --size-index-* and --size-span-* token it uses', () => {
    const used = new Set(
      [...CSS.matchAll(/var\((--size-(?:index|span)-[a-z-]+)/g)].map((match) => match[1]),
    );
    expect(used.size).toBeGreaterThanOrEqual(5);
    for (const token of used) {
      // `--size-index-rail` is declared in this file, on `.entity-index`, because it steps at a
      // breakpoint; everything else lives in `tokens.css`.
      expect(TOKENS.includes(`${String(token)}:`) || CSS.includes(`${String(token)}:`)).toBe(true);
    }
  });

  it('declares the row heights that back contain-intrinsic-size', () => {
    expect(TOKENS).toMatch(/--size-index-row:\s*\d+px/);
    expect(TOKENS).toMatch(/--size-index-row-sm:\s*\d+px/);
  });
});

describe('the rail column — the offset bug class CR-007 shipped once already', () => {
  /**
   * The column header and the row are two separate grids that have to agree about the rail's
   * width. A chart axis given the wrong containing block sat 130px out of line in CR-007 and threw
   * nothing; this is the same failure mode with a different element, so the width is **one
   * inherited custom property** and both grids read it.
   */
  it('declares --size-index-rail once per breakpoint on .entity-index and nowhere else', () => {
    const declarations = [...CSS.matchAll(/--size-index-rail:\s*(\d+)px/g)].map(
      (match) => match[1],
    );
    expect(declarations).toEqual(['140', '180', '220']);

    for (const body of bodies(CSS, '.entity-index')) {
      if (!body.includes('--size-index-rail')) continue;
      expect(body).toMatch(/--size-index-rail:\s*\d+px/);
    }
  });

  it('gives the row and the column header the same grid template at every width', () => {
    const md = mediaBlocks(CSS, '@media (min-width: 48rem)');

    const row = bodies(md, '.index-row')[0];
    const head = bodies(md, '.index-head')[0];
    expect(row).toBeDefined();
    expect(head).toBeDefined();

    const template = (body: string) =>
      flat(/grid-template-columns:([^;]*);/.exec(body)?.[1] ?? 'MISSING');
    expect(template(row ?? '')).toBe(template(head ?? ''));
    expect(template(row ?? '')).toContain('var(--size-index-rail)');

    const rowCircuit = bodies(md, ".index-row[data-kind='circuit']")[0];
    const headCircuit = bodies(md, ".index-head[data-kind='circuit']")[0];
    expect(template(rowCircuit ?? '')).toBe(template(headCircuit ?? ''));
    // §6.6.2.1 — a circuit has no identity colour and so no mark column: exactly one fewer track,
    // counted properly rather than by splitting on a delimiter that also occurs inside `minmax()`.
    expect(trackCount(template(rowCircuit ?? ''))).toBe(trackCount(template(row ?? '')) - 1);
    expect(trackCount(template(row ?? ''))).toBe(5);
  });

  it('gives both grids the same gap, or the columns drift apart across the row', () => {
    const md = mediaBlocks(CSS, '@media (min-width: 48rem)');
    const gap = (body: string) => flat(/(?:^|[;{\s])gap:([^;]*);/.exec(body)?.[1] ?? 'MISSING');
    expect(gap(bodies(md, '.index-row')[0] ?? '')).toBe(gap(bodies(md, '.index-head')[0] ?? ''));
  });
});

describe('density — §6.6.4.6', () => {
  it('lets the browser skip off-screen rows, with an intrinsic size so the scrollbar is honest', () => {
    const row = bodies(CSS, '.index-row')[0] ?? '';
    expect(row).toContain('content-visibility: auto');
    expect(row).toMatch(/contain-intrinsic-size:\s*auto var\(--size-index-row-sm\)/);
    expect(mediaBlocks(CSS, '@media (min-width: 48rem)')).toMatch(
      /contain-intrinsic-size:\s*auto var\(--size-index-row\)/,
    );
  });
});

describe('the console — §7.13', () => {
  /**
   * §5.2a: *nothing inside `main` sets a z-index above 1 except an overlay*. A sticky console that
   * borrowed `--z-header` would paint over the header itself, which is fault 4 of the dock rail
   * repeated on a different element.
   */
  it('sticks at the header height and never above --z-content', () => {
    const body = bodies(CSS, '.index-console')[0] ?? '';
    expect(body).toContain('position: sticky');
    expect(body).toMatch(/top:\s*var\(--size-header\)/);
    expect(body).toMatch(/z-index:\s*var\(--z-content\)/);
    expect(CSS).not.toContain('--z-header');
    expect(CSS).not.toContain('--z-overlay');
  });

  it('carries the mandatory opaque fallback for a browser without backdrop-filter (§5.2b)', () => {
    expect(CSS).toContain('@supports not (backdrop-filter: blur(1px))');
    const fallback = CSS.slice(CSS.indexOf('@supports not (backdrop-filter'));
    expect(fallback.slice(0, 200)).toContain('var(--surface-raised)');
  });

  it('keeps the search value at 16px or above, so iOS does not zoom a focused field', () => {
    const base = bodies(CSS, '.index-search-input')[0] ?? '';
    expect(base).toMatch(/font-size:\s*var\(--text-md\)/);
    expect(mediaBlocks(CSS, '@media (min-width: 48rem)')).toMatch(/font-size:\s*var\(--text-lg\)/);
  });

  /**
   * A radio hidden with `display: none` is not focusable and not in the arrow-key roving order —
   * which is the entire reason the sort is a fieldset of radios rather than a row of buttons. The
   * clip technique keeps it in both.
   */
  it('hides the sort radios by clipping, never by display: none', () => {
    const body = bodies(CSS, '.index-sort input')[0] ?? '';
    expect(body).toContain('clip-path: inset(50%)');
    expect(body).not.toContain('display: none');
    expect(body).not.toContain('visibility: hidden');
  });

  it('puts the focus ring on the visible segment, not on the one clipped pixel', () => {
    expect(CSS).toContain('.index-sort input:focus-visible + span');
    expect(bodies(CSS, '.index-sort input:focus-visible + span')[0] ?? '').toContain('outline:');
  });
});

describe('the span rail — §7.12', () => {
  it('always draws the baseline, so a row with nothing to plot is not a broken row', () => {
    const base = bodies(CSS, '.span-rail-base')[0] ?? '';
    expect(base).toMatch(/background-color:\s*var\(--border-subtle\)/);
    // Unconditional: no attribute selector gates the baseline into existence.
    expect(CSS).not.toMatch(/\.span-rail-base\[/);
  });

  /**
   * A single-season entity has `length: 0`, so without a floor the bracket would be zero pixels
   * wide and the row would look identical to one with nothing to plot — the absent-vs-zero
   * collapse §1.0 keeps finding.
   */
  it('gives a zero-length bracket a visible minimum width', () => {
    const bracket = bodies(CSS, '.span-rail-bracket')[0] ?? '';
    expect(bracket).toMatch(/min-width:\s*var\(--size-rule\)/);
    expect(bracket).toMatch(/inset-inline-start:\s*var\(--span-offset,\s*0%\)/);
    expect(bracket).toMatch(/width:\s*var\(--span-length,\s*0%\)/);
  });

  it('draws both end ticks, which is what makes it a bracket and not a fill', () => {
    expect(CSS).toContain('.span-rail-bracket::before');
    expect(CSS).toContain('.span-rail-bracket::after');
    const tick = bodies(CSS, '.span-rail-bracket::before,\n  .span-rail-bracket::after')[0] ?? '';
    expect(tick).toContain('var(--size-span-tick)');
    expect(tick).toContain('background-color: inherit');
  });

  it('marks a current entity with the accent, and only with the accent', () => {
    const current = bodies(CSS, ".span-rail-bracket[data-current='true']")[0] ?? '';
    expect(current).toMatch(/background-color:\s*var\(--accent-mark\)/);
  });
});

describe('reduced motion is genuinely stopped', () => {
  const reduce = mediaBlocks(CSS, '@media (prefers-reduced-motion: reduce)');

  it('removes the search underline transition rather than shortening it', () => {
    expect(reduce).toContain('transition: none');
  });

  it('suppresses the chevron nudge, and does not merely slow it', () => {
    expect(reduce).toMatch(/\.index-row:hover \.index-arrow[\s\S]*?transform:\s*none/);
  });

  it('never uses a duration or an ease that is not a token', () => {
    // Every timing in this file comes from `--dur-*` / `--ease-*`; a literal ms value or a
    // cubic-bezier is how a stylesheet starts disagreeing with `motion/tokens.ts` (§4.3).
    expect(CSS).not.toMatch(/transition:[^;]*\d+m?s/);
    expect(CSS).not.toContain('cubic-bezier');
  });
});

describe('the system, not a second one', () => {
  it('inlines no colour — every paint is a token', () => {
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CSS).not.toMatch(/\brgba?\(/);
    expect(CSS).not.toMatch(/\boklch\(/);
  });

  it('uses no font size off the §2.3 scale', () => {
    const sizes = [...CSS.matchAll(/font-size:\s*([^;]+);/g)].map((match) => match[1]?.trim());
    for (const size of sizes) {
      expect(size).toMatch(/^var\(--text-[a-z0-9-]+\)$/);
    }
  });

  it('uses no radius and no z-index off the scale', () => {
    const radii = [...CSS.matchAll(/border-radius:\s*([^;]+);/g)].map((match) => match[1]?.trim());
    for (const radius of radii) expect(radius).toMatch(/^var\(--radius-[a-z0-9]+\)$/);

    const zIndexes = [...CSS.matchAll(/z-index:\s*([^;]+);/g)].map((match) => match[1]?.trim());
    for (const value of zIndexes) expect(value).toMatch(/^var\(--z-[a-z]+\)$/);
  });

  it('reuses the season panel and chip rather than declaring a second set', () => {
    // The row lives inside `.season-panel` and the "Never raced" badge is `.season-chip`; if this
    // file ever grew its own panel or chip, the three surfaces would have started diverging.
    expect(CSS).not.toContain('.index-panel {');
    expect(CSS).not.toContain('.index-chip {');
  });
});
