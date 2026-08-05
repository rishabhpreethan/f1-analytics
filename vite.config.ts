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

    /*
     * Vitest replaces every CSS import with an empty string by default, and it does so
     * even for an explicit `?raw` request. Three test files assert *on the stylesheet
     * text* — CT-3 (JS and CSS durations cannot drift), CT-9 (nothing but transform and
     * opacity is animated in the backdrop) and CT-10 (the reduced-motion chokepoint
     * exists) — so those three files, and only those three, are exempted. `index.css` is
     * deliberately not listed: processing it would run the whole Tailwind pipeline in
     * every test run for no assertion.
     */
    css: { include: [/tokens\.css/, /motion\.css/, /backdrop\.css/] },
  },
});
