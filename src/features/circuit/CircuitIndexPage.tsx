import { useMemo } from 'react';
import type { CircuitList } from '@schemas/directory';
import { CircuitAtlas } from '@/components/entity/CircuitAtlas';
import { EntityIndex } from '@/components/entity/EntityIndex';
import { circuitIndexModel } from '@/components/entity/indexPresenters';
import { DataUnavailableState } from '@/components/ui/DataUnavailableState';

/**
 * **`/circuits`** — the circuit index. `DESIGN_SYSTEM.md` §6.6.4, §6.6.5.
 *
 * **The page's shape is attrition.** 78 venues have held a Formula 1 Grand Prix and **53 of them are
 * no longer on the calendar** — the sport moves, and an alphabetical list of circuit names hides
 * that completely. So the ladder here is not achievement, which a venue cannot have; it is
 * **status**, and the longest bar on the page is the one labelled *No longer used*.
 *
 * **A circuit's "current" window is two seasons wide, and that is not a rounding.** The archive's
 * latest season is in progress — 10 of 22 rounds in 2026 — so a venue whose round falls later in
 * the calendar has no result this year yet. A one-season test would file **Monza, Spa, Baku and
 * eleven more** as retired. It is the same trap `selectEntityActivity` documents for drivers, one
 * step further out, and `indexPresenters.ts` states the rule beside the code that applies it.
 *
 * **No mark column and no identity bar**, and that is §6.6.2.1's existing ruling applied
 * consistently rather than a shortcut: a circuit has no identity colour and must not borrow one.
 * The name block takes the mark column's grid space for the whole list, so it is a per-list
 * decision and never a per-row hole.
 *
 * **`Grands Prix` and `Rounds` are two columns because they are two facts.** A round is *held* when
 * the calendar numbers it; it has *results* when classification rows exist. Monza reads 76 and 75 —
 * the 76th is 2026's, not yet run — and Madring reads 1 and 0, which is a venue **joining** the
 * calendar rather than a hole in the record. It gets its own rung on the ladder for that reason,
 * and it is never an aside: a new circuit is the opposite of clutter.
 */

export interface CircuitIndexPageProps {
  data: CircuitList | null;
  pending: boolean;
  error: { code: string } | null;
  onRetry: () => void;
}

export function CircuitIndexPage({ data, pending, error, onRetry }: CircuitIndexPageProps) {
  const model = useMemo(() => (data === null ? null : circuitIndexModel(data.circuits)), [data]);

  if (error?.code === 'DATABASE_UNAVAILABLE') {
    return (
      <div className="shell-container entity-index px-4 md:px-6 xl:px-8">
        <DataUnavailableState />
      </div>
    );
  }

  return (
    <EntityIndex
      title="Circuits"
      eyebrow="The archive"
      facts={model?.facts ?? []}
      kind="circuit"
      noun="circuits"
      nounSingular="circuit"
      items={model?.items ?? null}
      columns={model?.columns ?? FALLBACK_COLUMNS}
      sorts={model?.lenses ?? FALLBACK_LENSES}
      strata={model?.strata ?? []}
      board={model?.board ?? FALLBACK_BOARD}
      aside={model?.aside ?? null}
      /*
       * The map takes the board's second column here, and the decade chart is dropped. Venues per
       * decade runs 19 → 30 across the whole history — the flattest thing this page knows — while
       * *where* they are and *which are still used* is the story. The coordinates were published
       * for exactly this (`server/schemas/directory.ts`).
       */
      boardAside={
        data === null || model === null ? null : (
          <CircuitAtlas circuits={data.circuits} latest={model.latest} />
        )
      }
      latest={model?.latest ?? null}
      pending={pending}
      error={error}
      onRetry={onRetry}
    />
  );
}

/* The loading-state shapes. See the note in `DriverIndexPage`. */
const FALLBACK_COLUMNS = [
  { key: 'races', label: 'Grands Prix', priority: 1 },
  { key: 'first', label: 'First', priority: 2 },
  { key: 'latest', label: 'Latest', priority: 3 },
  { key: 'rounds', label: 'Rounds', priority: 4 },
] as const;

const FALLBACK_LENSES = [
  { id: 'tier', label: 'Status', figure: null, by: 'tier', group: 'tier' },
  { id: 'era', label: 'Era', figure: 1, by: 'debut', group: 'decade' },
  { id: 'career', label: 'Grands Prix', figure: 0, by: 'band', group: 'band' },
  { id: 'az', label: 'A–Z', figure: null, by: 'name', group: 'letter' },
] as const;

const FALLBACK_BOARD = {
  strataHeading: 'Where they stand',
  strataCaption: '',
  eraHeading: 'Venues, by decade',
  eraCaption: '',
};
