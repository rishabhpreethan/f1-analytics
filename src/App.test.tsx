import { describe, expect, it } from 'vitest';
import APP_SRC from './App.tsx?raw';
import ROOT_LAYOUT_SRC from './routes/RootLayout.tsx?raw';

/**
 * The code-splitting invariants (2026-08-23, `ARCHITECTURE.md` §8 / §10 #36).
 *
 * These are **source-text** assertions, and that is deliberate rather than lazy. What the
 * split actually guarantees is a property of the emitted bundle — "the chart kit and the
 * coastline constant are not in the chunk the browser fetches before first paint" — and no
 * test in this suite can see a bundle: vitest transforms modules, it does not run rolldown.
 * `npm run build`'s budget gate measures the real thing, and it is the authority.
 *
 * What a test *can* do is pin the one edit that silently undoes the split, which is a
 * **static** import of a lazy route module from anywhere the initial chunk can reach. That
 * edit typechecks, lints, and passes every other test in this file's neighbourhood; the only
 * symptom is a bigger number in a gate someone may not run. So it is checked here, where the
 * failure names the file.
 *
 * Measured at the split, gzipped, by `npm run check:budget`: initial JS **225.76 KB → 161.28
 * KB**, and the largest single route adds 34.04 KB on top of that — so even the worst first
 * navigation is smaller than the pre-split initial payload.
 *
 * `import.meta.glob` rather than `node:fs`, following the convention the other source-reading
 * tests in `src/` already use (`?raw`): this project's files belong to `tsconfig.app.json`,
 * which carries `vite/client` and not `@types/node`, so a filesystem walk here is 30 lint
 * errors and no more coverage.
 */

/**
 * Every non-test source file under `src/`, keyed by path. `eager` so the assertions stay
 * synchronous, and `?raw` because the subject is the import *statement*, not the module.
 */
const SOURCES = import.meta.glob<string>('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * The ten route modules that must only ever be reached through `import()`.
 *
 * `Landing`, `NotFound` and `RootLayout` are deliberately absent — they are eager, for the
 * reasons written in `App.tsx`, and a static import of those three is correct.
 */
const LAZY_ROUTES = [
  'SeasonHub',
  'RaceDeepDive',
  'DriverIndex',
  'DriverProfile',
  'TeamIndex',
  'TeamProfile',
  'CircuitIndex',
  'CircuitProfile',
  'Compare',
  'Records',
] as const;

const EAGER_ROUTES = ['Landing', 'NotFound', 'RootLayout'] as const;

describe('route-level code splitting', () => {
  it('reaches every lazy route only through import(), from App.tsx', () => {
    const files = Object.entries(SOURCES).filter(([file]) => !/\.test\.tsx?$/.test(file));
    // Guard against the assertion passing vacuously if the glob ever stops matching.
    expect(files.length).toBeGreaterThan(50);

    const offenders: string[] = [];
    for (const route of LAZY_ROUTES) {
      // `from '@/routes/X'` in an import **statement** — the form that welds the module into
      // whichever chunk the importer lands in. `import('@/routes/X')` is written with a
      // parenthesis, never `from`, so this pattern cannot match the dynamic form.
      const statik = new RegExp(String.raw`from\s*['"]@/routes/${route}['"]`);
      for (const [file, source] of files) {
        if (statik.test(source)) offenders.push(`${file} statically imports @/routes/${route}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('declares all ten lazy routes with lazy(() => import(...))', () => {
    for (const route of LAZY_ROUTES) {
      expect(APP_SRC).toMatch(new RegExp(String.raw`import\(\s*['"]@/routes/${route}['"]\s*\)`));
    }
  });

  it('keeps the shell, the landing page and the catch-all eager', () => {
    // The three that must be in the initial chunk: `/` is the entry point with no link,
    // `*` is what a dead URL renders, and the layout is on every URL there is.
    for (const route of EAGER_ROUTES) {
      expect(APP_SRC).toMatch(new RegExp(String.raw`from '@/routes/${route}'`));
      expect(APP_SRC).not.toMatch(
        new RegExp(String.raw`import\(\s*['"]@/routes/${route}['"]\s*\)`),
      );
    }
  });

  it('puts exactly one Suspense boundary in the shell, around the Outlet', () => {
    // Inside the shell, not around it: a boundary above `RootLayout` would blank the header,
    // dock and footer on a cold load of a lazy route.
    expect(ROOT_LAYOUT_SRC).toMatch(/<Suspense fallback=\{<RouteChunkPending \/>\}>\s*<Outlet \/>/);
    expect(ROOT_LAYOUT_SRC.match(/<Suspense/g)).toHaveLength(1);
    // The element, not the word — `App.tsx`'s comment discusses the boundary at length.
    expect(APP_SRC).not.toMatch(/<Suspense/);
  });
});
