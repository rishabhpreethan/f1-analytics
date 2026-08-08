import { useParams } from 'react-router';
import { StateCard } from '@/components/ui/StateCard';
import { Trophy } from '@/components/ui/icons';
import { useRetryEntity, useTeam } from '@/features/entity/useEntity';
import { TeamPage } from '@/features/team/TeamPage';
import { resolveEntityRef } from '@/lib/entityRef';

/**
 * `/teams/:teamRef` — a `team.reference` slug, never an internal id (DL-3, trap 11).
 *
 * The feature boundary: resolve the URL, call one hook, hand plain values to `TeamPage`.
 * Identical in shape to `DriverProfile` because the two endpoints are identical in shape —
 * one reference in, one payload out, no dependent request to gate.
 */
export function TeamProfile() {
  const { teamRef } = useParams();
  const ref = resolveEntityRef(teamRef);
  const reference = ref.status === 'resolved' ? ref.reference : null;

  const team = useTeam(reference);
  const retry = useRetryEntity('team', reference);

  if (ref.status === 'invalid') {
    return (
      <div className="shell-container entity-page px-4 md:px-6 xl:px-8">
        <StateCard icon={<Trophy />} tone="neutral" title="That is not a team" code="BAD_REQUEST">
          <p>
            {`A team is addressed by its reference — letters, digits, hyphens and underscores. “${ref.value}” isn’t one.`}
          </p>
        </StateCard>
      </div>
    );
  }

  return (
    <TeamPage
      team={team.data ?? null}
      pending={team.data === undefined && team.error === null}
      error={team.error === null ? null : { code: team.error.code }}
      onRetry={retry}
    />
  );
}
