import type { CircuitListItem, DriverListItem, TeamListItem } from '@schemas/directory';
import {
  buildHaystack,
  driverSortKey,
  normalise,
  type FigureColumn,
  type IndexItem,
  type SortOption,
} from './indexModel';

/**
 * **Payload → row.** `DESIGN_SYSTEM.md` §6.6.4.
 *
 * The one place the three directory payloads meet the one surface that renders them, and the only
 * file that has to change if a field moves. Pure, so every decision below is asserted directly
 * rather than through a rendered list of 881 rows.
 *
 * ---
 *
 * **What the payload carries, and what the design had to give up.** `server/schemas/directory.ts`
 * rules that these endpoints are a **directory, not a dashboard**: `ref`, name, nationality,
 * `races`, `firstSeason`, `lastSeason` — and deliberately **no wins, no championships, no team
 * reference**. Three consequences, recorded rather than worked around:
 *
 * 1. **There is no wins or titles sort**, and no championship marker on the rail. The rail's accent
 *    marks the entities still going in the archive's latest season instead — which is available,
 *    is what a browsing reader actually wants, and is redundantly encoded by the bracket's own
 *    position.
 * 2. **A driver row carries no identity colour**, because a driver's colour is their team's and no
 *    `teamRef` crosses this boundary. Team rows keep theirs, since a team's reference *is* its
 *    identity. Requested of the engineer rather than invented here.
 * 3. **There is no `seasonsEntered`**, so the index cannot show the count-versus-span discrepancy
 *    the profile page does. The rail is still a bracket rather than a fill, which is what stops it
 *    *claiming* the years between.
 *
 * **`latest` is derived from the payload, not from `/api/meta`.** The most recent season any entity
 * in the list reached is, by construction, the most recent season the archive holds results for —
 * so the activity mark needs no second request, no cross-feature dependency and no hard-coded year.
 */

/** The most recent season anything in the list reached. `null` when nothing did. */
function latestSeason(seasons: readonly (number | null)[]): number | null {
  let latest: number | null = null;
  for (const season of seasons) {
    if (season !== null && (latest === null || season > latest)) latest = season;
  }
  return latest;
}

/* ------------------------------------------------------------------------------- drivers */

export const DRIVER_COLUMNS: readonly FigureColumn[] = [
  { key: 'races', label: 'Races', priority: 1 },
  { key: 'debut', label: 'Debut', priority: 2 },
  /* `Latest`, never `Final`: 20-odd of these drivers are racing right now, and a column headed
   * `Final` would state that their career is over. */
  { key: 'latest', label: 'Latest', priority: 3 },
];

export const DRIVER_SORTS: readonly SortOption[] = [
  { id: 'az', label: 'A–Z', figure: null, by: 'name', group: 'letter' },
  /* `figure: 1` highlights the Debut column without changing what the comparator reads — the
   * emphasis is the whole indication of what you are sorted by (§6.6.4.2). */
  { id: 'debut', label: 'Debut', figure: 1, by: 'debut', group: 'decade' },
  { id: 'races', label: 'Races', figure: 0, by: 'figure', group: 'none' },
];

export function driverItems(rows: readonly DriverListItem[]): IndexItem[] {
  const latest = latestSeason(rows.map((row) => row.lastSeason));

  return rows.map((row) => {
    const title = `${row.forename} ${row.surname}`;
    const raced = row.races > 0;

    return {
      ref: row.ref,
      href: `/drivers/${row.ref}`,
      title,
      sortKey: driverSortKey(row.forename, row.surname),
      /* The reference is in the haystack because it is what a URL carries and what a reader who
       * arrived from a link might type back. */
      haystack: buildHaystack([
        row.forename,
        row.surname,
        row.code,
        row.nationality,
        row.countryCode,
        row.ref,
      ]),
      code: row.code,
      subtitle: row.nationality,
      /* No `teamRef` on this payload — see the module header. */
      identityRef: null,
      markKind: 'driver',
      firstSeason: row.firstSeason,
      lastSeason: row.lastSeason,
      isCurrent: latest !== null && row.lastSeason === latest,
      raced,
      chip: raced ? null : 'Never raced',
      /*
       * **`races` renders its measured `0`; the two season columns render `—`.** That is the
       * §1.0 distinction rather than an inconsistency: `0` is what the query counted, and
       * `firstSeason` is genuinely absent — the schema makes it null *exactly* when `races` is 0.
       * Printing `0` for a debut year would state a season that does not exist.
       */
      figures: [row.races, row.firstSeason, row.lastSeason],
      ariaLabel: driverAriaLabel(row, title),
    };
  });
}

