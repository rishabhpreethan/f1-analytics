/*
 * Coastline generator for `CircuitAtlas` — emits `src/components/entity/worldLand.ts`.
 *
 *   node scripts/generate-world-land.mjs > src/components/entity/worldLand.ts
 *
 * Prints the module to **stdout** and nothing else; every diagnostic goes to stderr. That is
 * `validate-palette.mjs`'s shape (`… tokens > src/styles/entity.css`), and it is what lets
 * `scripts/world-land.test.mjs` assert the committed file is byte-identical to a fresh run
 * without the generator needing a `--check` mode of its own.
 *
 * Exit codes match the other two script gates: 0 emitted, 1 an invariant failed, 2 the input
 * is not there.
 *
 * ------------------------------------------------------------------ what it produces
 *
 * One SVG path `d` string covering Natural Earth 110m land, already in the atlas's own
 * coordinate space — `viewBox="0 0 360 180"`, no transform, no `<g>`, drop it straight into a
 * `<path d={WORLD_LAND_PATH} />` inside `CircuitAtlas`'s existing `<svg>`.
 *
 * ------------------------------------------------------------------ the projection, written out
 *
 * **`x = longitude + 180`, `y = 90 − latitude`.** Written here as two lines of arithmetic and
 * deliberately *not* obtained from a `d3-geo` projection object, because a projection object is
 * a second authority on the mapping: `geoEquirectangular()` carries its own default scale,
 * translate, rotation and clip extent, and any of them silently moving would put the coastline
 * out of register with the 78 pips — which `CircuitAtlas` plots with this same arithmetic
 * inline, and which `CircuitLocator` plots with it again. Three copies of two additions is
 * cheaper to keep true than one shared object with five parameters. `d3-geo` is also not a
 * dependency of this project and adding one to perform `+ 180` would be absurd.
 *
 * The mapping is exact and orientation-preserving in x, and mirrored in y (SVG's y grows
 * downward). That mirror flips the **sign** of every ring's signed area but not the *relative*
 * winding of an outer ring against its hole, which is the only property `fill-rule: nonzero`
 * needs — see "the one hole" below.
 *
 * ------------------------------------------------------------------ simplification
 *
 * `topojson-simplify`: `presimplify()` assigns every point the **Visvalingam–Whyatt** effective
 * area of its triangle, in square degrees; `simplify(minWeight)` drops every point under the
 * threshold. `MIN_WEIGHT = 1` and `PRECISION = 0.1` are the configuration Rishabh approved on
 * the figures in `DESIGN_SYSTEM.md` §6.6.5.3.
 *
 * ⚠ **§6.6.5.3 calls this "Douglas–Peucker" and that label is wrong** — see the reconciliation
 * in `ARCHITECTURE.md` §10 #35. DP is a *perpendicular-distance* rule and Visvalingam is an
 * *area* rule; at the same numeric threshold they produce visibly different maps, so the label
 * is not a synonym. The recorded *numbers* are Visvalingam's (measured: 12.9 KB raw / 5.01 KB
 * gzipped against the recorded 13.4 / 5.31), so the approved configuration is this one and the
 * name in the table is the part that is mistaken. A true DP at ε = 1.0° gives 744 points and
 * 3.17 KB — cheaper, but a *different picture*, and the picture the designer rasterised and
 * signed off is the one below. Do not "fix" the label by changing the algorithm.
 *
 * **`filter(filterWeight(…))` is deliberately not used.** It removes whole rings under the same
 * threshold, and measured here at `MIN_WEIGHT = 1` it is a byte-for-byte no-op: every ring it
 * would drop is already dropped by the degeneracy rule below, because a ring worth less than
 * one square degree cannot survive rounding to 0.1° with three distinct vertices. One fewer
 * import, and the rule that actually does the work is the one written in this file.
 *
 * ------------------------------------------------------------------ the one hole
 *
 * 125 polygons, 126 rings: exactly one polygon carries a hole (the Caspian, inside the
 * Afro-Eurasian landmass). Its winding is **opposite** to its outer ring in the source and this
 * generator never reorders or re-winds rings, so the emitted path punches the hole correctly
 * under SVG's default **`fill-rule: nonzero`** — no `evenodd` needed, and no `evenodd`
 * *wanted*, since with 72 disjoint rings the two rules agree everywhere else anyway.
 * Measured at emit time and asserted below, so a future source bump that flattened the winding
 * fails the generator instead of filling in the Caspian.
 *
 * ------------------------------------------------------------------ reproducibility
 *
 * Same input, byte-identical output. Nothing here reads the clock, the environment, the
 * filesystem beyond the one pinned source file, or iterates a `Set`/`Map` whose order could
 * depend on insertion history. The only external variable is the resolved version of
 * `world-atlas`, which the committed lockfile pins and which
 * `scripts/world-land.test.mjs` catches loudly if it moves — a data source that changes under
 * you is exactly the thing a byte-identity test is for.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { feature } from 'topojson-client';
import { presimplify, simplify } from 'topojson-simplify';

/* ------------------------------------------------------------------ configuration */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Natural Earth 1:110m land, as redistributed by `world-atlas` (ISC). */
const SOURCE = 'node_modules/world-atlas/land-110m.json';

