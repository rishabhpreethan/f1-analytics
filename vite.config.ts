import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Aliases are kept in sync with `tsconfig.*.json` by hand — no extra plugin
 * (Technical Spec §3.1). Regex `find` patterns rather than bare `'@'`, so a scoped
 * package such as `@tanstack/react-query` is never rewritten.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: [
      { find: /^@\//, replacement: `${root}/src/` },
      { find: /^@server\//, replacement: `${root}/server/` },
      { find: /^@schemas\//, replacement: `${root}/server/schemas/` },
    ],
  },

  server: {
    port: 5173,
    // One origin in development, as in production: the browser only ever talks to
    // this server, and same-origin holds either way.
    proxy: {
      '/api': { target: 'http://localhost:8787' },
    },
  },

  build: {
    outDir: 'dist',
  },

  test: {
    // Node by default; the few DOM tests opt in with a `@vitest-environment jsdom`
    // docblock, which keeps the fast path fast.
    environment: 'node',
    include: ['{src,server}/**/*.test.{ts,tsx}', '*.test.ts', 'scripts/**/*.test.mjs'],

    /*
     * `default` prints the pass/fail summary; the second reporter prints what the run did
     * **not** test. Order matters — reporters are invoked in registration order, so the
     * skip report lands after the summary, where the reader is already looking.
     */
    reporters: ['default', './vitest.reporter.ts'],

    /*
     * ------------------------------------------------------------------- timing, and CI
     *
     * The suite has been flaky twice, from two unrelated causes, and only one of them was
     * a timing problem:
     *
     *  1. A real 1 s TanStack Query retry backoff inside a 5 s test. **Fixed at the source**
     *     — `Landing.test.tsx` and `RootLayout.test.tsx` pass `retryDelay: 0`, so the retry
     *     still happens and the sleep does not. Nothing here addresses that; it is not a
     *     timeout problem and must not be re-fixed as one.
     *  2. jsdom mount cost under CPU contention exceeding the 5 s default.
     *
     * A GitHub-hosted Linux runner is slower per core than this machine and runs the same
     * files in parallel, so cause 2 is strictly more likely there than here. The slowest
     * single test measured locally is 717 ms (`RootLayout > distinguishes a rate limit`, a
     * jsdom mount plus two query retries). 15 s is ~21× that.
     *
     * **Why raising the timeout hides nothing:** no test in this suite asserts elapsed
     * wall-clock time. The only two time-sensitive suites — `server/cache/memo.test.ts` and
     * `server/middleware/rateLimit.test.ts` — drive `vi.useFakeTimers()`, and the motion
     * tests assert duration *token values*, not durations. So a larger budget cannot turn a
     * slow implementation green; it only removes a false negative. A genuine hang (an
     * unresolved `waitFor`) still fails, 15 s later instead of 5 s.
     *
     * **Retries stay at 0** — vitest's default, set explicitly so nobody "fixes" a future
     * flake by turning a real intermittent defect into a green run.
     *
     * **Worker count is left at vitest's default**, which already derives from
     * `availableParallelism()` and so adapts to the runner. Capping `maxWorkers` to cut
     * contention was considered and rejected: it would make CI slower to address a problem
     * the timeout budget already absorbs, and there is no measurement *from the runner* to
     * justify a specific cap. If CI does prove flaky, `maxWorkers` is the next lever —
     * recorded here rather than applied pre-emptively.
     */
    testTimeout: 15_000,
    hookTimeout: 15_000,
    retry: 0,

    // Runs before the first import of every test file, in that file's environment. It
    // exists for exactly one reason — see the file.
    setupFiles: ['./vitest.setup.ts'],

    /*
     * Vitest replaces every CSS import with an empty string by default, and it does so
     * even for an explicit `?raw` request. Four stylesheets are asserted *on their text* —
     * CT-3 (JS and CSS durations cannot drift), CT-9 (nothing but transform, opacity and
     * `offset-distance` is animated in the backdrop), CT-10 (the reduced-motion chokepoint
     * exists) and the accent rules of §3.6 / §5.2a (no raw ramp step consumed, no literal
     * z-index, an achromatic focus ring) — so those four, and only those four, are exempted.
     *
     * `index.css` was previously excluded on the grounds that processing it runs the whole
     * Tailwind pipeline for no assertion. There is now an assertion, and it is one nothing
     * else in the pipeline can make: with no visual gate (CR-006), a component reaching for
     * a raw `--signal-*` step or hard-coding a z-index would otherwise reach review unseen.
     */
    css: { include: [/tokens\.css/, /motion\.css/, /backdrop\.css/, /index\.css/] },
  },
});
