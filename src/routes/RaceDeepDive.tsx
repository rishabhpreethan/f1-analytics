import { useParams } from 'react-router';
import { RoutePlaceholder } from '@/components/ui/RoutePlaceholder';

/** `/seasons/:year/races/:round`. */
export function RaceDeepDive() {
  const { year, round } = useParams();

  return (
    <RoutePlaceholder
      eyebrow="Race deep dive"
      title={round === undefined ? 'Race' : `Round ${round}`}
      ships="F3"
      params={[
        { name: 'year', value: year },
        { name: 'round', value: round },
      ]}
    />
  );
}
