import { useParams } from 'react-router';
import { RoutePlaceholder } from '@/components/ui/RoutePlaceholder';

/** `/circuits/:circuitRef` — a `circuit.reference` slug, never an internal id (DL-3). */
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