/** Human-readable provenance for the generated header. */
const SOURCE_LABEL = 'Natural Earth 1:110m land, via world-atlas `land-110m.json`';

/** Visvalingam–Whyatt minimum effective area, in square degrees. §6.6.5.3. */
const MIN_WEIGHT = 1;

/**
 * Coordinate grid, in degrees.
 *
 * The atlas column measures 517 px for 360° — **1.44 px per degree** — so 0.1° is 0.14 px and
 * already below anything a display can resolve. Finer precision buys picture quality of zero
 * and costs about 1 byte per coordinate.
 */
const PRECISION = 0.1;

/** Where the emitted module is expected to live; used only in the generated header. */
const TARGET = 'src/components/entity/worldLand.ts';

/* ------------------------------------------------------------------ failure modes */

function inputError(...lines) {
  for (const line of lines) console.error(line);
  process.exit(2);
}

function invariantFailure(...lines) {
  for (const line of lines) console.error(line);
  process.exit(1);
}

/* ------------------------------------------------------------------ read + simplify */

const sourcePath = path.join(repoRoot, SOURCE);
if (!existsSync(sourcePath)) {
  inputError(
    `Cannot generate the coastline: ${SOURCE} does not exist.`,
    '`world-atlas` is a devDependency (ARCHITECTURE.md §2). Run `npm install` first.',
  );
}

const topology = JSON.parse(readFileSync(sourcePath, 'utf8'));
const simplified = simplify(presimplify(topology), MIN_WEIGHT);
const collection = feature(simplified, simplified.objects.land);

/*
 * `feature()` on a GeometryCollection returns a FeatureCollection; `land-110m` holds exactly
 * one MultiPolygon inside it. Checked rather than assumed — a source bump that split land into
 * several features would otherwise silently emit only the first.
 */
if (collection.type !== 'FeatureCollection' || collection.features.length !== 1) {
  invariantFailure(
    `Expected one feature in ${SOURCE}, got ${collection.type} with ` +
      `${String(collection.features?.length ?? 0)} features. The source shape has changed.`,
  );
}
const geometry = collection.features[0].geometry;
if (geometry.type !== 'MultiPolygon') {
  invariantFailure(`Expected a MultiPolygon in ${SOURCE}, got ${geometry.type}.`);
}

/* ------------------------------------------------------------------ project, round, emit */

/** The projection. Two additions; see the header for why it is not a projection object. */
const projectX = (longitude) => longitude + 180;
const projectY = (latitude) => 90 - latitude;

const GRID = 1 / PRECISION;

