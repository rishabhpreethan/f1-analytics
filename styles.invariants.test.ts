import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * **Stylesheet invariants for the two files no other test can read.**
 *
 * ## Why this file is at the repo root, which looks wrong and is not
 *
 * `charts.css` and `season.css` cannot be reached by a test in `src/`. Vite's `?raw` import returns
 * an **empty string** for them — measured, and the empirical split is not obvious:
 *
 * | Stylesheet | `?raw` length |
 * |---|---|
 * | `index.css` | 73,928 |
 * | `tokens.css` | 29,310 |
 * | `backdrop.css` | 15,327 |
 * | `entity.css` | 9,186 |
 * | `motion.css` | 3,083 |
 * | **`fonts.css`** | **0** |
 * | **`charts.css`** | **0** |
 * | **`season.css`** | **0** |
 *
 * Three of eight come back empty, and nothing in the import site distinguishes them — which is the
 * dangerous part. Two assertions were written against `charts.css`'s text during F2 and **both
 * passed vacuously** until the emptiness was noticed by accident. A test that cannot fail is worse
 * than no test, because it is counted as coverage.
 *
 * `node:fs` reads all of them correctly. But `src/` deliberately has **no node types** —
 * `tsconfig.app.json` sets `types: ['vite/client']`, and adding `node` there would put `fs`,
 * `process` and `Buffer` in scope for every browser module, which is precisely the layering the
 * project keeps. `tsconfig.node.json` already has `types: ['node']` and already includes a
 * root-level test (`vitest.reporter.test.ts`), so this file lives beside it. The location is
 * structural, not stylistic.
 *
 * ## What is asserted here, and what is not
 *
 * Only rules that are **decidable from the stylesheet's text**. Nothing here knows what anything
 * looks like — no layout, no computed value, no cascade resolution. These are the invariants that a
 * later edit breaks silently while the screen still looks fine, which is the same brief
 * `index.css.test.ts` has for the files it can read.
 */

const read = (name: string): string =>
  readFileSync(new URL(`./src/styles/${name}`, import.meta.url), 'utf8');

/** Comments stripped, because every rule below would otherwise match its own explanation. */
const code = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

const RAW = { charts: read('charts.css'), season: read('season.css') };
const CHARTS = code(RAW.charts);
const SEASON = code(RAW.season);
const SHEETS: ReadonlyArray<[name: string, css: string]> = [
  ['charts.css', CHARTS],
  ['season.css', SEASON],
];

describe('the mechanism itself', () => {
  /*
   * The guard that makes this file trustworthy. If `fs` ever returns nothing — a rename, a move —
   * every assertion below would pass against an empty string, which is the exact failure this file
   * exists to escape. So the substance is asserted before the rules are.
   */
  it('actually read both stylesheets', () => {
    expect(RAW.charts.length).toBeGreaterThan(10_000);
    expect(RAW.season.length).toBeGreaterThan(10_000);
  });

  it('left real declarations behind after stripping comments', () => {
    // A comment-stripping bug that ate the whole file would otherwise be invisible.
    expect(CHARTS.split('{').length).toBeGreaterThan(50);
    expect(SEASON.split('{').length).toBeGreaterThan(50);
  });
});

