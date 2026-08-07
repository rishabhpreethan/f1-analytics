import { useState, type CSSProperties } from 'react';
import { COMPARISON_CAP, LineChart } from '@/components/charts';
import { positionTicksWithin } from '@/components/charts/geometry';
import { ErrorState } from '@/components/ui/ErrorState';
import { cssVar, identityToken } from '@/lib/entityColor';
import type { StandingsProgression } from '@schemas/season';
import {
  selectGapToLeader,
  selectPositionSeries,
  selectProgressionSeries,
  selectRoundAxis,
  type ProgressionSeries,
  type SeriesKind,
} from './selectors';
import {
  METRICS,
  METRIC_ORDER,
  KIND_LABEL,
  defaultSelection,
  formatPosition,
  formatRound,
  positionDomain,
  roundNamer,
  toSeriesInput,
  toggleSelection,
  type ProgressionMetric,
} from './progression';

/**
 * **Championship progression** — SC-1 and SC-2, and the first real chart in the product.
 *
 * §6.1's six steps:
 *
 * 1. **Job**: change over time. How a championship was won, or is being won.
 * 2. **Form**: a per-round line. §6.5.4's scope→form rule fixes this — one season with ≤4 entities
 *    is a per-round line, and it is not the user's choice to get wrong. A bar chart would answer
 *    "how big was round 7", which nobody asks of a championship; a slope chart would throw away the
 *    intermediate rounds, which is where a title actually turns.
 * 3. **Marks**: the kit's. 2px lines, ≥8px markers with a surface ring, `null` drawn as a **gap**
 *    and never as zero.
 * 4. **Interaction**: one crosshair, one tooltip, every series in it, sorted by value. The filter
 *    row is above the plot and never over it.
 * 5. **Colour**: last. A driver plots in their team's colour; two drivers of one team is the
 *    teammate case, and §6.4a makes **marker shape and dash mandatory** there rather than escalated.
 * 6. **Accessibility**: legend at ≥2, direct labels at ≤4, a table view in the frame's header, and
 *    the plot as one tab stop with arrow-key stepping mirrored into an `aria-live` region.
 *
 * ---
 *
 * ## Three decisions worth the words
 *
 * **Three metrics, three charts — never one chart with two axes.** Points, position and gap answer
 * different questions on incompatible scales. §6.2's first non-negotiable is that two measures of
 * different scale become two charts, so the metric control is **exclusive**: choosing one replaces
 * the plot rather than adding to it. That is also why the axis title changes with it and always
 * carries the unit.
 *
 * **The default selection is the top four, and switching metric never changes it.** The series
 * arrive ordered by final standing, so the default is a `slice` and not a sort — sorting per metric
 * would mean moving from points to position silently swapped *which* drivers were shown as well as
 * what was plotted. Four is the cap (§6.2) and the count at which direct labels are the primary
 * identification (§6.5.2), so the default view is the one the system is strongest at rather than a
 * 22-series chart that would need small multiples.
 *
 * **The entity selection is its own row beneath the filters, not inside them.** §6.5.1 says filters
 * sit in one row above the plot; a season has 22 drivers and that cannot be one row of controls.
 * The *controls* stay in one row and the selection is a labelled `<fieldset>` under it — still above
 * the plot, never floating over it. Recorded in `DESIGN_SYSTEM.md` §6.5.2 rather than bent quietly.
 */

export interface SeasonProgressionProps {
  year: number;
  /** Null while the standings query is in flight, or when it failed. */
  progression: StandingsProgression | null;
  pending: boolean;
  errorCode: string | null;
  onRetry: () => void;
  /** False for 1950–57: no Constructors' Championship, so the entity switch offers drivers only. */
  hasTeamStandings: boolean;
}

