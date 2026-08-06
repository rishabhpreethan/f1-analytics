/*
 * Performance-budget gate — the pure half.
 *
 * Implements `docs/ARCHITECTURE.md` §8. Everything here is a pure function of its
 * arguments: no `fs`, no `zlib`, no `process`. The reason is not purity for its own sake —
 * it is that the two things most likely to be wrong in a budget gate are (a) which files
 * count as "initial" and (b) the arithmetic, and both are unit-testable only if they are
 * separated from reading a directory. `scripts/check-budget.mjs` is the shell that does the
 * I/O and calls into this file.
 *
 * ------------------------------------------------------------------ what "initial" means
 *
 * The budget is on the **first-paint payload**, not on `dist/` as a whole. §8 plans
 * route-level code splitting, so the moment a lazy chunk exists, "sum every .js in dist"
 * over-counts and the gate starts failing for a reason that is not a regression. A gate
 * that fails wrongly gets switched off, so the definition has to be right before the
 * splitting lands rather than after.
 *
 * The definition used here is the one the browser itself uses: **whatever the built
 * `dist/index.html` tells it to fetch before it can paint.** That is
 *
 *   - a classic `<script src>` in `<head>` with no `defer`/`async` — parser-blocking;
 *   - the `<script type="module" src>` entry, plus every `<link rel="modulepreload">`,
 *     which is exactly Vite's declaration of the entry's static import graph;
 *   - every `<link rel="stylesheet">` — render-blocking by specification.
 *
 * Nothing is maintained by hand, so the gate cannot drift out of step with what the
 * bundler emits. A JS file in `dist/` that `index.html` does not reference is a lazy chunk
 * by construction; it is reported, deliberately not gated (see `formatReport`).
 */

/* ------------------------------------------------------------------ units
 *
 * **KB here is 1000 bytes, not 1024.** Stated because it is worth 6 KB of budget at this
 * scale, and because every figure this project already quotes — Vite's build output, Chrome
 * DevTools, the CSS sizes in `DESIGN_SYSTEM.md`'s changelog — is decimal. Mixing the two
 * conventions is how a budget quietly gains or loses 2.4%.
 */
export const BYTES_PER_KB = 1000;

/** `1234` -> `'1.23 KB'`. One place, so every figure the gate prints is formatted alike. */
export function formatKB(bytes) {
  return `${(bytes / BYTES_PER_KB).toFixed(2)} KB`;
}

/* ==================================================================== the budgets
 *
 * ---------------------------------------------------------------- how to change a number
 *
 * Each bucket carries a `max` (what the gate enforces) and a `ceiling` (the largest value
 * the recorded basis can justify). Raising `max` up to `ceiling` is a local decision: edit
 * it here, and add a line to `changes` saying who asked and why. Raising `max` **past**
 * `ceiling` is not — the basis no longer supports the number, so it needs a new
 * `ARCHITECTURE.md` §10 entry that supplies a different one.
 *
 * That split exists because the failure mode of a budget is not being exceeded; it is being
 * quietly raised until it stops constraining anything. This makes the quiet raise
 * impossible and the deliberate raise cheap.
 *
 * ---------------------------------------------------------------- the reference link
 *
 * Two of the derivations below price bytes in milliseconds, which needs a stated link.
 * **Reference link: 1.6 Mbit/s downlink = 200,000 bytes/s.** This is the throughput
 * commonly used for "slow 4G" in web-performance work. It is an *assumption of the
 * calculation*, not a measurement of anyone's connection: if it is wrong, every ceiling
 * derived from it moves in proportion, and the arithmetic is written out here so that can be
 * re-derived rather than guessed at.
 */
export const REFERENCE_LINK_BYTES_PER_SEC = 200_000;

/** §8's FCP target for the season hub, in seconds. The budgets sit in front of this. */
export const FCP_TARGET_SECONDS = 1.5;

/**
 * The share of the FCP target a render-blocking resource may spend on transfer.
 *
 * Exported with the two constants above so `budget-core.test.mjs` can re-derive every
 * ceiling from them. A basis written only in a comment is a claim; a basis a test can
 * falsify is a constraint.
 */
export const BLOCKING_TRANSFER_SHARE_OF_FCP = 0.1;

