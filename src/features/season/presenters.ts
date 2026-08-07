import type { Adjustment, CancelledRound, DriverTeam, SeasonRound } from '@schemas/season';
import type { DriverStandingRow, SeasonNoticeCode, TeamStandingRow } from './selectors';

/**
 * **Presentation logic for the season hub** — pure, React-free, and owned by the `designer`.
 *
 * The split from `selectors.ts` is deliberate and is a boundary, not a filing convention:
 * `selectors.ts` decides **what the data means** and is the `developer`'s; this file decides
 * **where a fact appears on screen and what it is called**, which is a design decision. Nothing
 * here computes a championship figure, sums a point, or resolves a colour.
 *
 * Everything is exported and unit-tested because jsdom performs no layout — arithmetic and
 * partitioning are the only parts of this surface a test can actually decide, so they are pulled
 * out of the components on purpose.
 */

/* --------------------------------------------------------------- where a notice belongs */

/**
 * The slot a notice is rendered in.
 *
 * `selectSeasonNotices` returns eight codes and a naive surface would stack all eight in one box
 * under the title. That is the wrong design: a notice is only useful **where it changes how a
 * number is read**. "Only a driver's best 4 results counted" belongs above the standings table
 * whose totals it explains; "2 rounds were cancelled" belongs on the calendar that is missing
 * them. So each code is routed to exactly one place, and the routing is a table rather than a
 * condition scattered across four components.
 *
 * The `developer`'s comment on `SeasonNoticeCode` calls the code "the seam that lets [the
 * designer] replace a sentence without the sentence having to be right in two places". This is
 * that seam being used.
 */
export type NoticeSlot = 'masthead' | 'calendar' | 'standings' | 'constructors' | 'page';

const NOTICE_SLOTS: Record<SeasonNoticeCode, NoticeSlot> = {
  /* The masthead already states "10 of 22" and draws the dial; the sentence sits under it. */
  inProgress: 'masthead',
  /* The calendar owns the cancelled rounds — it is the only surface that renders them. */
  cancelledRounds: 'calendar',
  /* Lap coverage is a property of the rounds, and the calendar is the list of rounds. Nothing
   * on this surface charts lap data, so this notice is a signpost for the race pages. */
  noLapData: 'calendar',
  partialLapData: 'calendar',
  /* The two that make a points total mean something other than what it looks like. */
  bestNResults: 'standings',
  limitedResults: 'standings',
  /* Not a note beside a table — it *replaces* the table (1950–57). */
  noTeamChampionship: 'constructors',
  /* A season with no rounds at all has nothing else to say. */
  noStandings: 'page',
};

export function noticeSlot(code: SeasonNoticeCode): NoticeSlot {
  return NOTICE_SLOTS[code];
}

export function noticesFor<T extends { code: SeasonNoticeCode }>(
  notices: readonly T[],
  slot: NoticeSlot,
): T[] {
  return notices.filter((notice) => noticeSlot(notice.code) === slot);
}

/* ------------------------------------------------------------------------- the calendar */

/**
 * One row of the calendar, numbered or not.
 *
 * A **discriminated union rather than a nullable `round`**, for the same reason the payload keeps
 * cancelled rounds in their own array (trap 15): a cancelled round has no number, is not
 * addressable, and every consumer would otherwise have to remember to check. Here the type makes
 * a component that reads `entry.round` on a cancelled row a compile error.
 */
export type CalendarEntry =
  | { kind: 'round'; key: string; round: SeasonRound }
  | { kind: 'cancelled'; key: string; round: CancelledRound };

/**
 * The calendar in **date order, with cancelled rounds in place** — not numbered rounds first and
 * a cancelled appendix underneath.
 *
 * This is a design decision with a factual justification. 2026 has 24 calendar rows and 22
 * numbered rounds; the two cancelled ones fall in April, between rounds 3 and 4. Filing them at
 * the bottom would present a tidy 1–22 sequence and quietly delete the fact that the season had a
 * five-week hole in it. In place, with an em-dash where the number goes, the sequence tells the
 * truth: these happened here, and they carry no number.
 *
 * The sort is by date with the round number as the tie-break, so two events on one date order
 * stably rather than by array position.
 */