describe('§6.3 / §3.3a — no literal colour, in either stylesheet', () => {
  /*
   * *"Everything is SVG, and every colour is a `var()`. No component ever holds a literal hex."*
   * A hex here would render fine in one theme and be wrong in the other, and a theme switch would
   * not fix it — the single most likely silent colour defect in this codebase.
   */
  it.each(SHEETS)('%s has no hex literal', (_name, css) => {
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
  });

  it.each(SHEETS)('%s has no rgb() or hsl() literal either', (_name, css) => {
    // `--surface-glass` is the one legitimate `rgb()` in the product and it lives in `tokens.css`.
    expect(css.match(/\b(?:rgb|rgba|hsl|hsla)\(/g)).toBeNull();
  });
});

describe('§5.1 — spacing comes from the permitted subset of the 4px scale', () => {
  /** §5.1's table. Any other step — `7`, `9`, `11`, `14` — is a review failure. */
  const ALLOWED = new Set([
    '0',
    '0.5',
    '1',
    '1.5',
    '2',
    '2.5',
    '3',
    '4',
    '5',
    '6',
    '8',
    '10',
    '12',
    '16',
    '20',
    '24',
  ]);

  it.each(SHEETS)('%s uses no off-scale spacing step', (_name, css) => {
    const steps = [...css.matchAll(/var\(--spacing\)\s*\*\s*([\d.]+)/g)].map((m) => m[1] ?? '');
    expect(steps.length).toBeGreaterThan(10);
    const offScale = [...new Set(steps.filter((step) => !ALLOWED.has(step)))];
    expect(offScale, `off-scale spacing steps: ${offScale.join(', ')}`).toEqual([]);
  });
});

describe('no `!important` in a stylesheet with nothing to defeat', () => {
  /*
   * `motion.css` is the one legitimate user — its two reduced-motion chokepoints have to beat every
   * component, by design. Everywhere else `!important` is a specificity bug being papered over, and
   * it takes away the next author's ability to override the rule at all. Two crept into
   * `season.css`'s standings table and were replaced with `.standings-table .standings-num`.
   */
  it.each(SHEETS)('%s has none', (_name, css) => {
    expect(css.match(/!important/g)).toBeNull();
  });
});

describe('§6.5.1 — the tooltip rules whose absence shipped a defect', () => {
  /**
   * The rule this could not have caught before, because it is in `charts.css`: G-30 moves the
   * tooltip with a **transform**, which is measured from the element's own box, so without an
   * explicit origin the box sits at its static flow position — after the `<svg>`, below the plot.
   * That shipped and was caught by eye, not by a test.
   */
  it('gives .chart-tooltip an explicit origin', () => {
    expect(CHARTS).toMatch(/\.chart-tooltip\s*\{[^}]*inset:\s*0 auto auto 0;/);
  });

  it('gives it a fixed width from the token, never a min-width', () => {
    // `LineChart` flips it by subtracting `TOOLTIP_WIDTH`, so a wider box overhangs the plot.
    expect(CHARTS).toMatch(/\.chart-tooltip\s*\{[^}]*width:\s*var\(--size-tooltip\);/);
    expect(CHARTS).not.toMatch(/\.chart-tooltip\s*\{[^}]*min-width:/);
  });
});

describe('§3.5.1a — a segmented control states its pressed state on three channels', () => {
  it('recedes the unpressed segment to --ink-tertiary', () => {
    // The channel that actually fixed dark mode: the fill inverts per theme, this does not.
    expect(CHARTS).toMatch(/\.chart-seg-btn\s*\{[^}]*color:\s*var\(--ink-tertiary\);/);
  });

  it('carries a weight step as well as a fill', () => {
    const pressed = /\.chart-seg-btn\[aria-pressed='true'\]\s*\{([^}]*)\}/.exec(CHARTS)?.[1] ?? '';
    expect(pressed).toMatch(/background-color:\s*var\(--accent-fill\);/);
    expect(pressed).toMatch(/font-weight:\s*500;/);
  });
});

