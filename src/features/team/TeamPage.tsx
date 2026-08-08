import { Link } from 'react-router';
import type { Team, TeamSeason } from '@schemas/team';
import { ShareChart, SpanChart } from '@/components/charts';
import { CareerRibbon } from '@/components/entity/CareerRibbon';
import { EntityMasthead, type MastheadFact } from '@/components/entity/EntityMasthead';
import { StatTiles } from '@/components/entity/StatTiles';
import { DataUnavailableState } from '@/components/ui/DataUnavailableState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StateCard } from '@/components/ui/StateCard';
import { Trophy } from '@/components/ui/icons';
import { adjustmentNote } from '@/features/season/presenters';
import { teamLineupRows, teamRibbon, teamSplitRows, teamTiles } from './presenters';

/**
 * **The team page** — F5, CN-1 … CN-4. `DESIGN_SYSTEM.md` §6.6.2.
 *
 * Four sections, and the two charts answer genuinely different questions rather than the same one
 * twice: **CN-4** is *which driver carried the team* (composition, a share chart) and **CN-3** is
 * *who drove and when* (sequence, a span chart). Neither is a magnitude, which is why neither is a
 * bar.
 *
 * **No lineage is claimed anywhere on this page.** `base_team` holds 0 rows (trap 5), so
 * Minardi → Toro Rosso → AlphaTauri → RB does not resolve, and presenting successive identities as
 * one organisation would be an invention. Each `team.reference` is its own page, and the payload
 * deliberately does not expose `base_team_id`.
 */

export interface TeamPageProps {
  team: Team | null;
  pending: boolean;
  error: { code: string } | null;
  onRetry: () => void;
}

/** §6.6.2.6 — above this the plot cannot label its rows and the note states the cap. */
const LINEUP_CAP = 24;