function driverAriaLabel(row: DriverListItem, title: string): string {
  const parts = [title];
  if (row.nationality !== null) parts.push(row.nationality);
  if (row.races === 0) {
    parts.push('never started a Grand Prix');
  } else {
    parts.push(row.races === 1 ? '1 race' : `${String(row.races)} races`);
    if (row.firstSeason !== null && row.lastSeason !== null) {
      parts.push(
        row.firstSeason === row.lastSeason
          ? String(row.firstSeason)
          : `${String(row.firstSeason)} to ${String(row.lastSeason)}`,
      );
    }
  }
  return parts.join(', ');
}

/* --------------------------------------------------------------------------------- teams */

export const TEAM_COLUMNS: readonly FigureColumn[] = [
  { key: 'races', label: 'Races', priority: 1 },
  { key: 'debut', label: 'Debut', priority: 2 },
  { key: 'latest', label: 'Latest', priority: 3 },
];

export const TEAM_SORTS: readonly SortOption[] = [
  { id: 'az', label: 'A–Z', figure: null, by: 'name', group: 'letter' },
  { id: 'debut', label: 'Debut', figure: 1, by: 'debut', group: 'decade' },
  { id: 'races', label: 'Races', figure: 0, by: 'figure', group: 'none' },
];

export function teamItems(rows: readonly TeamListItem[]): IndexItem[] {
  const latest = latestSeason(rows.map((row) => row.lastSeason));

  return rows.map((row) => {
    const raced = row.races > 0;
    return {
      ref: row.ref,
      href: `/teams/${row.ref}`,
      title: row.name,
      sortKey: normalise(row.name),
      haystack: buildHaystack([row.name, row.nationality, row.countryCode, row.ref]),
      code: null,
      subtitle: row.nationality,
      /* A team *is* its own identity, so unlike a driver row this one carries a colour — the
       * brand colour for 12 of 214, the deterministic ramp slot for the rest (§3.3a.3). */
      identityRef: row.ref,
      markKind: 'team',
      firstSeason: row.firstSeason,
      lastSeason: row.lastSeason,
      isCurrent: latest !== null && row.lastSeason === latest,
      raced,
      chip: raced ? null : 'Never raced',
      figures: [row.races, row.firstSeason, row.lastSeason],
      ariaLabel: teamAriaLabel(row),
    };
  });
}

function teamAriaLabel(row: TeamListItem): string {
  const parts = [row.name];
  if (row.nationality !== null) parts.push(row.nationality);
  if (row.races === 0) {
    parts.push('entered and never started a Grand Prix');
  } else {
    parts.push(row.races === 1 ? '1 race' : `${String(row.races)} races`);
    if (row.firstSeason !== null && row.lastSeason !== null) {
      parts.push(
        row.firstSeason === row.lastSeason
          ? String(row.firstSeason)
          : `${String(row.firstSeason)} to ${String(row.lastSeason)}`,
      );
    }
  }
  return parts.join(', ');
}

/* ------------------------------------------------------------------------------ circuits */

export const CIRCUIT_COLUMNS: readonly FigureColumn[] = [
  { key: 'races', label: 'Grands Prix', priority: 1 },
  { key: 'first', label: 'First', priority: 2 },
  { key: 'latest', label: 'Latest', priority: 3 },
  /*
   * `Rounds` last, and it earns its column only at ≥1280 because it differs from `Grands Prix`
   * on very few venues — Monza reads 76 and 75, the 76th being 2026's, not yet run. Two numbers
   * because they are two facts (`server/schemas/directory.ts`), never a date comparison.
   */
  { key: 'rounds', label: 'Rounds', priority: 4 },
];

