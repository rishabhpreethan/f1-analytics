import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import { LoadingState } from '@/components/ui/LoadingState';
import { StateCard } from '@/components/ui/StateCard';
import { Trophy } from '@/components/ui/icons';
import { cssVar, identityToken } from '@/lib/entityColor';
import { SeasonNotes } from './SeasonNotes';
import { adjustmentNote, groupStandings, teamLineage } from './presenters';
import type { DriverStandingRow, SeasonNotice, TeamStandingRow } from './selectors';

/**
 * **The championship standings** — SC-3, and the surface where getting the data's shape wrong would
 * be an error of fact rather than of taste.
 *
 * Specified through §6.1's six steps, because a standings table is information design:
 *
 * 1. **Job**: rank, magnitude and identity together. Who is winning, by how much, in what.
 * 2. **Form**: a real `<table>`. Not a list, not cards. It is a matrix — entities down, measures
 *    across — and a `<table>` is the only form that gives a screen-reader user row/column
 *    association for free. The chart kit is not involved and must not be: there is no scale here.
 * 3. **Marks**: a 3px identity bar on the position cell, so the colour is at the start of the row
 *    and immediately before the name (§3.3a.1). **Points is the largest figure in the row** at
 *    `--text-md` mono, because it is the subject; a zero recedes to `--ink-tertiary` so the eye
 *    finds the values that are not zero.
 * 4. **Interaction**: whole-row hover raises the surface. Nothing else — every value is on the row.
 * 5. **Colour**: last, and only in the bar.
 * 6. **Accessibility**: `<caption>`, `<th scope>`, tabular mono numerals, and the three groups
 *    named in words rather than implied by position.
 *
 * ---
 *
 * ## Three data facts that decide the design, each verified
 *
 * **Nothing here sums a point, and no column is derived.** Every figure comes from
 * `driver_championship` / `team_championship`, already scored by that era's rules. 1950 reads Farina
 * 30 under the best-4 rule, which is **not** the sum of his race points; a "total" this table
 * computed itself would be a defect (`DATABASE.md` §7 trap 4). The `bestNResults` notice sits
 * directly above the table for exactly this reason — the explanation has to be next to the figure
 * it explains, not in a box at the top of the page.
 *
 * **`position IS NULL` means two completely different things**, so the table has three groups
 * (`groupStandings`):
 *
 * - **Classified** — everyone with a position.
 * - **Excluded** — `adjustment === 'excluded'`. **Kept in the table**, at the bottom, points and
 *   wins shown, with an `Excluded` marker. 2007 McLaren reads 0 points beside 8 wins and 1997
 *   Michael Schumacher reads 78 points with no position; filing either behind a disclosure would
 *   bury the story of that season. The adjustment is **annotated, never re-applied** — the figure
 *   in the payload is already post-penalty, so subtracting anything would double-count it.
 * - **Unscored** — no position, no exclusion, and therefore no championship points. 1950 has 81
 *   driver rows and 22 ranked ones; the other 59 are largely Indianapolis 500 entrants. Fifty-nine
 *   rows of zeros would bury the twenty-two that matter, and dropping them would misstate who
 *   contested the season — so they sit behind a disclosure **that states its own count**, which is
 *   the same move `CoverageRuler` already makes.
 *
 * **The Constructors' Championship did not exist before 1958**, so a 1950 page has driver standings
 * and no constructor standings. That is a designed state carrying its own explanation, not an empty
 * table — and it is `neutral`, never a status colour (§3.4.3): the sport was simply different then.
 */

export interface SeasonStandingsProps {
  year: number;
  drivers: readonly DriverStandingRow[];
  teams: readonly TeamStandingRow[];
  /** Slot `standings` — the scoring-rule notices, above the driver table. */
  driverNotices: readonly SeasonNotice[];
  /** Slot `constructors` — `noTeamChampionship`, which replaces the table rather than annotating it. */
  teamNotices: readonly SeasonNotice[];
  /** The round the standings are current to. Null when the season carries no snapshot. */
  asOfRound: number | null;
  isComplete: boolean;
  pending: boolean;
}