/** The share of the initial-JS budget that styling may cost. Policy, not measurement. */
export const CSS_SHARE_OF_JS_BUDGET = 0.1;

export const BUCKETS = [
  {
    id: 'js-initial',
    label: 'Initial JS (module entry + modulepreload)',
    max: 250 * BYTES_PER_KB,
    ceiling: 250 * BYTES_PER_KB,
    warnAt: 0.85,
    basis: [
      'Inherited: this is §8\'s pre-existing "initial JS bundle (gzipped) < 250 KB" row, kept',
      'unchanged. Its basis is recorded here for the first time, and honestly: 250 KB is a',
      "conventional ceiling for initial JavaScript, **not** a derivation from §8's 1.5 s FCP",
      `row — at the reference link 250 KB alone is ${(
        (250 * BYTES_PER_KB) /
        REFERENCE_LINK_BYTES_PER_SEC
      ).toFixed(2)} s of transfer, which does not fit inside`,
      `${FCP_TARGET_SECONDS} s. The two rows are reconciled by route-level code splitting, which is`,
      'also why this gate measures the *initial* set rather than all of dist/. If the initial',
      'set ever approaches 250 KB, the honest fix is splitting, not a larger number.',
    ].join(' '),
    changes: [],
  },
  {
    id: 'css-blocking',
    label: 'Render-blocking CSS (<link rel=stylesheet>)',
    max: 25 * BYTES_PER_KB,
    ceiling: 25 * BYTES_PER_KB,
    warnAt: 0.8,
    basis: [
      'New. §8 carried no CSS budget at all before 2026-08-07, and the 10 KB figure the',
      'designer was being held to was a remembered number with no basis and 0.15 KB of room',
      'left. Set from two independent derivations that land close together:',
      '(A) **Proportion.** Styling is a support layer, not the product; if it costs more than a',
      'tenth of the shipped application it has stopped being one. 10% of the 250 KB initial-JS',
      'budget = 25 KB. The 10% ratio is a chosen policy, not a measurement — what makes it',
      'defensible is that (B) agrees with it independently.',
      '(B) **Render-blocking transfer time.** A stylesheet blocks first paint, so it sits',
      `directly in front of the ${FCP_TARGET_SECONDS} s FCP target. Allot it at most 10% of that target in`,
      `transfer time on the reference link: 0.15 s x ${REFERENCE_LINK_BYTES_PER_SEC} B/s = 30 KB.`,
      'The tighter of the two is taken, so the enforced number is 25 KB.',
    ].join(' '),
    changes: [
      // Append here when the number moves. Keep it one line per change.
      '2026-08-07 — set to 25 KB (was: an unwritten, unenforced 10 KB).',
    ],
  },
  {
    id: 'js-blocking',
    label: 'Parser-blocking classic <script src> in <head>',
    max: 2 * BYTES_PER_KB,
    ceiling: 2 * BYTES_PER_KB,
    warnAt: 0.75,
    basis: [
      'New, and separate from js-initial on purpose: a synchronous script in <head> delays',
      'paint by its whole fetch + parse + execute, where a module chunk is deferred by',
      'specification. A byte here is worth more than a byte there, so lumping them into one',
      '250 KB bucket would hide the growth that actually matters. Today this bucket holds one',
      'file, `public/theme-init.js`, which exists to set one attribute before first paint',
      '(DESIGN_SYSTEM.md §10) and has no reason ever to approach 2 KB. The cap is deliberately',
      'close to the current figure: this is the one bucket where growth is the signal.',
    ].join(' '),
    changes: [],
  },
];

/* ==================================================================== HTML parsing */

/**
 * Remove `<!-- ... -->` blocks.
 *
 * Not optional. The authored `index.html` has comments that discuss `type="module"`,
 * `defer` and `async` in prose, so any regex run over the raw document is reading
 * documentation as markup. Comments are stripped first and the tag scan never sees them.
 */
export function stripHtmlComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

/** Pull `name="value"`, `name='value'` and bare `name` out of one tag's attribute text. */
function parseAttrs(attrText) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(attrText)) !== null) {
    // A valueless attribute (`defer`, `crossorigin`) becomes '' — present, no value.
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

/** Every `<script …>` and `<link …>` open tag, in document order, comments already gone. */
function scanTags(html) {
  const out = [];
  const re = /<(script|link)(\s[^>]*)?>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push({ name: m[1].toLowerCase(), attrs: parseAttrs(m[2] ?? '') });
  }
  return out;
}