export const CIRCUIT_SORTS: readonly SortOption[] = [
  { id: 'az', label: 'A–Z', figure: null, by: 'name', group: 'letter' },
  { id: 'first', label: 'First held', figure: 1, by: 'debut', group: 'decade' },
  { id: 'races', label: 'Grands Prix', figure: 0, by: 'figure', group: 'none' },
];

export function circuitItems(rows: readonly CircuitListItem[]): IndexItem[] {
  const latest = latestSeason(rows.map((row) => row.lastYear));

  return rows.map((row) => {
    const raced = row.racesWithResults > 0;
    const place = [row.locality, row.country].filter((part) => part !== null).join(', ');

    return {
      ref: row.ref,
      href: `/circuits/${row.ref}`,
      title: row.name,
      sortKey: normalise(row.name),
      haystack: buildHaystack([row.name, row.locality, row.country, row.countryCode, row.ref]),
      code: null,
      subtitle: place === '' ? null : place,
      /* §6.6.2.1 — a circuit has no identity colour and must not borrow one, so it takes no
       * colour and no mark column at all. */
      identityRef: null,
      markKind: null,
      firstSeason: row.firstYear,
      lastSeason: row.lastYear,
      isCurrent: latest !== null && row.lastYear === latest,
      raced,
      /*
       * **`Not yet raced`, never `Never raced`.** A venue with a numbered round and no
       * classification rows is on the calendar — Madring is 2026 R14 — and calling that a gap
       * would repeat the mistake `SeasonCalendar` fixed for an upcoming round.
       */
      chip: raced ? null : 'Not yet raced',
      figures: [row.racesWithResults, row.firstYear, row.lastYear, row.roundsHeld],
      ariaLabel: circuitAriaLabel(row, place),
    };
  });
}

function circuitAriaLabel(row: CircuitListItem, place: string): string {
  const parts = [row.name];
  if (place !== '') parts.push(place);
  if (row.racesWithResults === 0) {
    parts.push('no Grand Prix run here yet');
  } else {
    parts.push(
      row.racesWithResults === 1 ? '1 Grand Prix' : `${String(row.racesWithResults)} Grands Prix`,
    );
    if (row.firstYear !== null && row.lastYear !== null) {
      parts.push(
        row.firstYear === row.lastYear
          ? String(row.firstYear)
          : `${String(row.firstYear)} to ${String(row.lastYear)}`,
      );
    }
  }
  return parts.join(', ');
}

/* ------------------------------------------------------------------------------ the facts */

/** The masthead's fact line. Every figure is counted from the payload, never hardcoded. */
export function indexFacts(
  items: readonly IndexItem[],
  noun: string,
): { label: string; value: string; mono?: boolean }[] {
  if (items.length === 0) return [];

  const latest = latestSeason(items.map((item) => item.lastSeason));
  const earliest = items.reduce<number | null>(
    (least, item) =>
      item.firstSeason === null
        ? least
        : least === null
          ? item.firstSeason
          : Math.min(least, item.firstSeason),
    null,
  );
  const current = items.filter((item) => item.isCurrent).length;

  /*
   * **`N in the record`, not `N drivers`.** The console's live count sits 40px below this line and
   * reads `881 drivers`; the same sentence twice, that close together, reads as a rendering fault.
   * The two are also different claims — this one is the archive's size and never changes as you
   * type, which is why it belongs on the masthead rather than in the control.
   */
  const facts: { label: string; value: string; mono?: boolean }[] = [
    { label: `${noun} in the record`, value: `${String(items.length)} in the record`, mono: true },
  ];
  if (earliest !== null && latest !== null) {
    facts.push({ label: 'Span', value: `${String(earliest)}–${String(latest)}`, mono: true });
    facts.push({
      label: `Racing in ${String(latest)}`,
      value: `${String(current)} racing in ${String(latest)}`,
      mono: true,
    });
  }
  return facts;
}

/** How many rows have nothing to plot — the number the panel notice states. */
export function racelessCount(items: readonly IndexItem[]): number {
  return items.filter((item) => !item.raced).length;
}