export function SeasonStandings({
  year,
  drivers,
  teams,
  driverNotices,
  teamNotices,
  asOfRound,
  isComplete,
  pending,
}: SeasonStandingsProps) {
  /*
   * "after Round 10" and not "as of today". `asOfRound` is a fact about the record; a date would be
   * a claim about the real calendar that REQUIREMENTS.md §2.2 warns we cannot make.
   */
  const scope =
    asOfRound === null
      ? null
      : isComplete
        ? `Final standings after ${String(asOfRound)} rounds.`
        : `Standings after Round ${String(asOfRound)}.`;

  return (
    <section className="season-section" aria-labelledby="season-standings-title">
      <div>
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          The championships
        </p>
        <h2 id="season-standings-title" className="t-display-sm text-ink-primary mt-3">
          {isComplete ? 'How it finished' : 'How it stands'}
        </h2>
        {scope !== null && <p className="t-sm text-ink-secondary mt-2">{scope}</p>}
      </div>

      <StandingsPanel
        title="Drivers"
        notices={driverNotices}
        pending={pending}
        empty={drivers.length === 0}
        emptyCopy={`No driver standings are recorded for ${String(year)}.`}
      >
        <DriverTable rows={drivers} year={year} />
      </StandingsPanel>

      {/*
       * **The `noTeamChampionship` state replaces the table.** An empty table with headers would
       * say "there should be teams here and there are none", which is the opposite of true.
       */}
      {teamNotices.length > 0 ? (
        <div className="season-subsection">
          <h3 className="t-display-xs text-ink-primary">Constructors</h3>
          <StateCard
            icon={<Trophy />}
            tone="neutral"
            as="h4"
            title="No Constructors' Championship this season"
          >
            {teamNotices.map((notice) => (
              <p key={notice.code}>{notice.text}</p>
            ))}
            {/*
             * §6.5.3's third clause, the one that gets dropped and the only one that helps: say
             * what *is* available instead.
             */}
            <p>The drivers&apos; championship above is complete for {year}.</p>
          </StateCard>
        </div>
      ) : (
        <StandingsPanel
          title="Constructors"
          notices={[]}
          pending={pending}
          empty={teams.length === 0}
          emptyCopy={`No constructor standings are recorded for ${String(year)}.`}
        >
          <TeamTable rows={teams} year={year} />
        </StandingsPanel>
      )}
    </section>
  );
}

/** One titled panel: heading, its notices, then the table, the skeleton or the empty state. */
function StandingsPanel({
  title,
  notices,
  pending,
  empty,
  emptyCopy,
  children,
}: {
  title: string;
  notices: readonly SeasonNotice[];
  pending: boolean;
  empty: boolean;
  emptyCopy: string;
  children: ReactNode;
}) {
  return (
    <div className="season-subsection">
      <h3 className="t-display-xs text-ink-primary">{title}</h3>

      {/* The scoring rule sits between the heading and the table — next to the figures it changes. */}
      {notices.length > 0 && <SeasonNotes notices={notices} />}

      <div className="season-panel">
        {pending ? (
          <StandingsSkeleton label={`${title} standings`} />
        ) : empty ? (
          <p className="t-sm text-ink-tertiary p-4">{emptyCopy}</p>
        ) : (
          <div className="standings-scroll">{children}</div>
        )}
      </div>
    </div>
  );
}

function DriverTable({ rows, year }: { rows: readonly DriverStandingRow[]; year: number }) {
  const groups = groupStandings(rows);
  const inTable = [...groups.classified, ...groups.excluded];

  return (
    <>
      <table className="standings-table">
        <caption className="sr-only">
          {`${String(year)} Drivers' Championship — position, driver, team, points, wins and best finish.`}
        </caption>
        <thead>
          <tr>
            <th scope="col">Pos</th>
            <th scope="col">Driver</th>
            <th scope="col" className="standings-num">
              Points
            </th>
            <th scope="col" className="standings-num">
              Wins
            </th>
            <th scope="col" className="standings-num standings-optional">
              Best
            </th>
          </tr>
        </thead>
        <tbody>
          {inTable.map((row) => (
            <tr
              key={row.driverRef}
              data-adjustment={row.adjustment}
              style={{ '--identity': cssVar(identityToken(row.colorRef)) } as CSSProperties}
            >
              <PositionCell position={row.position} adjustment={row.adjustment} kind="driver" />
              {/*
               * §1.0a — the driver page exists now, so the link is this surface's obligation. The
               * name is the link and the position cell is not: a standings row's subject is the
               * ranking, and making the whole row navigate to a driver would give the points cell
               * a destination about somebody rather than about the number in it.
               */}
              <td>
                <Link className="entity-link" to={`/drivers/${row.driverRef}`}>
                  <span className="standings-name">
                    {row.forename} {row.surname}
                  </span>
                </Link>
                {row.code !== null && <span className="standings-code">{row.code}</span>}
                <TeamLine teams={row.teams} />
              </td>
              {/*
               * `data-zero` here too, so **one rule covers every numeral in the table**. It was
               * missing and the points column was the only one that did not recede at zero, which
               * is the kind of inconsistency a reader feels without being able to name.
               *
               * 2007 McLaren's `0` is the case that argues against it — the zero beside 8 wins *is*
               * the story — and the `Excluded` chip is what carries that story. A second convention
               * for one row would be worse than a slightly quieter zero.
               */}
              <td
                className="standings-num standings-points"
                data-zero={row.points === 0 ? 'true' : 'false'}
              >
                {row.points}
              </td>
              <NumericCell value={row.wins} />
              <NumericCell value={row.bestFinish} prefix="P" />
            </tr>
          ))}
        </tbody>
      </table>

      <AdjustmentFootnotes rows={inTable} kind="driver" />
      <UnscoredDisclosure
        rows={groups.unscored}
        year={year}
        label={(row) => `${row.forename} ${row.surname}`}
        keyOf={(row) => row.driverRef}
        noun="driver"
      />
    </>
  );
}