/**
 * Snap to the 0.1° grid and render with no trailing zero.
 *
 * `+ 0` normalises `-0`, which `Math.round` produces for tiny negatives and which would print
 * as `"0"` on most paths but `"-0"` through `String()`. Every value here is in `[0, 360]`
 * anyway, so this only guards the boundary at the antimeridian and the north pole — the two
 * places a sign bit could appear.
 */
function snap(value) {
  return Math.round(value * GRID) / GRID + 0;
}

/** Signed area x2 of a closed ring given as an open point list. Sign carries the winding. */
function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/**
 * One GeoJSON ring -> an open list of grid-snapped `[x, y]` points, or `null` if it collapsed.
 *
 * Two reductions, both of which only ever remove bytes that draw nothing:
 *   - consecutive duplicates after snapping (a segment of length 0);
 *   - the repeated closing vertex GeoJSON requires and `Z` supplies.
 *
 * A ring left with fewer than three distinct points encloses no area, so it is dropped
 * entirely rather than emitted as an invisible `M … Z`.
 */
function toRing(coordinates) {
  const points = [];
  for (const [longitude, latitude] of coordinates) {
    const x = snap(projectX(longitude));
    const y = snap(projectY(latitude));
    const previous = points[points.length - 1];
    if (previous !== undefined && previous[0] === x && previous[1] === y) continue;
    points.push([x, y]);
  }
  while (
    points.length > 1 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1]
  ) {
    points.pop();
  }
  return points.length < 3 ? null : points;
}

const subpaths = [];
let ringCount = 0;
let pointCount = 0;
let holesChecked = 0;

for (const polygon of geometry.coordinates) {
  const rings = polygon.map(toRing);
  const outer = rings[0];

  /*
   * Winding check, done on the *emitted* rings rather than the source, because rounding is the
   * step that could in principle flip a very small hole. `fill-rule: nonzero` fills a hole in
   * only if its winding matches its outer ring; there is one hole in this dataset and a filled
   * Caspian is the kind of defect that looks like a rendering choice rather than a bug.
   */
  for (let i = 1; i < rings.length; i++) {
    const hole = rings[i];
    if (outer === null || hole === null) continue;
    holesChecked++;
    if (Math.sign(signedArea(outer)) === Math.sign(signedArea(hole))) {
      invariantFailure(
        'A hole ring winds the same way as its outer ring, so `fill-rule: nonzero` would',
        'fill it in rather than punch it out. The source data or `simplify` has changed;',
        'either re-wind holes here or switch the consumer to `fill-rule: evenodd`.',
      );
    }
  }

  for (const ring of rings) {
    if (ring === null) continue;
    ringCount++;
    pointCount += ring.length;
    const [first, ...rest] = ring;
    /*
     * `M x y` then bare coordinate pairs: after a `moveto`, SVG treats further pairs as
     * implicit `lineto` (SVG 2 §9.3.3), so 71 `L` characters per ring are pure overhead.
     * `Z` closes back to the first point, so the closing vertex is never written.
     */
    subpaths.push(
      `M${String(first[0])} ${String(first[1])}` +
        rest.map(([x, y]) => ` ${String(x)} ${String(y)}`).join('') +
        'Z',
    );
  }
}

const d = subpaths.join('');

/* ------------------------------------------------------------------ assert before emitting */

if (holesChecked !== 1) {
  console.error(
    `Note: ${String(holesChecked)} hole ring(s) present, expected 1 (the Caspian). ` +
      'Not fatal — the winding of each was still checked.',
  );
}

if (ringCount === 0) {
  invariantFailure('Simplification produced no rings at all. Refusing to emit an empty path.');
}

/*
 * A floor, not a target. It exists so that a future threshold change made carelessly — or a
 * source that resolved to a coarser dataset — fails here rather than shipping a world map made
 * of eight triangles. The current figures are ~72 rings / ~1214 points, so this is not tight.
 */
