import { BarChart, LineChart, SpanChart } from '@/components/charts';
import { formatDuration } from '@/lib/format';
import type { RaceLaps, RaceStints } from '@schemas/race';
import { selectDriverShortLabel } from './selectors';
import {
  MAX_TRACE_SERIES,
  selectLapTimeChart,
  selectPitTimeline,
  selectStintChart,
} from './series';

/**
 * **RD-2, RD-3 and RD-7** — the three lap-scale charts, each an addition that may be absent.
 *
 * Every one of them takes its data from a selector that is already written and tested. What this file
 * decides is the *presentation*: which title, which unit in the axis label, what the caption has to
 * say, and which cross-era caveat is not optional.
 *
 * **Nothing here recomputes a ceiling or a distribution figure.** `selectLapTimeChart` states the
 * lap-time ceiling from the session's fastest lap and `selectPitTimeline` states the pit ceiling from
 * the median — and both are *server-stated inputs*, so two charts on one page cannot disagree about
 * where the axis stops. That is the whole reason `geometry.lapTimeCeiling` was deleted rather than
 * kept: one rule, one implementation, one figure.
 */

/* -------------------------------------------------------------------------- RD-2, traces */

export interface LapTimeTraceProps {
  laps: RaceLaps;
  /** Driver references to plot, capped at 4 by §6.5.2. */
  selected: readonly string[];
  onSelect: (next: string[]) => void;
}

