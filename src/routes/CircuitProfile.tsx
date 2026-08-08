import { useParams } from 'react-router';
import { RoutePlaceholder } from '@/components/ui/RoutePlaceholder';

/**
 * `/circuits/:circuitRef` — a `circuit.reference` slug, never an internal id (DL-3).
 *
 * **Still a placeholder, and the data layer behind it is not.** `GET /api/circuits/:reference`
 * ships with CI-1 … CI-3 — profile with coordinates, every race at the venue with its winners
 * and pole sitters, and the most successful drivers and teams — and `useCircuit` in
 * `src/features/entity/useEntity.ts` fetches it. What is missing is the **surface**
 * (`src/features/circuit/CircuitPage.tsx`), which is the `designer`'s.
 *
 * Wiring this route is then the same six lines as `DriverProfile`: `resolveEntityRef`,
 * `useCircuit`, `useRetryEntity`, and hand the payload down. Until then the endpoint is
 * reachable only directly, which is stated here rather than left to be discovered.
 */
export function CircuitProfile() {
  const { circuitRef } = useParams();

  return (
    <RoutePlaceholder
      eyebrow="Circuit profile"
      title="Circuit"
      ships="F6"
      params={[{ name: 'circuitRef', value: circuitRef }]}
    />
  );
}
