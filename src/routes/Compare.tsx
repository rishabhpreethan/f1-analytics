import { ComparePage } from '@/features/compare/ComparePage';
import { COMPARE_FIXTURE } from '@/features/compare/fixture';

/**
 * `/compare` — F7, the comparison workspace. `DESIGN_SYSTEM.md` §6.6.6.
 *
 * ⚠ **Rendering a fixture, deliberately and temporarily.** `GET /api/compare` does not exist yet:
 * this surface was designed and built in parallel with its endpoint so that the payload was
 * specified by the surface that needs it, rather than discovered after a schema had already
 * foreclosed the design — which is what happened to the entity indexes (§6.6.5).
 *
 * **Every figure in the fixture is queried from `data/f1.db`.** Nothing is invented. When the
 * endpoint lands this file becomes the usual three lines — a hook in, a payload out — and nothing
 * in `src/features/compare/**` changes, because `ComparePage` is a pure function of `CompareData`.
 *
 * The query-parameter contract (`?kind=…&e=…`, `ARCHITECTURE.md` §5) is the endpoint's to define
 * and is deliberately not read here yet.
 */
export function Compare() {
  return (
    <ComparePage
      available={COMPARE_FIXTURE.entities.map((entity) => entity.identity)}
      data={COMPARE_FIXTURE}
    />
  );
}