export function TeamPage({ team, pending, error, onRetry }: TeamPageProps) {
  if (error?.code === 'DATABASE_UNAVAILABLE') {
    return (
      <div className="shell-container entity-page px-4 md:px-6 xl:px-8">
        <DataUnavailableState />
      </div>
    );
  }

  const facts: MastheadFact[] = [];
  if (team !== null) {
    if (team.team.nationality !== null) {
      facts.push({ label: 'Nationality', value: team.team.nationality });
    }
    if (team.career.firstSeason !== null && team.career.lastSeason !== null) {
      facts.push({
        label: 'Seasons',
        value:
          team.career.firstSeason === team.career.lastSeason
            ? String(team.career.firstSeason)
            : `${String(team.career.firstSeason)}–${String(team.career.lastSeason)}`,
        mono: true,
      });
    }
    facts.push({
      label: 'Seasons entered',
      value: `${String(team.career.seasonsEntered)} ${team.career.seasonsEntered === 1 ? 'season' : 'seasons'}`,
      mono: true,
    });
  }

  const ribbon = team === null ? [] : teamRibbon(team.seasons);
  const lineup = team === null ? { rows: [], total: 0 } : teamLineupRows(team, LINEUP_CAP);
  const split = team === null ? [] : teamSplitRows(team);
  const domain = lineupDomain(team);

  return (
    <div className="shell-container entity-page px-4 md:px-6 xl:px-8">
      <EntityMasthead
        eyebrow="Constructor"
        titleId="team-title"
        name={team?.team.name ?? null}
        teamReference={team?.team.ref ?? null}
        portrait="team"
        facts={facts}
        pending={pending}
      >
        {(pending || ribbon.length > 0) && (
          <CareerRibbon
            seasons={ribbon}
            pending={pending}
            measureLabel="Constructors’ championship position"
            absentCopy="Did not enter"
            /*
             * §7.9 — a 1950–57 season is `unranked`, not `absent`. The Constructors' Championship
             * began in 1958; the team raced and there was no championship for it to place in.
             */
            unrankedCopy="Raced, no championship position"
            ariaLabel={`Constructors’ championship position by season, ${String(team?.career.firstSeason ?? '')} to ${String(team?.career.lastSeason ?? '')}. Every season is listed in the table below.`}
          />
        )}
      </EntityMasthead>

      {error?.code === 'NOT_FOUND' ? (
        <StateCard icon={<Trophy />} tone="neutral" as="h2" title="No such team" code="NOT_FOUND">
          <p>
            There is no constructor at this address. The record holds 214 teams from 1950 onwards,
            and each is addressed by its own reference — successive identities such as Minardi, Toro
            Rosso and AlphaTauri are separate teams here, because the data holds no lineage linking
            them.
          </p>
        </StateCard>
      ) : error !== null ? (
        <ErrorState
          title="This team could not be loaded"
          detail="Nothing was lost — the record is read-only. Try again."
          code={error.code}
          onRetry={onRetry}
        />
      ) : (
        <>
          <section className="season-section" aria-labelledby="team-honours-title">
            <div>
              <p className="season-eyebrow">
                <span className="accent-rule" aria-hidden="true" />
                The record
              </p>
              <h2 id="team-honours-title" className="t-display-sm text-ink-primary mt-3">
                Honours
              </h2>
            </div>
            <StatTiles
              ariaLabel="Team honours"
              pending={pending}
              tiles={team === null ? PLACEHOLDER_TILES : teamTiles(team)}
            />
          </section>

          <section className="season-section" aria-labelledby="team-split-title">
            <div>
              <p className="season-eyebrow">
                <span className="accent-rule" aria-hidden="true" />
                Inside the team
              </p>
              <h2 id="team-split-title" className="t-display-sm text-ink-primary mt-3">
                Who carried the car
              </h2>
            </div>

            <div className="season-panel entity-chart-panel">
              <ShareChart
                rows={split}
                title="Driver points split"
                subtitle={`${String(split.length)} seasons`}
                measureTitle="Share of the team’s driver points (%)"
                valueTitle="Points"
                entityTitle="Driver"
                categoryTitle="Season"
                emptyRowLabel="No points scored"
                state={pending ? 'loading' : split.length === 0 ? 'empty' : 'ready'}
                stateCopy={{ body: 'No seasons are recorded for this team.' }}
                ariaLabel="Each season’s share of this team’s driver race points, per driver."
                /*
                 * §5.2 and trap 4 — **the share is what makes this legal**. Raw points are
                 * comparable within one season and never across eras, and a share is a ratio of two
                 * figures scored under one system, so a 1961 row and a 2026 row are comparable as
                 * shares while their points never are.
                 */
                caption="Each row is one season, normalised to that season’s own scoring. Points totals are never comparable across eras — 24 different points systems have been used — but a share within a single season is. The table view carries the raw points beside every share."
                notes={[
                  'Race points, not constructors’ championship points: this is what each driver scored in the team’s cars, which is the only figure a split can be made of.',
                ]}
              />
            </div>
          </section>

          <section className="season-section" aria-labelledby="team-lineup-title">
            <div>
              <p className="season-eyebrow">
                <span className="accent-rule" aria-hidden="true" />
                The roster
              </p>
              <h2 id="team-lineup-title" className="t-display-sm text-ink-primary mt-3">
                Who drove, and when
              </h2>
            </div>

            <div className="season-panel entity-chart-panel">
              <SpanChart
                rows={lineup.rows}
                title="Driver lineup"
                subtitle={`${String(lineup.total)} ${lineup.total === 1 ? 'driver' : 'drivers'}`}
                measureTitle="Season"
                formatMeasure={(value) => String(Math.round(value))}
                {...(domain === null ? {} : { domain })}
                state={pending ? 'loading' : lineup.rows.length === 0 ? 'empty' : 'ready'}
                stateCopy={{ body: 'No drivers are recorded for this team.' }}
                ariaLabel="The seasons each driver raced for this team, as a span per spell."
                caption="One row per driver, one span per spell. A driver who returned after leaving has two spans, and the gap between them is real."
                notes={
                  lineup.total > LINEUP_CAP
                    ? [
                        `Showing the ${String(LINEUP_CAP)} drivers with the most starts, of ${String(lineup.total)} who raced for this team. The rest are in the season table below.`,
                      ]
                    : []
                }
              />
            </div>
          </section>

          <TeamSeasons
            seasons={team?.seasons ?? []}
            teamName={team?.team.name ?? ''}
            pending={pending || team === null}
          />
        </>
      )}
    </div>
  );
}

/**
 * The span chart's axis is the team's whole span, pinned rather than derived.
 *
 * Derived from the spans alone, a roster whose last driver left in 2018 would produce an axis that
 * stops there — and a reader would not see that the team raced on. Same argument the race page's
 * stint chart makes about a field that all pitted before the flag.
 *
 * `+ 1` on the upper bound for the reason the spans carry it: a season is a unit of width, so the
 * axis runs from the start of the first season to the start of the season after the last.
 */
