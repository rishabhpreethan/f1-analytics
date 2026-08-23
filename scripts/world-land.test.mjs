import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { WORLD_LAND_PATH } from '../src/components/entity/worldLand.ts';

/**
 * **`src/components/entity/worldLand.ts` is generated, and this is what stops it rotting.**
 *
 * It lives beside the generator rather than beside the constant, for the reason
 * `scripts/entity-tokens.test.mjs` gives: it needs `node:child_process` and `node:zlib`, and
 * `src/**` is compiled by `tsconfig.app.json`, which deliberately carries no `@types/node`.
 * Importing them there would mean application code could reach for `fs` and still typecheck.
 *
 * **What is asserted here is the budget and the shape, never the geometry.** Nobody should have
 * to update this file to change the simplification threshold — that is a decision recorded in
 * `ARCHITECTURE.md` §10 #35 and made in the generator. What must not change silently is:
 *
 *   - the byte cost, because 5.31 KB was the number Rishabh approved and the whole asset exists
 *     on the strength of that figure;
 *   - that the string is a parseable SVG path, because a malformed `d` renders as *nothing* in
 *     every browser, with no console error and no test failure anywhere else;
 *   - that it stays inside the atlas's `0 0 360 180` box, because CR-007's spotlight defect was
 *     exactly this — a coordinate in the wrong unit, drawn outside its element, invisible to
 *     jsdom;
 *   - that it is still recognisably a world map rather than eight triangles.
 *
 * **What this cannot tell anyone: whether the coastline looks right.** jsdom performs no layout
 * and no rasterisation, so every assertion below is about the *text* of a path. Whether the
 * outline lands in register with the 78 pips, whether the Caspian is punched out, whether the
 * stroke reads at 517 px — those need a browser, and they are named here rather than implied.
 */

const REPO = fileURLToPath(new URL('..', import.meta.url));

/** One generator run, ~60 ms. Cheap enough that the determinism test pays for a second. */
const generate = () =>
  execFileSync(process.execPath, ['scripts/generate-world-land.mjs'], {
    cwd: REPO,
    encoding: 'utf8',
    // stdout only. The generator prints its ring/point/extent line to stderr, which must not
    // end up compared against the committed file.
    stdio: ['ignore', 'pipe', 'ignore'],
  });

const COMMITTED = readFileSync(`${REPO}src/components/entity/worldLand.ts`, 'utf8');

/**
 * The ceiling, in gzipped bytes at zlib level 9 — the one compression setting this project
 * measures with (`scripts/check-budget.mjs` explains why level 9 and not the default).
 *
 * 6,000 rather than the measured 5,014 because a ceiling that sits on the current figure fails
 * on noise and gets raised reflexively. This leaves ~20% of headroom and still fires long
 * before the 19.91 KB unsimplified asset — the one §6.6.5.3 measured as *unaffordable* — could
 * be committed by accident.
 */
const GZIP_CEILING_BYTES = 6_000;

const gzipped = (text) => gzipSync(Buffer.from(text, 'utf8'), { level: 9 }).length;

