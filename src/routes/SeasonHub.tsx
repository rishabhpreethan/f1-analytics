import { useParams } from 'react-router';
import { RoutePlaceholder } from '@/components/ui/RoutePlaceholder';

/**
 * `/` and `/seasons/:year`. The bare `/` cannot name a year without asking the server,
 * and a placeholder fetches nothing, so it says "Current season" rather than guessing.
 * F2 resolves the default year from `/api/meta`.
 */
export function SeasonHub() {
  const { year } = useParams();

  return (
    <RoutePlaceholder
      eyebrow="Season hub"
      title={year === undefined ? 'Current season' : `${year} Season`}
      ships="F2"
      params={[{ name: 'year', value: year }]}
    />
  );
}
