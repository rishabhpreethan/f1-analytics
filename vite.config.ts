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
  },
});