export function mergeCalendar(
  rounds: readonly SeasonRound[],
  cancelled: readonly CancelledRound[],
): CalendarEntry[] {
  const entries: CalendarEntry[] = [
    ...rounds.map((round): CalendarEntry => ({
      kind: 'round',
      key: `r${String(round.round)}`,
      round,
    })),
    ...cancelled.map((round, i): CalendarEntry => ({
      kind: 'cancelled',
      key: `c${String(i)}-${round.date}`,
      round,
    })),
  ];

  return entries.sort((a, b) => {
    if (a.round.date !== b.round.date) return a.round.date < b.round.date ? -1 : 1;
    const an = a.kind === 'round' ? a.round.round : Number.POSITIVE_INFINITY;
    const bn = b.kind === 'round' ? b.round.round : Number.POSITIVE_INFINITY;
    return an - bn;
  });
}

/**
 * What the round-status column says. Three states, and **none of them is an error**.
 *
 * `upcoming` is the one most easily got wrong: a race that has not happened is not missing data
 * (REQUIREMENTS.md §2.2), so it never renders as an empty result or a dash in the winner column —
 * it renders as a scheduled date.
 */
export type RoundStatus = 'raced' | 'upcoming' | 'cancelled';

export function roundStatus(entry: CalendarEntry): RoundStatus {
  if (entry.kind === 'cancelled') return 'cancelled';
  return entry.round.hasResults ? 'raced' : 'upcoming';
}

/* ------------------------------------------------------------------------ the season dial */

/** One tick of the masthead dial — the whole calendar as 24 marks. */
export interface DialCell {
  key: string;
  status: RoundStatus;
  /** The tick's accessible reading, e.g. `Round 4, Japanese Grand Prix, raced`. */
  label: string;
}

export function dialCells(entries: readonly CalendarEntry[]): DialCell[] {
  return entries.map((entry) => {
    const status = roundStatus(entry);
    const name = entry.round.name;
    const prefix = entry.kind === 'round' ? `Round ${String(entry.round.round)}, ` : '';
    const suffix =
      status === 'raced' ? 'raced' : status === 'upcoming' ? 'still to come' : 'cancelled';
    return { key: entry.key, status, label: `${prefix}${name} — ${suffix}` };
  });
}

/* --------------------------------------------------------------------------- standings */

/**
 * The three groups a standings table has to separate, and why a single sorted list is wrong.
 *
 * `position === null` covers two completely different situations, and the payload's own schema
 * says so: a driver who **scored nothing** (13,701 of 13,718 rows) and a driver or team the
 * stewards **excluded** (the other 17, plus 2007 McLaren). Rendering both as "unranked" would file
 * 1997 Michael Schumacher — 78 points, excluded from the classification — in the same bucket as a
 * one-race entrant who scored none, and he is the story of that season.
 *
 * So:
 *
 * - **`classified`** — everyone with a position. The table.
 * - **`excluded`** — `adjustment === 'excluded'`. Stays in the table, at the bottom, with its
 *   points and wins shown and an `EXCLUDED` marker. 2007 McLaren reads 0 points beside 8 wins and
 *   that has to look deliberate.
 * - **`unscored`** — no position, no exclusion. 1950 has 81 driver rows and 22 ranked ones; the
 *   other 59 are mostly Indianapolis 500 entrants. Fifty-nine rows of zeros would drown the
 *   twenty-two that matter, so they go behind a disclosure that **states its own count** rather
 *   than being dropped.
 */
export interface StandingsGroups<Row> {
  classified: Row[];
  excluded: Row[];
  unscored: Row[];
}

export function groupStandings<Row extends { position: number | null; adjustment: Adjustment }>(
  rows: readonly Row[],
): StandingsGroups<Row> {
  const groups: StandingsGroups<Row> = { classified: [], excluded: [], unscored: [] };
  for (const row of rows) {
    if (row.position !== null) groups.classified.push(row);
    else if (row.adjustment === 'excluded') groups.excluded.push(row);
    else groups.unscored.push(row);
  }
  return groups;
}

/**
 * The team column for a driver row.
 *
 * A mid-season change is ordinary — 1976 alone has 59 driver-team pairs across 23 drivers — and
 * collapsing it to "their last team" quietly rewrites history, which is the payload's own reason
 * for sending an array. Two teams read as a lineage (`Talbot-Lago → Ferrari`, 1951 González),
 * which is genuinely informative at a glance. Three or more would blow the column width apart, so
 * those show first and last with the count.
 */
