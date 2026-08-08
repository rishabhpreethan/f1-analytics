import { CircuitIndexPage } from '@/features/circuit/CircuitIndexPage';
import { useCircuitIndex, useRetryEntityIndex } from '@/features/entity/useEntityIndex';

/**
 * `/circuits` — the front door to all 78 circuit profiles.
 *
 * The feature boundary, as `DriverIndex` is: one hook, plain values, no fetching below here
 * (ARCHITECTURE.md §3).
 */
export function CircuitIndex() {
  const circuits = useCircuitIndex();
  const retry = useRetryEntityIndex('circuit');

  return (
    <CircuitIndexPage
      data={circuits.data ?? null}
      pending={circuits.data === undefined && circuits.error === null}
      error={circuits.error === null ? null : { code: circuits.error.code }}
      onRetry={retry}
    />
  );
}
