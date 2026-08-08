import { useState } from 'react';
import type { Driver } from '@schemas/driver';
import { BarChart } from '@/components/charts';
import { progressCoverage, seasonProgress, type ProgressMetric } from './presenters';

/**
 * **DR-4 and DR-5 as one chart with two measures** — `DESIGN_SYSTEM.md` §6.6.2.4.
 *
 * Two near-identical diverging bars would be the worst outcome here. *Grid → finish* and
 * *qualifying → finish* differ only by grid penalties, so side by side they read as a rendering
 * mistake rather than as two measures — and the reader would have to hold one plot in their head
 * to compare it with the other. One chart with a segmented control makes the difference between
 * them **visible by toggling**, which is the most informative presentation of two measures that
 * agree most of the time and disagree exactly where the interesting thing happened.
 *
 * §6.1's six steps:
 *
 * 1. **Job**: polarity, per season. Did this driver gain or lose places, and when in their career.
 * 2. **Form**: a diverging horizontal bar, zero at the centre. Horizontal because a career is 1–20
 *    rows and reads top-down as a ledger, because §6.3 rotates any category axis above seven
 *    anyway, and because `categoryPlotHeight` grows the plot rather than crushing the labels.
 * 3. **Marks**: `BarChart`'s — 4px data-end on the far end only, square against the zero line, 2px
 *    surface gap between rows.
 * 4. **Interaction**: per-mark tooltip; the control row sits **above** the plot, never in it.
 * 5. **Colour**: the team the driver entered the most races with that season, so a career changes
 *    colour when the driver changed team — which is the reading an F1 fan wants from a career
 *    ledger and costs nothing, because a bar's identity is already carried by its label.
 * 6. **Accessibility**: every band labelled with its season, a table view, and the disabled
 *    segment's explanation rendered as **text beside the control** — never only a `title`, which is
 *    unreachable by touch, unreachable by keyboard in most browsers, and invisible in a screenshot.
 *
 * ---
 *
 * **The pre-1994 state is the control, not the plot.** NV-8: a coverage-aware control is disabled
 * and *explains itself*, reusing §7.4's exact sentence. A blank plot is never the answer to a
 * boundary.
 *
 * **And the boundary is holed, not bounded**, which is why the copy is generated from a season
 * count rather than from the year 1994. Qualifying classifications run 15/16 of 1994's rounds and
 * 17/17 of 1995's, then **7, 10, 7, 3, 4, 1 and 2** of ~16 for 1996–2002. "Seasons before 1994"
 * would understate that by six years and would be the more confident-sounding wording.
 */

export interface DriverProgressProps {
  driver: Driver | null;
  pending: boolean;
}

const LABEL: Record<ProgressMetric, string> = {
  grid: 'Grid → finish',
  qualifying: 'Qualifying → finish',
};

export function DriverProgress({ driver, pending }: DriverProgressProps) {
  const [metric, setMetric] = useState<ProgressMetric>('grid');

  const races = driver?.races ?? [];
  const qualifyingCoverage = progressCoverage(races, 'qualifying');
  /*
   * The segment is disabled when **no** season can be computed, not when the career predates a
   * year. A career that straddles the boundary keeps the segment and gets a partial note.
   */
  const qualifyingAvailable = qualifyingCoverage.seasonsCovered > 0;
  const active: ProgressMetric = metric === 'qualifying' && !qualifyingAvailable ? 'grid' : metric;

  const rows = seasonProgress(races, active);
  const coverage = active === 'grid' ? progressCoverage(races, 'grid') : qualifyingCoverage;

  const data = rows.map((row) => ({
    key: String(row.year),
    label: String(row.year),
    value: Number(row.mean.toFixed(2)),
    teamReference: row.teamRef,
  }));

  const notes: string[] = [];
  if (coverage.seasonsCovered < coverage.seasonsTotal) {
    const missing = coverage.seasonsTotal - coverage.seasonsCovered;
    notes.push(
      active === 'qualifying'
        ? `${String(missing)} of ${String(coverage.seasonsTotal)} seasons are not shown: they have no qualifying classifications to measure against. Qualifying results begin in 1994 and are complete from 2003. Every season is in the table below with its finishing positions.`
        : `${String(missing)} of ${String(coverage.seasonsTotal)} seasons are not shown: no race in them ended with both a starting position and a classified finish. Every season is in the table below.`,
    );
  }

  const excluded = driver?.gridVsFinish.excluded;
  if (active === 'grid' && excluded !== undefined) {
    /*
     * §5.1 — the metric excludes retirements and pit-lane starts, and the caption says so with the
     * counts. A mean that quietly included retirements would make every unreliable car look like a
     * bad racer, and the reader would have no way to tell.
     */
    notes.push(
      `Excludes ${String(excluded.unclassified)} races that ended without a classified finish and ${String(excluded.pitLaneStarts)} pit-lane starts, which have no grid position to gain from.`,
    );
  }

  return (
    <section className="season-section" aria-labelledby="driver-progress-title">
      <div>
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          Race craft
        </p>
        <h2 id="driver-progress-title" className="t-display-sm text-ink-primary mt-3">
          Places gained and lost
        </h2>
      </div>

      <div className="season-panel entity-chart-panel">
        <div className="season-filters">
          {/*
           * §3.5.1a — a pressed segment carries **three** channels: fill, ink and weight. The
           * unpressed recession is the one that makes dark mode work, and `.chart-seg` already
           * implements all three, so this is the product's control rather than a new one.
           */}
          <div className="chart-seg" role="group" aria-label="Measure">
            {(['grid', 'qualifying'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className="chart-seg-btn"
                aria-pressed={active === option}
                disabled={option === 'qualifying' && !qualifyingAvailable}
                onClick={() => {
                  setMetric(option);
                }}
              >
                {LABEL[option]}
              </button>
            ))}
          </div>

          {!qualifyingAvailable && !pending && driver !== null && (
            <p className="entity-control-note">
              Qualifying positions aren’t available for this career. Qualifying data begins in 1994
              and is complete from 2003.
            </p>
          )}
        </div>

        <BarChart
          data={data}
          orientation="row"
          title={LABEL[active]}
          subtitle={`Mean places gained per season · ${String(rows.length)} seasons`}
          valueTitle="Mean places gained"
          categoryTitle="Season"
          formatValue={(value) =>
            /* A signed figure, with U+2212 for minus so it matches digit width (§2.4). A bare
             * hyphen in a mono column is narrower than a digit and the column stops aligning. */
            value > 0
              ? `+${value.toFixed(1)}`
              : value < 0
                ? `−${Math.abs(value).toFixed(1)}`
                : '0.0'
          }
          state={pending ? 'loading' : data.length === 0 ? 'empty' : 'ready'}
          stateCopy={{
            title: 'Nothing to plot here',
            body:
              active === 'qualifying'
                ? 'No season in this career has both a qualifying classification and a classified finish.'
                : 'No season in this career has both a starting position and a classified finish.',
          }}
          notes={notes}
          ariaLabel={
            active === 'grid'
              ? 'Mean places gained between the starting grid and the finish, for each season of this career.'
              : 'Mean places gained between the qualifying classification and the finish, for each season of this career.'
          }
          caption={
            active === 'grid'
              ? 'Positions gained is the starting grid slot minus the finishing position, averaged over the season. Retirements and pit-lane starts are excluded — they have no place change to report.'
              : 'The qualifying classification minus the finishing position, averaged over the season. This is what the driver earned on Saturday against what they took on Sunday; the grid measure above is what they actually started from, after penalties.'
          }
        />
      </div>
    </section>
  );
}
