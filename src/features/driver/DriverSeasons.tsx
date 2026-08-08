import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import type { DriverSeason } from '@schemas/driver';
import { LoadingState } from '@/components/ui/LoadingState';
import { adjustmentNote } from '@/features/season/presenters';
import { cssVar, identityToken } from '@/lib/entityColor';

/**
 * **DR-3 — the season-by-season table**, `DESIGN_SYSTEM.md` §6.6.2.3.
 *
 * Same anatomy as the season hub's standings table, deliberately: a reader arriving from
 * `/seasons/1951` should meet the surface they just left, not a second convention. It reuses
 * `standings-table`, `standings-num`, `standings-optional`, `season-chip` and `adjustmentNote`
 * verbatim.
 *
 * ---
 *
 * ## The 318 two-team seasons
 *
 * **Measured: 318 driver-seasons map one driver to more than one team.** Rendering only the first
 * would delete half of González's 1951; rendering two rows would claim the driver held two
 * championship positions in one year, which is false.
 *
 * **One row per season, and the team cell holds every team, in order, joined by `→`.** Above two
 * teams it collapses to `{first} → {last}` plus a `{n} teams` chip — which is exactly
 * `teamLineage`'s rule from the standings table, so this is reuse rather than a second treatment
 * of the same data. Each team is its own link, so a lineage is two destinations rather than one.
 *
 * **The row's identity bar takes the team the driver entered the most races with that season**, and
 * that rule is stated rather than left to array order: the bar can only show one colour, and "the
 * most races" is the one non-arbitrary choice available — the same move `SeasonCalendar` makes for
 * a shared drive.
 *
 * ## Two things this table must never do
 *
 * **Never sum the points column.** Every figure is that era's championship score, read from
 * `driver_championship` (trap 4). A career total under it would be a defect, not a convenience —
 * which is why there is no footer row and no total anywhere on this page.
 *
 * **Never render a null position as last.** `position: null` means unranked, and 1950 has 59 such
 * drivers. It renders as an em-dash with a screen-reader-only "Not classified", exactly as the
 * standings table does.
 */

export interface DriverSeasonsProps {
  seasons: readonly DriverSeason[];
  driverName: string;
  pending: boolean;
}

export function DriverSeasons({ seasons, driverName, pending }: DriverSeasonsProps) {
  return (
    <section className="season-section" aria-labelledby="driver-seasons-title">
      <div>
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          The career
        </p>
        <h2 id="driver-seasons-title" className="t-display-sm text-ink-primary mt-3">
          Season by season
        </h2>
      </div>

      <div className="season-panel">
        {pending ? (
          <div className="standings-skeleton" role="status" aria-busy="true" aria-label="Seasons">
            {Array.from({ length: 8 }, (_, index) => (
              <LoadingState announce={false} className="skeleton-standings-row" key={index} />
            ))}
          </div>
        ) : seasons.length === 0 ? (
          <p className="t-sm text-ink-tertiary p-4">
            No seasons are recorded for this driver. Every driver in this record has at least one
            race entry, so this is a state you should not be able to reach.
          </p>
        ) : (
          <div className="standings-scroll">
            <table className="standings-table">
              <caption className="sr-only">
                {`${driverName} — one row per season: team, championship position, points, wins, starts and best finish.`}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Season</th>
                  <th scope="col">Team</th>
                  <th scope="col" className="standings-num">
                    Pos
                  </th>
                  <th scope="col" className="standings-num">
                    Points
                  </th>
                  <th scope="col" className="standings-num">
                    Wins
                  </th>
                  <th scope="col" className="standings-num standings-optional">
                    Starts
                  </th>
                  <th scope="col" className="standings-num standings-optional">
                    Best
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...seasons]
                  .sort((a, b) => b.year - a.year)
                  .map((season) => (
                    <SeasonRow key={season.year} season={season} />
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function SeasonRow({ season }: { season: DriverSeason }) {
  /*
   * The bar's colour: the team the driver entered the most races with. `entries` and not array
   * position, and ties broken by `ref` ascending so the colour cannot change between reloads for a
   * driver who split a season evenly.
   */
  const lead = [...season.teams].sort(
    (a, b) => b.entries - a.entries || (a.ref < b.ref ? -1 : 1),
  )[0];
  const note = adjustmentNote(season.adjustment, 'driver');

  return (
    <tr
      data-adjustment={season.adjustment}
      style={
        lead === undefined
          ? undefined
          : ({ '--identity': cssVar(identityToken(lead.ref)) } as CSSProperties)
      }
    >
      <th scope="row" className="standings-position">
        <Link className="entity-link t-mono" to={`/seasons/${String(season.year)}`}>
          {season.year}
        </Link>
        {season.isChampion && <span className="season-chip season-chip-inline">Champion</span>}
      </th>

      <td>
        <TeamCell season={season} />
      </td>

      <td className="standings-num">
        {season.position === null ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">Not classified</span>
          </>
        ) : (
          season.position
        )}
        {note !== null && <span className="season-chip season-chip-inline">{note.chip}</span>}
      </td>

      {/*
       * **That era's championship score, read and never summed** (trap 4). A `null` is not a zero:
       * it means the season holds no snapshot for this driver, which the payload notes is not
       * reachable on the present data — so it renders as an absence rather than as nothing scored.
       */}
      <td
        className="standings-num standings-points"
        data-zero={season.points === 0 ? 'true' : 'false'}
      >
        {season.points === null ? '—' : season.points}
      </td>
      <td className="standings-num" data-zero={season.wins === 0 ? 'true' : 'false'}>
        {season.wins}
      </td>
      <td
        className="standings-num standings-optional"
        data-zero={season.starts === 0 ? 'true' : 'false'}
      >
        {season.starts}
      </td>
      <td className="standings-num standings-optional">
        {season.bestFinish === null ? '—' : `P${String(season.bestFinish)}`}
      </td>
    </tr>
  );
}

/**
 * Every team of the season, each a link. **Two are shown in full; three or more collapse to first
 * and last with a count** — `teamLineage`'s rule, applied here with links rather than plain text,
 * which is why the fold is re-expressed instead of calling it: the presenter returns one joined
 * string, and a string cannot carry two destinations.
 *
 * The full list is in the row's accessible name either way, so a collapse never loses a team.
 */
function TeamCell({ season }: { season: DriverSeason }) {
  const teams = season.teams;
  if (teams.length === 0) return <span className="standings-team">—</span>;

  const shown = teams.length <= 2 ? teams : [teams[0], teams[teams.length - 1]];

  return (
    <span className="standings-name">
      {shown.map((team, index) =>
        team === undefined ? null : (
          <span key={team.ref}>
            {index > 0 && <span aria-hidden="true"> → </span>}
            <Link className="entity-link" to={`/teams/${team.ref}`}>
              {team.name}
            </Link>
          </span>
        ),
      )}
      {teams.length > 2 && (
        <>
          <span className="season-chip season-chip-inline">{teams.length} teams</span>
          <span className="sr-only">{`All teams: ${teams.map((team) => team.name).join(', ')}`}</span>
        </>
      )}
    </span>
  );
}
