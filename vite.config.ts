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
    include: ['{src,server}/**/*.test.{ts,tsx}'],

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
