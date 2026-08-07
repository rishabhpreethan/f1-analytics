import type { Meta } from '@schemas/meta';
import type {
  Adjustment,
  CancelledRound,
  DriverStanding,
  DriverTeam,
  Scoring,
  Season,
  SeasonRound,
  StandingsProgression,
  TeamStanding,
} from '@schemas/season';

/**
 * Where the season hub's logic lives. Every function here is pure, synchronous,
 * React-free and unit-tested, and none of them mutates its input (ARCHITECTURE.md §3:
 * chart components never query; shaping lives in selectors).
 *
 * **No function here resolves a colour.** Series carry `colorRef`, which is a
 * `team.reference` — the one field `src/lib/entityColor.ts` takes — and the mapping from
 * that to a token is the `designer`'s, in one module, by contract (DESIGN_SYSTEM.md
 * §3.3a.3). Nothing in this file knows a hex exists.
 *
 * **No function here sums points.** Every points figure originates in
 * `driver_championship` / `team_championship` and arrives already scored by the era's
 * rules. The only arithmetic performed is `selectGapToLeader`'s subtraction, which is
 * within one season and therefore within one points system.
 */

/* ------------------------------------------------------------------- resolving a year */

export type SeasonYearStatus = 'resolving' | 'resolved' | 'defaulted';

export interface ResolvedSeasonYear {
  /** null only while `/api/meta` has not answered and the URL carries no year. */
  year: number | null;
  status: SeasonYearStatus;
  /** The year in the URL that could not be used, for the notice. */
  rejected: string | null;
}

/**
 * Turn the `:year` route parameter into a season to show.
 *
 * `/seasons` and `/seasons/:year` are one surface with two entry points
 * (ARCHITECTURE.md §5), so the bare form has to resolve its year from `/api/meta` and
 * cannot render until it has.
 *
 * A URL that names a year outside the data **degrades to the default with a visible
 * notice — never a blank page and never a crash** (ARCHITECTURE.md §5). It returns
 * `rejected` rather than throwing, so the caller renders the hub *and* the explanation
 * instead of an error surface for what is usually a typo.
 *
 * The four-digit test mirrors the server's `yearParamSchema` deliberately: a client that
 * accepted `1990.0` would send a request the server answers with a 400, turning a
 * recoverable typo into a failed fetch.
 */
export function resolveSeasonYear(
  param: string | undefined,
  meta: Meta | undefined,
): ResolvedSeasonYear {
  const fallback =
    meta === undefined ? null : (meta.latestCompletedRound?.year ?? meta.seasons.latestYear);

  if (param === undefined) {
    return {
      year: fallback,
      status: fallback === null ? 'resolving' : 'resolved',
      rejected: null,
    };
  }

  if (!/^\d{4}$/.test(param)) {
    return {
      year: fallback,
      status: fallback === null ? 'resolving' : 'defaulted',
      rejected: param,
    };
  }

  const year = Number(param);

  // Without meta there is nothing to check the range against. Trusting the URL is right
  // here: the server is the authority and answers 404 if it is wrong, which is a better
  // outcome than refusing to fetch a year that is probably fine.
  if (meta === undefined) return { year, status: 'resolved', rejected: null };

  if (year < meta.seasons.firstYear || year > meta.seasons.latestYear) {
    return { year: fallback, status: 'defaulted', rejected: param };
  }

  return { year, status: 'resolved', rejected: null };
}

/* --------------------------------------------------------------------------- calendar */

export interface SeasonCalendar {
  /** Rounds with classification rows, in order. */
  completed: SeasonRound[];
  /** Rounds still to come. Not missing data (REQUIREMENTS.md §2.2). */
  upcoming: SeasonRound[];
  /** Not a data gap either — a fact about the calendar (trap 12). */
  cancelled: CancelledRound[];
  latestCompleted: SeasonRound | null;
  next: SeasonRound | null;
}

/**
 * Split the calendar the way SC-4 asks for it.
 *
 * **The split is on `hasResults`, never on the date.** The dump may lag the real calendar
 * by a couple of weeks — 2026 R11 has a date in the past and no results — so a
 * date-driven split would render a race as "completed" with nothing in it
 * (REQUIREMENTS.md §2.5).
 */
