import { useTeamIndex, useRetryEntityIndex } from '@/features/entity/useEntityIndex';
import { TeamIndexPage } from '@/features/team/TeamIndexPage';

/**
 * `/teams` — the front door to all 214 constructor profiles.
 *
 * The feature boundary, as `DriverIndex` is: one hook, plain values, no fetching below here
 * (ARCHITECTURE.md §3).
 */
export function TeamIndex() {
  const teams = useTeamIndex();
  const retry = useRetryEntityIndex('team');

  return (
    <TeamIndexPage
      data={teams.data ?? null}
      pending={teams.data === undefined && teams.error === null}
      error={teams.error === null ? null : { code: teams.error.code }}
      onRetry={retry}
    />
  );
}
