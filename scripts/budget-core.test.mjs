/*
 * Tests for the performance-budget gate's pure half.
 *
 * What these do and do not cover, stated so nobody reads a green run as more than it is:
 *
 *  - **Covered:** which files the gate counts as first-paint payload, the PASS/WARN/FAIL
 *    arithmetic and its boundaries, the refusal to score an unmeasured asset as zero, and
 *    the internal consistency of the recorded budget derivations.
 *  - **Not covered:** the actual gzipped size of anything (that is `check-budget.mjs`,
 *    which does I/O), and whether the *chosen* numbers are the right numbers — that is a
 *    judgement recorded in ARCHITECTURE.md §8 and §10, and no test can settle it.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  BLOCKING_TRANSFER_SHARE_OF_FCP,
  BUCKETS,
  BYTES_PER_KB,
  CSS_SHARE_OF_JS_BUDGET,
  FCP_TARGET_SECONDS,
  REFERENCE_LINK_BYTES_PER_SEC,
  bucketAssets,
  evaluate,
  exitCodeFor,
  formatKB,
  formatReport,
  parseInitialAssets,
  stripHtmlComments,
} from './budget-core.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------ test fixtures */

/**
 * A faithful reduction of the built `dist/index.html`: a parser-blocking classic script, two
 * font preloads, an icon link, the module entry and the stylesheet — plus the comments that
 * discuss `type="module"`, `defer` and `async` in prose, which are the reason comments are
 * stripped before anything is scanned.
 */
const BUILT_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>F1 Analytics</title>
    <!--
      Synchronous by necessity: no defer, no async, no type="module" — a module script is
      deferred by specification and would still flash the wrong theme.
    -->
    <script src="/theme-init.js"></script>
    <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/fonts/archivo-latin.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-def.css">
  </head>
  <body><div id="root"></div></body>
