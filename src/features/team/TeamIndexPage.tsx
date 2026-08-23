import { useMemo } from 'react';
import type { TeamList } from '@schemas/directory';
import { EntityIndex } from '@/components/entity/EntityIndex';
import { teamIndexModel } from '@/components/entity/indexPresenters';
import { DataUnavailableState } from '@/components/ui/DataUnavailableState';

/**
 * **`/teams`** — the team index. `DESIGN_SYSTEM.md` §6.6.4, §6.6.5.
 *
 * **Headed `Teams`, not `Constructors`, and the route table caught the difference.** The dock's own
 * item reads `Teams`, and a navigation page whose heading disagrees with the link that reached it is
 * exactly the seam this feature exists to close. The sport's own word stays where it belongs — on
 * the entity itself, as the team profile's eyebrow (§6.6.2.1) — rather than on the directory.
 *
 * The one page of the three whose rows always carry a colour: a team's identity *is* its own
 * reference, so `identityToken` resolves without a `teamRef` field — a brand colour for 12 of 214
 * and the deterministic ramp slot for the other 202 (§3.3a.3).
 *
 * **The page's shape is survivorship.** 205 of the 214 identities in the record started a Grand
 * Prix; **47 ever won one and 17 ever took a Constructors' title**, while 11 raced in 2026. That is
 * a far sharper pyramid than the drivers' and it is what the ladder draws.
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
  const model = useMemo(() => (data === null ? null : teamIndexModel(data.teams)), [data]);

  if (error?.code === 'DATABASE_UNAVAILABLE') {
    return (
      <div className="shell-container entity-index px-4 md:px-6 xl:px-8">
        <DataUnavailableState />
      </div>
    );
  }

  return (
    <EntityIndex
      title="Teams"
      eyebrow="The archive"
      facts={model?.facts ?? []}
      kind="team"
      noun="teams"
      nounSingular="team"
      items={model?.items ?? null}
      columns={model?.columns ?? FALLBACK_COLUMNS}
      sorts={model?.lenses ?? FALLBACK_LENSES}
      strata={model?.strata ?? []}
      board={model?.board ?? FALLBACK_BOARD}
      aside={model?.aside ?? null}
      latest={model?.latest ?? null}
      pending={pending}
      error={error}
      onRetry={onRetry}
    />
  );
}

/* The loading-state shapes. See the note in `DriverIndexPage`. */
const FALLBACK_COLUMNS = [
  { key: 'races', label: 'Grands Prix', priority: 1 },
  { key: 'wins', label: 'Wins', priority: 2 },
  { key: 'podiums', label: 'Podiums', priority: 3 },
  { key: 'debut', label: 'Debut', priority: 4 },
] as const;

const FALLBACK_LENSES = [
  { id: 'tier', label: 'Achievement', figure: 1, by: 'tier', group: 'tier' },
  { id: 'era', label: 'Era', figure: 3, by: 'debut', group: 'decade' },
  { id: 'career', label: 'Longevity', figure: 0, by: 'band', group: 'band' },
  { id: 'az', label: 'A–Z', figure: null, by: 'name', group: 'letter' },
] as const;

const FALLBACK_BOARD = {
  strataHeading: 'How far they got',
  strataCaption: '',
  eraHeading: 'Constructors, by decade',
  eraCaption: '',
};
