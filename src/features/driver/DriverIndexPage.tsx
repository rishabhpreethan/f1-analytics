import { useMemo } from 'react';
import type { DriverList } from '@schemas/directory';
import { EntityIndex } from '@/components/entity/EntityIndex';
import { driverIndexModel } from '@/components/entity/indexPresenters';
import { DataUnavailableState } from '@/components/ui/DataUnavailableState';

/**
 * **`/drivers`** — the driver index. `DESIGN_SYSTEM.md` §6.6.4, §6.6.5.
 *
 * A pure function of a payload and two error states, exactly as `DriverPage` is, so the route
 * component above it does the fetching and this does the rendering.
 *
 * It is thin on purpose: the surface is `EntityIndex`, shared with `/teams` and `/circuits`, and
 * everything that differs between the three is built by one presenter call. Three indexes that
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
  const model = useMemo(() => (data === null ? null : driverIndexModel(data.drivers)), [data]);

  if (error?.code === 'DATABASE_UNAVAILABLE') {
    return (
      <div className="shell-container entity-index px-4 md:px-6 xl:px-8">
        <DataUnavailableState />
      </div>
    );
  }

  return (
    <EntityIndex
      title="Drivers"
      eyebrow="The archive"
      facts={model?.facts ?? []}
      kind="driver"
      noun="drivers"
      nounSingular="driver"
      items={model?.items ?? null}
      columns={model?.columns ?? FALLBACK_COLUMNS}
      sorts={model?.lenses ?? FALLBACK_LENSES}
      strata={model?.strata ?? []}
      board={model?.board ?? FALLBACK_BOARD}
      aside={model?.aside ?? null}
      latest={model?.latest ?? null}
      pending={pending}
      error={error}
      onRetry={onRetry}
    />
  );
}

/*
 * The skeleton has to know how many figure columns to draw, and the console has to have a lens
 * pressed, **before** the payload exists. These are the loading-state shapes, not a second source
 * of truth: they carry no counts and no copy, and they are replaced whole the moment `model` is
 * non-null.
 */
const FALLBACK_COLUMNS = [
  { key: 'races', label: 'Starts', priority: 1 },
  { key: 'wins', label: 'Wins', priority: 2 },
  { key: 'podiums', label: 'Podiums', priority: 3 },
  { key: 'debut', label: 'Debut', priority: 4 },
] as const;

const FALLBACK_LENSES = [
  { id: 'tier', label: 'Achievement', figure: 1, by: 'tier', group: 'tier' },
  { id: 'era', label: 'Era', figure: 3, by: 'debut', group: 'decade' },
  { id: 'career', label: 'Career', figure: 0, by: 'band', group: 'band' },
  { id: 'az', label: 'A–Z', figure: null, by: 'name', group: 'letter' },
] as const;

const FALLBACK_BOARD = {
  strataHeading: 'How far they got',
  strataCaption: '',
  eraHeading: 'The field, by decade',
  eraCaption: '',
};
