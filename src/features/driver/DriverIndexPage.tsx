import { useMemo } from 'react';
import type { DriverList } from '@schemas/directory';
import { EntityIndex } from '@/components/entity/EntityIndex';
import {
  DRIVER_COLUMNS,
  DRIVER_SORTS,
  driverItems,
  indexFacts,
  racelessCount,
} from '@/components/entity/indexPresenters';
import { DataUnavailableState } from '@/components/ui/DataUnavailableState';
import { Info } from '@/components/ui/icons';

/**
 * **`/drivers`** — the driver index. `DESIGN_SYSTEM.md` §6.6.4.
 *
 * A pure function of a payload and two error states, exactly as `DriverPage` is, so the route
 * component above it does the fetching and this does the rendering.
 *
 * It is thin on purpose: the surface is `EntityIndex`, shared with `/teams` and `/circuits`, and
 * everything this file adds is a column set, a sort set, a noun and one notice. Three indexes that
 * each owned their own list would be three products, which is the failure §6.6.2 names.
 */

export interface DriverIndexPageProps {
  data: DriverList | null;
  pending: boolean;
  /** `null` when the request succeeded. */
  error: { code: string } | null;
  onRetry: () => void;
}

export function DriverIndexPage({ data, pending, error, onRetry }: DriverIndexPageProps) {
  const items = useMemo(() => (data === null ? null : driverItems(data.drivers)), [data]);

  if (error?.code === 'DATABASE_UNAVAILABLE') {
    return (
      <div className="shell-container entity-index px-4 md:px-6 xl:px-8">
        <DataUnavailableState />
      </div>
    );
  }

  const raceless = items === null ? 0 : racelessCount(items);

  return (
    <EntityIndex
      title="Drivers"
      eyebrow="The archive"
      facts={items === null ? [] : indexFacts(items, 'drivers')}
      kind="driver"
      noun="drivers"
      nounSingular="driver"
      items={items}
      columns={DRIVER_COLUMNS}
      sorts={DRIVER_SORTS}
      notice={
        raceless === 0 || items === null ? undefined : (
          <p className="index-notice">
            <Info size={16} />
            <span>
              <b>{`${String(raceless)} of the ${String(items.length)} drivers in the record never started a Grand Prix.`}</b>{' '}
              Some entered a Grand Prix and never qualified; others appear only in a Friday practice
              session. They are listed here and marked, rather than quietly left out.
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
