import type { Circuit } from '@schemas/circuit';
import type { BarDatum } from '@/components/charts';
import type { StatTile } from '@/components/entity/StatTiles';
import type { RibbonSeason } from '@/components/entity/ribbon';

/**
 * **Presentation grouping for the circuit page.** Same boundary as the other two pages': it folds
 * values the payload has already made safe and never re-derives a trap.
 */

/**
 * §7.9 — the ribbon, with a **different measure and the same component**.
 *
 * On a driver's page a cell's fill is a championship position. Here it is presence: a season the
 * venue hosted a Grand Prix is `ranked` at P1 and therefore full height, and a season it did not is
 * `absent`. That reads as a barcode of the venue's life on the calendar — Interlagos' gap through
 * most of the 1980s, Zandvoort's thirty-five-year absence — and it says both without a word.
 *
 * **A round scheduled with no results is `unranked`, not `absent`.** It was on the calendar; the
 * results are not in the record. Those are different facts and §7.9's three kinds exist to keep
 * them apart.
 */
export function circuitRibbon(circuit: Circuit): RibbonSeason[] {
  const byYear = new Map<number, { hasResults: boolean; name: string }>();
  for (const race of circuit.races) {
    const existing = byYear.get(race.year);
    /* A venue that held two rounds in one year — 1957's Pescara aside, this is rare but real —
     * counts as hosted once, and `hasResults` is true if either round has them. */
    byYear.set(race.year, {
      hasResults: (existing?.hasResults ?? false) || race.hasResults,
      name: race.name,
    });
  }

  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, entry]) => ({
      year,
      position: entry.hasResults ? 1 : null,
      champion: false,
      detail: entry.name,
    }));
}

/**
 * CI-1's four figures. **No win or pole count here** — those are the leaderboard's job, and
 * duplicating them as a tile would make the same number appear twice with two different denominators.
 *
 * `roundsHeld` counts scheduled rounds and `racesWithResults` counts the ones with classification
 * rows. They are shown side by side rather than folded, because the difference is a **scheduled
 * race that has not happened**, and calling that "missing data" is the mistake `REQUIREMENTS.md`
 * §2.2 warns against.
 */
export function circuitTiles(circuit: Circuit): StatTile[] {
  return [
    { key: 'races', label: 'Grands Prix', value: circuit.roundsHeld, emphasis: true },
    { key: 'with-results', label: 'With results', value: circuit.racesWithResults },
    { key: 'first', label: 'First', value: circuit.firstYear },
    { key: 'last', label: 'Most recent', value: circuit.lastYear },
  ];
}

/**
 * CI-3 — the leaderboard's bars.
 *
 * **A driver bar carries no `teamReference`, and that is deliberate.** A driver's colour is their
 * *team's*, and at a venue a driver has usually raced for several — so any single colour would be
 * a choice about which era of their career to represent. With none, `BarChart` falls back to
 * `--border-strong` and identity is carried entirely by the label, which is rung 1 and always
 * present. Team bars do carry their reference, because there the entity *is* the team.
 *
 * **Entities with no win are dropped, not drawn at zero.** The section is "most successful here";
 * a row of zero-length bars is a list of people who did not win, which answers a different question
 * and pushes the winners off the plot. The count that remains is stated in the subtitle.
 */
export function topEntityBars(circuit: Circuit, board: 'drivers' | 'teams'): BarDatum[] {
  if (board === 'teams') {
    return circuit.topTeams
      .filter((team) => team.wins > 0)
      .map((team) => ({
        key: team.teamRef,
        label: team.name,
        value: team.wins,
        teamReference: team.teamRef,
      }));
  }

  return circuit.topDrivers
    .filter((driver) => driver.wins > 0)
    .map((driver) => ({
      key: driver.driverRef,
      /* §6.5.4a's label rule: the surname, which is the fallback with 100% coverage. A code is
       * shorter but exists for 107 of 881 drivers, so a mixed column would look like a defect. */
      label: driver.surname,
      value: driver.wins,
    }));
}
