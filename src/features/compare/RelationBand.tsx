import type { CSSProperties } from 'react';
import type { SeriesChannels } from '@/components/charts/ladder';
import { cssVar } from '@/lib/entityColor';
import { orientLedger, pairFor, scoreLabel, verdict } from './model';
import type { Chain, CompareEntity, ComparePair } from './types';

/**
 * **`RelationBand`** — `DESIGN_SYSTEM.md` §6.6.6.1. The page's first act, and the thing that makes
 * this surface not a dashboard.
 *
 * Before any number is compared it states **what kind of comparison this is**: same car, same grid
 * in different cars, or never on the same grid at all. That is computed from the data and is never
 * a control — a reader cannot ask for a like-for-like comparison of two drivers who never shared a
 * car, and a "mode" switch would imply they could.
 *
 * **The matrix appears at three entities and above, and it is the navigator.** With four drivers
 * selected there are six relationships and they are not the same kind: Hamilton and Rosberg were
 * teammates, Hamilton and Verstappen never shared a car, Verstappen and Fangio never shared a
 * decade. A single verdict sentence would have to pick one and silently drop five. The matrix shows
 * all six at once — each cell carrying the figure that decides its tier — and choosing a cell is
 * how the reader points the chain and the ledgers at a pair.
 *
 * **Upper triangle only.** A relationship is symmetric, so a full grid would print every fact
 * twice and invite the reader to look for a difference between the two halves that does not exist.
 *
 * **`aria-pressed`, and one cell at a time.** Unlike `PopulationBoard`'s independent toggles
 * (§7.14) this is a single-selection control, because the instruments below can only be pointed at
 * one pair. It is a radio group in behaviour, and it is built from buttons with `aria-pressed`
 * rather than radios because the cells are a grid rather than a list and the label is the cell.
 */

export interface RelationBandProps {
  entities: CompareEntity[];
  channels: SeriesChannels[];
  pairs: ComparePair[];
  chains: Chain[];
  focus: [string, string];
  onFocus: (pair: [string, string]) => void;
}

const RELATION_LABEL: Record<string, string> = {
  teammate: 'Same car',
  contemporary: 'Same grid',
  disjoint: 'Never met',
};

export function RelationBand({
  entities,
  channels,
  pairs,
  chains,
  focus,
  onFocus,
}: RelationBandProps) {
  const byRef = new Map(entities.map((entity) => [entity.identity.ref, entity]));
  const first = byRef.get(focus[0]);
  const second = byRef.get(focus[1]);
  const focused = pairFor(pairs, focus[0], focus[1]);
  if (first === undefined || second === undefined || focused === null) return null;

  const teams = [...new Set(focused.sameTeamSeasons.map((season) => season.teamName))];
  const spoken = verdict(focused, first, second, teams.length === 1 ? (teams[0] ?? null) : null);

  return (
    <section className="relation" aria-labelledby="relation-heading">
      <div className="relation-verdict" data-relation={spoken.relation}>
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          The relationship, measured
        </p>
        <h2 className="relation-headline" id="relation-heading">
          {spoken.headline}
        </h2>
        <p className="relation-lead">{spoken.lead}</p>
      </div>

      {entities.length > 2 && (
        <div className="relation-matrix-wrap">
          <p className="relation-matrix-title">Every pair in this comparison</p>
          <table className="relation-matrix">
            <caption className="sr-only">
              How each selected driver is related to each other. Choose a pair to point the charts
              below at it.
            </caption>
            <thead>
              <tr>
                <td />
                {entities.slice(1).map((entity) => (
                  <th key={entity.identity.ref} scope="col">
                    {entity.identity.surname}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entities.slice(0, -1).map((row, rowIndex) => (
                <tr key={row.identity.ref}>
                  <th scope="row">
                    <span
                      className="relation-swatch"
                      aria-hidden="true"
                      style={
                        {
                          '--identity': cssVar(channels[rowIndex]?.identity ?? '--ramp-1-plot'),
                        } as CSSProperties
                      }
                    />
                    {row.identity.surname}
                  </th>
                  {entities.slice(1).map((column, offset) => {
                    const columnIndex = offset + 1;
                    if (columnIndex <= rowIndex) return <td key={column.identity.ref} />;
                    const pair = pairFor(pairs, row.identity.ref, column.identity.ref);
                    if (pair === null) return <td key={column.identity.ref} />;
                    const chain = chains.find(
                      (candidate) =>
                        (candidate.a === row.identity.ref && candidate.b === column.identity.ref) ||
                        (candidate.b === row.identity.ref && candidate.a === column.identity.ref),
                    );
                    const oriented = orientLedger(pair, row.identity.ref);
                    const selected =
                      (focus[0] === row.identity.ref && focus[1] === column.identity.ref) ||
                      (focus[1] === row.identity.ref && focus[0] === column.identity.ref);
                    return (
                      <td key={column.identity.ref}>
                        <button
                          aria-pressed={selected}
                          className="relation-cell"
                          data-relation={pair.relation}
                          onClick={() => {
                            onFocus([row.identity.ref, column.identity.ref]);
                          }}
                          type="button"
                        >
                          <span className="relation-cell-tier">
                            {RELATION_LABEL[pair.relation]}
                          </span>
                          <span className="relation-cell-figure">
                            {pair.relation === 'teammate'
                              ? scoreLabel(oriented.race)
                              : pair.relation === 'contemporary'
                                ? `${String(pair.sharedRaces)} shared`
                                : `${String(chain?.length ?? 0)} steps apart`}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
