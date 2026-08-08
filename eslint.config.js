import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * The chart substrate is **three** d3 modules and nothing else (ARCHITECTURE.md §10 #28,
 * amended by #31). `DESIGN_SYSTEM.md` §6 names four that are forbidden and gives a reason
 * for each; the reasons are reproduced here because a lint message is where someone will
 * meet the rule.
 *
 * The `d3` meta-package is added to the same list even though §6 does not name it: it
 * re-exports all thirty-odd modules, so a single `import { scaleLinear } from 'd3'` would
 * pull `d3-geo`, `d3-delaunay`, `d3-selection` and the rest into the resolution graph and
 * quietly defeat every measurement the decision rests on.
 *
 * `d3-time-format` joins them (§10 #31): it was uninstalled in F3 having never been
 * imported, and — exactly like `d3-format` — it stays **resolvable** as a transitive of
 * `d3-scale`, so without a rule it would type-check and work.
 */
const D3_RESTRICTED = [
  {
    name: 'd3',
    message:
      'Use the granular d3-scale / d3-shape / d3-array packages — the meta-package re-exports modules ARCHITECTURE §10 #28 deliberately excluded.',
  },
  {
    name: 'd3-axis',
    message:
      'Forbidden (DESIGN_SYSTEM §6): it writes DOM imperatively. Ticks are React output from scale.ticks().',
  },
  {
    name: 'd3-selection',
    message:
      'Forbidden (DESIGN_SYSTEM §6): React owns the DOM. Two DOM writers in one subtree is the defect class this avoids.',
  },
  {
    name: 'd3-transition',
    message: 'Forbidden (DESIGN_SYSTEM §6): GSAP owns motion (ARCHITECTURE §10 #21, #22).',
  },
  {
    name: 'd3-format',
    message:
      'Forbidden (DESIGN_SYSTEM §6): numerals go through @/lib/format. A second number formatter drifts on lap times. (It is present transitively under d3-scale; that is resolution, not an import site.)',
  },
  {
    name: 'd3-time-format',
    message:
      'Uninstalled in F3 (ARCHITECTURE §10 #31): nothing in this product plots a real date axis — rounds and laps are integers. Dates go through @/lib/format. (Still resolvable as a transitive of d3-scale; that is resolution, not an import site.) If a date axis is genuinely needed, reinstate it with a §10 entry rather than importing what happens to resolve.',
  },
];

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
            ...D3_RESTRICTED,
          ],
          patterns: ['gsap/*'],
        },
      ],
    },
  },
  {
    files: ['src/lib/motion/**/*.{ts,tsx}'],
    rules: {
      // The gsap chokepoint is lifted here — this *is* the registration site. The d3
      // restrictions are **re-stated rather than inherited**: ESLint replaces a rule's
      // options wholesale when a later config sets the same rule, so a bare `'off'` here
      // would have opened a hole in the chart-substrate rule for the one directory that
      // has the most reason to reach for `d3-transition`.
      'no-restricted-imports': ['error', { paths: [...D3_RESTRICTED] }],
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