function TeamTable({ rows, year }: { rows: readonly TeamStandingRow[]; year: number }) {
  const groups = groupStandings(rows);
  const inTable = [...groups.classified, ...groups.excluded];

  return (
    <>
      <table className="standings-table">
        <caption className="sr-only">
          {`${String(year)} Constructors' Championship — position, team, points, wins and best finish.`}
        </caption>
        <thead>
          <tr>
            <th scope="col">Pos</th>
            <th scope="col">Team</th>
            <th scope="col" className="standings-num">
              Points
            </th>
            <th scope="col" className="standings-num">
              Wins
            </th>
            <th scope="col" className="standings-num standings-optional">
              Best
            </th>
          </tr>
        </thead>
        <tbody>
          {inTable.map((row) => (
            <tr
              key={row.teamRef}
              data-adjustment={row.adjustment}
              style={{ '--identity': cssVar(identityToken(row.colorRef)) } as CSSProperties}
            >
              <PositionCell position={row.position} adjustment={row.adjustment} kind="team" />
              <td>
                <Link className="entity-link" to={`/teams/${row.teamRef}`}>
                  <span className="standings-name">{row.name}</span>
                </Link>
                {row.nationality !== null && (
                  <span className="standings-team">{row.nationality}</span>
                )}
              </td>
              {/*
               * `data-zero` here too, so **one rule covers every numeral in the table**. It was
               * missing and the points column was the only one that did not recede at zero, which
               * is the kind of inconsistency a reader feels without being able to name.
               *
               * 2007 McLaren's `0` is the case that argues against it — the zero beside 8 wins *is*
               * the story — and the `Excluded` chip is what carries that story. A second convention
               * for one row would be worse than a slightly quieter zero.
               */}
              <td
                className="standings-num standings-points"
                data-zero={row.points === 0 ? 'true' : 'false'}
              >
                {row.points}
              </td>
              <NumericCell value={row.wins} />
              <NumericCell value={row.bestFinish} prefix="P" />
            </tr>
          ))}
        </tbody>
      </table>

      <AdjustmentFootnotes rows={inTable} kind="team" />
      <UnscoredDisclosure
        rows={groups.unscored}
        year={year}
        label={(row) => row.name}
        keyOf={(row) => row.teamRef}
        noun="team"
      />
    </>
  );
}

/**
 * The position cell — a `<th scope="row">`, because the position *is* the row's identity in a
 * standings table and a screen reader should announce it with every value.
 *
 * An excluded entity has no position and shows the marker instead of a dash. A bare `—` would read
 * as missing data; `Excluded` reads as a decision, which is what it was.
 */
function PositionCell({
  position,
  adjustment,
  kind,
}: {
  position: number | null;
  adjustment: DriverStandingRow['adjustment'];
  kind: 'driver' | 'team';
}) {
  const note = adjustmentNote(adjustment, kind);

  return (
    <th scope="row" className="standings-position">
      {position !== null ? (
        String(position).padStart(2, '0')
      ) : (
        <span className="sr-only">Not classified</span>
      )}
      {note !== null && position === null && <span className="season-chip">{note.chip}</span>}
      {note !== null && position !== null && (
        <span className="season-chip season-chip-inline">{note.chip}</span>
      )}
    </th>
  );
}

/**
 * A numeral cell. **Zero recedes** — `--ink-tertiary` — so a column of wins reads as the handful of
 * non-zero values it actually is rather than as a wall of digits. `null` is an em-dash and never a
 * zero: a driver who was never classified has no best finish, which is not the same as P0.
 */
