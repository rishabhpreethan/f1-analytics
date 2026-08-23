import { describe, expect, it } from 'vitest';
import COMPARE_CSS from './compare.css?raw';
import TOKENS_CSS from './tokens.css?raw';

/**
 * The invariants of the comparison workspace's stylesheet (`DESIGN_SYSTEM.md` §6.6.6).
 *
 * **jsdom performs no layout and no compositing**, so nothing here can assert that the staircase's
 * connectors meet their capsules or that the era strip lines up with the chain above it. What it
 * *can* assert is every rule whose violation renders something wrong while throwing no error and
 * logging nothing: a token that does not exist and so resolves to the empty string, two tracks that
 * disagree about their left edge, a data-mark floor that was deleted as redundant, a 50% reference
 * that was tidied away. With no visual gate in this project (CR-006) a source assertion is the only
 * thing that catches those before Rishabh does.
 */

const CODE = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const CSS = CODE(COMPARE_CSS);
const TOKENS = CODE(TOKENS_CSS);

/** Every rule body for a selector, brace-balanced — a `[^}]*` regex would read a nested at-rule. */
function bodies(css: string, selector: string): string[] {
  const found: string[] = [];
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const needle = new RegExp(`(^|[},{])\\s*${escaped}\\s*\\{`, 'g');
  let match: RegExpExecArray | null;
  while ((match = needle.exec(css)) !== null) {
    /*
     * ⚠ **From the end of the match, not from its start.** The pattern's prefix group swallows the
     * `{` or `}` before the selector, so on the *first* rule inside `@layer components {` the match
     * begins at the layer's own brace and `indexOf('{', match.index)` returns that — handing back
     * the whole layer as the rule body. Every assertion on it then passes for the wrong reason, and
     * a `not.toMatch` fails for the wrong reason. `match[0]` ends with the selector's brace, so its
     * last index is the one to open from. Found by `.compare` becoming the first rule in the layer.
     */
    const open = match.index + match[0].length - 1;
    if (open === -1) continue;
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

const body = (selector: string) => bodies(CSS, selector).join('\n');

describe('the input', () => {
  /**
   * **Vitest replaces every CSS import with `''` by default, even for an explicit `?raw`.** A
   * stylesheet is only readable here if its name matches `test.css.include` in `vite.config.ts`,
   * and removing an entry there does not fail loudly — every assertion below would simply pass
   * against an empty string. This is the first test in the file for that reason.
   */
  it('is actually the stylesheet', () => {
    expect(CSS.length).toBeGreaterThan(1000);
    expect(TOKENS.length).toBeGreaterThan(1000);
  });
});

describe('the shared axis — the one geometric idea on the page', () => {
  it('declares the year gutter once, on the page root', () => {
    expect(body('.compare')).toMatch(/--axis-inset:\s*64px/);
    expect(CSS).toMatch(/--axis-inset:\s*88px/);
  });

  /**
   * The chain's track, the era strip's columns and every career band must start at the same x, or
   * a reader who drops their eye from a 1957 pairing to the 1957 column is reading two different
   * axes. This is the CR-007 defect class — a chart axis 130px out of line — and one inherited
   * custom property is what makes it unexpressible.
   */
  it('lays every axis-aligned track against that one gutter and never a literal', () => {
    expect(body('.chain-row')).toMatch(/grid-template-columns:\s*var\(--axis-inset\)/);
    expect(body('.era-columns')).toMatch(/margin-left:\s*var\(--axis-inset\)/);
    expect(body('.era-band-track')).toMatch(/margin-left:\s*var\(--axis-inset\)/);
    expect(body('.era-band-label')).toMatch(/margin-left:\s*var\(--axis-inset\)/);
    expect(body('.chain-axis')).toMatch(/var\(--axis-inset\)/);
  });
});

describe('the marks', () => {
  /**
   * A one-season pairing is 1/77th of the domain — about 4px at 1024 and under 3px on a phone.
   * Without the floor it is a mark the reader cannot see, which is indistinguishable from a mark
   * that failed to render. `PopulationBoard` carries the same floor for the same reason (§7.14).
   */
  it('floors a capsule at 3px so a single-season pairing is visible', () => {
    expect(body('.chain-link')).toMatch(/min-width:\s*3px/);
  });

  it('anchors the capsule to the axis, not to the row — left and width, never a transform', () => {
    const chainLink = body('.chain-link');
    expect(chainLink).toMatch(/left:\s*var\(--link-offset\)/);
    expect(chainLink).toMatch(/width:\s*var\(--link-length\)/);
  });

  /**
   * 2,378 of the archive's 4,637 round-level teammate pairings produced no race both drivers
   * finished. That link still happened, so its capsule keeps its true extent — but the head-to-head
   * inside it is empty, and the channel that says so is **texture, not colour** (§6.3): a colour
   * would be read as a category and there is no category here.
   */
  it('marks an unrated pairing with texture and keeps its extent', () => {
    const empty = body(".chain-link[data-evidence='none']");
    expect(empty).toMatch(/repeating-linear-gradient/);
    expect(empty).toMatch(/background-color:\s*transparent/);
    expect(empty).not.toMatch(/width:/);
  });

  /**
   * The run between two capsules is **inference** — the years the pivot driver raced with neither
   * teammate — and the capsule is measurement. They must not look alike. §6.3's crosshair idiom.
   */
  it('draws the connector run dashed and the capsule solid', () => {
    expect(body('.chain-run')).toMatch(/repeating-linear-gradient/);
    expect(body('.chain-link')).toMatch(/background-color:\s*var\(--accent-mark\)/);
  });

  /**
   * `SpanRail`'s rule (§7.12): a career has gaps, and a solid bar from first season to last would
   * state that the driver raced in every year between. Two end ticks joined by a rule read as
   * *from … to* and cannot be read as *throughout*.
   */
  it('draws a career as a bracket, never as a fill', () => {
    expect(body('.era-band-bracket')).toMatch(/height:\s*1px/);
    expect(bodies(CSS, '.era-band-bracket::before').length).toBeGreaterThan(0);
    expect(bodies(CSS, '.era-band-bracket::after').length).toBeGreaterThan(0);
  });
});

describe('the balance bar', () => {
  /**
   * **Never remove this.** Without a drawn 50% the reader has no reference to judge the split
   * against and 39–27 reads as a rout instead of the 59% it is. It is `--border-strong` because it
   * is this chart's one axis line (§6.3).
   */
  it('draws the even mark, in the axis-line token, at exactly half', () => {
    const even = body('.balance-even');
    expect(even).toMatch(/left:\s*50%/);
    expect(even).toMatch(/background-color:\s*var\(--border-strong\)/);
  });

  /** §3.3 rule 2: a 2px surface gap between adjacent fills, so two shades of one team read as two
   * marks rather than as one gradient. This is the teammate case, which is the common one here. */
  it('keeps a 2px surface gap between the two fills', () => {
    expect(body(".balance-fill[data-side='a']")).toMatch(
      /border-right:\s*2px solid var\(--surface-raised\)/,
    );
    expect(body(".balance-fill[data-side='b']")).toMatch(
      /border-left:\s*2px solid var\(--surface-raised\)/,
    );
  });
});

describe('the rate board — collisions are impossible, not merely avoided', () => {
  /**
   * The first build laid four absolutely-positioned labels on one shared rail per measure. Measured
   * at 1440 it produced **51 real sibling collisions** — `Hamilton` over `Verstappen` by 62px,
   * rendering as `MARSTAPPEN` — and at 390 it pushed `document.scrollWidth` to **407** against the
   * viewport, scrolling the whole body sideways. Both symptoms had one cause, and the fix was a
   * form change rather than a clamp. These four tests are what stop it coming back.
   */

  const RATE_SELECTORS = [
    '.rate-measure',
    '.rate-measure-head',
    '.rate-rows',
    '.rate-row',
    '.rate-who',
    '.rate-name',
    '.rate-glyph',
    '.rate-track',
    '.rate-bar',
    '.rate-figure',
    '.rate-percent',
    '.rate-of',
  ];

  it('positions nothing on the board absolutely — every label is a grid cell', () => {
    for (const selector of RATE_SELECTORS) {
      expect(`${selector}: ${body(selector)}`).not.toMatch(/position:\s*absolute/);
    }
  });

  /**
   * The figure column is reserved **before** the track is sized, and the track is `minmax(0, 1fr)`
   * rather than `1fr` — a bare `1fr` has an `auto` minimum, so a long figure would push the grid
   * wider than its container instead of being contained by it. That is the 17px of page overflow.
   */
  it('reserves the figure column and lets the track absorb what is left', () => {
    const row = body('.rate-row');
    expect(row).toMatch(/grid-template-columns:[^;]*var\(--size-rate-figure\)/);
    expect(row).toMatch(/grid-template-columns:[^;]*minmax\(0, 1fr\)/);
    expect(body('.rails-list')).toMatch(/--size-rate-figure:\s*96px/);
    expect(CSS).toMatch(/--size-rate-figure:\s*112px/);
  });

  it('keeps the row on the page spine at desktop, so a rate zero sits at the chain 1950', () => {
    expect(CSS).toMatch(
      /grid-template-columns:\s*var\(--axis-inset\) minmax\(0, 1fr\) var\(--size-rate-figure\)/,
    );
  });

  it('degrades a long name and a long figure rather than letting either push the grid', () => {
    expect(body('.rate-name')).toMatch(/text-overflow:\s*ellipsis/);
    expect(body('.rate-name')).toMatch(/white-space:\s*nowrap/);
    expect(body('.rate-figure')).toMatch(/white-space:\s*nowrap/);
  });

  it('anchors the bar at zero and floors it, because a rate is a magnitude', () => {
    /* The encoding the old marker-on-a-rail did not provide at all: a marker carries position, a
     * bar from zero carries the quantity §6.1 step 1 says this chart is for. */
    const bar = body('.rate-bar');
    expect(bar).toMatch(/width:\s*var\(--rate-extent\)/);
    expect(bar).toMatch(/min-width:\s*3px/);
  });
});

describe('the two surfaces the rate board defect was audited against', () => {
  /**
   * Asked for explicitly after the capture. Neither carries absolutely positioned text, so neither
   * can produce the same collision — but both are asserted so a later change cannot introduce one
   * quietly.
   */
  it('leaves the balance bar with no absolutely positioned text at all', () => {
    for (const selector of ['.balance-heads', '.balance-head', '.balance-name', '.balance-count']) {
      expect(`${selector}: ${body(selector)}`).not.toMatch(/position:\s*absolute/);
    }
    /* The only absolute elements in the bar are the 1px even mark and the tied hatch, both
     * `aria-hidden` and both inside an `overflow: hidden` track. */
    expect(body('.balance-track')).toMatch(/overflow:\s*hidden/);
  });

  it('reserves the tray remove button its own lane, so a long forename cannot run under it', () => {
    expect(body('.tray-body')).toMatch(/padding-right:/);
  });
});

describe('colour and tokens', () => {
  it('holds no literal colour — every colour is a token, so a theme switch needs no re-render', () => {
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CSS).not.toMatch(/\brgba?\(/);
    expect(CSS).not.toMatch(/\bhsla?\(/);
  });

  /**
   * An unknown custom property resolves to the empty string and paints **nothing** — no error, no
   * warning, an invisible mark. Every `var()` this file consumes must therefore exist, either in
   * `tokens.css` or as one this file or its components set themselves.
   */
  it('consumes no custom property that does not exist', () => {
    const local = new Set([
      '--axis-inset',
      '--identity',
      '--series',
      '--link-offset',
      '--link-length',
      '--drop-x',
      '--run-start',
      '--run-length',
      '--tick-x',
      '--mark-x',
      '--band-offset',
      '--band-length',
      '--column-extent',
      '--size-rate-figure',
      '--rate-extent',
      '--balance-a',
      '--balance-b',
      '--balance-a-share',
      '--balance-b-share',
      '--spacing',
    ]);
    const used = new Set([...CSS.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1] ?? ''));
    const missing = [...used].filter((name) => !local.has(name) && !TOKENS.includes(`${name}:`));
    expect(missing).toEqual([]);
  });
});

describe('reduced motion', () => {
  /**
   * G-32 is `matchMedia`-gated in the hook, so under `reduce` no tween exists. **The hook has no
   * say over a CSS `transition`**, which is the half `entity-index.css` had to remove separately —
   * so it is removed here too, and the state changes arrive instantly, which is what G-7's reduced
   * column asks for.
   */
  it('removes the CSS transitions the hook cannot reach', () => {
    const reduce = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduce).toMatch(/\.tray-remove/);
    expect(reduce).toMatch(/\.relation-cell/);
    expect(reduce).toMatch(/transition:\s*none/);
  });
});

describe('the page is its own container — one source of truth for the gutters', () => {
  /**
   * ⚠ **Measured on the live page before this rule existed: left gutter 96px, right gutter 0.**
   *
   * `.shell-main` reserves the dock's rail clearance on the left; nothing supplied the right,
   * because the route's three pre-payload branches each carried `shell-container px-4 md:px-6
   * xl:px-8` as a literal while the success branch carried none. Every right-hand element — the
   * chart's direct labels, the Chart/Table toggle, bay 4 — sat flush against the window edge.
   *
   * It is **asymmetry, not overflow**, which is why a `scrollWidth` check came back clean and why
   * it first read as clipping. Three copies of a rule in three branches is what let the fourth
   * drift, so all of it lives here and every branch names only the class. These assertions are the
   * only thing that can catch it coming back: jsdom computes no box, so no DOM test can measure a
   * gutter.
   */
  const base = () => bodies(CSS, '.compare')[0] ?? '';

  it('centres itself and takes the shell width, so no caller has to add a container', () => {
    expect(base()).toContain('max-width: var(--size-shell-max)');
    expect(base()).toContain('margin-inline: auto');
    expect(base()).toContain('width: 100%');
  });

  it('carries inline padding, which is the half that was missing', () => {
    expect(base()).toMatch(/padding-inline:/);
  });

  it('steps the inline padding at the same two breakpoints the utilities did', () => {
    /* `px-4 md:px-6 xl:px-8` — 1rem, then 1.5rem at 48rem, then 2rem at 80rem. Spelt as multiples
     * of `--spacing` so the page cannot drift from the scale. */
    const all = bodies(CSS, '.compare');
    const inline = all
      .map((body) => /padding-inline:\s*([^;]+);/.exec(body)?.[1]?.trim())
      .filter((value): value is string => value !== undefined);
    expect(inline).toEqual([
      'calc(var(--spacing) * 4)',
      'calc(var(--spacing) * 6)',
      'calc(var(--spacing) * 8)',
    ]);
  });

  it('never hardcodes a max-width in px, which is how a container drifts from the shell', () => {
    expect(base()).not.toMatch(/max-width:\s*\d/);
  });
});
