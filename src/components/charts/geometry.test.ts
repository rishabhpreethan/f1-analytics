import { describe, expect, it } from 'vitest';
import {
  AXIS_GAP,
  CATEGORY_COUNT_LIMIT,
  computeMargin,
  DIRECT_LABEL_MIN_GAP,
  labelStride,
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