export function SeasonProgression({
  year,
  progression,
  pending,
  errorCode,
  onRetry,
  hasTeamStandings,
}: SeasonProgressionProps) {
  const [metric, setMetric] = useState<ProgressionMetric>('points');
  const [kind, setKind] = useState<SeriesKind>('driver');
  /*
   * `null` means "not yet chosen", which is different from "nothing chosen". It resolves to the top
   * four on first render with data, and **is reset when the entity kind changes** — a driver
   * reference is not a team reference, so carrying it across would select nothing.
   */
  const [selected, setSelected] = useState<string[] | null>(null);

  const effectiveKind: SeriesKind = hasTeamStandings ? kind : 'driver';
  const spec = METRICS[metric];

  /* The full field, for the chip row and for the default selection. Built for the *current* kind. */
  const field: ProgressionSeries[] =
    progression === null ? [] : selectProgressionSeries(progression, effectiveKind);

  const selection = selected ?? defaultSelection(field);

  /*
   * The metric decides which selector runs. `gap` in particular **must** be computed over the whole
   * progression and filtered afterwards — the leader is the leader of the championship, not of the
   * selection, which is the entire meaning of the metric.
   */
  const series: ProgressionSeries[] =
    progression === null
      ? []
      : metric === 'points'
        ? selectProgressionSeries(progression, effectiveKind, { only: selection })
        : metric === 'position'
          ? selectPositionSeries(progression, effectiveKind, { only: selection })
          : selectGapToLeader(progression, effectiveKind, { only: selection });

  const rounds = progression === null ? [] : selectRoundAxis(progression);
  const namer = roundNamer(progression?.rounds ?? []);

  /* §6.3 — the position axis is the size of the field, not the range the selection occupies. */
  const domain =
    metric === 'position' && progression !== null
      ? positionDomain(selectPositionSeries(progression, effectiveKind))
      : null;

  const state =
    errorCode !== null ? 'error' : pending ? 'loading' : series.length === 0 ? 'empty' : 'ready';

  const capReached = selection.length >= COMPARISON_CAP;

  function chooseKind(next: SeriesKind) {
    setKind(next);
    // A driver reference is not a team reference. Reset rather than carry it across.
    setSelected(null);
  }

  return (
    <section className="season-section" aria-labelledby="season-progression-title">
      <div>
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          The season, plotted
        </p>
        <h2 id="season-progression-title" className="t-display-sm text-ink-primary mt-3">
          How the title was decided
        </h2>
      </div>

      <div className="season-panel season-progression">
        {errorCode !== null ? (
          <ErrorState
            title="This chart could not load"
            detail="The round-by-round standings are a separate request from the rest of this page."
            code={errorCode}
            onRetry={onRetry}
          />
        ) : (
          <LineChart
            key={`${String(year)}-${effectiveKind}-${metric}`}
            series={toSeriesInput(series)}
            title={spec.title}
            subtitle={`${String(year)} · ${KIND_LABEL[effectiveKind]} · ${String(rounds.length)} rounds`}
            ariaLabel={`${spec.ariaJob}, ${String(year)}, ${KIND_LABEL[effectiveKind].toLowerCase()}.`}
            caption={spec.caption}
            state={state}
            {...(state === 'empty'
              ? {
                  stateCopy: {
                    body: `No round-by-round standings are recorded for ${String(year)}.`,
                  },
                }
              : {})}
            xTitle="Round"
            yTitle={spec.yTitle}
            formatX={formatRound}
            formatXLong={namer}
            {...(metric === 'position' ? { formatY: formatPosition } : {})}
            invertY={spec.invertY}
            zeroBaseline={spec.zeroBaseline}
            {...(domain === null ? {} : { yDomain: domain })}
            {...(domain === null ? {} : { yTickValues: positionTicksWithin(domain[0], domain[1]) })}
          />
        )}
      </div>

      {/*
       * §6.5.1 — the filter row. **One row, above the plot**, never inside the plot area and never
       * floating over it. It sits *after* the chart in the DOM only because the panel above owns the
       * chart; visually and in the tab order the controls come first inside their own block.
       */}
      {errorCode === null && (
        <div className="season-controls">
          <div className="season-filters">
            <Segmented
              label="Metric"
              options={METRIC_ORDER.map((id) => ({ id, label: METRICS[id].label }))}
              value={metric}
              onChange={setMetric}
            />
            {/*
             * Offered only where there is a second championship to switch to. A disabled
             * "Constructors" segment on a 1950 page would advertise something that never existed.
             */}
            {hasTeamStandings && (
              <Segmented
                label="Championship"
                options={[
                  { id: 'driver' as const, label: KIND_LABEL.driver },
                  { id: 'team' as const, label: KIND_LABEL.team },
                ]}
                value={effectiveKind}
                onChange={chooseKind}
              />
            )}
          </div>

          {field.length > 0 && (
            <fieldset className="season-select-field">
              <legend className="season-select-legend">
                {`Compare — ${String(selection.length)} of ${String(COMPARISON_CAP)}`}
              </legend>
              {field.map((entry) => {
                const on = selection.includes(entry.key);
                return (
                  <button
                    key={entry.key}
                    type="button"
                    className="season-entity-chip"
                    aria-pressed={on}
                    /*
                     * **Disabled at the cap rather than silently evicting the oldest choice.** §6.4
                     * rule 3 — four rungs, four entities — depends on the cap holding, and a control
                     * that quietly drops something the reader chose is worse than one that plainly
                     * says it is full.
                     */
                    disabled={!on && capReached}
                    onClick={() => {
                      setSelected(toggleSelection(selection, entry.key));
                    }}
                    style={{ '--identity': cssVar(identityToken(entry.colorRef)) } as CSSProperties}
                  >
                    <span className="entity-swatch" aria-hidden="true" />
                    {entry.shortLabel ?? entry.label}
                  </button>
                );
              })}
            </fieldset>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * The segmented control, in `.chart-seg`'s exact visual language — the same two-segment control the
 * chart frame's Chart/Table and Colour/Patterns toggles use. Reused deliberately: a reader who has
 * learned one segmented control in this product has learned all of them (§6.5.5's third reason).
 */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="chart-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className="chart-seg-btn"
          aria-pressed={value === option.id}
          onClick={() => {
            onChange(option.id);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
