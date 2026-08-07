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

      {view === 'chart' ? (
        <div
          className="chart-plot"
          role="img"
          aria-label={ariaLabel}
          aria-describedby={caption === undefined ? undefined : captionId}
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
