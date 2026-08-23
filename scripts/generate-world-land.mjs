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
 * ⚠ **Read "the antimeridian" below before changing anything in the emit path.** The first
 * version of this generator projected each ring straight through and shipped three wrong
 * pictures — two islands smeared across the whole map, and Antarctica cut off four degrees short
 * of the pole. None of them is visible in a path string, none is reachable from jsdom, and all
 * three were found by rasterising the output offline and computing winding numbers at known
 * ocean points. That section is why the emit path is longer than two additions.
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
 * ⚠ **§6.6.5.3 called this "Douglas–Peucker", which was wrong; the label was corrected on
 * 2026-08-23 and the numbers, which were always Visvalingam's, were not touched.** See the
 * reconciliation
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
 * *wanted*, since with 72 other disjoint rings the two rules agree everywhere else anyway.
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
 * One list of projected `[x, y]` points -> an open, grid-snapped ring, or `null` if it
 * collapsed.
 *
 * Two reductions, both of which only ever remove bytes that draw nothing:
 *   - consecutive duplicates after snapping (a segment of length 0);
 *   - the repeated closing vertex GeoJSON requires and `Z` supplies.
 *
 * A ring left with fewer than three distinct points encloses no area, so it is dropped
 * entirely rather than emitted as an invisible `M … Z`.
 */
function toRing(projected) {
  const points = [];
  for (const [rawX, rawY] of projected) {
    const x = snap(rawX);
    const y = snap(rawY);
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

/* ------------------------------------------------------------------ the antimeridian
 *
 * ⚠ **Everything below was added on 2026-08-23 because the first emitted constant drew three
 * things that are not there, and none of them is visible in a path string.** They were found by
 * rasterising the path offline and computing the nonzero winding number at known ocean points:
 *
 *   1. **Fiji** (`land-110m` polygon 16) and **Wrangel Island** (polygon 92) sit *on* the
 *      antimeridian, and Natural Earth writes their seam vertices at longitude **−180** while
 *      the bodies are at **+178.7 … +180**. Projected naively, each became a 0.3–0.7° quad
 *      spanning **the whole 360° of the map** — a hairline of land drawn across the Pacific,
 *      the Atlantic and the Indian Ocean at lat −16.5 and lat 71. Measured: winding number 1
 *      at (−140°, −16.5°), which is open ocean 3,000 km from any land.
 *   2. **Afro-Eurasia** (polygon 90) genuinely crosses the antimeridian at Chukotka, so its
 *      ring carries a seam edge from x = 360 to x = 0 at y = 25. That edge is exactly
 *      horizontal, so it contributes nothing to a scanline fill and the artefact is invisible
 *      while the path is only filled — **and becomes a hairline across the entire map the
 *      moment §7.15 strokes the coastline**, which it does.
 *   3. **Antarctica** (polygon 7) is clipped by the dataset at lat −85.6 and closes with a wrap
 *      edge from lon +178.3 back to lon −180. Simplification had already deleted the two clip
 *      corners (a straight run has near-zero effective area under Visvalingam), so the
 *      continent rendered with a **dead-flat bottom at y ≈ 174.6 and 5 units of ocean below
 *      it** — and the pole, which is land, was not drawn at all.
 *
 * The fix is three ordered steps — unwrap, close over the pole, place — and then a clip to the
 * viewBox so that every artificial edge introduced here lands underneath `.atlas-neatline`
 * rather than in open water.
 */

/** How many rings had to be closed over a pole. Asserted to be exactly one (Antarctica). */
let polarClosures = 0;

/**
 * Unwrap a ring's longitudes so no consecutive pair jumps more than 180°.
 *
 * A GeoJSON ring is a walk along a coastline: two consecutive vertices are neighbours on the
 * ground, so a 359° gap between them is never a 359° journey — it is the ±180 seam, written in
 * the wrong frame. Adding or subtracting whole turns restores the walk. The result may leave
 * `[-180, 180]`, which is the point: a ring is allowed to be continuous even when the
 * coordinate system is not.
 */
function unwrapLongitudes(ring) {
  const out = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    const previous = out[i - 1][0];
    let longitude = ring[i][0];
    while (longitude - previous > 180) longitude -= 360;
    while (previous - longitude > 180) longitude += 360;
    out.push([longitude, ring[i][1]]);
  }
  return out;
}

/**
 * A ring that still spans a whole turn after unwrapping encircles a pole, and must be closed
 * *over* it rather than straight across the map.
 *
 * Antarctica is the only such ring in this dataset, and it is asserted to be — an equirectangular
 * map has no pole to route around except by walking along the frame edge, so a second one
 * appearing (a north-polar ice dataset, say) is a change this function should be re-read for
 * rather than absorbed silently.
 *
 * The two appended vertices take the boundary from the last coastal point straight down the
 * antimeridian to lat ∓90, along the pole line, and back up to the first. Geographically this
 * is not a fudge: everything from the coastline to the pole *is* the continent, and the
 * dataset's −85.6 clip is a storage limit, not a shore.
 */
function closeOverPole(ring) {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Math.abs(last[0] - first[0]) <= 180) return null;
  const pole = (first[1] + last[1]) / 2 < 0 ? -90 : 90;
  return [...ring, [last[0], pole], [first[0], pole]];
}

