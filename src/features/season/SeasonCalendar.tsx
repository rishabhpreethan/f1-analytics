import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import type { SeasonRound } from '@schemas/season';
import { LoadingState } from '@/components/ui/LoadingState';
import { ChevronRight } from '@/components/ui/icons';
import { cssVar, identityToken } from '@/lib/entityColor';
import { formatIsoDate } from '@/lib/format';
import { SeasonNotes } from './SeasonNotes';
import { roundStatus, type CalendarEntry } from './presenters';
import type { SeasonNotice } from './selectors';

/**
 * **The calendar** — SC-4, and the surface that carries the most information per pixel on this
 * page.
 *
 * Specified through the same six steps a chart is (§6.1), because it is information design even
 * though it is not a chart:
 *
 * 1. **Job**: sequence and identity. Which races happened, in what order, and who won each.
 * 2. **Form**: an ordered list of rows, not a table and not a card grid. A card grid at 22 rounds
 *    is eight screens of scrolling; a `<table>` cannot hold a two-winner cell and a wrapped
 *    circuit name without either scrolling sideways at 390px or collapsing to nonsense. An `<ol>`
 *    of rows reflows honestly and is semantically what a calendar is.
 * 3. **Marks**: a 3px left bar per row in the **winning team's identity colour**. This is the one
 *    thing that turns 22 rows into a season at a glance, and it is the correct role for a brand
 *    colour — beside a name, never as a chart mark (§3.3a.1). Absent on rounds with no winner,
 *    because there is no entity for it to identify.
 * 4. **Interaction**: whole-row hover raises the surface and brings the round number to
 *    `--accent-ink`. No tooltip: everything is already on the row.
 * 5. **Colour**: last, and only in the bar and the swatches.
 * 6. **Accessibility**: an `<ol>` announces position and count; every status is stated in words
 *    as well as in colour; the two-winner case reads as two names.
 *
 * ---
 *
 * **Three data facts this component is built around, each verified rather than assumed.**
 *
 * **`winners` is an array and rendering `winners[0]` is a defect.** Three races have two winners —
 * 1951 French GP (Fangio / Fagioli), 1956 Argentine GP (Fangio / Musso), 1957 British GP (Moss /
 * Brooks). Both drivers of a shared car are classified P1 and split the points, which is why the
 * 1951 pair reads 5 and 4 rather than 8 and 8. They render as two equal entries with a
 * shared-drive marker between them: neither is the "real" winner, and picking one at the mercy of
 * row order would silently delete Fagioli, Musso and Brooks.
 *
 * **A cancelled round has no number** (trap 15), and it is rendered **in date order, in place**,
 * with an em-dash where the number goes. 2026's two cancellations fall in April between rounds 3
 * and 4. Filing them in an appendix would present a tidy 1–22 sequence and quietly delete a
 * five-week hole in the season.
 *
 * **"Completed" means classification rows exist, never a date comparison.** The dump can lag the
 * real calendar by weeks — 2026 R11 has a date in the past and no results — so the split comes
 * from `hasResults` (REQUIREMENTS.md §2.5). A round with no results is *scheduled*, not empty.
 *
 * **No G-15, for the reason set out in `SeasonMasthead`**: at 1440×900 this section's heading is
 * above the fold, so a scroll-gated reveal fires against nothing, and the reveal was wrapping the
 * skeleton — which is why a cold load showed a heading and an empty page. `DESIGN_SYSTEM.md`
 * §4.6.1 now states both rules.
 */

/**
 * Derived from `SeasonRound` rather than imported: `server/schemas/season.ts` exports the schema
 * but not this element type, and schemas are the `developer`'s file. Indexing the array gives the
 * same type with no cross-boundary edit.
 */
type RoundWinner = SeasonRound['winners'][number];

export interface SeasonCalendarProps {
  entries: readonly CalendarEntry[] | null;
  /** Already filtered to the calendar slot by `noticesFor`. */
  notices: readonly SeasonNotice[];
  /**
   * `true` when some completed rounds have lap data and some do not. Only then does a per-round
   * lap marker earn its place: on a season where every round is the same, it is noise, and the
   * season-level notice says it better.
   */
  markLapCoverage: boolean;
  pending: boolean;
  /** Needed for the row's URL — a race is addressed through its season. */
  year: number;
}