export function selectCalendar(season: Season): SeasonCalendar {
  const completed = season.rounds.filter((round) => round.hasResults);
  const upcoming = season.rounds.filter((round) => !round.hasResults);
  return {
    completed,
    upcoming,
    cancelled: season.cancelledRounds,
    latestCompleted: completed.at(-1) ?? null,
    next: upcoming[0] ?? null,
  };
}

/* ---------------------------------------------------------------------------- notices */

export type SeasonNoticeCode =
  | 'inProgress'
  | 'cancelledRounds'
  | 'bestNResults'
  | 'limitedResults'
  | 'noTeamChampionship'
  | 'noLapData'
  | 'partialLapData'
  | 'noStandings';

export interface SeasonNotice {
  code: SeasonNoticeCode;
  text: string;
}

/**
 * Everything a season needs to say about itself before a number is read.
 *
 * This is REQUIREMENTS.md §5.3 (*"where a season lacks data for a chart, say which data
 * is missing and from when it exists"*) and §5.2 (*"any cross-era surface must display
 * the normalization it used"*) turned into data, so a surface renders notices rather than
 * remembering to write them. It returns a `code` beside the text: the `designer` owns
 * copy, and a code is the seam that lets it replace a sentence without the sentence
 * having to be right in two places.
 *
 * **`bestNResults` is the one that prevents a real error of fact.** 1950's 30 points and
 * 2026's 30 points are not the same quantity, and a season hub that shows a 1950 total
 * without saying only four results counted has misled its reader.
 */
export function selectSeasonNotices(season: Season): SeasonNotice[] {
  const notices: SeasonNotice[] = [];
  const year = String(season.year);

  if (season.rounds.length === 0) {
    notices.push({ code: 'noStandings', text: `No rounds are recorded for ${year}.` });
    return notices;
  }

  if (!season.isComplete) {
    const remaining = season.scheduledRounds - season.completedRounds;
    notices.push({
      code: 'inProgress',
      text:
        remaining === 1
          ? `The ${year} season is in progress — ${String(season.completedRounds)} of ${String(season.scheduledRounds)} rounds complete, 1 still to come.`
          : `The ${year} season is in progress — ${String(season.completedRounds)} of ${String(season.scheduledRounds)} rounds complete, ${String(remaining)} still to come.`,
    });
  }

  if (season.cancelledRounds.length > 0) {
    const names = season.cancelledRounds.map((round) => round.name).join(' and ');
    notices.push({
      code: 'cancelledRounds',
      text:
        season.cancelledRounds.length === 1
          ? `1 round on the ${year} calendar was cancelled: ${names}. It carries no round number and does not count toward the total.`
          : `${String(season.cancelledRounds.length)} rounds on the ${year} calendar were cancelled: ${names}. They carry no round number and do not count toward the total.`,
    });
  }

  notices.push(...scoringNotices(season.scoring, year));

  const withResults = season.rounds.filter((round) => round.hasResults);
  const withLaps = withResults.filter((round) => round.hasLapData);
  if (withResults.length > 0 && withLaps.length === 0) {
    notices.push({
      code: 'noLapData',
      text: `Lap-by-lap timing isn't available for ${year}. ${year} has full race classifications, grids and championship standings.`,
    });
  } else if (withLaps.length > 0 && withLaps.length < withResults.length) {
    notices.push({
      code: 'partialLapData',
      text: `Lap-by-lap timing is available for ${String(withLaps.length)} of the ${String(withResults.length)} completed rounds in ${year}.`,
    });
  }

  return notices;
}

