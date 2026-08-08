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
 * **`/teams`** — the constructor index. `DESIGN_SYSTEM.md` §6.6.4.
 *
 * The one page of the three whose rows carry a colour: a team's identity *is* its own reference, so
 * `identityToken` resolves without a `teamRef` field — a brand colour for 12 of 214 and the
 * deterministic ramp slot for the other 202 (§3.3a.3). A driver's colour belongs to their team and
 * the directory payload does not carry one, so that page is monochrome.
 *
 * **No lineage, and its absence is the data's.** `base_team` holds no rows (trap 5), so Minardi →
 * Toro Rosso → AlphaTauri → RB does not resolve and each identity is its own row. The index states
 * 214 constructors because the record holds 214, not because the sport had that many teams.
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
      title="Constructors"
      eyebrow="The archive"
      facts={items === null ? [] : indexFacts(items, 'constructors')}
      kind="team"
      noun="constructors"
      nounSingular="constructor"
      items={items}
      columns={TEAM_COLUMNS}
      sorts={TEAM_SORTS}
      notice={
        raceless === 0 || items === null ? undefined : (
          <p className="index-notice">
            <Info size={16} />
            <span>
              <b>{`${String(raceless)} of the ${String(items.length)} constructors in the record never started a Grand Prix.`}</b>{' '}
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