</html>`;

/** Three buckets with round numbers, so the arithmetic tests never move with the real table. */
const TEST_BUCKETS = [
  { id: 'js-initial', label: 'JS', max: 1000, ceiling: 2000, warnAt: 0.8, basis: 'x', changes: [] },
  {
    id: 'css-blocking',
    label: 'CSS',
    max: 100,
    ceiling: 100,
    warnAt: 0.5,
    basis: 'y',
    changes: [],
  },
];

/* ================================================================== comment stripping */

describe('stripHtmlComments', () => {
  it('removes a comment whose prose mentions markup, leaving the real tags', () => {
    const stripped = stripHtmlComments(BUILT_HTML);
    expect(stripped).not.toContain('deferred by specification');
    expect(stripped).toContain('<script src="/theme-init.js">');
  });

  it('removes several comments independently rather than everything between the first and last', () => {
    expect(stripHtmlComments('a<!--1-->b<!--2-->c')).toBe('abc');
  });

  it('removes a multi-line comment', () => {
    expect(stripHtmlComments('a<!--\nx\ny\n-->b')).toBe('ab');
  });
});

/* ================================================================== HTML classification */

describe('parseInitialAssets', () => {
  it('classifies the built document exactly', () => {
    expect(parseInitialAssets(BUILT_HTML)).toEqual({
      blockingScripts: ['/theme-init.js'],
      moduleScripts: ['/assets/index-abc.js'],
      modulePreloads: [],
      stylesheets: ['/assets/index-def.css'],
      fontPreloads: ['/fonts/inter-latin.woff2', '/fonts/archivo-latin.woff2'],
    });
  });

  it('does not invent a script from prose inside a comment', () => {
    const html = `<!-- <script src="/ghost.js"></script> and a <link rel="stylesheet" href="/ghost.css"> -->
      <script type="module" src="/real.js"></script>`;
    const parsed = parseInitialAssets(html);
    expect(parsed.blockingScripts).toEqual([]);
    expect(parsed.stylesheets).toEqual([]);
    expect(parsed.moduleScripts).toEqual(['/real.js']);
  });

  it('counts every modulepreload — this is the code-splitting case the gate exists for', () => {
    const html = `<script type="module" crossorigin src="/a/entry.js"></script>
      <link rel="modulepreload" crossorigin href="/a/vendor.js">
      <link rel="modulepreload" crossorigin href="/a/shared.js">`;
    const parsed = parseInitialAssets(html);
    expect(bucketAssets(parsed)['js-initial']).toEqual([
      '/a/entry.js',
      '/a/vendor.js',
      '/a/shared.js',
    ]);
  });

  it('excludes a deferred or async classic script from the parser-blocking bucket', () => {
    const parsed = parseInitialAssets(
      `<script src="/a.js" defer></script><script async src="/b.js"></script>`,
    );
    expect(parsed.blockingScripts).toEqual([]);
    expect(parsed.moduleScripts).toEqual([]);
  });

  it('ignores an inline script, which has no bytes to fetch', () => {
    expect(parseInitialAssets(`<script>var x = 1;</script>`).blockingScripts).toEqual([]);
  });

  it('reads single-quoted and unquoted attributes, and does not care about attribute order', () => {
    const parsed = parseInitialAssets(
      `<script crossorigin type='module' src=/q.js></script><link href='/q.css' rel='stylesheet'>`,
    );
    expect(parsed.moduleScripts).toEqual(['/q.js']);
    expect(parsed.stylesheets).toEqual(['/q.css']);
  });

  it('is case-insensitive about tag names, rel values and type values', () => {
    const parsed = parseInitialAssets(
      `<SCRIPT TYPE="MODULE" SRC="/u.js"></SCRIPT><LINK REL="StyleSheet" HREF="/u.css">`,
    );
    // The HTML specification matches `type="module"` and `rel` values ASCII-case-insensitively,
    // so an uppercase MODULE is still a module script and must still be counted.
    expect(parsed.moduleScripts).toEqual(['/u.js']);
    expect(parsed.stylesheets).toEqual(['/u.css']);
  });

  it('handles a space-separated rel list', () => {
    expect(parseInitialAssets(`<link rel="preload stylesheet" href="/m.css">`).stylesheets).toEqual(
      ['/m.css'],
    );
  });

  it('does not treat a non-font preload as a font', () => {
    const parsed = parseInitialAssets(`<link rel="preload" as="image" href="/hero.avif">`);
    expect(parsed.fontPreloads).toEqual([]);
  });

  it('ignores a link with no href and a script with no src', () => {
    const parsed = parseInitialAssets(`<link rel="stylesheet"><script type="module"></script>`);
    expect(parsed.stylesheets).toEqual([]);
    expect(parsed.moduleScripts).toEqual([]);
  });
});

/* ================================================================== evaluation */

describe('evaluate', () => {
  const membership = { 'js-initial': ['/a.js', '/b.js'], 'css-blocking': ['/a.css'] };

  it('sums every asset in a bucket', () => {
    const result = evaluate(membership, { '/a.js': 300, '/b.js': 400, '/a.css': 10 }, TEST_BUCKETS);
    expect(result.rows[0].total).toBe(700);
    expect(result.rows[1].total).toBe(10);
  });

  it('treats the budget as a maximum: exactly at it does not fail, one byte over does', () => {
    // §8's wording is "at most", not "under", and code and document have to agree on which.
    // Sitting exactly on the number still warns — being at 100% of a budget is worth saying
    // out loud — but it does not fail the gate.
    const at = evaluate({ 'css-blocking': ['/a.css'] }, { '/a.css': 100 }, TEST_BUCKETS);
    expect(at.rows[1].status).toBe('WARN');
    expect(at.ok).toBe(true);
    expect(exitCodeFor(at)).toBe(0);

    const over = evaluate({ 'css-blocking': ['/a.css'] }, { '/a.css': 101 }, TEST_BUCKETS);
    expect(over.rows[1].status).toBe('FAIL');
    expect(over.ok).toBe(false);
    expect(exitCodeFor(over)).toBe(1);
  });

  it('warns from the warnAt fraction inclusive, and a warning is not a failure', () => {
    const below = evaluate({ 'css-blocking': ['/a.css'] }, { '/a.css': 49 }, TEST_BUCKETS);
    expect(below.rows[1].status).toBe('PASS');

    const at = evaluate({ 'css-blocking': ['/a.css'] }, { '/a.css': 50 }, TEST_BUCKETS);
    expect(at.rows[1].status).toBe('WARN');
    expect(at.ok).toBe(true);
    expect(exitCodeFor(at)).toBe(0);
  });

  it('scores an empty bucket as zero rather than skipping it', () => {
    const result = evaluate({}, {}, TEST_BUCKETS);
    expect(result.rows.map((r) => r.total)).toEqual([0, 0]);
    expect(result.ok).toBe(true);
  });

  it('throws rather than scoring an unmeasured asset as zero', () => {
    // The failure this guards is the dangerous one: a gate that cannot find the build output
    // reporting 0.00 KB and exiting 0 looks exactly like a very small bundle.
    expect(() => evaluate({ 'js-initial': ['/gone.js'] }, {}, TEST_BUCKETS)).toThrow(
      /No measured size for "\/gone\.js"/,
    );
  });

  it('throws on a non-finite size', () => {
    expect(() => evaluate({ 'js-initial': ['/x.js'] }, { '/x.js': NaN }, TEST_BUCKETS)).toThrow(
      /No measured size/,
    );
  });

  it('reports failure when any bucket fails, even if others pass', () => {
    const result = evaluate(membership, { '/a.js': 1, '/b.js': 1, '/a.css': 9999 }, TEST_BUCKETS);
    expect(result.rows[0].status).toBe('PASS');
    expect(result.rows[1].status).toBe('FAIL');
    expect(exitCodeFor(result)).toBe(1);
  });
});

/* ================================================================== reporting */

describe('formatReport', () => {
  it('prints the basis and the escape hatch when a bucket fails', () => {
    const result = evaluate({ 'css-blocking': ['/a.css'] }, { '/a.css': 250 }, TEST_BUCKETS);
    const report = formatReport(result);
    expect(report).toContain('FAIL: css-blocking is 0.15 KB over its 0.10 KB budget.');
    expect(report).toContain('Basis for that number: y');
    expect(report).toContain('npx vite build');
  });

  it('says a raise needs a §10 entry when max already sits at the ceiling', () => {
    const result = evaluate({ 'css-blocking': ['/a.css'] }, { '/a.css': 250 }, TEST_BUCKETS);
    expect(formatReport(result)).toContain('needs a new ARCHITECTURE.md §10 entry');
  });

  it('says a raise is local when max is below the ceiling', () => {
    const result = evaluate({ 'js-initial': ['/a.js'] }, { '/a.js': 5000 }, TEST_BUCKETS);
    expect(formatReport(result)).toContain('is a local decision');
  });

  it('never lets an over-budget bar overflow its fixed width', () => {
    const result = evaluate({ 'js-initial': ['/a.js'] }, { '/a.js': 10_000_000 }, TEST_BUCKETS);
    const bars = formatReport(result)
      .split('\n')
      .filter((l) => l.includes('['));
    expect(bars.length).toBeGreaterThan(0);
    for (const line of bars) {
      expect(line.slice(line.indexOf('[') + 1, line.indexOf(']'))).toHaveLength(24);
    }
  });

  it('labels lazy chunks and fonts as not gated, so a reader cannot mistake them for budgeted', () => {
    const result = evaluate({}, {}, TEST_BUCKETS);
    const report = formatReport(result, {
      unreferenced: [{ url: '/assets/lazy.js', bytes: 4000 }],
      fonts: [{ url: '/fonts/inter-latin.woff2', bytes: 20_000 }],
    });
    expect(report).toContain('Not gated — lazily loaded chunks, 4.00 KB total');
    expect(report).toContain('Not gated — preloaded fonts, 20.00 KB total');
  });

  it('states the unit convention, because 1000 vs 1024 is worth 6 KB at this scale', () => {
    expect(formatReport(evaluate({}, {}, TEST_BUCKETS))).toContain('KB = 1000 bytes');
  });
});

describe('formatKB', () => {
  it('uses 1000 bytes to the KB and two decimals', () => {
    expect(formatKB(0)).toBe('0.00 KB');
    expect(formatKB(1000)).toBe('1.00 KB');
    expect(formatKB(9863)).toBe('9.86 KB');
    expect(formatKB(1024)).toBe('1.02 KB');
  });
});

/* ================================================================== the live budget table
 *
 * These are the tests that stop a number drifting away from the reason it was chosen. They
 * assert the derivations recorded in `BUCKETS[*].basis`, so editing a figure without
 * revisiting its basis fails here rather than passing quietly.
 */

describe('the recorded budgets are internally consistent', () => {
  it('has unique ids, and every bucket bucketAssets produces is in the table', () => {
    const ids = BUCKETS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);

    const produced = Object.keys(
      bucketAssets({
        blockingScripts: [],
        moduleScripts: [],
        modulePreloads: [],
        stylesheets: [],
        fontPreloads: [],
      }),
    );
    // A bucket produced but not in the table would be silently unbudgeted.
    expect(produced.every((id) => ids.includes(id))).toBe(true);
    expect(ids.every((id) => produced.includes(id))).toBe(true);
  });

  it('never lets max exceed the ceiling its basis supports', () => {
    for (const bucket of BUCKETS) {
      expect(bucket.max, `${bucket.id} max <= ceiling`).toBeLessThanOrEqual(bucket.ceiling);
      expect(bucket.max, `${bucket.id} max is positive`).toBeGreaterThan(0);
    }
  });

  it('warns before it fails, on every bucket', () => {
    for (const bucket of BUCKETS) {
      expect(bucket.warnAt, `${bucket.id} warnAt`).toBeGreaterThan(0);
      expect(bucket.warnAt, `${bucket.id} warnAt`).toBeLessThan(1);
    }
  });

  it('records a non-empty basis for every bucket', () => {
    for (const bucket of BUCKETS) {
      expect(bucket.basis.length, `${bucket.id} basis`).toBeGreaterThan(80);
    }
  });

  it('derives the CSS ceiling from both of its recorded bases, and takes the tighter', () => {
    const js = BUCKETS.find((b) => b.id === 'js-initial');
    const css = BUCKETS.find((b) => b.id === 'css-blocking');

    // (A) proportion of the initial-JS budget
    const byProportion = CSS_SHARE_OF_JS_BUDGET * js.max;
    // (B) render-blocking transfer time on the reference link
    const byTransferTime =
      BLOCKING_TRANSFER_SHARE_OF_FCP * FCP_TARGET_SECONDS * REFERENCE_LINK_BYTES_PER_SEC;

    expect(byProportion).toBe(25 * BYTES_PER_KB);
    // `toBeCloseTo`, not `toBe`: 0.1 * 1.5 * 200000 is 30000.000000000004 in binary floating
    // point. Which is precisely why `ceiling` is a literal in the table rather than computed
    // at run time — a budget must not be a float that lands a fraction of a byte either way.
    expect(byTransferTime).toBeCloseTo(30 * BYTES_PER_KB, 6);
    expect(css.ceiling).toBe(Math.min(byProportion, Math.round(byTransferTime)));
  });

  it('keeps the parser-blocking bucket small enough to remain a signal', () => {
    const blocking = BUCKETS.find((b) => b.id === 'js-blocking');
    // The point of a separate bucket is that a byte in front of first paint costs more than
    // a byte in a deferred module. If this ever grew to a percent of the JS budget it would
    // have stopped being that.
    expect(blocking.ceiling).toBeLessThan(0.02 * BUCKETS.find((b) => b.id === 'js-initial').max);
  });
});

/* ================================================================== the real artefact
 *
 * `dist/` is gitignored, so this runs only after `npm run build` — the loud-skip reporter
 * names it when it does not. CI builds before testing, so it runs there.
 *
 * It is worth having despite the unit tests above: the fixture is something I wrote, and the
 * thing that actually has to be parsed is something Vite writes. A Vite upgrade that changed
 * how the entry is declared would pass every test above and be caught only here.
 */
const builtIndex = path.join(repoRoot, 'dist', 'index.html');

describe.skipIf(!existsSync(builtIndex))('the built dist/index.html', () => {
  it('yields exactly one module entry, one stylesheet, and no unclassified script', () => {
    const parsed = parseInitialAssets(readFileSync(builtIndex, 'utf8'));
    expect(parsed.moduleScripts).toHaveLength(1);
    expect(parsed.stylesheets).toHaveLength(1);
    // If Vite ever emits a deferred classic script, or the theme script loses its blocking
    // position, the gate would stop counting it. Assert the shape rather than trust it.
    expect(parsed.blockingScripts).toEqual(['/theme-init.js']);
  });

  it('references only paths that begin at the site root', () => {
    const parsed = parseInitialAssets(readFileSync(builtIndex, 'utf8'));
    const all = [
      ...parsed.blockingScripts,
      ...parsed.moduleScripts,
      ...parsed.modulePreloads,
      ...parsed.stylesheets,
    ];
    // The resolver in check-budget.mjs maps a root-relative URL to a file under dist/. An
    // absolute or protocol-relative URL would not resolve, and would also be a DL-2
    // third-party fetch, so this assertion covers both.
    for (const url of all) expect(url).toMatch(/^\/[^/]/);
  });
});
