import type { CoverageKey, Meta } from '@schemas/meta';
import { formatIsoDate } from '@/lib/format';

/**
 * Where F0's logic lives. Every function here is pure, synchronous, React-free and
 * unit-tested, and none of them mutates its input.
 *
 * The vocabulary is deliberate: **coverage**, **complete**, **scheduled**,
 * **available**. Currency is expressed as a fact about the sport's calendar —
 * "complete results through Round 10 of 22" — and never as a fetch or refresh event.
 * `REQUIREMENTS.md` §2.2 warns the newest round may lag reality, so coverage phrasing
 * is also the more honest one: it states what is true without claiming to know today's
 * calendar position.
 */

export interface DataVintage {
  /** e.g. "2026-07-19" */
  isoDate: string;
  /** e.g. "Belgian Grand Prix" */
  roundName: string;
  /** e.g. 2026 */
  year: number;
  /** e.g. 10 */
  round: number;
  /** e.g. "Complete results through 2026 Round 10 — Belgian Grand Prix, 19 Jul 2026" */
  label: string;
  /** e.g. "10 of 22 rounds complete" */
  progressLabel: string;
}

/** null when the data holds no completed round at all (E6). */
export function selectDataVintage(meta: Meta): DataVintage | null {
  const round = meta.latestCompletedRound;
  if (round === null) return null;

  const { completed, scheduled } = selectSeasonProgress(meta);

  return {
    isoDate: round.date,
    roundName: round.roundName,
    year: round.year,
    round: round.round,
    label: `Complete results through ${String(round.year)} Round ${String(round.round)} — ${round.roundName}, ${formatIsoDate(round.date)}`,
    progressLabel: `${String(completed)} of ${String(scheduled)} rounds complete`,
  };
}

/**
 * The sentences the coverage popover and the footer echo render (Design Spec §5.1).
 *
 * They live here rather than in `DataVintage` for the reason every other string in this
 * file does: copy assembled inside a component is copy nobody can unit-test, and this is
 * the surface where a wrong number would be least visible and most damaging. The Design
 * Spec fixes every one of these strings verbatim.
 *
 * It is a separate selector from `selectDataVintage` because the two answer different
 * questions. The vintage is a fact about **one round**; this is a fact about the
 * **season's coverage** — and it needs `scheduledRounds`, `cancelledRounds`,
 * `isComplete` and the season range, none of which are on `DataVintage`.
 */
export interface CoverageDetail {
  /** Trigger accessible name — "…, 10 of 22 rounds complete. Show detail." */
  triggerName: string;
  /** Line 1: "Complete results through Round 10 of 22 — Belgian Grand Prix, 19 Jul 2026." */
  coverageLine: string;
  /** Line 2, or null when the season is complete. */
  scheduledLine: string | null;
  /** Line 3, or null when nothing was cancelled. Trap 12, surfaced rather than hidden. */
  cancelledLine: string | null;
  /** Line 4: "Seasons available: 1950–2026." */
  seasonsLine: string;
  /** The footer echo, so the same facts are reachable without opening anything. */
  footerEcho: string;
}

/** null when the data holds no completed round at all (E6) — as `selectDataVintage`. */
export function selectCoverageDetail(meta: Meta): CoverageDetail | null {
  const round = meta.latestCompletedRound;
  if (round === null) return null;

  const { year, scheduledRounds, completedRounds, cancelledRounds, isComplete } = meta.latestSeason;
  const { firstYear, latestYear } = meta.seasons;

  const seasons = `${String(firstYear)}–${String(latestYear)}`;

  // Rounds still to come. `scheduledRounds` excludes cancelled rounds, and cancelled
  // rounds carry no round number, so the remaining count is the plain difference.
  const remainingRounds = scheduledRounds - round.round;

  return {
    triggerName: `Data coverage: ${String(year)} season, ${String(completedRounds)} of ${String(scheduledRounds)} rounds complete. Show detail.`,
    coverageLine: `Complete results through Round ${String(round.round)} of ${String(scheduledRounds)} — ${round.roundName}, ${formatIsoDate(round.date)}.`,
    // Pluralisation is part of the copy spec (`DESIGN_SYSTEM.md` §7.3), not an
    // implementation detail: the plural form renders "Rounds 22–22" once a single round
    // remains, which is a copy defect even though the number is right. The `<= 0` arm is
    // not reachable from the present data — no season numbers a round beyond its
    // non-cancelled count — but there is no truthful sentence for it, so it says nothing
    // rather than "Rounds 23–22".
    scheduledLine:
      isComplete || remainingRounds <= 0
        ? null
        : remainingRounds === 1
          ? `Round ${String(scheduledRounds)} is scheduled and has no results yet.`
          : `Rounds ${String(round.round + 1)}–${String(scheduledRounds)} are scheduled and have no results yet.`,
    // The same reasoning, one line down: the Design Spec's cancelled sentence is written
    // for the plural, which is the live case (2), and the plural form would render
    // "1 rounds", so the singular is spelled out rather than approximated.
    cancelledLine:
      cancelledRounds === 0
        ? null
        : cancelledRounds === 1
          ? `1 round on the ${String(year)} calendar was cancelled.`
          : `${String(cancelledRounds)} rounds on the ${String(year)} calendar were cancelled.`,
    seasonsLine: `Seasons available: ${seasons}.`,
    footerEcho: `Complete results through ${String(round.year)} Round ${String(round.round)} · Seasons ${seasons}`,
  };
}

