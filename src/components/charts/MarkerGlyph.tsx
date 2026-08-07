import { cssVar } from '@/lib/entityColor';
import { fmtCoord, markerPath, MARKER_SIZE } from './geometry';
import { DASH_ARRAY, type DashPattern, type MarkerShape } from './ladder';

/**
 * **Rung 2 made visible** (`DESIGN_SYSTEM.md` §6.4): circle → square → triangle → diamond, in that
 * fixed order, ≥ 8px across, with a 1.5px `--surface-sunken` ring so two marks that overlap stay
 * two marks.
 *
 * The four shapes are sized to **equal visual area**, not to an equal bounding box. A square and a
 * circle of the same width are not the same size to the eye — the square is about 27% heavier — and
 * a marker set where one shape reads as "more" is encoding magnitude by accident, on a channel that
 * is supposed to carry identity only. The circle is the reference; every other radius is derived
 * from it so that all four enclose πr².
 */

export interface MarkerGlyphProps {
  shape: MarkerShape;
  /** The entity token name — never a colour. Written as `--series` for the stylesheet to read. */
  token: string;
  x: number;
  y: number;
  size?: number;
  className?: string;
}

export function MarkerGlyph({
  shape,
  token,
  x,
  y,
  size = MARKER_SIZE,
  className = 'chart-marker',
}: MarkerGlyphProps) {
  return (
    <path
      className={className}
      d={markerPath(shape, size)}
      transform={`translate(${fmtCoord(x)} ${fmtCoord(y)})`}
      style={{ '--series': cssVar(token) } as React.CSSProperties}
    />
  );
}

/**
 * The legend's key: a 34×14 sample carrying **all three channels at once** — the entity colour, the
 * dash pattern and the marker shape — because §6.5.2 makes the legend the only place the dash and
 * marker rungs are *stated*. A legend that showed colour alone would leave the reader to infer what
 * a dashed line meant, which is the same as not encoding it.
 */
export function LegendKey({
  shape,
  dash,
  token,
}: {
  shape: MarkerShape;
  dash: DashPattern;
  token: string;
}) {
  return (
    <svg
      className="chart-legend-key"
      viewBox="0 0 34 14"
      aria-hidden="true"
      focusable="false"
      style={{ '--series': cssVar(token) } as React.CSSProperties}
    >
      <line
        className="chart-line"
        x1={0}
        y1={7}
        x2={34}
        y2={7}
        strokeDasharray={DASH_ARRAY[dash]}
      />
      <MarkerGlyph shape={shape} token={token} x={17} y={7} />
    </svg>
  );
}

/**
 * Rung 4 — the 45° hatch (§6.4, §6.5.6). One `<pattern>` per series, because a pattern's fill has
 * to be the series' own colour; the id is namespaced by the chart instance so two charts on one
 * page cannot capture each other's fills, which is a real and silent SVG failure mode.
 */
export function HatchPattern({ id, token }: { id: string; token: string }) {
  return (
    <pattern
      id={id}
      width={6}
      height={6}
      patternTransform="rotate(45)"
      patternUnits="userSpaceOnUse"
      style={{ '--series': cssVar(token) } as React.CSSProperties}
    >
      <rect width={6} height={6} fill={cssVar(token)} />
      <line className="chart-hatch-line" x1={0} y1={0} x2={0} y2={6} />
      <line className="chart-hatch-line" x1={3} y1={0} x2={3} y2={6} />
    </pattern>
  );
}
