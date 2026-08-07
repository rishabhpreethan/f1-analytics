/*
 * Performance-budget gate — the I/O half. `docs/ARCHITECTURE.md` §8.
 *
 *   node scripts/check-budget.mjs [buildDir]     # buildDir defaults to ./dist
 *
 * Exit codes, matching `validate-palette.mjs` so the two gates behave alike:
 *   0  every gated bucket inside its budget (a WARN still exits 0)
 *   1  a bucket is over budget
 *   2  input error — no build to measure, or an asset the HTML references is missing
 *
 * All decisions about *what counts* and *what the numbers mean* live in `budget-core.mjs`,
 * which is pure and unit-tested. This file only reads bytes and prints.
 *
 * ---------------------------------------------------------------- why gzip level 9
 *
 * `zlib.gzipSync(buf, { level: 9 })` — an explicit level, not the default, because the figure a
 * gate reports has to be reproducible on any machine and zlib's default level is a value that
 * can in principle be re-tuned.
 *
 * It is **not** claimed to be the byte count any particular CDN would ship, and it is not the
 * minimum either. Measured on the same 497,715-byte JS chunk of this build: Node zlib level 9
 * 160,247 · Node zlib level 6 160,584 · GNU gzip -9 159,904 · GNU gzip -6 160,252 · Rolldown's
 * Rust deflate 162,060. A 1.3% spread across encoders, on one file, all of them "gzip". So a
 * budget cannot usefully be specified to better than about a percent, and what a gate needs is
 * a number that does not move for reasons unrelated to the code. That is the property level 9
 * on Node's own zlib has.
 *
 * This is deliberately the **only** gzip figure the project prints. Rolldown's reporter was
 * the widest outlier of the five, so `npm run build` and this gate would have disagreed about
 * the size of the same file by 1.8 KB — two authorities on one number, which is the drift
 * `ARCHITECTURE.md` §10 #19 avoided for colour. `build.reportCompressedSize` is therefore off
 * in `vite.config.ts`, and this is the answer.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import {
  bucketAssets,
  evaluate,
  exitCodeFor,
  formatReport,
  parseInitialAssets,
} from './budget-core.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.resolve(repoRoot, process.argv[2] ?? 'dist');

/** Print to stderr and exit 2. Used for every "there is nothing to measure" case. */
function inputError(...lines) {
  for (const line of lines) console.error(line);
  process.exit(2);
}

/* ------------------------------------------------------------------ locate the build */

const indexPath = path.join(buildDir, 'index.html');
if (!existsSync(indexPath)) {
  inputError(
    `No build to measure: ${path.relative(repoRoot, indexPath)} does not exist.`,
    'Run `npm run build` first — this gate measures build output, not source.',
  );
}

/* ------------------------------------------------------------------ measure */

/**
 * Root-relative URL as written in the HTML -> absolute file path inside the build directory.
 *
 * The containment check is not defending against an attacker — this reads our own build
 * output — it is catching a misconfiguration. A `base` that made Vite emit an absolute or
 * protocol-relative URL, or a `../` escaping the output directory, would otherwise be
 * measured as some unrelated file or silently skipped.
 */
function resolveAsset(url) {
  if (!url.startsWith('/') || url.startsWith('//')) {
    inputError(
      `The built index.html references "${url}", which is not a root-relative path.`,
      'Every asset must be served from this origin (ARCHITECTURE.md §7.3, DL-2), and the',
      'budget gate can only measure a file inside the build directory.',
    );
  }
  const resolved = path.resolve(buildDir, `.${url}`);
  if (resolved !== buildDir && !resolved.startsWith(buildDir + path.sep)) {
    inputError(`The built index.html references "${url}", which escapes ${buildDir}.`);
  }
  return resolved;
}

/** Gzipped size in bytes. Exits 2 rather than returning 0 for a file that is not there. */
function gzippedSize(url) {
  const file = resolveAsset(url);
  if (!existsSync(file)) {
    inputError(
      `The built index.html references "${url}" but ${path.relative(repoRoot, file)} does not exist.`,
      'The build output is incomplete. Refusing to report a size for a file that is missing —',
      'scoring it as 0 bytes would make an unmeasurable bundle look like a very small one.',
    );
  }
  return gzipSync(readFileSync(file), { level: 9 }).length;
}

const initial = parseInitialAssets(readFileSync(indexPath, 'utf8'));
const membership = bucketAssets(initial);

/** Every URL the buckets reference, de-duplicated: a file preloaded twice is fetched once. */
const gatedUrls = [...new Set(Object.values(membership).flat())];
const sizes = Object.fromEntries(gatedUrls.map((url) => [url, gzippedSize(url)]));

/* ------------------------------------------------------------------ the ungated extras */

/** Every file under `dir`, as absolute paths, recursively. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/** Absolute path -> the root-relative URL it is served at, for readable output. */
const toUrl = (file) => `/${path.relative(buildDir, file).split(path.sep).join('/')}`;

const gatedFiles = new Set(gatedUrls.map(resolveAsset));

/*
 * Script and stylesheet files the built HTML does not reference. By construction those are
 * lazily loaded chunks: not on the first-paint path, so not gated, but reported — unbounded
 * growth behind a dynamic import is still growth, and nothing else in the toolchain says so
 * now that Vite's own size report is off.
 */
const unreferenced = walk(buildDir)
  .filter((f) => /\.(js|css)$/.test(f) && !gatedFiles.has(f))
  .map((f) => ({ url: toUrl(f), bytes: gzipSync(readFileSync(f), { level: 9 }).length }))
  .sort((a, b) => b.bytes - a.bytes);

/*
 * Preloaded fonts. A genuine first-paint cost, deliberately not gated: `woff2` is already
 * compressed, the set is fixed by §10 #17 rather than by code, and a budget on it could only
 * ever fire when someone deliberately added a face — which is a decision, not a regression.
 * Reported so the number is visible instead of forgotten.
 */
const fonts = initial.fontPreloads
  .map((url) => {
    const file = resolveAsset(url);
    return existsSync(file) ? { url, bytes: statSync(file).size } : null;
  })
  .filter((f) => f !== null);

/* ------------------------------------------------------------------ report */

let result;
try {
  result = evaluate(membership, sizes);
} catch (error) {
  // `evaluate` throws only for an unmeasured asset, which `gzippedSize` already turns into an
  // exit-2. Reaching here means the two disagree about which URLs are in play, so report it as
  // an input error rather than letting a stack trace out.
  inputError(`Budget gate could not evaluate the build: ${error.message}`);
}

console.log(formatReport(result, { unreferenced, fonts }));
process.exit(exitCodeFor(result));