function scoringNotices(scoring: Scoring, year: string): SeasonNotice[] {
  const notices: SeasonNotice[] = [];

  if (scoring.driverCounting === 'bestN' && scoring.driverBestResults !== null) {
    notices.push({
      code: 'bestNResults',
      text: `In ${year} only a driver's best ${String(scoring.driverBestResults)} results counted toward the championship, so a season total is not the sum of their race points.`,
    });
  } else if (scoring.driverCounting === 'limited') {
    // The 1967–78 case. The data records that a limit applied and does not record what it
    // was, and saying so is the only honest option — a guessed N here would be a silent
    // cross-era error, which is the class REQUIREMENTS.md §5.2 exists to prevent.
    notices.push({
      code: 'limitedResults',
      text: `${year} did not count every result toward the championship. The standings shown are the official ones; the exact rule isn't recorded in this dataset.`,
    });
  }

  if (scoring.teamCounting === 'none') {
    notices.push({
      code: 'noTeamChampionship',
      text: `There was no Constructors' Championship in ${year}. It began in 1958.`,
    });
  }

  return notices;
}

/* -------------------------------------------------------------------------- standings */

export interface DriverStandingRow extends DriverStanding {
  /**
   * The team to show beside the name — the last one they raced for. `null` when the
   * driver holds a championship position without a race entry in the season, which the
   * data does produce.
   */
  principalTeam: DriverTeam | null;
  /** True when the driver raced for more than one team. A fact worth a marker. */
  changedTeam: boolean;
  /** `team.reference`, which is all `entityColor` takes. Falls back to the driver's. */
  colorRef: string;
}

export function selectDriverStandings(season: Season): DriverStandingRow[] {
  return season.standings.drivers.map((driver) => {
    const principalTeam = driver.teams.at(-1) ?? null;
    return {
      ...driver,
      principalTeam,
      changedTeam: driver.teams.length > 1,
      colorRef: principalTeam?.ref ?? driver.driverRef,
    };
  });
}

export interface TeamStandingRow extends TeamStanding {
  colorRef: string;
}

export function selectTeamStandings(season: Season): TeamStandingRow[] {
  return season.standings.teams.map((team) => ({ ...team, colorRef: team.teamRef }));
}

/* ------------------------------------------------------------------- chart-ready data */

export interface SeriesPoint {
  round: number;
  /** null is a genuine absence — a round the entity holds no ranked position in. */
  value: number | null;
}

export interface ProgressionSeries {
  /** Stable identity: the driver's or the team's `reference`. Never an index. */
  key: string;
  kind: 'driver' | 'team';
  /**
   * What `src/lib/entityColor.ts` takes. A driver plots in their team's colour, so this
   * is the team's `reference` — the driver's own only when they have no team in the
   * season, which keeps it deterministic rather than undefined.
   */
  colorRef: string;
  /** Full name for a legend or a direct label. */
  label: string;
  /** `driver.abbreviation` where one exists — null before the code era, not ''. */
  shortLabel: string | null;
  adjustment: Adjustment;
  points: SeriesPoint[];
}

export type SeriesKind = 'driver' | 'team';

export interface SeriesOptions {
  /**
   * Keep only these entities, by `reference`, in **this order**. Used by the comparison
   * tray, which caps at 4 (DESIGN_SYSTEM.md §6.2).
   */
  only?: readonly string[];
  /** Keep the first N of the field, which is already ordered by final standing. */
  limit?: number;
}

function seriesOf(progression: StandingsProgression, kind: SeriesKind): ProgressionSeries[] {
  if (kind === 'team') {
    return progression.teams.map((team) => ({
      key: team.teamRef,
      kind,
      colorRef: team.teamRef,
      label: team.name,
      shortLabel: null,
      adjustment: team.adjustment,
      points: team.progression.map((point) => ({ round: point.round, value: point.points })),
    }));
  }
  return progression.drivers.map((driver) => ({
    key: driver.driverRef,
    kind,
    colorRef: driver.teams.at(-1)?.ref ?? driver.driverRef,
    label: `${driver.forename} ${driver.surname}`,
    shortLabel: driver.code,
    adjustment: driver.adjustment,
    points: driver.progression.map((point) => ({ round: point.round, value: point.points })),
  }));
}

/**
 * Apply the filter **after** the series are built, never before.
 *
 * This is what keeps colour off rank (DESIGN_SYSTEM.md §6.2): `colorRef` is fixed by the
 * entity's own identity, so removing a series cannot repaint the survivors. Filtering
 * earlier would be equivalent today and would make an index-based palette possible
 * tomorrow.
 */