export function LapTimeTrace({ laps, selected, onSelect }: LapTimeTraceProps) {
  const chart = selectLapTimeChart(laps, selected);

  /*
   * §6.5.2's cap is a rule about the *chart*, so the copy has to say what is not being shown rather
   * than let a fifth selection silently vanish. `omitted` exists for this.
   */
  const notes =
    chart.omitted.length > 0
      ? [
          `Showing ${String(MAX_TRACE_SERIES)} drivers. ${String(chart.omitted.length)} more are selected and not plotted — a lap-time trace stays comparable at four.`,
        ]
      : [];

  return (
    <div className="season-subsection">
      <h3 className="t-display-xs text-ink-primary">Lap times</h3>

      {selected.length === 0 ? (
        /*
         * **The empty state is a prompt, not an apology.** Unlike the rank chart — where the whole
         * field *is* the resting view — a trace of twenty drivers would be unreadable, so this one
         * starts empty and says what to do. §6.5.3's empty state with an action.
         */
        <div className="season-panel p-4 md:p-6">
          <p className="t-sm text-ink-secondary">
            Choose up to {MAX_TRACE_SERIES} drivers below to compare their lap times.
          </p>
        </div>
      ) : (
        <div className="season-panel season-progression">
          <LineChart
            series={chart.series.map((s) => ({
              reference: s.driverRef,
              teamReference: s.colorRef,
              label: s.label,
              points: s.points.map((p) => ({ x: p.lap, y: p.timeMs })),
            }))}
            title="Lap time by lap"
            subtitle={`${String(chart.series.length)} of ${String(MAX_TRACE_SERIES)} drivers`}
            ariaLabel="Lap time for each selected driver, lap by lap."
            caption="Every timed lap, including pit and traffic laps. Laps above the axis ceiling are marked and their exact times are in the table."
            notes={notes}
            xTitle="Lap"
            yTitle="Lap time"
            formatX={(lap) => `L${String(lap)}`}
            formatXLong={(lap) => `Lap ${String(lap)}`}
            formatY={formatDuration}
            {...(chart.ceilingMs === null ? {} : { yCeiling: chart.ceilingMs })}
            formatCeiling={formatDuration}
          />
        </div>
      )}

      <DriverPicker
        drivers={laps.drivers.map((d) => ({
          ref: d.driverRef,
          label: selectDriverShortLabel(d),
        }))}
        selected={selected}
        cap={MAX_TRACE_SERIES}
        legend="Compare lap times"
        onSelect={onSelect}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- RD-3, stints */

export function StintChart({ stints }: { stints: RaceStints }) {
  const chart = selectStintChart(stints);

  return (
    <div className="season-subsection">
      <h3 className="t-display-xs text-ink-primary">Stints</h3>
      <div className="season-panel season-progression">
        <SpanChart
          rows={chart.rows.map((row) => ({
            reference: row.driverRef,
            teamReference: row.colorRef,
            label: row.label,
            spans: row.stints.map((stint) => ({
              /* `stint.stint` is the payload's own ordinal, so the key needs no index. */
              key: `${row.driverRef}-${String(stint.stint)}`,
              start: stint.fromLap,
              end: stint.toLap,
              /* The payload states the length; a span chart expresses it as extent and never as a
               * number, so this is the one place the figure is legible on the plot. */
              label: String(stint.laps),
            })),
          }))}
          title="Stints"
          subtitle={`${String(chart.rows.length)} drivers`}
          ariaLabel="The laps each driver ran between pit stops."
          caption="Each block is a stint — the laps run between stops. A driver who never stopped is one full-length block, which is the most informative row a strategy chart carries."
          measureTitle="Lap"
          formatMeasure={(lap) => String(lap)}
          {...(chart.firstLap === null || chart.lastLap === null
            ? {}
            : { domain: [chart.firstLap, chart.lastLap] as const })}
        />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------- RD-7, pits */

export function PitTimeline({ stints }: { stints: RaceStints }) {
  const chart = selectPitTimeline(stints);

  if (chart.rows.length === 0) {
    return (
      <div className="season-subsection">
        <h3 className="t-display-xs text-ink-primary">Pit stops</h3>
        <div className="season-panel p-4 md:p-6">
          <p className="t-sm text-ink-tertiary">Nobody pitted in this race.</p>
        </div>
      </div>
    );
  }

  /*
   * **The cross-era caveat is not optional.** `DATABASE.md` §2.4: duration semantics vary across eras
   * — some stationary time, some pit-lane transit — so a duration is never comparable across decades
   * and the chart has to say so on its face rather than in a tooltip nobody opens. It is a `note`
   * (`--status-info`) and not a caption, because it changes how every number above it is read.
   */
  const notes = [
    'Pit stop durations are not comparable between eras: what the timing recorded as a “stop” has meant stationary time in some seasons and pit-lane transit in others.',
  ];

  /* One bar per stop, so the key carries the driver and the stop number. */
  const data = chart.rows.flatMap((row) =>
    row.stops.map((stop) => ({
      key: `${row.driverRef}-${String(stop.stopNumber)}`,
      label: `${row.label} · L${String(stop.lap)}`,
      value: stop.durationMs ?? 0,
      teamReference: row.colorRef,
    })),
  );

  return (
    <div className="season-subsection">
      <h3 className="t-display-xs text-ink-primary">Pit stops</h3>
      <div className="season-panel season-progression">
        <BarChart
          data={data}
          title="Pit stop durations"
          subtitle={`${String(data.length)} stops`}
          ariaLabel="How long each pit stop took, by driver and lap."
          caption="One bar per stop. The axis is clipped at twice the median stop, so a red-flag stop does not compress every real one — exact values are in the table."
          notes={notes}
          valueTitle="Stop duration"
          categoryTitle="Driver and lap"
          formatValue={formatDuration}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ shared control */

/**
 * The driver picker. `.season-entity-chip` and the cap-disables-rather-than-evicts rule, both
 * inherited from the season hub's compare field — one control, learned once.
 */
function DriverPicker({
  drivers,
  selected,
  cap,
  legend,
  onSelect,
}: {
  drivers: readonly { ref: string; label: string }[];
  selected: readonly string[];
  cap: number;
  legend: string;
  onSelect: (next: string[]) => void;
}) {
  const full = selected.length >= cap;

  return (
    <fieldset className="season-select-field">
      <legend className="season-select-legend">
        {`${legend} — ${String(selected.length)} of ${String(cap)}`}
      </legend>
      {drivers.map((driver) => {
        const on = selected.includes(driver.ref);
        return (
          <button
            key={driver.ref}
            type="button"
            className="season-entity-chip"
            aria-pressed={on}
            disabled={!on && full}
            onClick={() => {
              onSelect(
                on ? selected.filter((entry) => entry !== driver.ref) : [...selected, driver.ref],
              );
            }}
          >
            {driver.label}
          </button>
        );
      })}
    </fieldset>
  );
}
