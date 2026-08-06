import { useParams } from 'react-router';
import { RoutePlaceholder } from '@/components/ui/RoutePlaceholder';

/**
 * `/seasons` and `/seasons/:year` — one surface, two entry points (`ARCHITECTURE.md` §5).
 *
 * Bare `/seasons` cannot name a year without asking the server, and a placeholder fetches
 * nothing, so it says "Current season" rather than guessing. F2 resolves the default year
 * from `/api/meta`. **`/seasons` is the canonical URL for "current"** — there is no redirect
 * to `/seasons/2026` and none from `/` (§10 #23).
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
