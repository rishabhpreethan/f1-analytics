import type { CircuitListItem } from '@schemas/directory';

import { WORLD_LAND_PATH } from './worldLand';

/**
 * **`CircuitAtlas`** — 78 venues on one graticule. `DESIGN_SYSTEM.md` §6.6.5.3, §7.11.
 *
 * `server/schemas/directory.ts` publishes `latitude` and `longitude` on the index payload with an
 * explicit reason: *"a circuit index is a **map**, and a map is the one design a list of 78 venues
 * actually wants."* This is that map, and it is **`CircuitLocator` with the pip repeated** — same
 * equirectangular projection, same graticule, same reference parallels, same CSS classes. One
 * venue's position and seventy-eight venues' positions are the same drawing at two scales, and
 * building a second map language for the second one is how a product starts looking assembled.
 *
 * ---
 *
 * **The coastline lands here, and still no track outline.** §7.11 ruled both out together and
 * only one of the two rulings survived a number: the landmass was rejected as *"a topojson asset
 * costing more than the whole chart kit"*, which measured out at **5.95 KB gzipped in-bundle**
 * and was approved. A track shape was rejected because the `circuit` table holds a name, a
 * locality, a country and three numbers — that is fabrication, and no measurement changes it.
 *
 * **Paint order is the whole of this component's correctness, and SVG has no z-index.**
 * Frame plate → coastline → graticule → retired pips → current pips → neatline. Land after the
 * plate and *before* the pips, so a venue is never buried under the continent it is on; the
 * neatline last, because land now reaches x = 0, x = 360 and y = 180 and would otherwise eat
 * three sides of the border.
 *
 * ⚠ **No `fill-rule`, no wrapper `<g>`, no transform, and the subpaths are never reordered.**
 * `WORLD_LAND_PATH` is already in this viewBox's coordinate space, and its one hole — the
 * Caspian — winds against its outer ring, so SVG's default `nonzero` punches it out.
 *
 * **`role="img"` with one accessible name, and not 78 links.** This is `SeasonDial`'s decision on a
 * bigger mark: seventy-eight tab stops between the console and the list would make the map a
 * keyboard obstacle in front of the thing it introduces, and announcing seventy-eight pips one at a
 * time is worse than useless. The list below is the navigable surface; the map is the picture of
 * what is in it. The summary sentence carries the whole reading.
 *
 * **Two pip classes, and the difference is not colour alone.** A venue on the current calendar is
 * `--accent-mark` at r=3.2 with a surface ring; one that is not is `--ink-tertiary` at r=2 and
 * translucent. Size, opacity and hue all move together (§3.4.2), and the legend states both counts
 * in words.
 *
 * ⚠ **The legend says `not on it`, never `no longer used`, and that is a correction.** A map is a
 * **two-way** split — a venue is on the current calendar or it is not — while the ladder 200px to
 * its left is a **three-way** one: `On the 2026 calendar 22 · Last used in 2025 3 · No longer used
 * 53`. The first build of this legend reused the ladder's own phrase for its complement, so one
 * board carried *"No longer used"* twice with **53** and **56** beside it. Caught in Rishabh's
 * capture. It is the same defect the circuit masthead had — a three-way split printed as a two-way
 * one — and the same fix: a complement is worded as a complement, and it closes against the count
 * above it (`22 + 56 = 78`).
 *
 * **Drawn in one pass, the off-calendar pips first.** SVG has no z-index, so paint order *is*
 * stacking: the 22
 * current venues are appended last, so Monza's pip is never hidden under a venue that closed in
 * 1958. That is the one thing about this component that is easy to get wrong and invisible in a
 * test.
 */

export interface CircuitAtlasProps {
  circuits: readonly CircuitListItem[];
  /** The calendar's latest year — `max(lastScheduledYear)`, computed by the page. */
  latest: number | null;
}

/** The reference parallels, verbatim from `CircuitLocator` so the two maps cannot drift. */
const PARALLELS = [
  { lat: 66.5635, label: 'Arctic Circle' },
  { lat: 23.4365, label: 'Tropic of Cancer' },
  { lat: 0, label: 'Equator' },
  { lat: -23.4365, label: 'Tropic of Capricorn' },
  { lat: -66.5635, label: 'Antarctic Circle' },
] as const;

