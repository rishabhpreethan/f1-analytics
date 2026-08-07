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
 * One emitter run costs ~1.7s — the ramp is an exact maximum-clique search — so the run is hoisted
 * and shared. The determinism test below deliberately pays for a *second* process, because two calls
 * inside one process would prove nothing about a search that could depend on ambient state.
 */
const emit = () =>
  execFileSync(process.execPath, ['scripts/validate-palette.mjs', 'tokens'], {
    cwd: REPO,
    encoding: 'utf8',
  });

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

  it('is deterministic — a second process returns the same twelve entries', () => {
    /*
     * The ramp is an exact maximum-clique followed by a greedy extension whose ties break on pool
     * order. If either ever became order-dependent on something ambient — a `Set` iteration, a
     * hash seed, a `Date` — the stylesheet would change under a regeneration nobody asked for, and
     * the drift test above would start failing for a reason unrelated to a hand edit.
     */
    expect(emit()).toBe(EMITTED);
  });
});
