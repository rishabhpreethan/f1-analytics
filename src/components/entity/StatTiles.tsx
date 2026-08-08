import type { ReactNode } from 'react';
import { LoadingState } from '@/components/ui/LoadingState';

/**
 * **The career-totals grid** — `DESIGN_SYSTEM.md` §6.6.2.2.
 *
 * §6.1 step 1: *sometimes the answer is a stat tile, not a chart*. Eight counts with no shared
 * scale and no ordering between them is one of those times — a bar chart of "wins, podiums, poles,
 * DNFs" would invite a comparison between quantities that are not comparable.
 *
 * ---
 *
 * ## The unavailable tile is the reason this is a component and not a `<dl>`
 *
 * **A total that is silently zero is worse than a total that is absent**, because zero is a
 * plausible-looking claim. `DR-2` asks for eight figures and they do not share one coverage
 * window: **fastest laps are 2004+** (`fastest_lap_rank`, §5.1) while everything else is 1950+. A
 * 1960s driver rendering `0 fastest laps` would be stating something false about the sport, in the
 * product's own voice, on its most-visited surface.
 *
 * So an out-of-window tile renders **`—` in `--ink-tertiary` with a superscript marker**, and the
 * grid carries one sentence per distinct absent window beneath it. Never a `0`, never a `caution`
 * colour (§3.4.3 — a coverage boundary is a property of the sport's history, not a fault), and
 * never a tooltip as the only carrier of the explanation.
 */

export interface StatTile {
  key: string;
  label: string;
  /**
   * `null` means **outside this figure's coverage window** — the tile renders `—` and a marker.
   * It does not mean "zero" and it does not mean "still loading"; the grid has separate states for
   * both, which is the three-state distinction §1.0 asks to be made explicit rather than folded
   * into a falsy check.
   */
  value: number | null;
  /** Which footnote this tile's absence points at. Required whenever `value` is `null`. */
  note?: string;
  /** Larger type, for the one or two figures that are the headline. */
  emphasis?: boolean;
}

export interface StatTilesProps {
  tiles: readonly StatTile[];
  /** One sentence per distinct absent window, in `note` order. §6.5.3's three-part copy. */
  notes?: readonly { key: string; text: ReactNode }[];
  /** The grid's accessible name — "Career totals". */
  ariaLabel: string;
  pending?: boolean;
}

export function StatTiles({ tiles, notes = [], ariaLabel, pending = false }: StatTilesProps) {
  /* The marker is the note's **index**, so two tiles missing for the same reason share one mark
   * and one sentence. Markers are assigned from the notes rather than from the tiles, which is why
   * a note with no tile pointing at it cannot appear. */
  const markerOf = (note: string | undefined) => {
    if (note === undefined) return null;
    const index = notes.findIndex((entry) => entry.key === note);
    return index < 0 ? null : index + 1;
  };

  return (
    <div className="stat-tiles-block">
      <dl className="stat-tiles" aria-label={ariaLabel} aria-busy={pending ? 'true' : undefined}>
        {tiles.map((tile) => {
          const marker = markerOf(tile.note);
          const unavailable = tile.value === null;
          return (
            <div className="stat-tile" key={tile.key} data-emphasis={tile.emphasis === true}>
              <dt className="season-eyebrow">{tile.label}</dt>
              <dd className="stat-tile-figure" data-unavailable={unavailable}>
                {pending ? (
                  <LoadingState announce={false} className="skeleton-stat-figure" />
                ) : (
                  <>
                    {unavailable ? (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">Not available for this career</span>
                      </>
                    ) : (
                      tile.value
                    )}
                    {/*
                     * ⚠ **The marker belongs to the note, not to the absence, and the first build
                     * of this component tied it to the absence.** That collapsed §6.6.2.2's three
                     * states back into two: a *partial* figure — 26 poles measured over 41 of 161
                     * starts — rendered as a bare `26` with no indication it was undercounted,
                     * which is the more dangerous of the two failures because the number looks
                     * complete. Caught by the test, not by reading the code.
                     */}
                    {marker !== null && (
                      <sup className="stat-tile-marker" aria-hidden="true">
                        {marker}
                      </sup>
                    )}
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      {notes.length > 0 && (
        <ul className="stat-notes">
          {notes.map((note, index) => (
            <li key={note.key} className="season-note">
              <sup className="stat-tile-marker" aria-hidden="true">
                {index + 1}
              </sup>
              <span>{note.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