/**
 * Translate an unwrapped ring by whole turns to the frame that shows the most of it.
 *
 * Fiji unwraps to lon [−180.64, −180] — one turn west of where it belongs, with nothing inside
 * the map at all. `+360` puts it back at [179.36, 180]. Afro-Eurasia unwraps to
 * [−377.62, −169.90] and `+360` gives [−17.62, 190.10], its true range: 197.6° of it visible
 * instead of 10.1°.
 *
 * Candidates are tried in order of |k| so that a ring already in frame is never moved on a tie.
 */
function placeInFrame(ring) {
  const longitudes = ring.map((point) => point[0]);
  const lo = Math.min(...longitudes);
  const hi = Math.max(...longitudes);
  let best = 0;
  let bestVisible = -Infinity;
  for (const k of [0, -1, 1, -2, 2]) {
    const visible = Math.min(hi + 360 * k, 180) - Math.max(lo + 360 * k, -180);
    if (visible > bestVisible + 1e-9) {
      bestVisible = visible;
      best = k;
    }
  }
  return best === 0
    ? ring
    : ring.map(([longitude, latitude]) => [longitude + 360 * best, latitude]);
}

/**
 * A ring that still escapes the frame after placement has land on both sides of the
 * antimeridian, and needs a second copy one turn away so the far side is drawn too.
 *
 * Only Afro-Eurasia does, for the 10.1° of Chukotka east of lon 180. The copy is clipped to the
 * viewBox immediately afterwards, so it costs a dozen points rather than the ring's 342.
 */
function frameCopies(ring) {
  const longitudes = ring.map((point) => point[0]);
  const copies = [ring];
  if (Math.max(...longitudes) > 180)
    copies.push(ring.map(([longitude, latitude]) => [longitude - 360, latitude]));
  if (Math.min(...longitudes) < -180)
    copies.push(ring.map(([longitude, latitude]) => [longitude + 360, latitude]));
  return copies;
}

/**
 * Sutherland–Hodgman clip of a closed polygon against one vertical half-plane, in projected
 * space.
 *
 * Clipping is what keeps the *artificial* edges — the ones this file introduces, which are not
 * coastline — pinned to x = 0 and x = 360, where `.atlas-neatline` (§7.15) paints over them.
 * Left unclipped they would either escape the viewBox, tripping the bounds assertion below, or
 * be stroked somewhere a reader would take them for a shore.
 *
 * The inside test is inclusive, so a ring already within the frame passes through vertex for
 * vertex and no crossing is invented at a coordinate that merely touches the edge.
 */
function clipToHalfPlane(points, limit, keepGreater) {
  const inside = (point) => (keepGreater ? point[0] >= limit : point[0] <= limit);
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const previous = points[(i - 1 + points.length) % points.length];
    if (inside(current) !== inside(previous)) {
      const t = (limit - previous[0]) / (current[0] - previous[0]);
      out.push([limit, previous[1] + t * (current[1] - previous[1])]);
    }
    if (inside(current)) out.push(current);
  }
  return out;
}