function NumericCell({ value, prefix = '' }: { value: number | null; prefix?: string }) {
  const optional = prefix === 'P' ? ' standings-optional' : '';
  if (value === null) {
    return <td className={`standings-num${optional}`}>—</td>;
  }
  return (
    <td className={`standings-num${optional}`} data-zero={value === 0 ? 'true' : 'false'}>
      {prefix}
      {value}
    </td>
  );
}

/**
 * The team a driver raced for, under their name rather than in its own column.
 *
 * **Deliberately not a separate column.** A five-column table fits 390px; a six-column one does
 * not, and the alternative — a sideways-scrolling table with a sticky name column — is a worse
 * reading experience than a two-line cell at every width. It also lets the lineage show: two teams
 * read as `Talbot-Lago → Ferrari`, which is genuinely informative at a glance (1951 González).
 */
function TeamLine({ teams }: { teams: DriverStandingRow['teams'] }) {
  const lineage = teamLineage(teams);
  /*
   * §1.0a again, and the reason the presenter's joined label is not used here: `teamLineage`
   * returns **one string**, and a string cannot carry two destinations. A driver who changed team
   * mid-season has two team pages, so the fold is re-expressed with the same rule — two shown in
   * full, three or more collapsed to first and last with a count — and each name is its own link.
   * The full list stays in the row's accessible text either way, so a collapse never loses a team.
   */
  const shown = teams.length <= 2 ? teams : [teams[0], teams[teams.length - 1]];

  if (teams.length === 0) return <span className="standings-team">{lineage.label}</span>;

  return (
    <span className="standings-team">
      {shown.map((team, index) =>
        team === undefined ? null : (
          <span key={team.ref}>
            {index > 0 && <span aria-hidden="true"> → </span>}
            <Link className="entity-link entity-link-quiet" to={`/teams/${team.ref}`}>
              {team.name}
            </Link>
          </span>
        ),
      )}
      {lineage.count !== null && (
        <>
          <span className="season-chip season-chip-inline">{lineage.count} teams</span>
          <span className="sr-only">{`All teams: ${teams.map((team) => team.name).join(', ')}`}</span>
        </>
      )}
    </span>
  );
}

/**
 * The adjustment explanations, once per kind of adjustment present — never once per row, which on
 * 1997 would print the same sentence beside a single driver and on 2020 beside a single team.
 */
function AdjustmentFootnotes({
  rows,
  kind,
}: {
  rows: readonly { adjustment: DriverStandingRow['adjustment'] }[];
  kind: 'driver' | 'team';
}) {
  const present = [...new Set(rows.map((row) => row.adjustment))].filter(
    (adjustment) => adjustment !== 'none',
  );
  if (present.length === 0) return null;

  return (
    <ul className="standings-footnotes">
      {present.map((adjustment) => {
        const note = adjustmentNote(adjustment, kind);
        if (note === null) return null;
        return (
          <li key={adjustment} className="season-note">
            <span className="season-chip">{note.chip}</span>
            <span>{note.detail}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * **The disclosure states its own count**, which is the whole reason it is honest rather than a
 * hiding place. "59 further drivers scored no championship points in 1950" tells the reader exactly
 * what is behind it; a bare "Show more" does not, and omitting them would misstate who contested
 * the season.
 */
function UnscoredDisclosure<Row>({
  rows,
  year,
  label,
  keyOf,
  noun,
}: {
  rows: readonly Row[];
  year: number;
  label: (row: Row) => string;
  keyOf: (row: Row) => string;
  noun: 'driver' | 'team';
}) {
  if (rows.length === 0) return null;

  const plural = rows.length === 1 ? noun : `${noun}s`;
  const verb = rows.length === 1 ? 'scored' : 'scored';

  return (
    <details className="standings-disclosure">
      <summary>
        {rows.length} further {plural} {verb} no championship points in {year}
      </summary>
      <ul className="standings-unscored">
        {rows.map((row) => (
          <li key={keyOf(row)}>{label(row)}</li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Eight rows of the table's real geometry (§7.5), so the panel holds its height. **Outside any
 * reveal** — §4.6.1 rule 1: a loading state is never animated in.
 */
function StandingsSkeleton({ label }: { label: string }) {
  return (
    <div className="standings-skeleton" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: 8 }, (_, index) => (
        <LoadingState announce={false} className="skeleton-standings-row" key={index} />
      ))}
    </div>
  );
}
