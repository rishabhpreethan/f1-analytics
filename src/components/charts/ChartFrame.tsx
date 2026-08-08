import { useId, useState, type ReactNode } from 'react';
import type { PlotState } from './types';

/**
 * **The frame every chart in this product wears** (`DESIGN_SYSTEM.md` §6.5.3, §6.5.5, §6.5.6).
 *
 * Three things are here rather than in each chart, and each is a rule that would otherwise depend
 * on whoever writes the next chart remembering it:
 *
 * 1. **The Table toggle is in the header, beside the title, on every chart.** Not a link, not a
 *    modal, not a separate route — the table replaces the plot *in place*, keeping the header, the
 *    filters and the caption. It is the discharge of §3.2's contrast WARN, so it must be reachable
 *    in one action from any chart; it is how a screen-reader user reads the data; and a toggle that
 *    moves between surfaces is a toggle nobody finds twice.
 * 2. **The plot area keeps its exact height in all five states**, so nothing reflows as a query
 *    resolves. That is a CSS token rather than a measured height, in `charts.css`.
 * 3. **The frame takes exactly one measure axis.** There is no prop for a second, so a dual-axis
 *    chart is not expressible — the constraint becomes a type error rather than a convention with
 *    no review gate behind it (`ARCHITECTURE.md` §4).
 */

export interface ChartFrameProps {
  title: string;
  /** One line under the title. The scope, the filter, the season — never the chart's own type. */
  subtitle?: string;
  /**
   * The plot's `aria-label`: **the chart's job and its headline reading**, never a description of
   * its appearance. "Bar chart with five bars" tells a screen-reader user nothing they can use.
   */
  ariaLabel: string;
  /** Under the plot. Provenance, the metric's definition, the coverage window. */
  caption?: ReactNode;
  /**
   * Above the plot: the partial-data note (§6.5.3) and the cross-era normalisation note (§6.4a).
   * **Normalisation is made visible, never applied silently** — a silently indexed axis is the same
   * class of defect as a dual axis, because it makes an incomparable comparison look fine.
   */
  notes?: readonly ReactNode[];
  state?: PlotState;
  /** The SVG. Rendered only in `ready`, `loading` and `no-coverage` — never over an error. */
  children: ReactNode;
  /** The `<table>`. Required: §6.5.5 has no opt-out, and a chart without one is incomplete. */
  table: ReactNode;
  /** The legend, at ≥2 series (§6.5.2). */
  legend?: ReactNode;
  /** The filter row. One row **above** the chart, never inside the plot area, never floating. */
  filters?: ReactNode;
  /** §6.5.6 — the Patterns toggle is offered only where a fill can carry a hatch. */
  onPatternsChange?: (patterns: boolean) => void;
  patterns?: boolean;
  /** The state copy. Generated from `GET /api/meta`, never hardcoded — see §6.5.3. */
  stateCopy?: { title?: string; body: string; action?: ReactNode };
  /**
   * §6.3 — **the off-scale note, and it lives here rather than in the chart on purpose.**
   *
   * A clipped measure axis (a lap-time trace's `fastest × 1.5` ceiling) is only honest if two things
   * are true: the reader can see **how many** readings are above the ceiling without hovering
   * anything, and the exact values are one action away. The count is the note; the exact values are
   * the table view — and the table toggle is **already** this component's, so the affordance that
   * connects them has to be here too. A chart rendering its own note could state the count but could
   * not offer the button, and "the table has the real numbers" would be true in the spec and
   * invisible in the interface.
   */
  offScale?: {
    count: number;
    /** The ceiling, already formatted — e.g. `2:03.135`. The frame never formats a value. */
    ceiling: string;
  };
  /**
   * The plot area's **minimum** height, in px. Use `geometry.bandPlotHeight`.
   *
   * For any chart laying rows out with a band scale — the horizontal bar, the span, the share — whose
   * row count exceeds what the height token can label. §6.3 rotates a chart whose category axis does
   * not fit, and rotating moves the problem to the *other* axis, where 32 rows in a 360px plot gave an
   * 11.3px pitch against a 14px line-height. A leaderboard grows and its panel scrolls; it does not
   * crush its own labels.
   *
   * **Applied as `min-height`, and that is load-bearing rather than stylistic** _(corrected
   * 2026-08-08)_. As an inline `height` it *replaced* the responsive `--size-plot*` token, so the
   * caller had to decide the height in every case and could only do that by reading the measured one —
   * which is a feedback loop, and it oscillated (see `geometry.bandPlotHeight`). As a floor, the token
   * still governs every chart whose rows fit, the caller supplies a figure derived from its data
   * alone, and the used height is `max(token, floor)` — which no re-measurement can change.
   *
   * §6.5.3 is not weakened: this is a function of the data the caller already has, so it is identical
   * across loading, ready and empty for one dataset — which is the property that rule protects.
   */
  plotHeight?: number;
}

