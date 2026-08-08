import type { CSSProperties } from 'react';
import { spanRailGeometry } from './indexModel';

/**
 * **`SpanRail`** — `DESIGN_SYSTEM.md` §7.12, and the index pages' signature element.
 *
 * One row's whole existence plotted against **the same fixed domain as every other row**, so
 * scrolling the list is scrolling the sport's history: the 1950s cluster left, the current grid
 * clusters right, and Monza's rail runs the entire width. It is `CareerRibbon`'s idea compressed
 * from 900px to a table column.
 *
 * ---
 *
 * **It is a bracket, never a fill, and that is correctness rather than taste.** A career has gaps —
 * Räikkönen raced 2001–2009 and 2012–2021 — and a solid bar from first to last would state that he
 * raced in 2010. Two end ticks joined by a rule read as *from … to* and cannot be read as
 * *throughout*. The season **count** sits in its own column beside it, so a 21-year span against 19
 * seasons is visible as a discrepancy rather than absorbed (§1.0). Separated by **form**, exactly as
 * §3.3a.5 separates an identity swatch from a timing colour.
 *
 * **The baseline is always drawn, including for an entity with nothing to plot.** That is what makes
 * a raceless row read as *a row with nothing to plot* rather than as a row that failed to render —
 * and it is why `spanRailGeometry` returns `null` instead of a zero-width bracket at the origin,
 * which would be indistinguishable from a 1950 debut.
 *
 * **It is not a chart and must not grow one.** No axis, no ticks, no tooltip: the years are already
 * in the row and in its accessible name. The product has a `SpanChart` for a span that genuinely
 * needs an axis, and it renders an SVG per chart — at 881 rows that would be 881 SVGs.
 *
 * **`aria-hidden`.** Its content is in the row's `aria-label` as `1991 to 2007`, which is a better
 * reading than any description of a graphic. Announcing it here would read the same fact twice.
 */

export interface SpanRailProps {
  firstSeason: number | null;
  lastSeason: number | null;
  /** The shared domain, from `railDomain(items)` — never a literal (§7.12). */
  domainStart: number;
  domainEnd: number;
  /**
   * Still going in the archive's most recent season. Promotes the bracket to `--accent-mark`.
   *
   * **Never the only channel.** An active entity's bracket is also the one that reaches the right
   * end of the domain, and its last season is in the row's accessible name — so the accent
   * reinforces a position rather than carrying a fact by colour alone (§3.4.2).
   */
  current?: boolean;
}

export function SpanRail({
  firstSeason,
  lastSeason,
  domainStart,
  domainEnd,
  current = false,
}: SpanRailProps) {
  const geometry = spanRailGeometry(firstSeason, lastSeason, domainStart, domainEnd);

  return (
    <span className="span-rail" aria-hidden="true">
      <span className="span-rail-base" />
      {geometry !== null && (
        <span
          className="span-rail-bracket"
          data-current={current ? 'true' : 'false'}
          /*
           * Percentages of the rail's own box, which is the only geometry involved — so this is not
           * the `%`-vs-px trap CR-007 shipped. The rail has no other coordinate system to be wrong
           * about, and the fractions themselves are unit-tested in `indexModel.test.ts`.
           */
          style={
            {
              '--span-offset': `${String(geometry.offset * 100)}%`,
              '--span-length': `${String(geometry.length * 100)}%`,
            } as CSSProperties
          }
        />
      )}
    </span>
  );
}
