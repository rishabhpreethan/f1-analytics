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
    files: ['server/**/*.ts', 'vite.config.ts'],
    languageOptions: {
      globals: globals.node,
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