export function SeasonCalendar({
  entries,
  notices,
  markLapCoverage,
  pending,
  year,
}: SeasonCalendarProps) {
  return (
    <section className="season-section" aria-labelledby="season-calendar-title">
      <div>
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          The calendar
        </p>
        <h2 id="season-calendar-title" className="t-display-sm text-ink-primary mt-3">
          Every round, in order
        </h2>
      </div>

      {notices.length > 0 && <SeasonNotes notices={notices} />}

      <div className="season-panel">
        {pending || entries === null ? (
          <CalendarSkeleton />
        ) : entries.length === 0 ? (
          <p className="t-sm text-ink-tertiary p-4">No rounds are recorded for this season.</p>
        ) : (
          <ol className="season-calendar">
            {entries.map((entry) => (
              <RoundRow
                key={entry.key}
                entry={entry}
                markLapCoverage={markLapCoverage}
                year={year}
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/**
 * ⚠ **Every numbered round is a link to its race page, and its absence was a shipped defect.**
 *
 * Rishabh asked *"how do I go to the race page?"* and the answer was that he could not: the whole race
 * deep dive was reachable only by typing a URL. Twenty-two rows carrying a round number, a grand prix
 * name, a circuit, a date and a winner, and not one of them clickable.
 *
 * **A cancelled round is deliberately NOT a link**, and that follows from trap 15 rather than from
 * taste: it has no round number, so it has no address. There is nothing to navigate to.
 *
 * **An upcoming round IS a link.** Its race page is a real destination — the masthead, the circuit and
 * the `notRun` notice — and a scheduled race is not missing data (REQUIREMENTS.md §2.2), so treating
 * it as unreachable would repeat that mistake in the navigation.
 */
function RoundRow({
  entry,
  markLapCoverage,
  year,
}: {
  entry: CalendarEntry;
  markLapCoverage: boolean;
  year: number;
}) {
  const status = roundStatus(entry);
  const winners = entry.kind === 'round' ? entry.round.winners : [];
  const leadWinner = winners[0];

  /*
   * The row's identity colour is the *leading* winner's team — the driver credited with the greater
   * share of a shared drive, since the payload orders `winners` by points descending. On a shared
   * drive both swatches are still rendered beside their own names; the bar simply cannot show two
   * colours, and choosing the greater share is the one non-arbitrary rule available.
   */
  const identity =
    leadWinner === undefined
      ? undefined
      : ({ '--identity': cssVar(identityToken(leadWinner.team.ref)) } as CSSProperties);

  const content = (
    <>
      <span className="round-number" aria-hidden="true">
        {entry.kind === 'round' ? String(entry.round.round).padStart(2, '0') : '—'}
      </span>

      <span className="round-name">
        {entry.round.name}
        {entry.kind === 'round' && entry.round.hasSprint && (
          <span className="season-chip">Sprint</span>
        )}
        {status === 'cancelled' && <span className="season-chip">Cancelled</span>}
        {entry.kind === 'round' && markLapCoverage && entry.round.hasResults && (
          <LapMarker round={entry.round} />
        )}
        {entry.round.circuitName !== null && (
          <span className="round-circuit">{entry.round.circuitName}</span>
        )}
      </span>

      <span className="round-date t-mono">{formatIsoDate(entry.round.date)}</span>

      <span className="round-winner">
        {status === 'cancelled' ? (
          <span className="round-pending">Did not take place</span>
        ) : winners.length === 0 ? (
          /*
           * **Not "no data".** A race that has not happened yet is not a gap in the record
           * (REQUIREMENTS.md §2.2), and saying so is the difference between a product that knows
           * its own calendar and one that looks broken every March.
           */
          <span className="round-pending">Not yet raced</span>
        ) : (
          winners.map((winner, index) => (
            <WinnerEntry key={winner.driverRef} winner={winner} shared={index > 0} />
          ))
        )}
      </span>

      {/*
       * The affordance. A row that navigates and looks exactly like a row that does not is the coverage
       * chip's lesson repeated — *"it was not broken, it was undiscoverable, and that is worse"*. The
       * chevron nudges `x: 3` on hover and focus, the same gesture `CapabilityCard` and the hero CTA
       * use, so this reads as the product's existing "go here" rather than as a new one.
       */}
      <ChevronRight size={16} className="round-arrow" />
    </>
  );

  if (entry.kind === 'cancelled') {
    return (
      <li className="round-row" data-status={status} style={identity}>
        {content}
      </li>
    );
  }

  return (
    <li>
      <Link
        className="round-row"
        data-status={status}
        style={identity}
        to={`/seasons/${String(year)}/races/${String(entry.round.round)}`}
        /*
         * The accessible name is built here rather than left to the row's text, which would read as
         * "07 British Grand Prix Silverstone Circuit 13 May 1950 Nino Farina Alfa Romeo" — every value
         * in the row, in order, as one sentence. A link's name should say where it goes.
         */
        aria-label={`Round ${String(entry.round.round)}, ${entry.round.name}`}
      >
        {content}
      </Link>
    </li>
  );
}

/**
 * Rendered only when the season is **partially** covered by lap timing, so the reader can see
 * which rounds a lap chart will exist for. On a season where every round is the same, the
 * season-level notice already says it and a marker on every row would be noise.
 */
function LapMarker({ round }: { round: SeasonRound }) {
  if (round.hasLapData) return null;
  return <span className="season-chip">No lap times</span>;
}

/**
 * One winner. On a shared drive the second entry is preceded by a "shared with" marker at
 * `--ink-tertiary`, so the relationship is stated in words rather than inferred from adjacency.
 */
function WinnerEntry({ winner, shared }: { winner: RoundWinner; shared: boolean }) {
  return (
    <>
      {shared && (
        <span className="round-winner-shared" aria-hidden="true">
          shared with
        </span>
      )}
      <span
        className="round-winner-entry"
        style={{ '--identity': cssVar(identityToken(winner.team.ref)) } as CSSProperties}
      >
        <span className="entity-swatch" aria-hidden="true" />
        <span>
          {shared ? <span className="sr-only">shared with </span> : null}
          {winner.forename} {winner.surname}
        </span>
        <span className="round-winner-team">{winner.team.name}</span>
      </span>
    </>
  );
}

/**
 * Eight rows of the real geometry (§7.5), so the panel holds its height and nothing below it moves
 * when the query resolves. One busy region for the whole list, not one per row.
 */
function CalendarSkeleton() {
  return (
    <ol className="season-calendar" role="list" aria-busy="true" aria-label="Season calendar">
      {Array.from({ length: 8 }, (_, index) => (
        <li className="round-row" key={index}>
          <span className="round-number" aria-hidden="true">
            <LoadingState announce={false} className="skeleton-round-number" />
          </span>
          <span className="round-name">
            <LoadingState announce={false} className="skeleton-round-name" />
          </span>
          <span className="round-date">
            <LoadingState announce={false} className="skeleton-round-date" />
          </span>
          <span className="round-winner">
            <LoadingState announce={false} className="skeleton-round-winner" />
          </span>
        </li>
      ))}
    </ol>
  );
}
