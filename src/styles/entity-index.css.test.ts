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
    /* From the END of the match: the prefix group swallows the preceding brace, so on the first
     * rule inside an `@layer` this would open at the layer's brace and return the whole layer.
     * `match[0]` ends with the selector's own `{`. (Found in `compare.css.test.ts`, 2026-08-23.) */
    const open = match.index + match[0].length - 1;
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

describe('the population board — §6.6.5.1', () => {
  /**
   * The board sits on `--surface-sunken` and every mark on it sits on `--surface-raised`. Both
   * halves matter and neither is decoration: the step down separates the instrument from the list
   * panel below it, and the step back up is what gives a track and a map plate an edge to be seen
   * against. Flatten either and the board becomes one grey rectangle with numbers on it.
   */
  it('recesses the board and raises every plate on it', () => {
    expect(bodies(CSS, '.pop-board')[0] ?? '').toMatch(
      /background-color:\s*var\(--surface-sunken\)/,
    );
    for (const selector of ['.tier-track', '.era-track']) {
      expect(bodies(CSS, selector)[0] ?? '').toMatch(/background-color:\s*var\(--surface-raised\)/);
    }
  });

  /**
   * A stratum of one — Madring joining the calendar — must be a visible mark. Without the floor
   * its bar rounds to zero pixels and *measured as one* renders identically to *nobody at all*,
   * which is §1.0's collapse moved into a chart.
   */
  it('gives the smallest bar and the shortest column a visible floor', () => {
    const tier = bodies(CSS, '.tier-bar')[0] ?? '';
    expect(tier).toMatch(/width:\s*var\(--tier-extent,\s*0%\)/);
    expect(tier).toMatch(/min-width:\s*3px/);

    const era = bodies(CSS, '.era-bar')[0] ?? '';
    expect(era).toMatch(/height:\s*var\(--era-extent,\s*0%\)/);
    expect(era).toMatch(/min-height:\s*3px/);
  });

  /**
   * §6.1 — a magnitude mark grows off its own axis. The decade column is anchored at the bottom of
   * its track, which is where G-31's `scaleY` origin also is; anchor it at the top and the tween
   * would grow it downwards out of the baseline.
   */
  it('anchors the decade column to the baseline, not to the top of its track', () => {
    const era = bodies(CSS, '.era-bar')[0] ?? '';
    expect(era).toMatch(/bottom:\s*0/);
    expect(era).not.toMatch(/\btop:\s*0/);
    // Rounded at the two ends that are *not* on the axis, so the bar reads as sitting on it.
    expect(era).toMatch(/border-radius:\s*var\(--radius-xs\) var\(--radius-xs\) 0 0/);
  });

  /**
   * The ladder's opacity is driven by a per-row custom property so it can run **rarest-loudest**.
   * A hard-coded opacity here would silently flatten the whole device — 35 champions and 571
   * starters would read as equally important marks.
   */
  it('drives the ladder’s emphasis from the row, not from a fixed value', () => {
    expect(bodies(CSS, '.tier-bar')[0] ?? '').toMatch(/opacity:\s*var\(--tier-emphasis,\s*1\)/);
  });

  /**
   * §3.5.1a — a pressed control carries three channels, because a fill alone inverts between the
   * themes and leaves dark mode with pressed and unpressed reading the same weight.
   */
  it('gives a pressed rung a fill, a boundary and an ink-plus-weight step', () => {
    const pressed = bodies(CSS, ".tier-row[aria-pressed='true']")[0] ?? '';
    expect(pressed).toMatch(/background-color:\s*var\(--accent-wash\)/);
    expect(pressed).toMatch(/border-color:\s*var\(--accent-border\)/);

    const label = bodies(CSS, ".tier-row[aria-pressed='true'] .tier-label")[0] ?? '';
    expect(label).toMatch(/color:\s*var\(--accent-wash-ink\)/);
    expect(label).toMatch(/font-weight:\s*600/);
  });

  it('gives a pressed decade column the same three channels', () => {
    const pressed = bodies(CSS, ".era-col[aria-pressed='true']")[0] ?? '';
    expect(pressed).toMatch(/background-color:\s*var\(--accent-wash\)/);
    expect(pressed).toMatch(/border-color:\s*var\(--accent-border\)/);
    // Joined, not `[0]`: the ink step is shared with `:hover` in a grouped selector and the
    // weight step is its own rule, so the pressed value's declarations live in two bodies.
    const value = bodies(CSS, ".era-col[aria-pressed='true'] .era-value").join('\n');
    expect(value).toMatch(/color:\s*var\(--ink-primary\)/);
    expect(value).toMatch(/font-weight:\s*600/);
  });

  /**
   * ⚠ **Growing the track created this and the fix ships with it.** At 104px the value could sit in
   * the flow above its column and still read as that bar's label. At the ~360px the filled column
   * gives it, the 2020s figure would float roughly 300px above the mark it names. It is therefore
   * anchored at `bottom: var(--era-extent)` — the bar's own top edge — which also means the track
   * **must not clip**, or a full-height column would lose its number entirely.
   */
  it('rides each decade’s value on its own bar, and lets it out of the track', () => {
    const value = bodies(CSS, '.era-value')[0] ?? '';
    expect(value).toMatch(/position:\s*absolute/);
    expect(value).toMatch(/bottom:\s*var\(--era-extent,\s*0%\)/);
    expect(bodies(CSS, '.era-track')[0] ?? '').not.toMatch(/overflow:\s*hidden/);
  });

  /**
   * The unfinished decade is hatched as well as short. Texture rather than colour, per §6.3's
   * CVD-and-print rule, and the caption says the same thing in words — three channels for a fact
   * that would otherwise read as "the sport shrank again this year".
   */
  it('hatches the decade the record has not finished', () => {
    const partial = bodies(CSS, ".era-col[data-partial='true'] .era-bar")[0] ?? '';
    expect(partial).toMatch(/repeating-linear-gradient/);
  });

  /**
   * ⚠ **Measured at 1440×900 and then fixed: the board's second column ran 517px and its content
   * stopped at 264 — 253px, 49% of the column, empty.** A two-column grid stretches to the taller
   * row, so the board rendered as a tall panel with a tall hole in it. The mark has to grow to the
   * space; the space must not be left around the mark. `/circuits` never showed it because the
   * atlas fills its column, which is what pointed at the fix.
   *
   * These four declarations are the whole of it, and every one is deletable-looking. Without the
   * `flex` pair the chart snaps back to 104px and the hole returns; without `align-items: stretch`
   * the columns sit at their content height inside a stretched row and the hole returns under
   * them; without the `min-height` pair the track collapses to nothing when the ladder is short.
   */
  it('grows the decade chart into its column instead of leaving the board half empty', () => {
    const bars = bodies(CSS, '.era-bars')[0] ?? '';
    expect(bars).toMatch(/flex:\s*1 1 auto/);
    expect(bars).toMatch(/align-items:\s*stretch/);
    expect(bars).toMatch(/min-height:\s*var\(--size-era-track\)/);

    const track = bodies(CSS, '.era-track')[0] ?? '';
    expect(track).toMatch(/flex:\s*1 1 auto/);
    /*
     * And the `height` **stays**, which looks like the bug and is the fix. `.era-bar` is absolutely
     * positioned at a percentage height, and a percentage against an `auto`-height ancestor is the
     * one corner of flexbox engines have historically disagreed on. The explicit height makes the
     * flex basis definite; `flex-grow` does the filling. Removing it as "dead" would leave the
     * layout correct in the browser someone tested and the bars missing in another.
     */
    expect(track).toMatch(/height:\s*var\(--size-era-track\)/);
  });

  /** A disabled rung stays readable — §3.5.2 forbids fading a control whose reason must be read. */
  it('keeps a rung nobody is in fully opaque', () => {
    expect(bodies(CSS, '.tier-row:disabled')[0] ?? '').toMatch(/opacity:\s*1/);
  });
});

