import type { CSSProperties } from 'react';
import type { SeriesChannels } from '@/components/charts/ladder';
import { MarkerGlyph } from '@/components/charts/MarkerGlyph';
import { Info } from '@/components/ui/icons';
import { cssVar } from '@/lib/entityColor';
import { TIER_BAR_ATTR, usePopulationMount } from '@/lib/motion/scroll';
import { rateRails } from './model';
import type { CompareEntity } from './types';

/**
 * **`RateRailBoard`** — `DESIGN_SYSTEM.md` §6.6.6.5. The cross-era comparison, and the only part of
 * this page that compares the selected drivers directly.
 *
 * ---
 *
 * ## ⚠ Rebuilt 2026-08-23, after a measurement. Read this before "simplifying" it back
 *
 * The first build put **one rail per measure with four markers on it**, each marker carrying a
 * floating direct label. It was measured at 1440 and it failed, in two ways that turned out to have
 * one cause:
 *
 * - **51 real sibling label collisions.** `Hamilton` over `Verstappen` by **62px**, rendering as
 *   `MARSTAPPEN`; `207 of 390` over `130 of 243` by 58px, rendering as `2020o6.f5983`. Three of the
 *   five rows were unreadable.
 * - **The axis caption collided with the leading marker on all five rows, structurally** — the
 *   caption reads `0 – 47%` and the leader's label reads `47%`, because **the leader *is* the
 *   ceiling**. That was not bad luck; it could not not happen.
 * - **17px of horizontal page overflow at 390.** `document.scrollWidth` 407 against a 390 viewport,
 *   and every offender was one of these labels reaching x = 400–407.
 *
 * **The honest finding is not that the labels needed nudging. It is that the form was wrong for its
 * own stated job.** §6.1 step 1 asks what the chart is for, and the answer here is **magnitude** — a
 * rate is a quantity, not a position. A marker on a shared rail encodes *position* and encodes
 * magnitude not at all; a bar anchored at zero encodes magnitude directly. The old form was a 1-D
 * scatter with three lines of text hung off each of four points inside a 12px band, and no
 * de-collision arithmetic makes that legible at 390 where the whole track is ~220px wide.
 *
 * **So the board is now one row per entity per measure**, which is the anatomy §7.14's
 * `PopulationBoard` ladder already uses and which this should have reused in the first place:
 * label and figure on fixed grid columns, track between them, one mark per row.
 *
 * **Collisions are now impossible by construction rather than avoided by measurement.** Every piece
 * of text sits in its own grid cell; nothing on this board is absolutely positioned; nothing can
 * reach past the track's right edge because the figure column is reserved before the track is
 * sized. That is the difference between a fix and a patch, and it is why the answer was a form
 * change rather than a clamp.
 *
 * **What was given up, and the answer to my own earlier objection.** The old spec argued against
 * grouped bars because *"grouped bars make the reader compare across groups by memory"*. That is
 * true only when the group order varies. Here **the entity order is the stable selection order and
 * is identical on all five measures** (§6.2 — colour and order follow the entity, never its rank),
 * so reading one driver across the five measures is a vertical scan at a fixed offset, not a
 * recall task. Sorting these rows by value would break that and must not be done.
 *
 * **The direct-label rule is satisfied more strictly than before, not less** (§6.4 rung 1). The
 * label sits in its row's own gutter beside its own marker glyph, adjacent to exactly one mark. The
 * old floating label was adjacent to whichever label happened to be nearest.
 *
 * ---
 *
 * **As a chart (§6.1), in order.**
 *
 * 1. **The job** — magnitude, on five unrelated measures, for up to four entities.
 * 2. **The form** — horizontal bars anchored at zero, grouped by measure. Each measure keeps **its
 *    own ceiling**, printed: a win rate and a beat-your-teammate rate live on genuinely different
 *    natural scales and one shared track would flatten the interesting one to nothing.
 * 3. **Marks** — 8px bars, `--radius-xs` data-ends, `min-width: 3px`, anchored at the zero axis.
 * 4. **Interaction** — none, and none is needed: every value is already printed as text.
 * 5. **Colour** — last. Entity tokens via `assignEntityColours`, with the ladder's marker shape in
 *    the row gutter as the mandatory second channel (§6.4). Two Mercedes drivers take the shade
 *    pair *and* circle/square *and* solid/`6 3` — §6.4a makes all three mandatory.
 * 6. **Accessibility** — every value is printed beside its own mark, which is what a table view
 *    would have added; the same §6.5 discharge §7.14 records. Twenty marks, twenty printed numbers.
 *
 * ---
 *
 * **Every rail is a rate and none is a total, and that is correctness rather than taste.** 24 point
 * systems, six best-N eras and a season that grew from 8.4 rounds to 21.9 mean a career total
 * measures opportunity before it measures a driver (`REQUIREMENTS.md` §5.2, trap 4). A y-axis
 * reading "career points" is a defect in this product, and a win *count* is only marginally better.
 *
 * **The denominator is printed on every row**, because a rate whose denominator is invisible is not
 * checkable — and two of these have denominators that are genuinely surprising. Fangio's same-car
 * pairings number 93 against 51 starts, because a 1950s constructor could enter as many as 29 cars
 * in one Grand Prix and every same-team pair in a race is one comparison.
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

  /*
   * **G-27 through `usePopulationMount`, reused rather than reimplemented.** These are the same
   * mark as §7.14's ladder bars — a horizontal magnitude anchored at zero — so they take the same
   * motion: `scaleX 0 → 1` from `transformOrigin: 'left'`, `dur.chart` / `ease.mech`,
   * `stagger.bar` through `staggerAmount`, and **not created at all** under reduced motion.
   * Declaring a second hook with the same tokens is exactly the drift §4.3 exists to prevent.
   *
   * The first build wrote `data-motion="chart-bar"` on the track and called **no hook at all**, so
   * these bars have never animated while the markup claimed they did. That is CR-007's "a motion a
   * comment claimed existed but nothing implemented" defect, shipped again; it is recorded here
   * rather than quietly corrected.
   *
   * Deps identify the **dataset** — which measures, for which entities — never a hover (G-29).
   */
  const { scope } = usePopulationMount<HTMLOListElement>([
    rails.length,
    entities.map((entity) => entity.identity.ref).join(','),
  ]);

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

      <ol className="rails-list" ref={scope}>
        {rails.map((rail) => (
          <li className="rate-measure" key={rail.id}>
            <div className="rate-measure-head">
              <span className="rate-measure-name">{rail.label}</span>
              <span className="rate-measure-ceiling">0 – {Math.round(rail.ceiling * 100)}%</span>
            </div>

            <ol className="rate-rows">
              {rail.values.map((value) => {
                const channel = channelFor.get(value.ref);
                const entity = entities.find((item) => item.identity.ref === value.ref);
                if (channel === undefined || entity === undefined) return null;
                const extent =
                  rail.ceiling > 0 ? Math.min(1, (value.value ?? 0) / rail.ceiling) : 0;

                return (
                  <li className="rate-row" key={value.ref}>
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
                      <span className="rate-name">{entity.identity.surname}</span>
                    </span>

                    <span className="rate-track">
                      {/*
                       * ⚠ **A rate of zero draws no bar** _(2026-08-23)_. `min-width: 3px` keeps a
                       * near-zero rate visible, which is right for a driver who won 1 of 390 and
                       * wrong for one who never won at all — the floor was painting a mark for
                       * *nothing* on every zero, and 702 of 818 drivers have never won a Grand
                       * Prix. `null` and `0` stay different states: `null` is "he never started,
                       * so there is no rate", `0` is "there is a rate and it is zero", and both
                       * are said in the figure column where they are text.
                       */}
                      {value.value !== null && value.value > 0 && (
                        <span
                          className="rate-bar"
                          data-motion={TIER_BAR_ATTR}
                          style={
                            {
                              '--series': cssVar(channel.plot),
                              '--rate-extent': `${String(extent * 100)}%`,
                            } as CSSProperties
                          }
                        />
                      )}
                    </span>

                    <span className="rate-figure">
                      {value.value === null ? (
                        <>
                          <span className="rate-percent">&mdash;</span>
                          <span className="rate-of">never started</span>
                        </>
                      ) : (
                        <>
                          <span className="rate-percent">{Math.round(value.value * 100)}%</span>
                          <span className="rate-of">
                            {value.numerator} of {value.denominator}
                          </span>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>

            <p className="rate-denominator">{rail.denominatorLabel}</p>
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
            teammate rows carry their own denominators.
          </span>
        </li>
        <li className="season-note">
          <Info size={16} aria-hidden="true" />
          <span>
            Each measure is scaled to its own leader, printed beside its name. Rows are in the order
            you added the drivers, on every measure — so reading one driver down the board is a
            straight line, not a search.
          </span>
        </li>
      </ul>
    </section>
  );
}
