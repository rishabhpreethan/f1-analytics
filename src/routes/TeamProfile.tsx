import { useParams } from 'react-router';
import { RoutePlaceholder } from '@/components/ui/RoutePlaceholder';

/** `/teams/:teamRef` — a `team.reference` slug, never an internal id (DL-3). */
export function TeamProfile() {
  const { teamRef } = useParams();

  return (
    <RoutePlaceholder
      eyebrow="Team profile"
      title="Team"
      ships="F5"
      params={[{ name: 'teamRef', value: teamRef }]}
    />
  );
}
