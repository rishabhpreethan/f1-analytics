import { cssVar } from '@/lib/entityColor';
import type { BarDatum, ResolvedSeries } from './types';

/**
 * §6.5.5 — **the table view, on every chart, in the same place.**
 *
 * Three reasons this exists as a real `<table>` rather than as an `aria` narration of the SVG:
 * it is the discharge of §3.2's contrast WARN; a table with `<caption>`, `<th scope>` and tabular
 * numerals is a better rendering for a screen-reader user than any description of a picture; and
 * it is the only view that survives print, a screenshot in a message, or a reader who wants the
 * number rather than the shape.
 *
 * **Numerals are `--font-mono` and right-aligned** (§2.4), because a column of lap times in a
 * proportional font is a column that looks like it is vibrating.
 */

export interface SeriesTableProps {
  series: readonly ResolvedSeries[];
  caption: string;
  /** The x column's heading — "Round", "Season", "Lap". Carries the unit if there is one. */
  xLabel: string;
  formatX: (x: number) => string;
  formatY: (y: number) => string;
  /** What a `null` reading prints as. Never `0`, and never an empty cell. */
  noValue?: string;
}

export function SeriesTable({
  series,
  caption,
  xLabel,
  formatX,
  formatY,
  noValue = '—',
}: SeriesTableProps) {
  /* Every x that any series has a row for, ascending. A union rather than the first series' x
   * values: a driver who joined at round 5 must not silently truncate the table to rounds 5+. */
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);

  return (
    <table className="chart-table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col" data-numeric="true">
            {xLabel}
          </th>
          {series.map((entry) => (
            <th scope="col" key={entry.reference} data-numeric="true">
              <span
                className="chart-table-swatch"
                aria-hidden="true"
                style={{ '--series': cssVar(entry.identity) } as React.CSSProperties}
              />
              {entry.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {xs.map((x) => (
          <tr key={x}>
            <th scope="row" data-numeric="true">
              {formatX(x)}
            </th>
            {series.map((entry) => {
              const point = entry.points.find((p) => p.x === x);
              const value = point?.y ?? null;
              return (
                <td key={entry.reference} data-numeric="true">
                  {value === null ? noValue : formatY(value)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface BarTableProps {
  data: readonly BarDatum[];
  caption: string;
  categoryLabel: string;
  valueLabel: string;
  formatValue: (value: number) => string;
  /** The token per bar, so the table carries the same identity swatch the chart does. */
  tokenFor?: (datum: BarDatum) => string | undefined;
}

export function BarTable({
  data,
  caption,
  categoryLabel,
  valueLabel,
  formatValue,
  tokenFor,
}: BarTableProps) {
  return (
    <table className="chart-table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{categoryLabel}</th>
          <th scope="col" data-numeric="true">
            {valueLabel}
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((datum) => {
          const token = tokenFor?.(datum);
          return (
            <tr key={datum.key}>
              <th scope="row">
                {token !== undefined && (
                  <span
                    className="chart-table-swatch"
                    aria-hidden="true"
                    style={{ '--series': cssVar(token) } as React.CSSProperties}
                  />
                )}
                {datum.label}
              </th>
              <td data-numeric="true">{formatValue(datum.value)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