/**
 * Every season present, newest first. Derived from `firstYear`/`latestYear` rather
 * than from a list, which is safe because the year sequence was verified contiguous —
 * there are no gap years to explain in the UI.
 */
export function selectSeasonOptions(meta: Meta): number[] {
  const { firstYear, latestYear } = meta.seasons;
  const years: number[] = [];
  for (let year = latestYear; year >= firstYear; year -= 1) years.push(year);
  return years;
}

/** The season a bare `/` should show. */
export function selectDefaultSeason(meta: Meta): number {
  return meta.latestCompletedRound?.year ?? meta.seasons.latestYear;
}

/**
 * The single function every coverage-aware surface calls (NV-8). Nobody hard-codes
 * 1996. `to: null` means open-ended.
 */
export function isSeasonInCoverage(meta: Meta, key: CoverageKey, year: number): boolean {
  const window = meta.coverage[key];
  if (year < window.from) return false;
  return window.to === null || year <= window.to;
}

/**
 * Explain, never apologise — a missing-coverage boundary is a property of the sport's
 * history, not a fault (`DESIGN_SYSTEM.md` §3.4.3, §7.4).
 *
 * The sentences are §7.4's, with the year interpolated. Two are necessarily adapted:
 * §7.4 phrases sprint coverage per event ("There was no sprint at this event"), which
 * a season-level function cannot honestly claim, so the season-level form is used and
 * the second sentence is kept verbatim.
 */
const COVERAGE_COPY: Record<CoverageKey, (year: number, from: number) => string> = {
  results: (year, from) =>
    `Race results aren't available for ${String(year)}. Results begin in ${String(from)}.`,
  qualifying: (year, from) =>
    `Qualifying positions aren't available for ${String(year)}. Qualifying data begins in ${String(from)}.`,
  qualifyingSegments: (year, from) =>
    `Segment-by-segment qualifying isn't available for ${String(year)}. Q1, Q2 and Q3 times begin in ${String(from)}.`,
  laps: (year, from) =>
    `Lap-by-lap timing isn't available for ${String(year)}. Lap data begins in ${String(from)}. ${String(year)} has full race classifications, grids and championship standings.`,
  pitStops: (year, from) =>
    `Pit stop data isn't available for ${String(year)}. Pit data begins in ${String(from)}, so stints, strategy and pit timings can't be shown.`,
  sprint: (year, from) =>
    `There was no sprint in ${String(year)}. Sprint races begin in ${String(from)}.`,
  sprintQualifying: (year, from) =>
    `Sprint qualifying isn't available for ${String(year)}. Sprint qualifying begins in ${String(from)}.`,
};

/** null inside the window; the explanation outside it. */
export function selectCoverageNotice(meta: Meta, key: CoverageKey, year: number): string | null {
  if (isSeasonInCoverage(meta, key, year)) return null;
  return COVERAGE_COPY[key](year, meta.coverage[key].from);
}

/**
 * Progress through the latest season. `ratio` is 0 — never `NaN` — when nothing is
 * scheduled, because a NaN reaches a width style and silently breaks a layout.
 */
export function selectSeasonProgress(meta: Meta): {
  completed: number;
  scheduled: number;
  ratio: number;
} {
  const { completedRounds, scheduledRounds } = meta.latestSeason;
  return {
    completed: completedRounds,
    scheduled: scheduledRounds,
    ratio: scheduledRounds === 0 ? 0 : completedRounds / scheduledRounds,
  };
}