describe('§6.3 — the chart furniture is exact, not approximate', () => {
  it('draws gridlines dashed 2 4 at --border-subtle', () => {
    const rule = /\.chart-grid-line\s*\{([^}]*)\}/.exec(CHARTS)?.[1] ?? '';
    expect(rule).toMatch(/stroke:\s*var\(--border-subtle\);/);
    expect(rule).toMatch(/stroke-dasharray:\s*2 4;/);
  });

  it('draws the crosshair dashed 2 3, distinct from a gridline', () => {
    // Same colour, different rhythm — so a reader never mistakes the readout for the grid.
    expect(/\.chart-crosshair\s*\{([^}]*)\}/.exec(CHARTS)?.[1] ?? '').toMatch(
      /stroke-dasharray:\s*2 3;/,
    );
  });

  it('draws a reference line dashed 4 4', () => {
    expect(/\.chart-reference-line\s*\{([^}]*)\}/.exec(CHARTS)?.[1] ?? '').toMatch(
      /stroke-dasharray:\s*4 4;/,
    );
  });

  it('gives every mark its stroke width from the token, never a literal', () => {
    expect(/\.chart-line\s*\{([^}]*)\}/.exec(CHARTS)?.[1] ?? '').toMatch(
      /stroke-width:\s*var\(--size-mark-stroke\);/,
    );
  });

  it('recesses the plot area, so a mark’s 3:1 floor is measured against --surface-sunken', () => {
    expect(/\.chart-plot\s*\{([^}]*)\}/.exec(CHARTS)?.[1] ?? '').toMatch(
      /background-color:\s*var\(--surface-sunken\);/,
    );
  });
});

describe('§6.5.3 — the plot area holds its height in every state', () => {
  /*
   * The reason nothing reflows as a query resolves. The height is a token per breakpoint rather
   * than content-derived, and the table view has to match it or switching views jumps the page.
   */
  it('sizes the plot from a token at all three breakpoints', () => {
    expect(CHARTS).toMatch(/\.chart-plot\s*\{[^}]*height:\s*var\(--size-plot\);/);
    expect(CHARTS).toContain('height: var(--size-plot-md);');
    expect(CHARTS).toContain('height: var(--size-plot-lg);');
  });

  it('gives the table view the same three heights, so the two views do not jump', () => {
    const scroll = RAW.charts.slice(RAW.charts.indexOf('.chart-table-scroll'));
    expect(scroll).toContain('var(--size-plot)');
    expect(scroll).toContain('var(--size-plot-md)');
    expect(scroll).toContain('var(--size-plot-lg)');
  });
});

describe('§6.5.6 — print renders the table AFTER the chart, not instead of it', () => {
  it('hides the print table on screen and shows it in print', () => {
    expect(CHARTS).toMatch(/\.chart-table-print\s*\{[^}]*display:\s*none;/);
    const print = RAW.charts.slice(RAW.charts.indexOf('@media print'));
    expect(print).toMatch(/\.chart-table-print\s*\{[^}]*display:\s*block;/);
  });

  it('drops the plot fill in print rather than laying ink over the whole figure', () => {
    const print = RAW.charts.slice(RAW.charts.indexOf('@media print'));
    expect(print).toMatch(/\.chart-plot\s*\{[^}]*background-color:\s*transparent;/);
  });
});

describe('the season hub’s identity rule — colour only ever beside a name', () => {
  /*
   * §3.3a.1: an identity colour paints a 3px bar or a 10px chip next to a name. It is never a fill,
   * a background, or a data mark. `--identity` is the only channel it arrives on, so every use of
   * it is checkable here.
   */
  it('uses --identity only on a bar width or a swatch background', () => {
    const uses = [...SEASON.matchAll(/var\(--identity[^)]*\)/g)];
    expect(uses.length).toBeGreaterThan(2);
    // Every one is a `background-color`, which for a 3px `::before` bar and a 10px chip is the
    // same declaration. What must never appear is `--identity` on a text colour.
    // The lookbehind is load-bearing: `background-color:` *ends with* `color:`, so a naive
    // `/color:\s*var\(--identity/` matches every legitimate use and this guard failed on its own
    // first run against correct CSS. A test that fires on the thing it is meant to permit is worse
    // than none, because it gets weakened rather than understood.
    expect(SEASON).not.toMatch(/(?<![-\w])color:\s*var\(--identity/);
  });

  it('sizes every identity bar from --size-rule, never a literal 3px', () => {
    const bars = [...SEASON.matchAll(/&?::before\s*\{[^}]*\}/g)].map((m) => m[0]);
    const withIdentity = bars.filter((b) => b.includes('--identity'));
    expect(withIdentity.length).toBeGreaterThan(0);
    for (const bar of withIdentity) expect(bar).toMatch(/width:\s*var\(--size-rule\)/);
  });
});
