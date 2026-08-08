/**
 * **`CareerRibbon`'s arithmetic** — `DESIGN_SYSTEM.md` §7.9.2.
 *
 * Pure, and separated from the component for the reason `geometry.ts` exists: jsdom performs no
 * layout, so a rendered strip proves nothing about where a cell is or how tall its fill came out.
 * Every decision the ribbon makes that could be *wrong* rather than merely *misplaced* lives here.
 */

/**
 * What one cell of the strip is. The three kinds are **not** interchangeable and collapsing any two
 * of them is §1.0's failure mode — something absent given the meaning of something present.
 */
export type RibbonCellKind =
  /** The entity contested this season and holds a championship position. */
  | 'ranked'
  /** The entity contested this season and finished it with no championship position. */
  | 'unranked'
  /** The entity did not contest this season. The hole in a career is part of the career. */
  | 'absent';

export interface RibbonSeason {
  year: number;
  /** The championship position, or `null` for a season contested without one. */
  position: number | null;
  /** `true` when the entity took the title that season. Read from the payload, never derived. */
  champion?: boolean;
  /** Optional second line for the readout — the team, the points, whatever the page has. */
  detail?: string;
}

export interface RibbonCell {
  year: number;
  kind: RibbonCellKind;
  position: number | null;
  champion: boolean;
  detail: string | null;
  /** `0…1`. Meaningful only for `ranked`; `0` for the other two, which draw their own mark. */
  fill: number;
}

/** §7.9.2 — the floor. A zero-height fill is indistinguishable from the absent state. */
export const RIBBON_FILL_FLOOR = 0.12;

/**
 * Map a championship position to a fill fraction, **inverted**: P1 is the tallest.
 *
 * In F1 up means faster and 1 is the best value — §6.3 already inverts every position axis in the
 * product, and a strip that grew with the number would read backwards to every fan.
 *
 * `deepest` is the entity's **own worst ranked season**, not the size of the grid. A driver whose
 * career ran P1–P4 gets a strip that uses its full height; scaling to P26 would flatten a title
 * fight into four near-identical stubs. This is the same reversal §6.3 records for the position
 * axis's maximum, reached the same way — by looking at what it renders as.
 *
 * The floor of `RIBBON_FILL_FLOOR` and never 0 is what keeps "raced, finished last" a different
 * mark from "did not race".
 */
export function positionFill(position: number, deepest: number): number {
  if (!Number.isFinite(position) || position < 1) return RIBBON_FILL_FLOOR;
  /* One ranked season, or a career spent entirely at one position: there is no range to spend, so
   * the strip is full height. Interpolating against a zero span would divide by zero and paint
   * `NaN`, which is the same silent collapse `normaliseShareRow` guards. */
  if (deepest <= 1) return 1;
  const clamped = Math.min(Math.max(position, 1), deepest);
  const t = (clamped - 1) / (deepest - 1);
  return 1 - t * (1 - RIBBON_FILL_FLOOR);
}

/**
 * Build the strip: **one cell per year from the first season to the last, with no gaps**.
 *
 * A career is not the list of seasons an entity raced; it is the span they existed over, and the
 * years inside that span they sat out are part of it. Räikkönen's 2010–11 rally sabbatical and
 * Brabham's 1993–2009 absence are the two most legible facts on their respective strips, and a
 * ribbon that only drew the seasons present would silently close both gaps.
 *
 * Returns an empty array for an empty input — which the component renders as its empty state
 * rather than as a zero-width strip.
 */
export function buildRibbon(seasons: readonly RibbonSeason[]): RibbonCell[] {
  if (seasons.length === 0) return [];

  const years = seasons.map((season) => season.year);
  const first = Math.min(...years);
  const last = Math.max(...years);

  const bySeason = new Map<number, RibbonSeason>();
  for (const season of seasons) bySeason.set(season.year, season);

  /* The reference is the entity's own deepest **ranked** finish. `1` when nothing is ranked, which
   * `positionFill` reads as "no range to spend" rather than as a division by zero. */
  const ranked = seasons
    .map((season) => season.position)
    .filter((position): position is number => position !== null && position >= 1);
  const deepest = ranked.length > 0 ? Math.max(...ranked) : 1;

  const cells: RibbonCell[] = [];
  for (let year = first; year <= last; year += 1) {
    const season = bySeason.get(year);
    if (season === undefined) {
      cells.push({ year, kind: 'absent', position: null, champion: false, detail: null, fill: 0 });
      continue;
    }
    if (season.position === null) {
      cells.push({
        year,
        kind: 'unranked',
        position: null,
        champion: false,
        detail: season.detail ?? null,
        fill: 0,
      });
      continue;
    }
    cells.push({
      year,
      kind: 'ranked',
      position: season.position,
      champion: season.champion === true,
      detail: season.detail ?? null,
      fill: positionFill(season.position, deepest),
    });
  }
  return cells;
}

/**
 * Which cells carry a year label. Every 5th year plus **both ends**, always.
 *
 * Labelling every cell collides at 14px — a four-digit mono year is ~34px wide — and labelling only
 * the multiples of five would leave a career from 2007 to 2026 with no label on either end, which
 * are the two the eye goes to first. This is `withEndpoints`' rule from the chart kit, applied to a
 * strip that has no axis to borrow it from.
 */
export function ribbonLabelYears(cells: readonly RibbonCell[]): Set<number> {
  const labels = new Set<number>();
  const first = cells[0]?.year;
  const last = cells.at(-1)?.year;
  if (first === undefined || last === undefined) return labels;

  labels.add(first);
  labels.add(last);
  for (const cell of cells) {
    if (cell.year % 5 !== 0) continue;
    /* Never adjacent to an endpoint label — `2025` beside `2026` is the collision the stride
     * exists to avoid, and it is the one case a pure multiple-of-five rule creates. */
    if (cell.year - first < 2 || last - cell.year < 2) continue;
    labels.add(cell.year);
  }
  return labels;
}
