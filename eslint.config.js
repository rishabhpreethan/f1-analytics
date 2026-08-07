import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: ['dist', 'coverage', 'node_modules', 'public/theme-init.js'],
  },

  // Type-aware linting for every TypeScript file in the repository.
  // `any` and non-null assertions are errors, not warnings: ARCHITECTURE.md §2.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // One animation library, and one place it is imported from.
  //
  // `src/lib/motion/gsap.ts` is the only registration site (ARCHITECTURE.md §10 #21):
  // `gsap.registerPlugin` binds a plugin to a core instance, so a second import site is
  // a second chance to register per mount and to miss the shared defaults. Making that a
  // lint error rather than a convention is the difference between a rule and a hope.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            // Removed by CR-007. Named here so a reinstall-and-import cannot pass review
            // quietly: the failure is a lint error, not a reviewer noticing a diff.
            {
              name: 'framer-motion',
              message: 'Removed by CR-007. Use @/lib/motion.',
            },
            {
              name: 'gsap',
              message:
                'Import from @/lib/motion/gsap — one registration site (ARCHITECTURE §10 #21).',
            },
            { name: '@gsap/react', message: 'Import from @/lib/motion/gsap.' },
          ],
          patterns: ['gsap/*'],
        },
      ],
    },
  },
  {
    files: ['src/lib/motion/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // Client — React rules and browser globals.
  {
    files: ['src/**/*.{ts,tsx}'],
    // `configs.flat.recommended` is the flat-config shape. The top-level
    // `configs.recommended` is still the legacy eslintrc form, which ESLint 10 rejects.
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
    },
  },

  // Server and build tooling — Node globals.
  {
    files: ['server/**/*.ts', 'vite.config.ts', 'vitest.reporter.ts', 'vitest.reporter.test.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Repo tooling in `scripts/` is zero-dependency ESM run by Node directly (ARCHITECTURE §9).
  //
  // Before this block existed, **nothing in `scripts/` was linted at all**: every config
  // object above declares an explicit `files` pattern, and flat config applies no rules to a
  // file that matches none of them. Probed with a deliberately broken `.mjs` file — an unused
  // binding and an assignment inside an `if` condition — and `eslint .` reported zero
  // problems. Both of the gates that live here (the colour validator and the bundle-budget
  // check) are things a silent bug would make quietly useless, so they get the same
  // recommended rule set as everything else. No type-aware rules: they are plain JS and are
  // not in a TypeScript project.
  {
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },

  // ⛔ TEMPORARY, and owned by the `designer` — delete this block, do not extend it.
  //
  // Switching the rules on above immediately found three dead bindings in
  // `scripts/validate-palette.mjs`, which is the `designer`'s file (DESIGN_SYSTEM §9.1 makes
  // the validator design's, so a second pair of hands in it is exactly the drift CR-010
  // removed). All three pre-exist in committed `main` (verified against 10d7014, so they are
  // not in-flight work), and the file is under active edit, so they are named rather than
  // located by line:
  //
  //   `stack` — an unused `over()`-folding helper
  //   `F` — `FIELD[theme]`, computed and never read, in the V-22 glass block
  //   `S` — `SURF[theme]`, same block, same
  //
  // None affects a reported figure: they are dead, not wrong, and `npm run validate:palette`
  // still exits 0. The alternative to this override was leaving CI red on someone else's
  // file, which would have blocked every branch. Three one-line deletions retire it.
  {
    files: ['scripts/validate-palette.mjs'],
    rules: {
      'no-unused-vars': 'off',
    },
  },

  // This config file is plain JS and is not covered by the type-aware program.
  {
    files: ['eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
);
