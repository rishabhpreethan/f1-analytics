import { useMemo } from 'react';
import type { CircuitList } from '@schemas/directory';
import { EntityIndex } from '@/components/entity/EntityIndex';
import {
  CIRCUIT_COLUMNS,
  CIRCUIT_SORTS,
  circuitItems,
  indexFacts,
  racelessCount,
} from '@/components/entity/indexPresenters';
import { DataUnavailableState } from '@/components/ui/DataUnavailableState';
import { Info } from '@/components/ui/icons';

/**
 * **`/circuits`** — the circuit index. `DESIGN_SYSTEM.md` §6.6.4.
 *
 * **No mark column and no identity bar**, and that is §6.6.2.1's existing ruling applied
 * consistently rather than a shortcut: a circuit has no identity colour and must not borrow one.
 * The name block takes the mark column's grid space for the whole list, so it is a per-list
 * decision and never a per-row hole.
 *
 * **`Grands Prix` and `Rounds` are two columns because they are two facts.** A round is *held* when
 * the calendar numbers it; it has *results* when classification rows exist. Monza reads 76 and 75 —
 * the 76th is 2026's, not yet run — and Madring reads 1 and 0, which is a venue joining the
 * calendar rather than a hole in the record.
 */

export interface CircuitIndexPageProps {
  data: CircuitList | null;
  pending: boolean;
  error: { code: string } | null;
  onRetry: () => void;
}

export function CircuitIndexPage({ data, pending, error, onRetry }: CircuitIndexPageProps) {
  const items = useMemo(() => (data === null ? null : circuitItems(data.circuits)), [data]);

  if (error?.code === 'DATABASE_UNAVAILABLE') {
    return (
      <div className="shell-container entity-index px-4 md:px-6 xl:px-8">
        <DataUnavailableState />
      </div>
    );
  }

  const unraced = items === null ? 0 : racelessCount(items);

  return (
    <EntityIndex
      title="Circuits"
      eyebrow="The archive"
      facts={items === null ? [] : indexFacts(items, 'circuits')}
      kind="circuit"
      noun="circuits"
      nounSingular="circuit"
      items={items}
      columns={CIRCUIT_COLUMNS}
      sorts={CIRCUIT_SORTS}
      notice={
        unraced === 0 || items === null ? undefined : (
          <p className="index-notice">
            <Info size={16} />
            <span>
              <b>
                {unraced === 1
                  ? '1 of these circuits has a numbered round and no result yet.'
                  : `${String(unraced)} of these circuits have a numbered round and no result yet.`}
              </b>{' '}
              A venue joining the calendar is not a gap in the record — the race has not been run.
            </span>
          </p>
        )
      }
      pending={pending}
      error={error}
      onRetry={onRetry}
    />
  );
}
