import { DriverIndexPage } from '@/features/driver/DriverIndexPage';
import { useDriverIndex, useRetryEntityIndex } from '@/features/entity/useEntityIndex';

/**
 * `/drivers` — the front door to all 881 driver profiles.
 *
 * **This is the feature boundary, so this is the only thing here that fetches**
 * (ARCHITECTURE.md §3). One hook in, plain values out, and `DriverIndexPage` is a pure
 * function of a payload that can be tested against a fixture with no network and no router.
 *
 * There is no parameter, so — unlike `DriverProfile` — there is no invalid-reference state
 * and no 404: this route either has the directory or it has an error.
 */
export function DriverIndex() {
  const drivers = useDriverIndex();
  const retry = useRetryEntityIndex('driver');

  return (
    <DriverIndexPage
      data={drivers.data ?? null}
      pending={drivers.data === undefined && drivers.error === null}
      error={drivers.error === null ? null : { code: drivers.error.code }}
      onRetry={retry}
    />
  );
}
