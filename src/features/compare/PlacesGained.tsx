import type { CSSProperties } from 'react';
import type { SeriesChannels } from '@/components/charts/ladder';
import { MarkerGlyph } from '@/components/charts/MarkerGlyph';
import { Info } from '@/components/ui/icons';
import { cssVar } from '@/lib/entityColor';
import { GAIN_BAR_ATTR, usePopulationMount } from '@/lib/motion/scroll';
import { placesGained } from './model';
import type { CompareEntity } from './types';

/**
 * **`PlacesGained` — did he move forward from where he started?**
 * `DESIGN_SYSTEM.md` §6.6.6.14 C.
 *
 * *Job*: **polarity and magnitude** — a signed quantity around a true zero. *Form*: a diverging
 * bar, one row per driver, the zero line drawn down the middle of every track. *Marks*: the rate
 * board's 8px track and `--radius-xs` bar, anchored at zero rather than at the left edge.
 * *Interaction*: none, and none is needed — every figure is printed. *Colour*: the entity's plot
 * token; **the sign is carried by direction, never by hue**, which matters twice over here because
 * green is a reserved timing semantic (§3.4) and a red/green pair is the commonest CVD failure in
 * charting. *Accessibility*: figures beside every bar, the ladder's marker glyph in the gutter, and
 * the split counted in words.
 *
 * ---
 *
 * **A diverging bar, when §6.6.6.3 argued against one.** That argument was about a *head-to-head
 * split* — two counts of one whole, where a diverging form pushes the imbalance out to the ends and
 * makes it hardest to compare exactly where it matters. This is the other case: a genuinely signed
 * quantity with a real zero in the middle of its range, where the sign *is* the first thing the
 * reader wants. The forms differ because the quantities do.
 *
 * ## Three properties of this measure that decide how it may be drawn
 *
 * 1. ⚠ **A null mean is a state, not a zero.** 155 of the 818 drivers with a race were never
 *    classified in one they started from a grid slot, and every one of them is pickable. A
 *    zero-length bar at the origin reads as "started and finished level every time" — a different
 *    and false claim, and §1.0's exact failure mode.
 * 2. ⚠ **The split can disagree with the mean's sign, and that is the honest part.** A handful of
 *    large losses outweighs many small gains, so a driver can be ahead in far more races than he is
 *    behind and still average a loss. The counts are printed beside the bar for exactly that
 *    reason; a bar drawn on the mean alone puts such a driver on the side of zero that a reader
 *    counting races would not expect.
 * 3. ⚠ **The denominator is not his race count.** A race that ended without a classification has no
 *    place change to measure and is excluded rather than counted as zero. That exclusion is large —
 *    33 of Verstappen's 243 — so it is printed rather than assumed.
 *
 * **Motion is G-27 through `usePopulationMount`**, with the anchor read from the mark's own
 * `data-origin`: a bar pointing back grows from its right edge, because the axis it is measured
 * from is zero and not the left edge of the track. Not created at all under reduced motion.
 *
 * ⚠ **Untested by construction**: that the zero line lands at the centre of every track, that a
 * 3px minimum bar is visible, and whether the split column wraps at 768. jsdom performs no layout.
 */

export interface PlacesGainedProps {
  entities: CompareEntity[];
  channels: SeriesChannels[];
}

const signed = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}`;

export function PlacesGained({ entities, channels }: PlacesGainedProps) {
  const { rows, scale } = placesGained(entities);
  const channelFor = new Map(
    entities.map((entity, index) => [entity.identity.ref, channels[index]]),
  );

  const { scope } = usePopulationMount<HTMLOListElement>([
    rows.length,
    rows.map((row) => row.ref).join(','),
  ]);

  const unmeasured = rows.filter((row) => row.mean === null);
  const excluded = rows.filter((row) => row.excluded > 0);

  return (
    <section className="gains" aria-labelledby="gains-heading">
      <header className="rails-header">
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          Against the slot he started from
        </p>
        <h2 className="rails-heading" id="gains-heading">
          Places gained on the first lap and after it
        </h2>
      </header>

      <div className="gain-scale">
        <span>lost places</span>
        <span className="t-mono">
          {'−'}
          {scale.toFixed(1)} to +{scale.toFixed(1)} places, average per race
        </span>
        <span>gained places</span>
      </div>

      <ol className="gain-rows" ref={scope}>
        {rows.map((row) => {
          const channel = channelFor.get(row.ref);
          if (channel === undefined) return null;
          return (
            <li className="gain-row" key={row.ref}>
              <span className="rate-who">
                <svg
                  aria-hidden="true"
                  className="rate-glyph"
                  focusable="false"
                  height={12}
                  viewBox="-7 -7 14 14"
                  width={12}
                >
                  <MarkerGlyph shape={channel.marker} token={channel.plot} x={0} y={0} />
                </svg>
                <span className="rate-name">{row.surname}</span>
              </span>

              <span className="gain-track">
                <span className="gain-zero" aria-hidden="true" />
                {row.mean !== null && row.direction !== 'held' && (
                  <span
                    className="gain-bar"
                    data-direction={row.direction}
                    data-motion={GAIN_BAR_ATTR}
                    data-origin={row.direction === 'forward' ? 'left' : 'right'}
                    style={
                      {
                        '--series': cssVar(channel.plot),
                        '--gain-extent': `${String(row.extent * 50)}%`,
                      } as CSSProperties
                    }
                  />
                )}
              </span>

              <span className="rate-figure">
                {row.mean === null ? (
                  <>
                    <span className="rate-percent">&mdash;</span>
                    <span className="rate-of">no measured race</span>
                  </>
                ) : (
                  <>
                    <span className="rate-percent">{signed(row.mean)}</span>
                    <span className="rate-of">over {row.racesCounted} races</span>
                  </>
                )}
              </span>

              <span className="gain-split">
                {row.mean === null ? (
                  <>Never classified in a race he started from the grid.</>
                ) : (
                  <>
                    <strong>{row.gained}</strong> ahead of his grid slot,{' '}
                    <strong>{row.lost}</strong> behind it, <strong>{row.held}</strong> level.
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <ul className="season-notes">
        <li className="season-note">
          <Info size={16} aria-hidden="true" />
          <span>
            <strong>The counts are here because they can disagree with the average.</strong> A
            driver can finish ahead of his grid slot in far more races than he finishes behind it
            and still average a loss, because one race lost by fifteen places outweighs ten gained
            by one. The bar is the average; the sentence beside it is the count.
          </span>
        </li>
        {excluded.length > 0 && (
          <li className="season-note">
            <Info size={16} aria-hidden="true" />
            <span>
              <strong>
                A race that ended without a classification has no place change to measure
              </strong>
              , so it is left out rather than counted as no movement —{' '}
              {excluded.map((row) => `${row.surname} ${String(row.excluded)}`).join(', ')}. The
              figure beside each bar is the number of races that remain.
            </span>
          </li>
        )}
        {unmeasured.length > 0 && (
          <li className="season-note">
            <Info size={16} aria-hidden="true" />
            <span>
              <strong>
                {unmeasured.map((row) => row.surname).join(', ')} has no measurable race here.
              </strong>{' '}
              155 of the 818 drivers who started a Grand Prix were never classified in one they
              started from a grid slot. The row is left empty rather than drawn at zero, which would
              say he finished exactly where he started every time.
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}