if (ringCount < 40 || pointCount < 800) {
  invariantFailure(
    `Only ${String(ringCount)} rings / ${String(pointCount)} points survived simplification ` +
      `at MIN_WEIGHT=${String(MIN_WEIGHT)}. That is below the floor at which the outline is ` +
      'still a recognisable world map. Refusing to emit.',
  );
}

for (const value of d.matchAll(/[\d.]+/g)) {
  const n = Number(value[0]);
  if (!Number.isFinite(n)) invariantFailure(`Emitted a non-finite coordinate: "${value[0]}".`);
}

const numbers = d.match(/[\d.]+/g) ?? [];
let minX = Infinity;
let maxX = -Infinity;
let minY = Infinity;
let maxY = -Infinity;
for (let i = 0; i < numbers.length; i += 2) {
  const x = Number(numbers[i]);
  const y = Number(numbers[i + 1]);
  if (x < minX) minX = x;
  if (x > maxX) maxX = x;
  if (y < minY) minY = y;
  if (y > maxY) maxY = y;
}
if (minX < 0 || maxX > 360 || minY < 0 || maxY > 180) {
  invariantFailure(
    `Coordinates escape the 360x180 viewBox: x [${String(minX)}, ${String(maxX)}], ` +
      `y [${String(minY)}, ${String(maxY)}]. The projection or the source bounds have changed.`,
  );
}

console.error(
  `world-land: ${String(ringCount)} rings, ${String(pointCount)} points, ` +
    `${String(d.length)} bytes raw, x [${String(minX)}, ${String(maxX)}], ` +
    `y [${String(minY)}, ${String(maxY)}]`,
);

/* ------------------------------------------------------------------ the module */

/*
 * Prettier formats the repository and this file is not exempt, so the emitter has to agree
 * with it or `worldLand.ts` cannot be both generated and `format:check`-clean — the same
 * constraint `validate-palette.mjs` meets by lower-casing hex. Two rules bind here: single
 * quotes, and a string too long for `printWidth: 100` goes on its own indented line after the
 * `=`. `scripts/world-land.test.mjs` pins the agreement by byte-identity, and
 * `npm run format:check` would catch a drift independently.
 *
 * The string contains no quote, backslash or newline — only digits, spaces, `M` and `Z` — so
 * no escaping is needed and none is performed. Asserted rather than trusted.
 */
if (/['\\\n\r]/.test(d)) {
  invariantFailure('The path string contains a character that would need escaping. Refusing.');
}

const header = `/*
 * ⚠ GENERATED FILE — DO NOT HAND-EDIT.
 *
 * Regenerate with:
 *
 *   node scripts/generate-world-land.mjs > ${TARGET}
 *
 * Source:         ${SOURCE_LABEL}
 * Simplification: Visvalingam–Whyatt via topojson-simplify, minimum effective area ${String(MIN_WEIGHT)}
 * Precision:      ${String(PRECISION)}° grid
 * Result:         ${String(ringCount)} rings, ${String(pointCount)} points, ${String(d.length)} bytes
 *
 * The generator carries the reasoning — the projection, why it is written out rather than
 * taken from a projection object, and why the threshold is what it is.
 * \`scripts/world-land.test.mjs\` fails if this file and a fresh run of the generator disagree,
 * so a hand edit here is caught rather than absorbed.
 */

/**
 * Natural Earth 110m land as a single SVG path \`d\`, in the circuit atlas's own coordinate
 * space: **\`viewBox="0 0 360 180"\`**, \`x = longitude + 180\`, \`y = 90 − latitude\`. No
 * transform, no wrapper group — it draws in register with the pips \`CircuitAtlas\` plots with
 * that same arithmetic inline.
 *
 * ${String(ringCount)} subpaths, each \`M\` + implicit linetos + \`Z\`. Exactly one is a hole (the Caspian) and it
 * winds against its outer ring, so **the default \`fill-rule: nonzero\` is correct** — do not
 * set \`evenodd\`, and do not reorder the subpaths.
 */
`;

process.stdout.write(`${header}export const WORLD_LAND_PATH =\n  '${d}';\n`);
