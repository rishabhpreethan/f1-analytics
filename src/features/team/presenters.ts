import type { Team, TeamSeason } from '@schemas/team';
import type { ShareRow } from '@/components/charts';
import type { SpanRow } from '@/components/charts';
import type { StatTile } from '@/components/entity/StatTiles';
import type { RibbonSeason } from '@/components/entity/ribbon';

/**
 * **Presentation grouping for the team page.** Same boundary as the driver page's: this folds
 * values the payload has already made safe, and it never re-derives a trap.
 */

/* -------------------------------------------------------------------- the career ribbon */

/**
 * §7.9 — the constructors' championship position by season.
 *
 * **A season before 1958 is `unranked`, not `absent`.** The Constructors' Championship began in
 * 1958, so 1950–57 seasons carry `hasTeamStandings: false` and a null position — the team raced,
 * and there was no championship for it to place in. `absent` means *did not race*, and the ribbon's
 * three-kind rule is only worth having if these two stay apart (§7.9.1).
 */
export function teamRibbon(seasons: readonly TeamSeason[]): RibbonSeason[] {
  return seasons.map((season) => ({
    year: season.year,
    position: season.position,
    champion: season.isChampion,
    detail: season.hasTeamStandings
      ? `${String(season.races)} races`
      : 'No Constructors’ Championship this season',
  }));
}

/* ---------------------------------------------------------------------- the honours grid */

/**
 * CN-1's honours. Six figures, and **no points total** — the same trap-4 rule the driver page
 * follows, and it bites harder here: a constructor's history spans more point systems than any
 * driver's.
 *
 * Nothing on this grid needs the denominator rule, because none of these six is coverage-limited:
 * results, positions and status codes all run from 1950.
 */
export function teamTiles(team: Team): StatTile[] {
  return [
    { key: 'seasons', label: 'Seasons', value: team.career.seasonsEntered, emphasis: true },
    { key: 'races', label: 'Races', value: team.totals.races, emphasis: true },
    { key: 'wins', label: 'Wins', value: team.totals.wins, emphasis: true },
    { key: 'podiums', label: 'Podiums', value: team.totals.podiums },
    { key: 'drivers', label: 'Drivers', value: team.totals.driversUsed },
    { key: 'championships', label: 'Championships', value: team.totals.championships },
  ];
}

/* ------------------------------------------------------------------ CN-4, the points split */

/**
 * §6.6.2.5 — one `ShareChart` row per season, segments per driver.
 *
 * **`racePoints`, not `season.points`, and the distinction is load-bearing.** `season.points` is
 * the *constructors'* championship figure under that era's rules; `racePoints` is the sum of the
 * driver's own race scores. They differ in any best-N era and in any season with a shared drive,
 * and the payload publishes `driverRacePointsTotal` precisely so the split's denominator is the
 * thing the split is a split of.
 *
 * A season the team scored nothing in produces a row whose segments all read 0 — `ShareChart`
 * detects the zero total itself and draws one labelled band rather than dividing by it. That is a
 * real and common state for a small constructor and it is not hidden.
 *
 * **Newest season first**, because a team's history reads backwards from the present the way a
 * driver's career table does.
 */
export function teamSplitRows(team: Team): ShareRow[] {
  return [...team.seasons]
    .sort((a, b) => b.year - a.year)
    .map((season) => ({
      key: String(season.year),
      label: String(season.year),
      segments: season.drivers.map((driver) => ({
        reference: driver.driverRef,
        teamReference: team.team.ref,
        label: `${driver.forename} ${driver.surname}`,
        /*
         * §6.5.4a's label rule: the sport's own code where the driver has one (107 of 881),
         * otherwise the **surname** — never a three-letter abbreviation derived from it, which
         * would invent a convention the data does not carry.
         */
        shortLabel: driver.code ?? driver.surname,
        value: driver.racePoints,
      })),
    }));
}

/* --------------------------------------------------------------------- CN-3, the lineup */

/**
 * §6.6.2.6 — one `SpanChart` row per driver, spans across the seasons they drove.
 *
 * **A driver with two separate spells gets two spans in one row.** Räikkönen at Ferrari and Alonso
 * at Renault are the obvious cases, and they are the whole reason this is a span chart rather than
 * a bar per driver: a bar could only say "drove here for six seasons" and would silently close the
 * gap in the middle.
 *
 * **Rows sort by first season ascending, then by surname** — never by success, which would encode
 * rank in vertical position and repaint the chart whenever a filter changed (§6.2).
 *
 * The measure is the **season**, not the lap, so a span runs `[year, year]` inclusive for a single
 * season and merges only across *consecutive* years. Merging across a gap is exactly the error this
 * form exists to avoid.
 */
export function teamLineupRows(team: Team, limit: number): { rows: SpanRow[]; total: number } {
  const byDriver = new Map<
    string,
    { label: string; sort: string; first: number; starts: number; years: number[] }
  >();

  for (const season of team.seasons) {
    for (const driver of season.drivers) {
      const existing = byDriver.get(driver.driverRef);
      if (existing === undefined) {
        byDriver.set(driver.driverRef, {
          label: driver.code ?? driver.surname,
          sort: driver.surname,
          first: season.year,
          starts: driver.starts,
          years: [season.year],
        });
      } else {
        existing.first = Math.min(existing.first, season.year);
        existing.starts += driver.starts;
        existing.years.push(season.year);
      }
    }
  }

  const all = [...byDriver.entries()];
  /*
   * The cap is by **starts**, so the roster shown is the drivers who actually raced most for the
   * team rather than the first alphabetically. It is stated in a note by the caller — a silently
   * truncated roster would be a lie, and Ferrari has raced far more than any plot can label.
   */
  const kept = [...all].sort((a, b) => b[1].starts - a[1].starts).slice(0, limit);

  const rows = kept
    .sort((a, b) => a[1].first - b[1].first || (a[1].sort < b[1].sort ? -1 : 1))
    .map(([reference, entry]) => ({
      reference,
      teamReference: team.team.ref,
      label: entry.label,
      spans: mergeYears(entry.years).map((span) => ({
        key: `${reference}:${String(span[0])}`,
        start: span[0],
        /*
         * `end + 1` because a span chart's measure is continuous and a season is a unit: a driver
         * who raced only in 1974 must occupy the width of one season, and `[1974, 1974]` is a span
         * of zero width that paints nothing. The axis is therefore "start of season", and the
         * formatter drops the extra tick.
         */
        end: span[1] + 1,
      })),
    }));

  return { rows, total: all.length };
}

/**
 * Collapse a list of years into inclusive runs of **consecutive** years.
 *
 * Pure, and the one piece of this file that could be wrong in a way nothing on screen would show: a
 * merge that ignored the gap would draw Räikkönen at Ferrari as one unbroken 2007–2018 span and
 * quietly delete the six seasons he spent at McLaren, Lotus and in rallying.
 */
export function mergeYears(years: readonly number[]): [number, number][] {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const year of sorted) {
    const last = runs.at(-1);
    if (last !== undefined && year === last[1] + 1) {
      last[1] = year;
      continue;
    }
    runs.push([year, year]);
  }
  return runs;
}