export interface TeamLineage {
  label: string;
  /** The count, when it is not simply the number of names shown. Null otherwise. */
  count: number | null;
}

export function teamLineage(teams: readonly DriverTeam[]): TeamLineage {
  if (teams.length === 0) return { label: '—', count: null };
  if (teams.length <= 2) {
    return { label: teams.map((team) => team.name).join(' → '), count: null };
  }
  const first = teams[0];
  const last = teams[teams.length - 1];
  if (first === undefined || last === undefined) return { label: '—', count: null };
  return { label: `${first.name} → ${last.name}`, count: teams.length };
}

/**
 * The adjustment marker's copy. **Annotate, never re-apply** — the figure in the payload is
 * already post-penalty (2020 Racing Point reads 195, the post-penalty total), so subtracting
 * anything here would double-count it.
 */
export interface AdjustmentNote {
  chip: string;
  detail: string;
}

export function adjustmentNote(
  adjustment: Adjustment,
  kind: 'driver' | 'team',
): AdjustmentNote | null {
  const subject = kind === 'driver' ? 'This driver was' : 'This team was';
  if (adjustment === 'excluded') {
    return {
      chip: 'Excluded',
      detail: `${subject} excluded from the final championship classification. The points and wins shown are as the record holds them.`,
    };
  }
  if (adjustment === 'adjusted') {
    return {
      chip: 'Adjusted',
      detail: `${subject} given a championship adjustment. The total shown is the official figure after it was applied.`,
    };
  }
  return null;
}

/**
 * The one line the masthead leads with: who is winning, or who won.
 *
 * Reads the **first classified row**, never `rows[0]` — the payload orders unranked entities last,
 * but an excluded entity with 78 points is not the champion and a `[0]` would eventually find one.
 */
export function titleHolder<Row extends { position: number | null }>(
  rows: readonly Row[],
): Row | null {
  return rows.find((row) => row.position === 1) ?? null;
}

export interface TitleCard {
  /** `Drivers' Champion` / `Championship leader`. */
  eyebrow: string;
  name: string;
  detail: string;
  colorRef: string;
  points: number;
  wins: number;
}

export function driverTitleCard(
  rows: readonly DriverStandingRow[],
  isComplete: boolean,
): TitleCard | null {
  const holder = titleHolder(rows);
  if (holder === null) return null;
  return {
    eyebrow: isComplete ? "Drivers' Champion" : 'Championship leader',
    name: `${holder.forename} ${holder.surname}`,
    detail: holder.principalTeam?.name ?? 'No team recorded',
    colorRef: holder.colorRef,
    points: holder.points,
    wins: holder.wins,
  };
}

export function teamTitleCard(
  rows: readonly TeamStandingRow[],
  isComplete: boolean,
): TitleCard | null {
  const holder = titleHolder(rows);
  if (holder === null) return null;
  return {
    eyebrow: isComplete ? "Constructors' Champion" : 'Constructors leader',
    name: holder.name,
    detail: holder.nationality ?? 'Nationality not recorded',
    colorRef: holder.colorRef,
    points: holder.points,
    wins: holder.wins,
  };
}

/* ----------------------------------------------------------------------- season picker */

/** Seasons grouped by decade, newest decade first, newest year first inside it. */
export interface DecadeGroup {
  decade: number;
  label: string;
  years: number[];
}

export function decadeGroups(years: readonly number[]): DecadeGroup[] {
  const byDecade = new Map<number, number[]>();
  for (const year of years) {
    const decade = Math.floor(year / 10) * 10;
    const group = byDecade.get(decade);
    if (group === undefined) byDecade.set(decade, [year]);
    else group.push(year);
  }

  return [...byDecade.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([decade, group]) => ({
      decade,
      label: `${String(decade)}s`,
      years: [...group].sort((a, b) => b - a),
    }));
}

/**
 * The previous and next season that actually exist in the data.
 *
 * Derived from the season list rather than `year ± 1`, so the arrows are never a link to a 404 —
 * and so the ends of the range disable rather than dead-end.
 */
export function adjacentSeasons(
  years: readonly number[],
  year: number,
): { previous: number | null; next: number | null } {
  let previous: number | null = null;
  let next: number | null = null;
  for (const candidate of years) {
    if (candidate < year && (previous === null || candidate > previous)) previous = candidate;
    if (candidate > year && (next === null || candidate < next)) next = candidate;
  }
  return { previous, next };
}