describe('the circuit atlas — §6.6.5.3', () => {
  /**
   * `.locator-frame` fills `--surface-sunken`, which is the board's own surface. Inherited
   * unchanged the map would be an invisible rectangle — the one rule this component adds, and the
   * one that a tidy-up would most plausibly delete as redundant.
   */
  it('raises the map plate off the sunken board', () => {
    expect(bodies(CSS, '.atlas-map .locator-frame')[0] ?? '').toMatch(
      /fill:\s*var\(--surface-raised\)/,
    );
  });

  /**
   * §3.4.2 — never colour alone. A current venue and a retired one differ in fill, in stroke
   * weight and in opacity, and their radii differ in the markup as well.
   */
  it('separates a current pip from a retired one on more than fill', () => {
    const current = bodies(CSS, ".atlas-pip[data-current='true']")[0] ?? '';
    const retired = bodies(CSS, ".atlas-pip[data-current='false']")[0] ?? '';
    expect(current).toMatch(/fill:\s*var\(--accent-mark\)/);
    expect(retired).toMatch(/fill:\s*var\(--ink-tertiary\)/);
    expect(retired).toMatch(/opacity:\s*0\.7/);
    expect(current).toMatch(/stroke-width:\s*1\.5/);
    expect(retired).toMatch(/stroke-width:\s*1/);
  });

  /**
   * §6.3's surface ring. On a single-pip locator it is belt-and-braces; with 78 pips on one
   * graticule the European cluster is a single blob without it.
   */
  it('rings every pip in the surface behind it', () => {
    for (const state of ['true', 'false']) {
      expect(bodies(CSS, `.atlas-pip[data-current='${state}']`)[0] ?? '').toMatch(
        /stroke:\s*var\(--surface-raised\)/,
      );
    }
  });

  /* -------------------------------------------------------------- the coastline, §7.15 */

  it('paints the landmass in its own two tokens, not in a borrowed one', () => {
    const land = bodies(CSS, '.atlas-land')[0] ?? '';
    expect(land).toMatch(/fill:\s*var\(--map-land\)/);
    expect(land).toMatch(/stroke:\s*var\(--map-coast\)/);
  });

  /**
   * ⚠ **The single highest-consequence assertion in this file.**
   *
   * `WORLD_LAND_PATH` carries exactly one hole — the Caspian — and it winds *against* its outer
   * ring, so SVG's default `fill-rule: nonzero` punches it out. `evenodd` produces the same
   * picture here **by accident**, and would silently start filling lakes in on any source bump
   * that added a hole winding the other way. Nothing about a filled Caspian looks like a bug:
   * it looks like a cartographic choice, which is why it needs an assertion rather than an eye.
   */
  it('never sets a fill-rule anywhere on the map', () => {
    expect(bodies(CSS, '.atlas-land')[0] ?? '').not.toMatch(/fill-rule/);
    expect(bodies(CSS, '.atlas-map')[0] ?? '').not.toMatch(/fill-rule/);
    expect(bodies(CSS, '.locator-map')[0] ?? '').not.toMatch(/fill-rule/);
  });

  /**
   * The map is `width: 100%` over a 360-unit viewBox — 1.44 px per unit in the 517 px board
   * column and 0.95 on a phone. A user-space stroke is therefore a different weight at every
   * breakpoint; `non-scaling-stroke` is what makes a coastline a hairline at all of them.
   */
  it('holds the coastline to a hairline at every width', () => {
    const land = bodies(CSS, '.atlas-land')[0] ?? '';
    expect(land).toMatch(/vector-effect:\s*non-scaling-stroke/);
    expect(land).toMatch(/stroke-width:\s*1/);
  });

  /**
   * ⚠ **The border is drawn twice over, and deleting either half breaks it.**
   *
   * Land reaches x = 0, x = 360 and y = 180 — Eurasia runs off both edges at Chukotka and
   * Antarctica fills to the pole — and SVG has no z-index, so anything after the plate paints
   * over the plate's stroke. The frame therefore carries the fill and `.atlas-neatline`, drawn
   * last, carries the border. A tidy-up that restored `stroke` to the frame and dropped the
   * neatline would ship a map with three sides of its border eaten by continents, and no test
   * anywhere else would notice.
   */
  it('moves the frame’s border to a neatline drawn after the land', () => {
    expect(bodies(CSS, '.atlas-map .locator-frame')[0] ?? '').toMatch(/stroke:\s*none/);
    const neatline = bodies(CSS, '.atlas-neatline')[0] ?? '';
    expect(neatline).toMatch(/fill:\s*none/);
    expect(neatline).toMatch(/stroke:\s*var\(--border-subtle\)/);
  });

  /**
   * The pip's surface ring is `--surface-raised`. If `--map-land` ever equalled it, every pip on
   * land would lose the ring that separates it from its neighbour, and the European cluster —
   * twenty-odd venues inside four degrees — would go back to being one blob. Asserted in both
   * themes because a token only has to collide in one of them to break that theme.
   */
  it('keeps the land distinct from the surface every pip is ringed in', () => {
    const light = TOKENS.slice(0, TOKENS.indexOf("[data-theme='dark']"));
    const dark = TOKENS.slice(TOKENS.indexOf("[data-theme='dark']"));
    for (const [theme, scope] of [
      ['light', light],
      ['dark', dark],
    ] as const) {
      const land = /--map-land:\s*(#[0-9a-f]{6})/.exec(scope)?.[1];
      const raised = /--surface-raised:\s*(#[0-9a-f]{6})/.exec(scope)?.[1];
      expect(land, `--map-land missing in ${theme}`).toBeTruthy();
      expect(land).not.toBe(raised);
    }
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

  it('stops every board transition, so a hovered bar changes state instantly', () => {
    // G-31 itself never exists under reduce — `useMotion` builds no tween — but these are CSS
    // transitions on hover and pressed, which the hook has no say over.
    for (const selector of ['.tier-bar', '.era-bar', '.tier-label', '.era-value']) {
      expect(reduce).toContain(selector);
    }
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
    /*
     * Each corner is a `--radius-*` token or a literal `0`, and a shorthand of those is allowed.
     * The decade bar rounds its **top two corners only** (`var(--radius-xs) var(--radius-xs) 0 0`)
     * because §6.1 asks for rounded data-ends *anchored to the baseline* — a bar rounded at the
     * bottom would lift off the axis it grows from. The rule this test exists to hold is "no px
     * literal", and that is what it still holds.
     */
    const radii = [...CSS.matchAll(/border-radius:\s*([^;]+);/g)].map((match) => match[1]?.trim());
    for (const radius of radii) {
      for (const corner of (radius ?? '').split(/\s+/)) {
        expect(corner).toMatch(/^(?:var\(--radius-[a-z0-9]+\)|0)$/);
      }
    }

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
