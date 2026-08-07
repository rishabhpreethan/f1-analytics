import { cssVar } from '@/lib/entityColor';
import { LegendKey } from './MarkerGlyph';
import type { ResolvedSeries } from './types';

/**
 * §6.5.2 — **a legend is present at ≥ 2 series, even when direct labels make it redundant for
 * identification.** It is the only place the dash and marker rungs are *stated*, so without it a
 * reader has to infer what a dashed line means, which is the same as not encoding it.
 *
 * The name wears `--ink-primary`, never the series colour (§6.2: text wears text tokens). The
 * coloured mark beside it carries identity; a coloured label would fail contrast for six of the
 * eleven brand colours in light mode and would say nothing the swatch did not.
 */

export interface ChartLegendProps {
  series: readonly ResolvedSeries[];
  /**
   * References with no data in the current window. §6.5.3: they stay in the legend, **struck
   * through**, and are named in a note above the plot. Removing them would be worse — a missing
   * row is a question the reader has to answer; a struck row is an answer.
   */
  emptyReferences?: readonly string[];
}

export function ChartLegend({ series, emptyReferences = [] }: ChartLegendProps) {
  if (series.length < 2) return null;
  const empty = new Set(emptyReferences);

  return (
    <ul className="chart-legend">
      {series.map((entry) => (
        <li
          className="chart-legend-item"
          key={entry.reference}
          data-empty={empty.has(entry.reference)}
        >
          <LegendKey shape={entry.marker} dash={entry.dash} token={entry.plot} />
          <span>{entry.label}</span>
          {/*
           * The identity swatch, in the TRUE brand colour, beside the plotting key. The two are
           * different roles (§3.3a.1) and showing both is what lets an F1 fan recognise the team
           * while still being able to find its line: a plotting variant of Mercedes is not the
           * colour anyone has on a cap.
           */}
          <span
            className="chart-swatch"
            aria-hidden="true"
            style={{ '--series': cssVar(entry.identity) } as React.CSSProperties}
          />
        </li>
      ))}
    </ul>
  );
}
