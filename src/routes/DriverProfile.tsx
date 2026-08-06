import { useParams } from 'react-router';
import { RoutePlaceholder } from '@/components/ui/RoutePlaceholder';

/** `/drivers/:driverRef` — a `driver.reference` slug, never an internal id (DL-3). */
export function DriverProfile() {
  const { driverRef } = useParams();

  return (
    <RoutePlaceholder
      eyebrow="Driver profile"
      title="Driver"
      ships="F4"
      params={[{ name: 'driverRef', value: driverRef }]}
    />
  );
}