/**
 * Classify what the built `index.html` asks the browser to fetch before it can paint.
 *
 * Returns URL strings exactly as written in the document; resolving them to files is the
 * caller's job, because that is I/O.
 */
export function parseInitialAssets(html) {
  const result = {
    blockingScripts: [],
    moduleScripts: [],
    modulePreloads: [],
    stylesheets: [],
    fontPreloads: [],
  };

  for (const { name, attrs } of scanTags(stripHtmlComments(html))) {
    if (name === 'script') {
      const src = attrs.src;
      if (!src) continue; // inline script: no bytes to fetch, and §7.4 forbids one anyway
      // `type` and `rel` are compared ASCII-case-insensitively by the HTML specification, so
      // the gate must be too — otherwise `type="Module"` would silently stop counting.
      if ((attrs.type ?? '').toLowerCase() === 'module') {
        result.moduleScripts.push(src);
      } else if ('defer' in attrs || 'async' in attrs) {
        // Not parser-blocking, and not part of the module graph either. Nothing emits one
        // today; if something does, it belongs in a bucket chosen deliberately rather than
        // silently absorbed into one of these.
        continue;
      } else {
        result.blockingScripts.push(src);
      }
      continue;
    }

    // <link>. `rel` can carry a space-separated list.
    const rels = (attrs.rel ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const href = attrs.href;
    if (!href) continue;
    if (rels.includes('stylesheet')) result.stylesheets.push(href);
    else if (rels.includes('modulepreload')) result.modulePreloads.push(href);
    else if (rels.includes('preload') && (attrs.as ?? '').toLowerCase() === 'font')
      result.fontPreloads.push(href);
  }

  return result;
}

/* ==================================================================== evaluation */

/**
 * Map the parsed initial assets onto the budget buckets.
 *
 * `initial` is `parseInitialAssets`'s output. Returns, per bucket id, the list of asset
 * URLs that count against it.
 */
export function bucketAssets(initial) {
  return {
    'js-initial': [...initial.moduleScripts, ...initial.modulePreloads],
    'css-blocking': [...initial.stylesheets],
    'js-blocking': [...initial.blockingScripts],
  };
}

/**
 * Compare measured sizes against the budgets.
 *
 * @param membership `bucketAssets` output — bucket id -> asset URLs.
 * @param sizes      asset URL -> gzipped byte count. Every URL in `membership` must be
 *                   present; a missing one is thrown rather than treated as zero, because
 *                   silently scoring an unreadable asset as 0 bytes is how a gate passes
 *                   while measuring nothing.
 * @param buckets    defaults to `BUCKETS`; injectable so the tests do not depend on the
 *                   live numbers.
 */
export function evaluate(membership, sizes, buckets = BUCKETS) {
  const rows = buckets.map((bucket) => {
    const assets = (membership[bucket.id] ?? []).map((url) => {
      const bytes = sizes[url];
      if (typeof bytes !== 'number' || !Number.isFinite(bytes)) {
        throw new Error(
          `No measured size for "${url}" (bucket ${bucket.id}). It is referenced by the ` +
            `built index.html but was not measured — the build output is incomplete, or the ` +
            `asset URL does not resolve to a file under the build directory.`,
        );
      }
      return { url, bytes };
    });

    const total = assets.reduce((sum, a) => sum + a.bytes, 0);
    const fraction = total / bucket.max;
    const status = total > bucket.max ? 'FAIL' : fraction >= bucket.warnAt ? 'WARN' : 'PASS';

    return { bucket, assets, total, fraction, status };
  });

  return { rows, ok: rows.every((r) => r.status !== 'FAIL') };
}

/** 0 when nothing exceeded its budget, 1 when something did. WARN never fails the gate. */
export function exitCodeFor(result) {
  return result.ok ? 0 : 1;
}

/* ==================================================================== reporting */

const BAR_WIDTH = 24;

/** `████████░░░░` — a fixed-width fill bar, capped so an over-budget row cannot overflow. */
function bar(fraction) {
  const filled = Math.min(BAR_WIDTH, Math.max(0, Math.round(fraction * BAR_WIDTH)));
  return '#'.repeat(filled) + '.'.repeat(BAR_WIDTH - filled);
}

/**
 * The human-readable gate output.
 *
 * `extras` carries the things that are reported but **not** gated, each for a reason:
 *   - `unreferenced` — JS/CSS in the build directory that `index.html` does not reference,
 *     i.e. lazily loaded chunks. Not gated because they are not on the first-paint path;
 *     reported because unbounded growth there is still worth seeing.
 *   - `fonts` — preloaded font files. A real first-paint cost, but a fixed asset set that
 *     does not move with code changes, so a budget on it would only ever fire when someone
 *     deliberately added a face.
 */
export function formatReport(result, extras = {}) {
  const lines = [];
  lines.push('Performance budget — ARCHITECTURE.md §8');
  lines.push('Sizes are gzipped bytes; KB = 1000 bytes.');
  lines.push('');

  for (const row of result.rows) {
    const { bucket, assets, total, fraction, status } = row;
    lines.push(
      `${status.padEnd(4)} ${bucket.label}` +
        (bucket.max !== bucket.ceiling
          ? ` — budget ${formatKB(bucket.max)} of a ${formatKB(bucket.ceiling)} derived ceiling`
          : ''),
    );
    lines.push(
      `     [${bar(fraction)}] ${formatKB(total)} / ${formatKB(bucket.max)}` +
        `  (${(fraction * 100).toFixed(1)}%)`,
    );
    for (const asset of assets) {
      lines.push(`       ${formatKB(asset.bytes).padStart(10)}  ${asset.url}`);
    }
    if (assets.length === 0) lines.push('       (no assets matched this bucket)');
    lines.push('');
  }

  const unreferenced = extras.unreferenced ?? [];
  if (unreferenced.length > 0) {
    const total = unreferenced.reduce((s, a) => s + a.bytes, 0);
    lines.push(`Not gated — lazily loaded chunks, ${formatKB(total)} total:`);
    for (const a of unreferenced) lines.push(`       ${formatKB(a.bytes).padStart(10)}  ${a.url}`);
    lines.push('');
  }

  const fonts = extras.fonts ?? [];
  if (fonts.length > 0) {
    const total = fonts.reduce((s, a) => s + a.bytes, 0);
    lines.push(`Not gated — preloaded fonts, ${formatKB(total)} total (already compressed):`);
    for (const a of fonts) lines.push(`       ${formatKB(a.bytes).padStart(10)}  ${a.url}`);
    lines.push('');
  }

  const failed = result.rows.filter((r) => r.status === 'FAIL');
  const warned = result.rows.filter((r) => r.status === 'WARN');

  for (const row of warned) {
    lines.push(
      `WARN: ${row.bucket.id} is at ${(row.fraction * 100).toFixed(1)}% of its budget ` +
        `(warns from ${(row.bucket.warnAt * 100).toFixed(0)}%). Not a failure.`,
    );
  }

  if (failed.length === 0) {
    lines.push('Every gated bucket is inside its budget.');
  } else {
    for (const row of failed) {
      lines.push(
        `FAIL: ${row.bucket.id} is ${formatKB(row.total - row.bucket.max)} over its ` +
          `${formatKB(row.bucket.max)} budget.`,
      );
      lines.push(`      Basis for that number: ${row.bucket.basis}`);
      if (row.bucket.max < row.bucket.ceiling) {
        lines.push(
          `      The recorded basis supports up to ${formatKB(row.bucket.ceiling)}. Raising ` +
            `\`max\` toward that in scripts/budget-core.mjs is a local decision — add a line ` +
            `to \`changes\` saying who asked and why.`,
        );
      } else {
        lines.push(
          `      \`max\` is already at the ceiling the recorded basis supports, so raising it ` +
            `needs a new ARCHITECTURE.md §10 entry with a different basis — not an edit here.`,
        );
      }
    }
    lines.push('');
    // Named rather than left to be discovered. The gate runs at the end of `npm run build`,
    // so without a stated way past it the first person who needs a build while over budget
    // will delete the gate instead of using the hatch.
    lines.push('The gate runs at the end of `npm run build`. To build without it:');
    lines.push('  npm run build:unchecked');
  }

  return lines.join('\n');
}