/** One source ring -> zero or more emitted rings, projected, clipped and grid-snapped. */
function prepareRing(source) {
  const unwrapped = unwrapLongitudes(source);
  const overPole = closeOverPole(unwrapped);
  if (overPole !== null) polarClosures++;
  const placed = placeInFrame(overPole ?? unwrapped);
  const out = [];
  for (const copy of frameCopies(placed)) {
    const projected = copy.map(([longitude, latitude]) => [
      projectX(longitude),
      projectY(latitude),
    ]);
    const clipped = clipToHalfPlane(clipToHalfPlane(projected, 0, true), 360, false);
    if (clipped.length < 3) continue;
    const ring = toRing(clipped);
    if (ring !== null) out.push(ring);
  }
  return out;
}

const subpaths = [];
let ringCount = 0;
let pointCount = 0;
let holesChecked = 0;

for (const polygon of geometry.coordinates) {
  const rings = polygon.map(prepareRing);
  const outer = rings[0]?.[0] ?? null;

  /*
   * Winding check, done on the *emitted* rings rather than the source, because rounding is the
   * step that could in principle flip a very small hole. `fill-rule: nonzero` fills a hole in
   * only if its winding matches its outer ring; there is one hole in this dataset and a filled
   * Caspian is the kind of defect that looks like a rendering choice rather than a bug.
   *
   * Placement cannot separate a hole from its outer ring: `placeInFrame` recovers each ring's
   * *true* longitude range independently, so the Caspian at [47, 54] and Afro-Eurasia at
   * [−17.6, 190.1] land in the same frame without either knowing about the other. A hole that
   * falls outside the frame a copy occupies is clipped away to nothing, which is correct.
   */
  for (let i = 1; i < rings.length; i++) {
    for (const hole of rings[i]) {
      if (outer === null) continue;
      holesChecked++;
      if (Math.sign(signedArea(outer)) === Math.sign(signedArea(hole))) {
        invariantFailure(
          'A hole ring winds the same way as its outer ring, so `fill-rule: nonzero` would',
          'fill it in rather than punch it out. The source data or `simplify` has changed;',
          'either re-wind holes here or switch the consumer to `fill-rule: evenodd`.',
        );
      }
    }
  }

  for (const ring of rings.flat()) {
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
 * ⚠ **The assertion that would have caught all three antimeridian defects, and did not exist.**
 *
 * No edge of any emitted ring may span more than half the map. On a 1:110m coastline the
 * longest legitimate segment is a few degrees; anything approaching 180 is a seam edge, a wrap
 * edge or a polar chord, and every one of those draws a straight line across open ocean — which
 * is exactly what shipped. A path string cannot be proofread for this and jsdom cannot render
 * it, so it is asserted at the only point where the geometry still exists as numbers.
 *
 * The threshold is 180 rather than something tight because the clip at x = 0 / x = 360 can
 * legitimately produce a long edge along the frame — Antarctica's pole line is a full 360 and is
 * exempted by being horizontal, which no fill and no stroke of a *coastline* can be mistaken for.
 */
{
  let worstSpan = 0;
  let worstAt = null;
  for (const ring of subpaths) {
    const numbers = ring.slice(1, -1).trim().split(/[\s]+/).map(Number);
    for (let i = 0; i < numbers.length; i += 2) {
      const j = (i + 2) % numbers.length;
      /* A horizontal edge draws no fill boundary and, at y = 0 or y = 180, no visible stroke. */
      if (numbers[i + 1] === numbers[j + 1]) continue;
      const span = Math.abs(numbers[i] - numbers[j]);
      if (span > worstSpan) {
        worstSpan = span;
        worstAt = [numbers[i], numbers[i + 1], numbers[j], numbers[j + 1]];
      }
    }
  }
  if (worstSpan > 180) {
    invariantFailure(
      `A non-horizontal edge spans ${String(worstSpan)} of the 360-unit map, from ` +
        `(${String(worstAt?.[0])}, ${String(worstAt?.[1])}) to (${String(worstAt?.[2])}, ` +
        `${String(worstAt?.[3])}). That is an antimeridian seam, not a coastline, and it will`,
      'draw a straight line across open ocean. See "the antimeridian" above.',
    );
  }
  console.error(`world-land: longest non-horizontal edge span ${String(worstSpan)} (ceiling 180)`);
}

if (polarClosures !== 1) {
  invariantFailure(
    `${String(polarClosures)} ring(s) needed closing over a pole; expected exactly 1 ` +
      '(Antarctica). An equirectangular map routes around a pole along the frame edge, so a ' +
      'second such ring is a change to re-read `closeOverPole` for, not to absorb.',
  );
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