const MERIDIANS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150] as const;

export function CircuitAtlas({ circuits, latest }: CircuitAtlasProps) {
  const placed = circuits.filter(
    (circuit): circuit is CircuitListItem & { latitude: number; longitude: number } =>
      circuit.latitude !== null && circuit.longitude !== null,
  );

  const isCurrent = (circuit: CircuitListItem) =>
    latest !== null && circuit.lastScheduledYear !== null && circuit.lastScheduledYear >= latest;

  const current = placed.filter(isCurrent);
  /* `off`, not `retired`: `retired` is the ladder's third rung and means something narrower. */
  const off = placed.filter((circuit) => !isCurrent(circuit));

  /*
   * Counted, never written. `placed.length` rather than `circuits.length` because a venue with no
   * coordinates is not on this map and the sentence must not claim it is — all 78 carry them today,
   * and the schema makes both fields nullable anyway.
   */
  const summary =
    latest === null
      ? `${String(placed.length)} Formula 1 venues, plotted by latitude and longitude.`
      : `${String(placed.length)} Formula 1 venues, plotted by latitude and longitude: ${String(current.length)} on the ${String(latest)} calendar, ${String(off.length)} not on it.`;

  return (
    <div className="atlas">
      <svg
        className="locator-map atlas-map"
        viewBox="0 0 360 180"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={summary}
      >
        <rect className="locator-frame" x="0.5" y="0.5" width="359" height="179" />

        {/*
         * The coastline, drawn straight in with no transform because the generator emitted it in
         * this viewBox's own space. `aria-hidden` is redundant under `role="img"` and is written
         * anyway: the summary sentence is the whole accessible reading of this figure, and a
         * 12.9 KB path is the single most likely thing to acquire an accidental name later.
         */}
        <path className="atlas-land" d={WORLD_LAND_PATH} aria-hidden="true" />

        {MERIDIANS.map((lon) => (
          <line
            key={`m${String(lon)}`}
            className={lon === 0 ? 'locator-prime' : 'locator-graticule'}
            x1={lon + 180}
            x2={lon + 180}
            y1={0}
            y2={180}
          />
        ))}

        {PARALLELS.map((parallel) => (
          <line
            key={parallel.label}
            className={parallel.lat === 0 ? 'locator-prime' : 'locator-graticule'}
            x1={0}
            x2={360}
            y1={90 - parallel.lat}
            y2={90 - parallel.lat}
          />
        ))}

        {/*
         * The parallels are unlabelled here and labelled on `CircuitLocator`. There, the labels are
         * the readout — a single pip is located by reading it off the grid. Here the grid is
         * context for a distribution, and five captions across 78 marks would be five more things
         * to read past.
         */}

        {off.map((circuit) => (
          <circle
            key={circuit.ref}
            className="atlas-pip"
            data-current="false"
            cx={circuit.longitude + 180}
            cy={90 - circuit.latitude}
            r={2}
          />
        ))}

        {current.map((circuit) => (
          <circle
            key={circuit.ref}
            className="atlas-pip"
            data-current="true"
            cx={circuit.longitude + 180}
            cy={90 - circuit.latitude}
            r={3.2}
          />
        ))}

        {/*
         * The neatline. Same geometry as the plate, stroke only, painted after everything —
         * see `.atlas-neatline` for why the plate's own stroke is suppressed to make room for
         * it. It is drawn after the pips too, which is deliberate: a pip on the edge of the map
         * is clipped by the frame rather than hanging over it.
         */}
        <rect className="atlas-neatline" x="0.5" y="0.5" width="359" height="179" />
      </svg>

      {/*
       * The key is text, not a colour swatch: §3.4.2 wants a second channel and the second channel
       * here is the word. Both counts also appear on the ladder to the left, which is the map's
       * table view.
       */}
      <p className="atlas-key">
        <span className="atlas-key-item">
          <span className="atlas-key-pip" data-current="true" aria-hidden="true" />
          {latest === null ? 'On the calendar' : `On the ${String(latest)} calendar`}
          <b className="t-mono">{current.length}</b>
        </span>
        <span className="atlas-key-item">
          <span className="atlas-key-pip" data-current="false" aria-hidden="true" />
          Not on it
          <b className="t-mono">{off.length}</b>
        </span>
      </p>
    </div>
  );
}