describe('worldLand.ts is generated, never authored', () => {
  it('is byte-identical to a fresh run of the generator', () => {
    /*
     * Two things at once, and both matter. A hand edit to a generated file fails here — nobody
     * can meaningfully proofread 1,214 coordinates, and a mistyped one still renders, just
     * slightly wrong. And the generator is asserted to be *reproducible*: same input, same
     * bytes. Its only ambient input is the resolved `world-atlas` version, so a lockfile bump
     * that quietly changed the dataset also lands here rather than on the screen.
     *
     * If this fails, regenerate — never edit an expected value into this file:
     *
     *   node scripts/generate-world-land.mjs > src/components/entity/worldLand.ts
     */
    expect(generate()).toBe(COMMITTED);
  });

  it('pulls no runtime dependency into the client bundle', () => {
    /*
     * The contract that keeps `world-atlas`, `topojson-client` and `topojson-simplify` in
     * devDependencies where they belong: the emitted module is one string literal and imports
     * nothing. A generator that started emitting `import { feature } from 'topojson-client'`
     * would put a TopoJSON runtime on the first-paint path, which is the opposite of the point.
     */
    expect(COMMITTED).not.toMatch(/^\s*import\b/m);
    expect(COMMITTED).not.toMatch(/\brequire\s*\(/);
  });
});

describe('the coastline stays inside the budget it was approved on', () => {
  it(`gzips to under ${String(GZIP_CEILING_BYTES)} bytes`, () => {
    const bytes = gzipped(WORLD_LAND_PATH);
    // Printed on failure so the number is in the log rather than in someone's head.
    expect(
      bytes,
      `WORLD_LAND_PATH is ${String(bytes)} B gzipped (level 9), over the ${String(
        GZIP_CEILING_BYTES,
      )} B ceiling. Raising the ceiling needs the §6.6.5.3 measurement redone and Rishabh's ` +
        'call on the budget — the asset exists only because 5.31 KB was affordable.',
    ).toBeLessThanOrEqual(GZIP_CEILING_BYTES);
  });

  it('is still a recognisable world map, not a handful of triangles', () => {
    /*
     * A floor, deliberately far below the current 72 rings / 1,214 points. Its job is to catch
     * a threshold raised carelessly, which shrinks the file — so the byte ceiling above cannot
     * catch it and the map silently loses Antarctica. Not an assertion about *which* rings
     * survive: that is geometry, and geometry is the generator's business.
     */
    const rings = WORLD_LAND_PATH.match(/M/g) ?? [];
    const points = WORLD_LAND_PATH.match(/[\d.]+ [\d.]+/g) ?? [];
    expect(rings.length).toBeGreaterThanOrEqual(40);
    expect(points.length).toBeGreaterThanOrEqual(800);
  });
});

describe('the path string is well formed and in the atlas coordinate space', () => {
  /**
   * Parse `M x y (x y)* Z` repeated, strictly. Deliberately hand-rolled rather than regex-
   * matched in one shot: the failure this guards against is a *silent* one — an SVG renderer
   * given a malformed `d` draws nothing at all and reports nothing — so the parser has to be
   * able to say which subpath and which token went wrong.
   */
  function parseSubpaths(d) {
    const subpaths = [];
    let index = 0;
    while (index < d.length) {
      expect(d[index], `expected 'M' at offset ${String(index)}`).toBe('M');
      const end = d.indexOf('Z', index);
      expect(end, `subpath starting at ${String(index)} is not closed with 'Z'`).toBeGreaterThan(
        index,
      );
      const body = d.slice(index + 1, end);
      const tokens = body.split(' ');
      expect(
        tokens.length % 2,
        `subpath at ${String(index)} has ${String(tokens.length)} numbers, which is odd — ` +
          'coordinates come in pairs',
      ).toBe(0);
      const points = [];
      for (let i = 0; i < tokens.length; i += 2) {
        points.push([tokens[i], tokens[i + 1]]);
      }
      subpaths.push(points);
      index = end + 1;
    }
    return subpaths;
  }

  const subpaths = parseSubpaths(WORLD_LAND_PATH);

  it('is a sequence of closed subpaths, each with at least three points', () => {
    expect(subpaths.length).toBeGreaterThan(0);
    for (const [i, points] of subpaths.entries()) {
      // A ring of one or two points encloses nothing and is bytes that draw air.
      expect(
        points.length,
        `subpath ${String(i)} has ${String(points.length)} points`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('uses only digits, spaces, M and Z — no command the atlas did not ask for', () => {
    /*
     * Pins the emit format itself. A stray `C`, `A` or a scientific-notation coordinate would
     * still be valid SVG and would still render, but it would mean the generator had changed
     * shape underneath the size assertions above, and `1e-7` in particular is how a float
     * formatter leaks a number no `viewBox` can place.
     */
    expect(WORLD_LAND_PATH).toMatch(/^[MZ0-9. ]+$/);
    expect(WORLD_LAND_PATH).not.toMatch(/[eE]/);
    expect(WORLD_LAND_PATH).not.toMatch(/ {2}|^ | $/);
  });

  it('carries at most one decimal place per coordinate', () => {
    // The 0.1° grid, asserted on the output rather than trusted from the configuration. At
    // 1.44 px/degree a second decimal is 0.014 px and is pure payload.
    for (const points of subpaths) {
      for (const [x, y] of points) {
        expect(x).toMatch(/^\d+(\.\d)?$/);
        expect(y).toMatch(/^\d+(\.\d)?$/);
      }
    }
  });

  it('falls entirely inside the 360 x 180 viewBox', () => {
    /*
     * The CR-007 lesson, mechanised: a coordinate in the wrong unit renders outside its element
     * and jsdom, which performs no layout, sees nothing wrong. `CircuitAtlas` is
     * `viewBox="0 0 360 180"` with `x = longitude + 180` and `y = 90 − latitude`, so the whole
     * globe maps to exactly that box and anything outside it is an arithmetic error.
     */
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const points of subpaths) {
      for (const [xs, ys] of points) {
        const x = Number(xs);
        const y = Number(ys);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    expect(minX).toBeGreaterThanOrEqual(0);
    expect(maxX).toBeLessThanOrEqual(360);
    expect(minY).toBeGreaterThanOrEqual(0);
    expect(maxY).toBeLessThanOrEqual(180);

    /*
     * And it actually spans the box, rather than sitting in one corner — a projection that had
     * lost its `+ 180` would still satisfy the bounds above for every eastern longitude.
     * Natural Earth land touches the antimeridian at both ends, so x really does reach 0 and
     * 360. `maxY` is exactly 180 — the south pole — because the generator closes Antarctica
     * over it: `world-atlas` clips the dataset at 85.6°S, which is a storage limit and not a
     * shore, and everything between there and the pole is continent. `minY` does not reach 0;
     * the northernmost land in this dataset is ~83.6°N.
     */
    expect(minX).toBe(0);
    expect(maxX).toBe(360);
    expect(minY).toBeGreaterThan(0);
    expect(minY).toBeLessThan(20);
    expect(maxY).toBe(180);
  });

  /**
   * ⚠ **The invariant whose absence shipped three wrong pictures, and none of them was visible
   * in a path string.**
   *
   * Two islands that straddle the antimeridian — Fiji and Wrangel — carry seam vertices Natural
   * Earth writes at longitude −180 while their bodies sit at +178.7…+180. Projected without
   * unwrapping, each became a quad **spanning the whole 360-unit map**: a hairline of land
   * across the Pacific, the Atlantic and the Indian Ocean at lat −16.5 and lat 71, with a
   * measured nonzero winding number of 1 at (−140°, −16.5°), which is open ocean. Afro-Eurasia
   * carried a third such edge at y = 25, invisible while the path was only filled because a
   * horizontal edge crosses no scanline — and a full-width scar the moment §7.15 stroked it.
   *
   * Found by rasterising the constant offline. Caught here from now on: on a 1:110m coastline
   * the longest legitimate segment is a few degrees, so a non-horizontal edge spanning half the
   * map is a seam, a wrap or a polar chord, never a shore.
   */
  it('has no edge that sweeps across the map — the antimeridian guard', () => {
    let worst = 0;
    let where = null;
    for (const points of subpaths) {
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        // Horizontal edges are exempt: they bound no fill and, at y = 0 or y = 180, the
        // neatline covers the stroke. Antarctica's pole line is one, and is a full 360 wide.
        if (a[1] === b[1]) continue;
        const span = Math.abs(Number(a[0]) - Number(b[0]));
        if (span > worst) {
          worst = span;
          where = `(${a[0]}, ${a[1]}) -> (${b[0]}, ${b[1]})`;
        }
      }
    }
    expect(
      worst,
      `longest non-horizontal edge is ${String(worst)} units, ${String(where)} — that is an ` +
        'antimeridian seam, not a coastline, and it draws a straight line across open ocean',
    ).toBeLessThanOrEqual(180);
  });
});
