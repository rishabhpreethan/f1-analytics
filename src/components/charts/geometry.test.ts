import { describe, expect, it } from 'vitest';
import {
  AXIS_GAP,
  CATEGORY_COUNT_LIMIT,
  clampTooltip,
  MARKER_RING,
  ISOLATION_THRESHOLD,
  nearestByOffset,
  shouldDrawMarkers,
  withEndpoints,
  computeMargin,
  mountKey,
  positionTicksWithin,
  tooltipHeight,
  TOOLTIP_OFFSET,
  DIRECT_LABEL_MIN_GAP,
  fmtCoord,
  labelStride,
  MARKER_SIZE,
  markerPath,
  measureTickCount,
  MONO_ADVANCE_EM,
  monoTextWidth,
  placeDirectLabels,
  plotArea,
  POSITION_TICKS,
  prefersHorizontalBars,
  TICK_LABEL_SIZE,
  timeTickCount,
} from './geometry';

/**
 * **This file is the only thing standing behind chart layout.** jsdom performs no layout and no
 * compositing, so a component test can render an axis into a document and learn nothing about
 * whether it is in the right place. Every assertion below is arithmetic that would otherwise only
 * be checked by looking at the running product.
 */

describe('§6.3 — tick density is a rule, not a judgement', () => {
  it('takes the measure axis from round(px / 56), floored at 3 and capped at 6', () => {
    expect(measureTickCount(56)).toBe(3); // 1 → floor
    expect(measureTickCount(200)).toBe(4);
    expect(measureTickCount(280)).toBe(5);
    expect(measureTickCount(336)).toBe(6);
    expect(measureTickCount(1200)).toBe(6); // cap: past 6 a value axis reads as a ruler
    expect(measureTickCount(0)).toBe(3);
  });

  it('takes the time axis from round(px / 72), floored at 2 and capped at 12', () => {
    expect(timeTickCount(0)).toBe(2);
    expect(timeTickCount(720)).toBe(10);
    expect(timeTickCount(5000)).toBe(12);
  });

  it('never returns a negative or fractional count for a collapsed container', () => {
    for (const px of [-100, 0, 1, 13]) {
      expect(Number.isInteger(measureTickCount(px))).toBe(true);
      expect(measureTickCount(px)).toBeGreaterThanOrEqual(3);
      expect(timeTickCount(px)).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('Chivo Mono is 0.6em per character — measured from the shipped font', () => {
  it('uses the figure read from the woff2 hmtx table, not a guessed monospace ratio', () => {
    expect(MONO_ADVANCE_EM).toBe(0.6);
    expect(monoTextWidth('1:23.456')).toBeCloseTo(8 * TICK_LABEL_SIZE * 0.6, 6);
  });

  it('is linear in length, which is the property the axis gutter depends on', () => {
    expect(monoTextWidth('88')).toBeCloseTo(monoTextWidth('8') * 2, 6);
  });
});

describe('§6.3 — drop labels, never ticks', () => {
  it('labels every tick when they fit', () => {
    const positions = [0, 100, 200, 300];
    expect(labelStride(positions, [20, 20, 20, 20])).toBe(1);
  });

  it('strides rather than hiding an arbitrary subset — an irregular gap reads as missing data', () => {
    const positions = [0, 20, 40, 60, 80, 100];
    // 24px labels 20px apart need 12 + 12 + 8 = 32px of pitch, so every other tick is labelled.
    expect(labelStride(positions, Array<number>(6).fill(24), 8)).toBe(2);
    // Wider still, and the stride goes to 3 rather than to an irregular subset.
    expect(labelStride(positions, Array<number>(6).fill(40), 8)).toBe(3);
  });

  it('measures from the label centres, so ONE wide label pushes the stride out on its own', () => {
    const positions = [0, 60, 120];
    expect(labelStride(positions, [10, 10, 10], 8)).toBe(1);
    expect(labelStride(positions, [10, 120, 10], 8)).toBe(2);
  });

  it('returns 1 for a single tick and for an empty axis', () => {
    expect(labelStride([], [])).toBe(1);
    expect(labelStride([50], [40])).toBe(1);
  });

  it('terminates rather than looping when nothing can ever fit', () => {
    // Four labels wider than the axis. There is no stride that clears; the answer is "one label".
    expect(labelStride([0, 1, 2, 3], [500, 500, 500, 500])).toBe(4);
  });
});

describe('§6.3 — a category axis that does not fit rotates the CHART', () => {
  it('goes horizontal past seven categories', () => {
    const seven = Array.from({ length: CATEGORY_COUNT_LIMIT }, (_, i) => `R${String(i)}`);
    expect(prefersHorizontalBars(seven)).toBe(false);
    expect(prefersHorizontalBars([...seven, 'R8'])).toBe(true);
  });

  it('goes horizontal on one long label, however few categories there are', () => {
    expect(prefersHorizontalBars(['Verstappen', 'Hamilton'])).toBe(false);
    expect(prefersHorizontalBars(['Verstappen', 'Antonelli-Kimi'])).toBe(true);
  });

  it('keeps the position axis ticks at 1, 5, 10, 15, 20', () => {
    // In F1 up means faster and 1 is the best value, so this axis is inverted with P1 at the top.
    expect([...POSITION_TICKS]).toEqual([1, 5, 10, 15, 20]);
  });
});

describe('the margin is computed from what the chart will draw, never fixed', () => {
  it('sizes the left gutter to the widest measure label plus the axis gap', () => {
    const margin = computeMargin({ measureLabels: ['0', '25', '50', '75', '100'] });
    expect(margin.left).toBe(Math.ceil(monoTextWidth('100')) + AXIS_GAP);
  });

  it('grows the gutter for a five-digit label rather than clipping it', () => {
    const narrow = computeMargin({ measureLabels: ['0', '9'] });
    const wide = computeMargin({ measureLabels: ['0', '717764'] });
    expect(wide.left).toBeGreaterThan(narrow.left);
  });

  it('reserves the right margin for a direct label, so it is never clipped by the SVG edge', () => {
    const plain = computeMargin({ measureLabels: ['0'] });
    const labelled = computeMargin({ measureLabels: ['0'], directLabelWidth: 64 });
    expect(plain.right).toBe(AXIS_GAP);
    expect(labelled.right).toBe(64 + AXIS_GAP);
  });

  it('adds a bottom gutter only when the category axis actually has labels', () => {
    expect(computeMargin({ measureLabels: ['0'] }).bottom).toBe(0);
    expect(computeMargin({ measureLabels: ['0'], hasCategoryLabels: true }).bottom).toBeGreaterThan(
      0,
    );
  });

  it('clamps the plot area at zero in a collapsed container', () => {
    /*
     * A negative `<rect width>` is an SVG error the browser reports and jsdom does not — a
     * container that has not been measured yet is width 0, and that happens on every first paint.
     */
    const area = plotArea(20, 10, computeMargin({ measureLabels: ['100000'] }));
    expect(area.innerWidth).toBe(0);
    expect(area.innerHeight).toBeGreaterThanOrEqual(0);
  });

  it('leaves inner dimensions that add back up to the box', () => {
    const margin = computeMargin({ measureLabels: ['0', '100'], hasCategoryLabels: true });
    const area = plotArea(640, 320, margin);
    expect(area.innerWidth + margin.left + margin.right).toBe(640);
    expect(area.innerHeight + margin.top + margin.bottom).toBe(320);
  });
});

describe('§6.5.2 — direct labels are pushed apart, and never off the chart', () => {
  const bounds = { top: 0, bottom: 200 };

  it('leaves labels alone when they already clear the minimum gap', () => {
    const placed = placeDirectLabels([10, 80, 150], bounds);
    expect(placed.map((p) => p.y)).toEqual([10, 80, 150]);
    expect(placed.every((p) => !p.leader)).toBe(true);
  });

  it('separates converging labels to exactly the minimum gap', () => {
    const placed = placeDirectLabels([100, 104, 108], bounds);
    const ys = placed.map((p) => p.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i += 1) {
      expect((ys[i] ?? 0) - (ys[i - 1] ?? 0)).toBeGreaterThanOrEqual(DIRECT_LABEL_MIN_GAP);
    }
  });

  it('pushes the run back up when the forward pass runs out of room at the bottom', () => {
    /*
     * The bug this test exists for: a single forward pass drops the last label off the bottom of
     * the chart, and lines converge exactly when the comparison is at its most interesting.
     */
    const placed = placeDirectLabels([190, 195, 198, 199], bounds);
    expect(Math.max(...placed.map((p) => p.y))).toBeLessThanOrEqual(bounds.bottom);
  });

  it('keeps the top edge when labels converge at the top', () => {
    const placed = placeDirectLabels([1, 2, 3], bounds);
    expect(Math.min(...placed.map((p) => p.y))).toBeGreaterThanOrEqual(bounds.top);
  });

  it('returns placements in the caller’s order, whatever order the anchors are in', () => {
    const placed = placeDirectLabels([150, 10, 80], bounds);
    expect(placed.map((p) => p.anchor)).toEqual([150, 10, 80]);
  });

  it('asks for a leader line only where the label moved more than 8px', () => {
    const placed = placeDirectLabels([100, 104], bounds);
    expect(placed[0]?.leader).toBe(false); // did not move
    expect(placed[1]?.leader).toBe(true); // moved 104 → 116
  });

  it('handles the degenerate cases without throwing', () => {
    expect(placeDirectLabels([], bounds)).toEqual([]);
    expect(placeDirectLabels([50], bounds).map((p) => p.y)).toEqual([50]);
  });
});

describe('§6.4 rung 2 — the four marker shapes are equal AREA, not equal width', () => {
  /** Shoelace over the polygon a path command list describes. Curves are handled separately. */
  const polygonArea = (d: string): number => {
    const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    const points: [number, number][] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) points.push([nums[i] ?? 0, nums[i + 1] ?? 0]);
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
      const [x1, y1] = points[i] ?? [0, 0];
      const [x2, y2] = points[(i + 1) % points.length] ?? [0, 0];
      sum += x1 * y2 - x2 * y1;
    }
    return Math.abs(sum) / 2;
  };

  it('encloses the same area for square, triangle and diamond as a circle of the same size', () => {
    /*
     * A square and a circle of the same *width* are not the same size to the eye — the square is
     * about 27% heavier. A marker set where one shape reads as "more" is encoding magnitude by
     * accident, on a channel that is supposed to carry identity only.
     */
    const target = Math.PI * (MARKER_SIZE / 2) ** 2;
    for (const shape of ['square', 'triangle', 'diamond'] as const) {
      // 1% tolerance: the path is emitted at two decimals, which is a real rounding of the shape.
      expect(polygonArea(markerPath(shape)), shape).toBeCloseTo(target, 0);
    }
  });

  it('draws a triangle centred on its centroid, not on its bounding box', () => {
    // Otherwise a triangle sits visibly low against a circle on the same baseline.
    const nums =
      markerPath('triangle')
        .match(/-?\d+(\.\d+)?/g)
        ?.map(Number) ?? [];
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeLessThan(0);
    expect(Math.max(...ys)).toBeGreaterThan(0);
    // The apex is twice as far from centre as the base, which is what "centroid" means here.
    expect(Math.abs(Math.min(...ys))).toBeCloseTo(2 * Math.max(...ys), 1);
  });

  it('never emits a path smaller than the §6.3 floor', () => {
    expect(MARKER_SIZE).toBeGreaterThanOrEqual(8);
  });

  it('rounds coordinates to two decimals rather than emitting 15 significant figures', () => {
    expect(fmtCoord(1 / 3)).toBe('0.33');
    expect(fmtCoord(-2.005)).toBe('-2');
  });
});

/**
 * §6.5.1's tooltip placement — **flipped AND clamped**, which is the arithmetic jsdom can decide
 * without layout: no rendering is needed to know whether a computed left edge is inside a known
 * rectangle. Rishabh's capture caught the tooltip rendering below the plot and clipped by the panel;
 * the origin was fixed in `charts.css`, and this is what keeps it inside once it is there.
 */
describe('clampTooltip', () => {
  const PLOT = { left: 48, top: 12, innerWidth: 800, innerHeight: 300 };
  const SIZE = { width: 200, height: 100 };

  it('offsets to the right of the crosshair in the left half', () => {
    expect(clampTooltip(100, PLOT, SIZE).x).toBe(48 + 100 + TOOLTIP_OFFSET);
  });

  it('flips to the left of the crosshair past the midpoint, so it never covers the mark', () => {
    expect(clampTooltip(600, PLOT, SIZE).x).toBe(48 + 600 - 200 - TOOLTIP_OFFSET);
  });

  it('never starts left of the plot area', () => {
    // At x = 0 in the left half the un-flipped box is already inside; the case that used to
    // overflow is a flip near the midpoint on a narrow plot.
    const narrow = { left: 48, top: 12, innerWidth: 210, innerHeight: 300 };
    expect(clampTooltip(110, narrow, SIZE).x).toBeGreaterThanOrEqual(narrow.left);
  });

  it('never ends right of the plot area', () => {
    const placed = clampTooltip(800, PLOT, SIZE);
    expect(placed.x + SIZE.width).toBeLessThanOrEqual(PLOT.left + PLOT.innerWidth);
  });

  it('sits inside the plot vertically, which is the axis the shipped bug got wrong', () => {
    const placed = clampTooltip(400, PLOT, SIZE);
    expect(placed.y).toBeGreaterThanOrEqual(PLOT.top);
    expect(placed.y + SIZE.height).toBeLessThanOrEqual(PLOT.top + PLOT.innerHeight);
  });

  it('degrades to the plot origin rather than a negative coordinate when the box cannot fit', () => {
    const tiny = { left: 48, top: 12, innerWidth: 80, innerHeight: 40 };
    const placed = clampTooltip(40, tiny, SIZE);
    expect(placed.x).toBe(tiny.left);
    expect(placed.y).toBe(tiny.top);
  });
});

describe('tooltipHeight', () => {
  it('grows with the series count, because every series is in the one tooltip', () => {
    expect(tooltipHeight(4)).toBeGreaterThan(tooltipHeight(1));
  });

  it('reserves generously — under-reserving is what lets the box hang out of the panel', () => {
    expect(tooltipHeight(4)).toBeGreaterThanOrEqual(4 * 20);
  });
});

/**
 * §6.3's position ticks. The `P0` this prevents was a real emitted tick: `scaleLinear().nice(4)` on
 * a `[1, 22]` domain widens outward to a round boundary and produces `0`.
 */
describe('positionTicksWithin', () => {
  it('never emits P0', () => {
    expect(positionTicksWithin(1, 22)).not.toContain(0);
  });

  it('always includes P1, the line the chart is read against', () => {
    expect(positionTicksWithin(1, 22)[0]).toBe(1);
    expect(positionTicksWithin(1, 5)).toContain(1);
  });

  it('drops ticks the field never reaches', () => {
    // A nine-car grid gets no gridline at P20.
    expect(positionTicksWithin(1, 9)).toEqual([1, 5]);
  });

  it("is §6.3's fixed editorial set, never a computed one", () => {
    expect(positionTicksWithin(1, 20)).toEqual([1, 5, 10, 15, 20]);
  });
});

describe('mountKey', () => {
  it('is stable by value where an array literal is not', () => {
    expect(mountKey(['a'], 10, 20)).toBe(mountKey(['a'], 10, 20));
  });
});

/**
 * §6.3's marker-density rule. The figures are the ones that forced it: a modern race is 58 laps, a
 * plot is ~800px, and an 8px marker with a 1.5px ring occupies 11px.
 */
describe('shouldDrawMarkers', () => {
  it('refuses at race density — 58 laps across 800px', () => {
    // 13.8px apart against a 22px floor (2x the 11px marker). This is the case it exists for.
    expect(shouldDrawMarkers(58, 800)).toBe(false);
  });

  it('draws at season density — 22 rounds across 800px', () => {
    // 38px apart. The season hub's progression chart must keep its markers.
    expect(shouldDrawMarkers(22, 800)).toBe(true);
  });

  it('requires TWICE the marker width, not once', () => {
    const full = MARKER_SIZE + 2 * MARKER_RING;
    // Exactly one marker width apart is refused; exactly two is accepted.
    expect(shouldDrawMarkers(2, full)).toBe(false);
    expect(shouldDrawMarkers(2, 2 * full)).toBe(true);
  });

  it('always draws a single point, which cannot collide with anything', () => {
    expect(shouldDrawMarkers(1, 0)).toBe(true);
  });

  it('DRAWS on an unmeasured plot — "not yet measured" is not "too dense"', () => {
    // `useChartSize` reports 0 until the ResizeObserver fires. Treating that as dense would drop
    // every marker on the first paint and pop them in, and would make the marker layer absent in
    // jsdom — where the "a null reading is a gap, not a zero" assertion depends on counting them.
    expect(shouldDrawMarkers(58, 0)).toBe(true);
  });
});

/**
 * §6.3's endpoint rule. The two cases are the real ones: `d3.ticks(11)` on a 22-round season yields
 * `[2, 4 … 22]` and on a 58-lap race yields `[5, 10 … 55]`, so round 1, lap 1 and lap 58 all go
 * unlabelled. The 22-round case was **already live in the season hub** and went unnoticed only
 * because 2026 has 10 completed rounds and `ticks` on `[1, 10]` happens to include 1.
 */
describe('withEndpoints', () => {
  it('adds round 1 to a season axis that d3 started at 2', () => {
    expect(withEndpoints([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22], 1, 22, 0)).toEqual([
      1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22,
    ]);
  });

  it('adds both the first and the last lap of a race', () => {
    const ticks = withEndpoints([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], 1, 58, 0);
    expect(ticks[0]).toBe(1);
    expect(ticks[ticks.length - 1]).toBe(58);
  });

  it('drops an interior tick that crowds an endpoint, never the endpoint itself', () => {
    // An interior tick is one of eleven equivalent references; an endpoint is the only one of its
    // kind, so the endpoint always wins. Here `2` crowds `1` and `20` crowds `22`, and both go.
    expect(withEndpoints([2, 10, 20], 1, 22, 3)).toEqual([1, 10, 22]);
  });

  it('keeps an interior tick that clears the gap at both ends', () => {
    expect(withEndpoints([5, 10, 18], 1, 22, 3)).toEqual([1, 5, 10, 18, 22]);
  });

  it('never duplicates an endpoint that d3 already produced', () => {
    expect(withEndpoints([1, 5, 10], 1, 10, 0)).toEqual([1, 5, 10]);
  });

  it('collapses a single-value domain rather than emitting a reversed pair', () => {
    expect(withEndpoints([], 7, 7, 0)).toEqual([7]);
  });

  it('guarantees ascending order rather than inheriting it from the caller', () => {
    // `d3.ticks` returns sorted values, so nothing depends on this today — but the axis renderer
    // assumes ordering, and a function should hold its own postcondition.
    expect(withEndpoints([30, 10, 20], 1, 58, 0)).toEqual([1, 10, 20, 30, 58]);
  });
});

/**
 * §6.5.4a's isolation, as arithmetic. This exists as a pure function because the component version
 * was untestable — `RankChart` derives each candidate's offset from a `d3` scale, and in jsdom every
 * scale collapses to 0, so twenty lines are exactly equidistant from any pointer.
 */
describe('nearestByOffset', () => {
  const FIELD = [
    { reference: 'a', offset: 0 },
    { reference: 'b', offset: 20 },
    { reference: 'c', offset: 40 },
  ];

  it('picks the nearest candidate', () => {
    expect(nearestByOffset(FIELD, 22, ISOLATION_THRESHOLD)).toBe('b');
  });

  it('returns null past the threshold — open space is hovering NOTHING', () => {
    // Snapping to the closest line regardless would make isolation fire constantly and mean nothing.
    expect(nearestByOffset([{ reference: 'a', offset: 0 }], 60, ISOLATION_THRESHOLD)).toBeNull();
  });

  it('accepts a candidate exactly at the threshold', () => {
    expect(nearestByOffset([{ reference: 'a', offset: 0 }], 14, ISOLATION_THRESHOLD)).toBe('a');
  });

  it('breaks a tie toward the earlier candidate, which is the stable entity order', () => {
    const tied = [
      { reference: 'first', offset: 10 },
      { reference: 'second', offset: 10 },
    ];
    expect(nearestByOffset(tied, 10, ISOLATION_THRESHOLD)).toBe('first');
  });

  it('returns null for an empty field rather than throwing', () => {
    expect(nearestByOffset([], 0, ISOLATION_THRESHOLD)).toBeNull();
  });

  it('has a threshold forgiving enough for a 1px line', () => {
    // Half a row at 20 cars in a 360px plot is 9px; 14 clears it without reaching the next line.
    expect(ISOLATION_THRESHOLD).toBeGreaterThan(9);
    expect(ISOLATION_THRESHOLD).toBeLessThan(18);
  });
});