function applyOptions(
  series: ProgressionSeries[],
  options: SeriesOptions | undefined,
): ProgressionSeries[] {
  if (options?.only !== undefined) {
    const wanted = options.only;
    const byKey = new Map(series.map((entry) => [entry.key, entry]));
    return wanted.flatMap((key) => {
      const entry = byKey.get(key);
      return entry === undefined ? [] : [entry];
    });
  }
  if (options?.limit !== undefined) return series.slice(0, Math.max(0, options.limit));
  return series;
}

/** SC-1 — cumulative championship points by round. */
export function selectProgressionSeries(
  progression: StandingsProgression,
  kind: SeriesKind,
  options?: SeriesOptions,
): ProgressionSeries[] {
  return applyOptions(seriesOf(progression, kind), options);
}

/**
 * SC-1's companion — the same series with **championship position** on the y-axis.
 *
 * `null` where the entity held no ranked position at that round, which is not the same
 * as position 0 and not the same as last. The chart draws a gap; DESIGN_SYSTEM.md §6.6
 * inverts this axis so P1 is at the top.
 */
export function selectPositionSeries(
  progression: StandingsProgression,
  kind: SeriesKind,
  options?: SeriesOptions,
): ProgressionSeries[] {
  const source = kind === 'team' ? progression.teams : progression.drivers;
  const positions = new Map(
    source.map((entry) => [
      'teamRef' in entry ? entry.teamRef : entry.driverRef,
      new Map(entry.progression.map((point) => [point.round, point.position])),
    ]),
  );

  const series = seriesOf(progression, kind).map((entry) => ({
    ...entry,
    points: entry.points.map((point) => ({
      round: point.round,
      value: positions.get(entry.key)?.get(point.round) ?? null,
    })),
  }));

  return applyOptions(series, options);
}

/**
 * SC-2 — points gap to the championship leader, per round. Zero is the leader; every
 * other value is negative.
 *
 * **The leader is the leader of the whole field, not of the filtered selection.** That is
 * the entire meaning of the metric: comparing two midfielders should show both a long way
 * below zero, not one of them artificially on the baseline. So the maximum is computed
 * across the full progression and the filter is applied afterwards.
 *
 * A round an entity has no snapshot for produces no point at all rather than a zero —
 * a driver who joined at round 6 was not level with the leader for five rounds.
 */
export function selectGapToLeader(
  progression: StandingsProgression,
  kind: SeriesKind,
  options?: SeriesOptions,
): ProgressionSeries[] {
  const full = seriesOf(progression, kind);

  const leaderByRound = new Map<number, number>();
  for (const entry of full) {
    for (const point of entry.points) {
      if (point.value === null) continue;
      const best = leaderByRound.get(point.round);
      if (best === undefined || point.value > best) leaderByRound.set(point.round, point.value);
    }
  }

  const gaps = full.map((entry) => ({
    ...entry,
    points: entry.points.flatMap((point) => {
      const leader = leaderByRound.get(point.round);
      if (point.value === null || leader === undefined) return [];
      return [{ round: point.round, value: point.value - leader }];
    }),
  }));

  return applyOptions(gaps, options);
}

/** The shared category axis for every progression chart — the rounds with a snapshot. */
export function selectRoundAxis(progression: StandingsProgression): number[] {
  return progression.rounds.map((round) => round.round);
}

/**
 * The table view every chart is required to have (DESIGN_SYSTEM.md §6.2, §6.5.5),
 * shaped once here so it cannot disagree with the chart it accompanies — the two read the
 * same series.
 */
export interface SeriesTable {
  rounds: number[];
  rows: { key: string; label: string; values: (number | null)[] }[];
}

export function selectSeriesTable(
  series: readonly ProgressionSeries[],
  rounds: readonly number[],
): SeriesTable {
  return {
    rounds: [...rounds],
    rows: series.map((entry) => {
      const byRound = new Map(entry.points.map((point) => [point.round, point.value]));
      return {
        key: entry.key,
        label: entry.label,
        values: rounds.map((round) => byRound.get(round) ?? null),
      };
    }),
  };
}
