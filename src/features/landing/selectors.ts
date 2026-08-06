import type { Meta } from '@schemas/meta';

/**
 * Everything the landing page renders as a figure, shaped once, here, and tested (§S.4).
 *
 * **The reason this module exists is `PLAN.md` §S.1 rule 2: a hard-coded statistic is a
 * defect, not a placeholder.** `77`, `1950`, `2026`, `22`, `10` are all correct today and
 * all wrong after the next database refresh, silently, on the most visible surface in the
 * product. CT-14 greps `Landing.tsx` and its children for a three-digit literal, which is
 * only a meaningful check because every figure has somewhere else to live: here.
 *
 * Two arithmetic rules that are decisions, not conveniences:
 *
 *   - **`seasonCount` is `seasons.count`, never `latestYear − firstYear + 1`.** The
 *     subtraction assumes an unbroken run of seasons. That is an assumption about the data,
 *     not a fact we have checked, and it would be wrong by exactly the number of missing
 *     years — with no symptom.
 *   - **`scheduledRounds` is used verbatim and `cancelledRounds` is never added back.**
 *     Trap 15: a cancelled round carries `number IS NULL`, so `scheduledRounds` is
 *     `max(number)` — 22 for 2026, not the 24 that `count(*)` would give. The mitigation is
 *     already in `Q_LATEST_SEASON_PROGRESS`; re-deriving it here is how it gets undone.
 */

/** Which sentence the hero tells. Not a data state — a **season** state. */
export type SeasonState = 'preseason' | 'inSeason' | 'complete';

export interface RoundSummary {
  round: number;
  roundName: string;
  /**
   * A slug, for a link — **never an integer id** (trap 11). `null` is a real case the schema
   * allows: a round can exist without a resolvable circuit, and a link is then not offered
   * rather than pointing at `/circuits/null`.
   */
  circuitRef: string | null;
  circuitName: string | null;
  isoDate: string;
}

export interface HeroFigures {
  /** e.g. "1950—2026", em dash (U+2014) per Design Spec §3.2. */
  seasonSpan: string;
  firstYear: number;
  latestYear: number;
  seasonCount: number;
  roundProgress: { completed: number; scheduled: number };
  /** `null` when nothing has been run yet — the tile is omitted, not rendered as "—". */
  latestRound: RoundSummary | null;
  /** `null` once the season is over. */
  nextRound: RoundSummary | null;
  /** `null` when the coverage window is unknown; the tile is omitted (Design Spec §8). */
  lapTimingFrom: number | null;
  state: SeasonState;
}

const EM_DASH = '—';

function summarise(round: Meta['latestCompletedRound']): RoundSummary | null {
  if (round === null) return null;
  return {
    round: round.round,
    roundName: round.roundName,
    circuitRef: round.circuitRef,
    circuitName: round.circuitName,
    isoDate: round.date,
  };
}

export function selectHeroFigures(meta: Meta): HeroFigures {
  const { firstYear, latestYear, count } = meta.seasons;
  const { completedRounds, scheduledRounds, isComplete } = meta.latestSeason;

  // Order matters: a season that is both complete and has run zero rounds cannot happen,
  // but "no completed round" is the case that must not produce an in-season sentence.
  const state: SeasonState =
    completedRounds === 0 ? 'preseason' : isComplete ? 'complete' : 'inSeason';

  return {
    seasonSpan: `${String(firstYear)}${EM_DASH}${String(latestYear)}`,
    firstYear,
    latestYear,
    seasonCount: count,
    roundProgress: { completed: completedRounds, scheduled: scheduledRounds },
    latestRound: summarise(meta.latestCompletedRound),
    nextRound: summarise(meta.nextScheduledRound),
    lapTimingFrom: meta.coverage.laps.from,
    state,
  };
}

export interface CoverageBand {
  /** The row label, Design Spec §9 verbatim. */
  label: string;
  from: number;
  /**
   * Where the available span starts, as a fraction of the domain — so the bar is plain
   * arithmetic over `firstYear → latestYear` and needs no scale function, no axis component
   * and no chart library. F0 ships no chart, and this is why the ruler is not one.
   */
  offset: number;
  /** Width of the available span, as a fraction of the domain. */
  extent: number;
}

/**
 * The coverage ruler's six rows (Design Spec §3.5). **Every year is read from
 * `meta.coverage`** — the point of the section is that the product knows its own limits, so
 * a hard-coded 1996 here would be self-refuting as well as wrong.
 *
 * `to` is honoured: a closed window (sprint, were it ever to close) stops short of the right
 * edge rather than implying coverage that does not exist.
 */
export function selectCoverageBands(meta: Meta): CoverageBand[] {
  const { firstYear, latestYear } = meta.seasons;
  const span = latestYear - firstYear;

  const rows: ReadonlyArray<{ label: string; key: keyof Meta['coverage'] }> = [
    { label: 'Results', key: 'results' },
    { label: 'Qualifying positions', key: 'qualifying' },
    { label: 'Lap-by-lap timing', key: 'laps' },
    { label: 'Q1 / Q2 / Q3', key: 'qualifyingSegments' },
    { label: 'Pit stops', key: 'pitStops' },
    { label: 'Sprint races', key: 'sprint' },
  ];

  return rows.map(({ label, key }) => {
    const window = meta.coverage[key];
    // A single-season domain would divide by zero; the honest answer is a full-width bar.
    if (span <= 0) return { label, from: window.from, offset: 0, extent: 1 };

    const start = Math.min(Math.max((window.from - firstYear) / span, 0), 1);
    const end = window.to === null ? 1 : Math.min(Math.max((window.to - firstYear) / span, 0), 1);
    return { label, from: window.from, offset: start, extent: Math.max(end - start, 0) };
  });
}

/**
 * The axis ticks. 1950 / 1970 / 1990 / 2010 / `latestYear` at ≥768, and 1950 / 1990 /
 * `latestYear` below it (Design Spec §3.6) — the caller decides which, because that is a
 * decision about what to render.
 *
 * The domain bounds are read rather than assumed, so a tick outside the domain is dropped
 * instead of rendered off the end of the track.
 *
 * **Why the four literal years are allowed here, and are not the thing §S.1 rule 2 forbids.**
 * They are **axis positions, not statistics**: they describe where the eye should find a
 * gridline, they are not read from the data and they make no claim about it. They are also
 * domain-filtered on the next line, so a payload whose first season were 1961 would simply drop
 * 1950 rather than draw a tick off the end. CT-14 greps `Landing.tsx` and the components it
 * renders — deliberately not this module, which is where a *figure* is allowed to be computed
 * and where `latestYear` in this very list comes from.
 */
export function selectRulerTicks(meta: Meta, dense: boolean): Array<{ year: number; at: number }> {
  const { firstYear, latestYear } = meta.seasons;
  const span = latestYear - firstYear;
  // Axis positions — see the note above on why these four are not hard-coded statistics.
  const years = dense ? [1950, 1970, 1990, 2010, latestYear] : [1950, 1990, latestYear];

  return years
    .filter(
      (year, index, all) => year >= firstYear && year <= latestYear && all.indexOf(year) === index,
    )
    .map((year) => ({ year, at: span <= 0 ? 0 : (year - firstYear) / span }));
}