function lineupDomain(team: Team | null): readonly [number, number] | null {
  if (team === null) return null;
  const { firstSeason, lastSeason } = team.career;
  if (firstSeason === null || lastSeason === null) return null;
  return [firstSeason, lastSeason + 1];
}

/**
 * **CN-2 — the season performance table.** Same anatomy as the driver page's and the season hub's,
 * and for the same reason: one surface, not three.
 *
 * **A 1950–57 row has no championship position and that is not a gap.** The Constructors'
 * Championship began in 1958, `hasTeamStandings` says so per row, and the cell reads "No
 * championship" rather than an em-dash — an em-dash would read as missing data (§3.4.3: absent is
 * not a fault, and it is never a status colour).
 */
function TeamSeasons({
  seasons,
  teamName,
  pending,
}: {
  seasons: readonly TeamSeason[];
  teamName: string;
  pending: boolean;
}) {
  return (
    <section className="season-section" aria-labelledby="team-seasons-title">
      <div>
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          The history
        </p>
        <h2 id="team-seasons-title" className="t-display-sm text-ink-primary mt-3">
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
          <p className="t-sm text-ink-tertiary p-4">No seasons are recorded for this team.</p>
        ) : (
          <div className="standings-scroll">
            <table className="standings-table">
              <caption className="sr-only">
                {`${teamName} — one row per season: championship position, points, wins, races and drivers.`}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Season</th>
                  <th scope="col">Drivers</th>
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
                    Races
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...seasons]
                  .sort((a, b) => b.year - a.year)
                  .map((season) => (
                    <TeamSeasonRow key={season.year} season={season} />
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function TeamSeasonRow({ season }: { season: TeamSeason }) {
  const note = adjustmentNote(season.adjustment, 'team');

  return (
    <tr data-adjustment={season.adjustment}>
      <th scope="row" className="standings-position">
        <Link className="entity-link t-mono" to={`/seasons/${String(season.year)}`}>
          {season.year}
        </Link>
        {season.isChampion && <span className="season-chip season-chip-inline">Champion</span>}
      </th>

      <td>
        <span className="standings-name">
          {season.drivers.map((driver, index) => (
            <span key={driver.driverRef}>
              {index > 0 && <span aria-hidden="true">, </span>}
              {/*
               * **No per-driver colour here, deliberately.** `identityToken` takes a *team*
               * reference; hashing a driver's would produce a stable colour that means nothing and
               * would contradict §3.3a — colour identifies the team, and on a team page every
               * driver is already that team's colour. The link is the affordance; the name is the
               * identity.
               */}
              <Link className="entity-link" to={`/drivers/${driver.driverRef}`}>
                {driver.forename} {driver.surname}
              </Link>
            </span>
          ))}
          {season.drivers.length === 0 && '—'}
        </span>
      </td>

      <td className="standings-num">
        {!season.hasTeamStandings ? (
          /*
           * **Not an em-dash.** The Constructors' Championship began in 1958; 1950–57 has no
           * position for the team to hold, and an em-dash would read as missing data rather than
           * as a different sport.
           */
          <span className="season-chip">No championship</span>
        ) : season.position === null ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">Not classified</span>
          </>
        ) : (
          season.position
        )}
        {note !== null && <span className="season-chip season-chip-inline">{note.chip}</span>}
      </td>

      <td
        className="standings-num standings-points"
        data-zero={season.points === 0 ? 'true' : 'false'}
      >
        {season.points === null ? '—' : season.points}
      </td>
      <td className="standings-num" data-zero={season.wins === 0 ? 'true' : 'false'}>
        {season.wins}
      </td>
      <td className="standings-num standings-optional">{season.races}</td>
    </tr>
  );
}

const PLACEHOLDER_TILES = [
  { key: 'seasons', label: 'Seasons', value: 0 },
  { key: 'races', label: 'Races', value: 0 },
  { key: 'wins', label: 'Wins', value: 0 },
  { key: 'podiums', label: 'Podiums', value: 0 },
  { key: 'drivers', label: 'Drivers', value: 0 },
  { key: 'championships', label: 'Championships', value: 0 },
];
