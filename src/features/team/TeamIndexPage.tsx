import { useMemo } from 'react';
import type { TeamList } from '@schemas/directory';
import { EntityIndex } from '@/components/entity/EntityIndex';
import {
  TEAM_COLUMNS,
  TEAM_SORTS,
  indexFacts,
  racelessCount,
  teamItems,
} from '@/components/entity/indexPresenters';
import { DataUnavailableState } from '@/components/ui/DataUnavailableState';
import { Info } from '@/components/ui/icons';

/**
 * **`/teams`** — the team index. `DESIGN_SYSTEM.md` §6.6.4.
 *
 * **Headed `Teams`, not `Constructors`, and the route table caught the difference.** The dock's own
 * item reads `Teams`, and a navigation page whose heading disagrees with the link that reached it is
 * exactly the seam this feature exists to close. The sport's own word stays where it belongs — on
 * the entity itself, as the team profile's eyebrow (§6.6.2.1) — rather than on the directory.
 *
 * The one page of the three whose rows carry a colour: a team's identity *is* its own reference, so
 * `identityToken` resolves without a `teamRef` field — a brand colour for 12 of 214 and the
 * deterministic ramp slot for the other 202 (§3.3a.3). A driver's colour belongs to their team and
 * the directory payload does not carry one, so that page is monochrome.
 *
 * **No lineage, and its absence is the data's.** `base_team` holds no rows (trap 5), so Minardi →
 * Toro Rosso → AlphaTauri → RB does not resolve and each identity is its own row. The index states
 * 214 teams because the record holds 214 identities, not because the sport had 214 outfits.
 */

export interface TeamIndexPageProps {
  data: TeamList | null;
  pending: boolean;
  error: { code: string } | null;
  onRetry: () => void;
}

export function TeamIndexPage({ data, pending, error, onRetry }: TeamIndexPageProps) {
  const items = useMemo(() => (data === null ? null : teamItems(data.teams)), [data]);

  if (error?.code === 'DATABASE_UNAVAILABLE') {
    return (
      <div className="shell-container entity-index px-4 md:px-6 xl:px-8">
        <DataUnavailableState />
      </div>
    );
  }

  const raceless = items === null ? 0 : racelessCount(items);

  return (
    <EntityIndex
      title="Teams"
      eyebrow="The archive"
      facts={items === null ? [] : indexFacts(items, 'teams')}
      kind="team"
      noun="teams"
      nounSingular="team"
      items={items}
      columns={TEAM_COLUMNS}
      sorts={TEAM_SORTS}
      notice={
        raceless === 0 || items === null ? undefined : (
          <p className="index-notice">
            <Info size={16} />
            <span>
              <b>{`${String(raceless)} of the ${String(items.length)} teams in the record never started a Grand Prix.`}</b>{' '}
              They entered and never made a grid. They are listed here and marked, rather than
              quietly left out.
            </span>
          </p>
        )
      }
      pending={pending}
      error={error}
      onRetry={onRetry}
    />
  );
}