export function ChartFrame({
  title,
  subtitle,
  ariaLabel,
  caption,
  notes = [],
  state = 'ready',
  children,
  table,
  legend,
  filters,
  patterns = false,
  onPatternsChange,
  stateCopy,
  offScale,
  plotHeight,
}: ChartFrameProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const captionId = useId();

  /* An error removes the axes with the marks. Axes over an error imply the data is merely late,
   * and the reader waits for something that is not coming (§6.5.3). */
  const showPlot = view === 'chart' && state !== 'error' && state !== 'empty';

  return (
    <figure className="chart">
      <div className="chart-header">
        <div className="chart-heading">
          <h3 className="chart-title">{title}</h3>
          {subtitle !== undefined && <p className="chart-subtitle">{subtitle}</p>}
        </div>

        <div className="chart-controls">
          {onPatternsChange !== undefined && (
            <div className="chart-seg" role="group" aria-label="Fill style">
              <button
                type="button"
                className="chart-seg-btn"
                aria-pressed={!patterns}
                onClick={() => {
                  onPatternsChange(false);
                }}
              >
                Colour
              </button>
              <button
                type="button"
                className="chart-seg-btn"
                aria-pressed={patterns}
                onClick={() => {
                  onPatternsChange(true);
                }}
              >
                Patterns
              </button>
            </div>
          )}

          <div className="chart-seg" role="group" aria-label="Chart view">
            <button
              type="button"
              className="chart-seg-btn"
              aria-pressed={view === 'chart'}
              onClick={() => {
                setView('chart');
              }}
            >
              Chart
            </button>
            <button
              type="button"
              className="chart-seg-btn"
              aria-pressed={view === 'table'}
              onClick={() => {
                setView('table');
              }}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {filters}

      {notes.map((note, i) => (
        <p className="chart-note" key={`note-${String(i)}`}>
          {note}
        </p>
      ))}

      {/*
       * §6.3's off-scale note. Rendered only in the chart view — in the table view every value is
       * already on screen, so the note would be telling the reader about a ceiling that is not
       * currently being applied to anything they can see.
       */}
      {offScale !== undefined && offScale.count > 0 && view === 'chart' && (
        <p className="chart-note">
          <span>
            {offScale.count === 1
              ? `1 lap is slower than ${offScale.ceiling} and is drawn at the top of the axis.`
              : `${String(offScale.count)} laps are slower than ${offScale.ceiling} and are drawn at the top of the axis.`}
          </span>{' '}
          <button
            type="button"
            className="chart-note-action"
            onClick={() => {
              setView('table');
            }}
          >
            Show exact times
          </button>
        </p>
      )}

      {view === 'chart' ? (
        <div
          className="chart-plot"
          role="img"
          aria-label={ariaLabel}
          aria-describedby={caption === undefined ? undefined : captionId}
          {...(plotHeight === undefined ? {} : { style: { minHeight: `${String(plotHeight)}px` } })}
        >
          {showPlot && children}
          {state !== 'ready' && state !== 'loading' && stateCopy !== undefined && (
            <PlotStateBlock state={state} copy={stateCopy} />
          )}
        </div>
      ) : (
        <div className="chart-table-scroll">{table}</div>
      )}

      {view === 'chart' && legend}

      {caption !== undefined && (
        <figcaption className="chart-caption" id={captionId}>
          {caption}
        </figcaption>
      )}

      {/* §6.5.6 — in print the table follows the chart rather than replacing it. */}
      <div className="chart-table-print">{table}</div>
    </figure>
  );
}

/**
 * The three states that put copy inside the plot area.
 *
 * **`no-coverage` is neutral, never a status colour.** Lap data beginning in 1996 is a property of
 * the sport's history, not a fault; painting it `caution` tells the reader something broke. Its
 * copy always says three things — where the boundary is, which side this request falls on, and what
 * *is* available instead — and the third is the one that gets dropped and the only one that helps.
 */
function PlotStateBlock({
  state,
  copy,
}: {
  state: PlotState;
  copy: { title?: string; body: string; action?: ReactNode };
}) {
  return (
    <div className="chart-state" data-tone={state === 'no-coverage' ? 'neutral' : 'default'}>
      {copy.title !== undefined && <p className="chart-state-text">{copy.title}</p>}
      <p className="chart-state-text">{copy.body}</p>
      {copy.action}
    </div>
  );
}
