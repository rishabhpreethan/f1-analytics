import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * **`src/styles/entity.css` is generated, and this is the test that keeps it that way.**
 *
 * It lives beside the emitter rather than beside the stylesheet, for a reason worth writing down:
 * it needs `node:child_process` and `node:fs`, and `src/**` is compiled by `tsconfig.app.json`,
 * which deliberately does not carry `@types/node`. Importing them there does not merely lint badly
 * — it would mean app code could reach for `fs` and typecheck. So the node-side assertion lives on
 * the node side, and `src/styles/entity.css.test.ts` asserts the stylesheet's *properties* with no
 * node imports at all.
 *
 * What this catches: a hand edit to a generated file. 144 hex values across two themes is well past
 * the point where transcription is reliable, and a mistyped hex is invisible — it still renders, it
 * is still roughly the right colour, and every figure recorded in `DESIGN_SYSTEM.md` §9.2.3 silently
 * stops describing what ships.
 */

const REPO = fileURLToPath(new URL('..', import.meta.url));

/**
 * One emitter run costs **4.6 s (`tokens`) / 4.9 s (`entity-data`)**, measured on an idle 8-core
 * machine 2026-08-08 — the ramp is an exact maximum-clique search. (The figure recorded here was
 * `~1.7s`; it predates `entity-data` and had gone stale by ~3×, which matters because the whole
 * budget argument below is built on it.) The run is therefore hoisted and shared. The determinism
 * tests deliberately pay for a *second* process each, because two calls inside one process would
 * prove nothing about a search that could depend on ambient state.
 *
 * **This file is the suite's slowest thing by an order of magnitude: four spawns, ~19 s of
 * CPU-bound work, serialised.** Two of those spawns happen at collection time and so sit outside
 * any test's budget; the two below sit inside one, and that is why they carry an explicit timeout.
 */
const run = (mode) =>
  execFileSync(process.execPath, ['scripts/validate-palette.mjs', mode], {
    cwd: REPO,
    encoding: 'utf8',
  });

/**
 * **The budget for a determinism test, and why raising one here is not the mistake it was in
 * `vitest.setup.ts` §3.**
 *
 * Measured 2026-08-08: with the full suite running in parallel on 8 cores, a single spawn of the
 * emitter took **20.1 s and 17.6 s** on two of three consecutive `npm test` runs, against the 15 s
 * `testTimeout` — so the suite failed 2 of 3 times, always on this one test. Idle, the same spawn
 * is 4.6 s; contention stretches it ~4×.
 *
 * The distinction from the flake in `vitest.setup.ts` §3 is the whole reason this is allowed to be
 * a timeout change. There, `testTimeout` was **not the binding constraint** — `asyncUtilTimeout`
 * was, at an unstated 1 s — so raising it fixed nothing and hid a mis-set inner cap. Here the
 * budget genuinely is the constraint, and the work underneath it is genuinely, measurably
 * CPU-bound: an exact maximum-clique search, run in a second process because the claim *is* "a
 * second process agrees". Neither the search nor the extra process is removable without weakening
 * what is being asserted.
 *
 * Scoped to these two tests rather than raised globally, deliberately: a global figure this large
 * would silently cover every other test in the repository, and nothing else here has earned it.
 *
 * **This hides nothing** — no assertion in this file is about elapsed time; both compare bytes. A
 * larger budget cannot make a wrong emitter agree with itself.
 *
 * **The alternative, not taken here.** Four spawns could become two if `validate-palette.mjs`
 * grew a mode emitting both artefacts in one process — the determinism claim would survive intact,
 * since it would still compare two distinct processes. That means editing the palette validator,
 * which is a shipping gate (`npm run validate:palette`), so it is recorded as a decision to take
 * rather than taken in passing.
 */
const SPAWN_TIMEOUT_MS = 60_000;

const emit = () => run('tokens');

const EMITTED = emit();

describe('src/styles/entity.css is generated, never authored', () => {
  it('is byte-identical to a fresh run of `validate-palette.mjs tokens`', () => {
    /*
     * If this fails, either someone typed into a generated file or the emitter changed. In both
     * cases the fix is to regenerate and re-read `npm run validate:palette` — never to update an
     * expected value here.
     *
     *   node scripts/validate-palette.mjs tokens > src/styles/entity.css
     */
    const committed = readFileSync(`${REPO}src/styles/entity.css`, 'utf8');
    expect(committed.trimEnd()).toBe(EMITTED.trimEnd());
  });

  it('emits a stylesheet that is already in the house format', () => {
    /*
     * The emitter has to agree with Prettier or `entity.css` cannot be both generated and
     * format-clean — which would leave `npm run format:check` permanently red or the file
     * permanently stale. The concrete rule this pins is hex case: Prettier lower-cases, so the
     * emitter lower-cases.
     */
    expect(EMITTED).not.toMatch(/#[0-9a-f]*[A-F][0-9a-fA-F]*\b/);
  });

  it(
    'is deterministic — a second process returns the same twelve entries',
    { timeout: SPAWN_TIMEOUT_MS },
    () => {
      /*
       * The ramp is an exact maximum-clique followed by a greedy extension whose ties break on pool
       * order. If either ever became order-dependent on something ambient — a `Set` iteration, a
       * hash seed, a `Date` — the stylesheet would change under a regeneration nobody asked for, and
       * the drift test above would start failing for a reason unrelated to a hand edit.
       */
      expect(emit()).toBe(EMITTED);
    },
  );
});

/**
 * **`src/lib/entityColorData.ts` is generated by the same validator, for the same reason.**
 *
 * It carries no colours — §3.3a.3 fixes the contract as entity → token *name* — but it does carry
 * the palette's structure: which tokens exist, and which 663 of 2016 pairs the palette never
 * promised to separate. Those are results of the ramp search and of CIEDE2000 across two themes
 * and two CVD models. Typing them by hand is not a thing a person can do correctly, and a wrong
 * bit is invisible: it withdraws a dash pattern from a pair that needed one, or adds one to a pair
 * that did not, and the chart still renders.
 */
describe('src/lib/entityColorData.ts is generated, never authored', () => {
  const EMITTED_DATA = run('entity-data');

  it('is byte-identical to a fresh run of `validate-palette.mjs entity-data`', () => {
    /*
     * If this fails, regenerate — never edit the expected value here:
     *
     *   node scripts/validate-palette.mjs entity-data > src/lib/entityColorData.ts
     */
    const committed = readFileSync(`${REPO}src/lib/entityColorData.ts`, 'utf8');
    expect(committed.trimEnd()).toBe(EMITTED_DATA.trimEnd());
  });

  it('leaks no colour into the client bundle', () => {
    /*
     * The contract, asserted at the boundary it could be broken at. A hex here would be a second
     * copy of the palette, free to drift from `entity.css`, and it would defeat the theme.
     */
    expect(EMITTED_DATA).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it(
    'is deterministic — a second process returns the same table',
    { timeout: SPAWN_TIMEOUT_MS },
    () => {
      expect(run('entity-data')).toBe(EMITTED_DATA);
    },
  );
});
