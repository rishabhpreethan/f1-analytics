import type { CSSProperties } from 'react';
import type { SeriesChannels } from '@/components/charts/ladder';
import { MarkerGlyph } from '@/components/charts/MarkerGlyph';
import { Info } from '@/components/ui/icons';
import { cssVar } from '@/lib/entityColor';
import { CHART_BAR_ATTR } from '@/lib/motion/chart';
import { rateRails } from './model';
import type { CompareEntity } from './types';

/**
 * **`RateRailBoard`** — `DESIGN_SYSTEM.md` §6.6.6.5. The cross-era comparison, and the only part of
 * this page that compares the selected drivers directly.
 *
 * **As a chart, in §6.1's order.**
 *
 * 1. **The job** — magnitude, on several unrelated measures, for up to four entities. Not change
 *    over time; that is the season trajectory's job.
 * 2. **The form** — one **rail per measure**, with a marker per entity on it. Not a grouped bar
 *    chart: grouped bars put four bars per measure on one axis and make the reader compare across
 *    groups by memory. A rail makes the comparison a distance along a line, which is the one
 *    judgement the eye is reliably good at. It is also the only form that survives a fifth measure
 *    being added without becoming a wall.
 *    **Each rail has its own ceiling**, and that is deliberate: a win rate and a beat-your-teammate
 *    rate live on genuinely different natural scales, and one shared track for both would flatten
 *    the interesting one to nothing. The ceiling is printed on every rail so the two are never
 *    silently compared.
 * 3. **Marks** — an 8px marker, equal *area* across the four shapes (`MarkerGlyph`), with a 1.5px
 *    `--surface-sunken` ring where two land close together. The rail itself is 8px,
 *    `--surface-sunken`, `--radius-xs`.
 * 4. **Interaction** — the whole rail row is the hit target; each marker is direct-labelled with
 *    the driver's surname and the rate, so there is nothing to hover for.
 * 5. **Colour** — last. Entity tokens through `assignEntityColours`, with the ladder's marker
 *    shapes as the mandatory second channel (§6.4). Two Mercedes drivers take the shade pair *and*
 *    circle/square *and* solid/`6 3` — §6.4a makes all three mandatory rather than escalated.
 * 6. **Accessibility** — every value is printed as text beside its mark, which is what a table view
 *    would have added; the discharge is the same one `PopulationBoard` records (§7.14).
 *
 * ---
 *
 * **Every rail is a rate and none is a total, and that is correctness rather than taste.** 24 point
 * systems, six best-N eras and a season that grew from 8.4 rounds to 21.9 mean that a career total
 * measures opportunity before it measures a driver (`REQUIREMENTS.md` §5.2, trap 4). A y-axis
 * reading "career points" is a defect in this product, and a win *count* is only marginally better.
 *
 * **The denominator is printed under every rail**, because a rate whose denominator is invisible is
 * not checkable — and two of these have denominators that are genuinely surprising. Fangio's
 * same-car pairings number 93 against 51 starts, because a 1950s constructor could enter as many as
 * 29 cars in one Grand Prix and every same-team pair in a race is one comparison.
 */

export interface RateRailBoardProps {
  entities: CompareEntity[];
  channels: SeriesChannels[];
}

export function RateRailBoard({ entities, channels }: RateRailBoardProps) {
  const rails = rateRails(entities);
  const channelFor = new Map(
    entities.map((entity, index) => [entity.identity.ref, channels[index]]),
  );

  return (
    <section className="rails" aria-labelledby="rails-heading">
      <header className="rails-header">
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          Normalised against opportunity
        </p>
        <h2 className="rails-heading" id="rails-heading">
          Five rates that mean the same thing in every era
        </h2>
      </header>

      <ol className="rails-list">
        {rails.map((rail) => (
          <li className="rail" key={rail.id}>
            <div className="rail-label">
              <span className="rail-name">{rail.label}</span>
              <span className="rail-ceiling">0 – {Math.round(rail.ceiling * 100)}%</span>
            </div>
            <div className="rail-track" data-motion={CHART_BAR_ATTR}>
              {rail.values.map((value) => {
                const channel = channelFor.get(value.ref);
                const entity = entities.find((item) => item.identity.ref === value.ref);
                if (channel === undefined || entity === undefined || value.value === null) {
                  return null;
                }
                const offset = rail.ceiling > 0 ? Math.min(1, value.value / rail.ceiling) : 0;
                return (
                  <span
                    className="rail-mark"
                    key={value.ref}
                    style={{ '--mark-x': `${String(offset * 100)}%` } as CSSProperties}
                  >
                    <svg
                      aria-hidden="true"
                      className="rail-glyph"
                      focusable="false"
                      height={14}
                      viewBox="-7 -7 14 14"
                      width={14}
                    >
                      <MarkerGlyph shape={channel.marker} token={channel.plot} x={0} y={0} />
                    </svg>
                    <span
                      className="rail-value"
                      style={{ '--series': cssVar(channel.plot) } as CSSProperties}
                    >
                      <span className="rail-value-figure">{Math.round(value.value * 100)}%</span>
                      <span className="rail-value-who">{entity.identity.surname}</span>
                      <span className="rail-value-of">
                        {value.numerator} of {value.denominator}
                      </span>
                    </span>
                  </span>
                );
              })}
            </div>
            <p className="rail-denominator">{rail.denominatorLabel}</p>
          </li>
        ))}
      </ol>

      <ul className="season-notes">
        <li className="season-note">
          <Info size={16} aria-hidden="true" />
          <span>
            <strong>No total appears on this page.</strong> The championship has run under 24
            different points systems and six eras counted only a driver&rsquo;s best results, so a
            career points figure is not one quantity. A season also grew from 8.4 rounds in the
            1950s to 21.9 in the 2020s, which makes a win count a measure of opportunity before it
            is a measure of a driver.
          </span>
        </li>
        <li className="season-note">
          <Info size={16} aria-hidden="true" />
          <span>
            <strong>Same-car pairings are not races.</strong> A 1950s constructor could enter more
            than twenty cars in one Grand Prix, and every same-team pair in a race counts once — so
            a driver of that era can hold more pairings than starts. It is the reason the two
            teammate rails carry their own denominators.
          </span>
        </li>
      </ul>
    </section>
  );
}
