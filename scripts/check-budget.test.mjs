/*
 * `scripts/check-budget.mjs` — exit codes and failure paths.
 *
 * These run the gate as a subprocess against synthetic build directories. The unit tests in
 * `budget-core.test.mjs` cover what counts and what the arithmetic says; this file covers the
 * only thing they cannot: **that the process actually exits non-zero.**
 *
 * That is worth its own file because the specific way a gate becomes useless is by passing
 * unconditionally, and this project has already been bitten by exactly that — `npx tsc
 * --noEmit` against a solution tsconfig compiled nothing and exited 0 while hiding 12 real
 * errors. A budget gate that cannot find `dist/`, or that scores a missing asset as 0 bytes,
 * fails in the same shape: green, silent, measuring nothing.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = path.join(repoRoot, 'scripts', 'check-budget.mjs');

/** Directories created by a test, torn down afterwards. */
const created = [];

afterEach(() => {
  while (created.length > 0) rmSync(created.pop(), { recursive: true, force: true });
});

/**
 * Build a fake `dist/`. `files` maps a root-relative URL to its contents; `html` is the
 * `index.html` body.
 */
function fakeBuild(html, files = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'f1-budget-'));
  created.push(dir);
  writeFileSync(path.join(dir, 'index.html'), html);
  for (const [url, contents] of Object.entries(files)) {
    const target = path.join(dir, url.replace(/^\//, ''));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
  return dir;
}

function run(dir) {
  const proc = spawnSync(process.execPath, [gate, dir], { encoding: 'utf8' });
  return { code: proc.status, stdout: proc.stdout, stderr: proc.stderr };
}

/**
 * Content that will not compress below `target` gzipped bytes. Random bytes are
 * incompressible, so the gzipped size is the raw size plus a small header — close enough, and
 * the tests only need "comfortably over" or "comfortably under".
 */
function incompressible(bytes) {
  const buf = Buffer.allocUnsafe(bytes);
  for (let i = 0; i < bytes; i += 1) buf[i] = (i * 2654435761) % 256;
  // A counter-based pattern is not random enough; xor in a second stride so deflate cannot
  // find a short period.
  for (let i = 0; i < bytes; i += 1) buf[i] ^= (i * 40503) >>> 8;
  return buf;
}

const MINIMAL_HTML = `<script type="module" src="/assets/app.js"></script>
<link rel="stylesheet" href="/assets/app.css">`;

describe('check-budget.mjs', () => {
  it('exits 0 and prints the table for a build inside its budgets', () => {
    const dir = fakeBuild(MINIMAL_HTML, {
      '/assets/app.js': 'const a = 1;\n'.repeat(100),
      '/assets/app.css': 'a{color:red}\n'.repeat(100),
    });
    const { code, stdout } = run(dir);
    expect(code).toBe(0);
    expect(stdout).toContain('Every gated bucket is inside its budget.');
    expect(stdout).toContain('/assets/app.js');
  });

  it('exits 1 when a bucket is over budget, and says which and by how much', () => {
    // 40 KB of incompressible CSS against a 25 KB budget.
    const dir = fakeBuild(MINIMAL_HTML, {
      '/assets/app.js': 'const a = 1;\n',
      '/assets/app.css': incompressible(40_000),
    });
    const { code, stdout } = run(dir);
    expect(code).toBe(1);
    expect(stdout).toContain('FAIL: css-blocking is');
    expect(stdout).toContain('over its 25.00 KB budget');
    expect(stdout).toContain('npm run build:unchecked');
  });

  it('exits 2 when there is no build to measure, rather than reporting 0 bytes', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'f1-budget-empty-'));
    created.push(dir);
    const { code, stderr, stdout } = run(dir);
    expect(code).toBe(2);
    expect(stderr).toContain('No build to measure');
    expect(stdout).not.toContain('inside its budget');
  });

  it('exits 2 when the HTML references an asset that is not there', () => {
    const dir = fakeBuild(MINIMAL_HTML, { '/assets/app.css': 'a{}' });
    const { code, stderr } = run(dir);
    expect(code).toBe(2);
    expect(stderr).toContain('does not exist');
    expect(stderr).toContain('scoring it as 0 bytes');
  });

  it('exits 2 on an off-origin asset URL rather than skipping it', () => {
    const dir = fakeBuild(`<script type="module" src="https://cdn.example.com/app.js"></script>`);
    const { code, stderr } = run(dir);
    expect(code).toBe(2);
    expect(stderr).toContain('not a root-relative path');
  });

  it('exits 2 on a path that escapes the build directory', () => {
    const dir = fakeBuild(`<link rel="stylesheet" href="/../outside.css">`);
    const { code, stderr } = run(dir);
    expect(code).toBe(2);
    expect(stderr).toContain('escapes');
  });

  it('reports an unreferenced chunk as not gated, and does not count it against a budget', () => {
    const dir = fakeBuild(MINIMAL_HTML, {
      '/assets/app.js': 'const a = 1;\n',
      '/assets/app.css': 'a{}',
      // 400 KB of lazy chunk: far past the 250 KB initial-JS budget, and must not fail it.
      '/assets/lazy-route.js': incompressible(400_000),
    });
    const { code, stdout } = run(dir);
    expect(code).toBe(0);
    expect(stdout).toContain('Not gated — lazily loaded chunks');
    expect(stdout).toContain('/assets/lazy-route.js');
  });

  it('leaks no absolute path or stack trace into the failure output', () => {
    // Not a response body, so S-6 does not strictly govern it — but the same reasoning does:
    // a gate is read by whoever is unblocking a red build, and a stack trace at that moment is
    // noise that hides the number they came for.
    const dir = fakeBuild(MINIMAL_HTML, {
      '/assets/app.js': 'const a = 1;\n',
      '/assets/app.css': incompressible(40_000),
    });
    const { stdout, stderr } = run(dir);
    expect(stdout + stderr).not.toContain('    at ');
    expect(stdout + stderr).not.toContain(repoRoot);
  });
});
