// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (media: string) => ({
      matches: media.includes('reduce'),
      media,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

import { RankChart, type RankSeries } from './RankChart';
import { labelCapacity } from './geometry';

/**
 * **§6.5.4a's rank chart — the exemption's five conditions, asserted where they are decidable.**
 *
 * jsdom gives no layout, so nothing here checks that 22 lines look legible, that the labels avoid
 * each other on screen, or that the reveal plays. What *is* decidable is the structure the legibility
 * depends on: that the field is drawn recessive **at rest** rather than only on hover, that markers
 * never reach the field, that the tooltip does not grow to 22 rows, and which series get labels when
 * the axis cannot hold them all.
 *
 * **The fixture is a 20-car field over `LAPS` laps, and `LAPS` is 8 rather than a race's 58.**
 * Twenty series is load-bearing — it is what makes this a *many*-series chart and what
 * `labelCapacity` is measured against — but the lap count is not: every assertion here is structural,
 * and jsdom reports width 0 so the density rules take §1.0's permissive branch regardless of it.
 *
 * It was 58, which built 20 paths over 1,160 points on each of 24 tests. Measured: this file runs
 * ~1.6 s alone, ~4.4 s under suite parallelism, and was observed at **10.6 s under contention** — an
 * 8× spread, and the failures were **timeouts rather than assertions**. So the cost is contention for
 * the worker pool, not weight, and the fix is a cheaper tree rather than a longer timeout: a raised
 * timeout hides it, and CI is real and slower than this machine.
 */

const LAPS = 8;

const FIELD: RankSeries[] = Array.from({ length: 20 }, (_, i) => ({
  reference: `driver-${String(i + 1)}`,
  teamReference: `team-${String(Math.floor(i / 2) + 1)}`,
  label: `Driver ${String(i + 1)}`,
  shortLabel: `D${String(i + 1).padStart(2, '0')}`,
  points: Array.from({ length: LAPS }, (_, lap) => ({ x: lap + 1, y: i + 1 })),
}));

function renderRank(over: Partial<Parameters<typeof RankChart>[0]> = {}) {
  return render(
    <RankChart
      series={FIELD}
      selected={['driver-1', 'driver-2']}
      fieldSize={20}
      title="Position by lap"
      ariaLabel="Championship position after each lap"
      xTitle="Lap"
      {...over}
    />,
  );
}

afterEach(cleanup);

describe('condition 5 — the resting state separates analysis from context', () => {
  it('draws every series in the field, not just the selection', () => {
    const { container } = renderRank();
    expect(container.querySelectorAll('.chart-rank-line')).toHaveLength(20);
  });

  it('marks the selection as selected AT REST, with no hover involved', () => {
    /*
     * The constraint that matters most: a chart legible only on hover has failed for a screenshot, a
     * printout and a keyboard. So the foreground/background split is a resting attribute, not an
     * interaction state.
     */
    const { container } = renderRank();
    expect(container.querySelectorAll('.chart-rank-line[data-selected="true"]')).toHaveLength(2);
    expect(container.querySelector('.chart-rank')?.getAttribute('data-isolated')).toBe('false');
  });

  it('caps the emphasised set at four however many are passed', () => {
    const { container } = renderRank({
      selected: FIELD.slice(0, 8).map((s) => s.reference),
    });
    expect(container.querySelectorAll('.chart-rank-line[data-selected="true"]')).toHaveLength(4);
  });

  it('is a legible chart with no selection at all — the field alone still renders', () => {
    const { container } = renderRank({ selected: [] });
    expect(container.querySelectorAll('.chart-rank-line')).toHaveLength(20);
    expect(container.querySelectorAll('.chart-rank-line[data-selected="true"]')).toHaveLength(0);
  });
});

describe('condition 2 — markers never reach the field', () => {
  it('draws none at all when nothing is selected', () => {
    // 20 × 58 would be 1,160 marks. The field is context and carries no markers under any condition.
    const { container } = renderRank({ selected: [] });
    expect(container.querySelectorAll('.chart-marker')).toHaveLength(0);
  });

  it('draws them only for the selection, never for the other eighteen', () => {
    /*
     * jsdom reports width 0, so `shouldDrawMarkers` takes §1.0's permissive branch and markers *are*
     * emitted here — which is correct, and means the density refusal itself is untestable in this
     * environment. It is asserted directly in `geometry.test.ts` instead. What is decidable here is
     * the structural half: the count can only ever come from the selection.
     */
    const { container } = renderRank({ selected: ['driver-1', 'driver-2'] });
    expect(container.querySelectorAll('.chart-marker')).toHaveLength(2 * LAPS);
  });
});

describe('isolation is an aid, and opacity-only', () => {
  /*
   * **Driven from the hit target, not from the line** — and that is the fix for a real defect rather
   * than a test detail. The first version put `onPointerEnter` on each `<path>`; it passed here,
   * because a test dispatches straight at the element, and **could never have fired in a browser**:
   * the hit rect covers the plot and paints after the lines, so it swallows every pointer event first.
   * Hover-isolation would have shipped dead with a green test behind it.
   */
  it('flags the hovered line and the group, so CSS can raise one and drop the rest', async () => {
    const user = userEvent.setup();
    const { container } = renderRank();
    await user.pointer({
      target: container.querySelector('.chart-hit') as Element,
      coords: { x: 10, y: 0 },
    });
    expect(container.querySelector('.chart-rank')?.getAttribute('data-isolated')).toBe('true');
    expect(container.querySelectorAll('.chart-rank-line[data-hovered="true"]')).toHaveLength(1);
  });

  it('clears isolation when the pointer leaves the plot', async () => {
    const user = userEvent.setup();
    const { container } = renderRank();
    const hit = container.querySelector('.chart-hit') as Element;
    await user.pointer({ target: hit, coords: { x: 10, y: 0 } });
    await user.pointer({ target: container.querySelector('.chart-svg') as Element });
    expect(container.querySelector('.chart-rank')?.getAttribute('data-isolated')).toBe('false');
  });

  it('changes no series colour when isolating — the swatch must keep its promise', async () => {
    const user = userEvent.setup();
    const { container } = renderRank();
    const before = [...container.querySelectorAll('.chart-rank-line')].map(
      (l) => l.getAttribute('style') ?? '',
    );
    await user.pointer({
      target: container.querySelector('.chart-hit') as Element,
      coords: { x: 10, y: 0 },
    });
    const after = [...container.querySelectorAll('.chart-rank-line')].map(
      (l) => l.getAttribute('style') ?? '',
    );
    expect(after).toEqual(before);
  });
});

describe('condition 3 — both-end labels, capacity-checked rather than assumed', () => {
  it('knows a 360px plot holds 23 labels and a 288px one holds 19', () => {
    // The arithmetic behind labelling the full field at desktop and not below it.
    expect(labelCapacity(360)).toBe(23);
    expect(labelCapacity(288)).toBe(19);
    expect(labelCapacity(240)).toBe(16);
  });

  it('reports full capacity for an unmeasured axis — §1.0, not zero', () => {
    // "Not yet measured" must not read as "no room", or the first paint drops every label.
    expect(labelCapacity(0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('labels both ends, so a label appears twice per series', () => {
    renderRank();
    // jsdom reports width 0, so capacity is infinite and the whole field is labelled — which is the
    // desktop case. Each labelled series gets a left and a right label.
    expect(screen.getAllByText('D01')).toHaveLength(2);
  });

  it('uses the short code where one exists, not the full name', () => {
    // `VER` rather than `Verstappen`: the sport's own timing convention, and a third the width.
    const { container } = renderRank();
    const plotLabels = [...container.querySelectorAll('.chart-rank-label')].map(
      (n) => n.textContent,
    );
    expect(plotLabels).toContain('D20');
    // Scoped to the plot: the *table* carries full names on purpose, and an unscoped query found
    // them and failed. The table is where an unlabelled series is identified.
    expect(plotLabels).not.toContain('Driver 20');
  });

  it('falls back to the full label before the code era', () => {
    // `abbreviation` covers 107 of 881 drivers, so a 1996 race cannot assume one.
    const noCodes = FIELD.slice(0, 2).map((s) => ({ ...s, shortLabel: null }));
    renderRank({ series: noCodes, selected: [] });
    expect(screen.getAllByText('Driver 1').length).toBeGreaterThan(0);
  });

  it('marks the selection’s labels so they are findable in a column of twenty', () => {
    const { container } = renderRank();
    // Two selected × two ends.
    expect(container.querySelectorAll('.chart-rank-label[data-selected="true"]')).toHaveLength(4);
  });
});

describe('refinement 3 — the tooltip carries the analysis set, not all twenty', () => {
  it('shows the selection rather than every series at that lap', async () => {
    const user = userEvent.setup();
    const { container } = renderRank();
    await user.pointer({
      target: container.querySelector('.chart-hit') as Element,
      coords: { x: 10, y: 10 },
    });
    /*
     * §6.5.1 asks for one tooltip rather than per-series tooltips, and that purpose is served. Twenty
     * rows would be a tooltip taller than the plot it covers; the full field at that lap is in the
     * table view.
     */
    const rows = container.querySelectorAll('.chart-tooltip .chart-tooltip-row');
    expect(rows).toHaveLength(2);
  });

  /*
   * **"The hovered series joins the tooltip" is not decidable here**, and saying so is more useful
   * than a test that pretends otherwise: which series is nearest depends on `yScale`, and in jsdom
   * every scale collapses to 0, so all twenty lines are exactly equidistant from any pointer. The
   * *choice* is tested as `nearestByOffset` in `geometry.test.ts`, where offsets are given rather
   * than measured. Named in the hand-off as unverified in composition.
   */

  it('sorts ascending, because on a rank axis a lower number is better', async () => {
    const user = userEvent.setup();
    const { container } = renderRank({ selected: ['driver-5', 'driver-1'] });
    await user.pointer({
      target: container.querySelector('.chart-hit') as Element,
      coords: { x: 10, y: 10 },
    });
    const values = [...container.querySelectorAll('.chart-tooltip-value')].map(
      (n) => n.textContent,
    );
    expect(values).toEqual(['P1', 'P5']);
  });
});

describe('the axis', () => {
  it('is the size of the field, not the deepest rank anybody reached', () => {
    /*
     * A race where nobody ran below 12th still had 20 cars, and the axis should say so. Asserted on
     * the **gridlines**, because the tick text is deliberately absent — `positionTicksWithin(1, 20)`
     * is `[1, 5, 10, 15, 20]`, five gridlines, where a field of three would give one.
     */
    const { container } = renderRank({ series: FIELD.slice(0, 3), fieldSize: 20, selected: [] });
    expect(container.querySelectorAll('.chart-grid-line')).toHaveLength(5);
  });

  it('draws fewer gridlines for a smaller field', () => {
    const { container } = renderRank({ series: FIELD.slice(0, 3), fieldSize: 3, selected: [] });
    expect(container.querySelectorAll('.chart-grid-line')).toHaveLength(1);
  });

  /**
   * **The fix for the one real defect the capture found.** Five of sixty text nodes overlapped on
   * 2026 R1 — `P1`×`LEC`, `P5`×`LIN`, `P10`×`ALO`, `P15`×`BOT`, `P20`×`STR` — and **zero were driver
   * against driver**, so `placeDirectLabels` was right at 22 anchors and the collision *set* was
   * incomplete: the y-axis tick labels share the same gutter.
   *
   * The overlap itself is a bounding-box fact and undecidable here. What is decidable is the fix:
   * the gutter now holds one kind of label, because the ticks no longer render text.
   */
  it('renders no POSITION tick text — the label columns enumerate the scale', () => {
    const { container } = renderRank();
    const ticks = [...container.querySelectorAll('.chart-tick')].map((n) => n.textContent ?? '');
    // Scoped to the measure axis: the **lap** axis keeps its labels, and an unscoped assertion
    // caught them and failed. It is the left gutter that had two occupants, not every axis.
    expect(ticks.filter((text) => /^P\d/.test(text))).toEqual([]);
    expect(container.querySelectorAll('.chart-rank-label').length).toBeGreaterThan(0);
  });

  it('keeps the gridlines, which are the only mid-plot reference to P5 / P10 / P15', () => {
    const { container } = renderRank();
    expect(container.querySelectorAll('.chart-grid-line').length).toBeGreaterThan(1);
  });

  it('titles the axis for a race, not for a championship', () => {
    // "Championship position" was the season chart's label carried over onto a race page.
    renderRank();
    expect(screen.getByText('Race position')).toBeTruthy();
    expect(screen.queryByText('Championship position')).toBeNull();
  });

  it('labels the first and last lap, which d3 omits on a 1-based domain', () => {
    renderRank();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getAllByText(String(LAPS)).length).toBeGreaterThan(0);
  });
});

describe('§6.5.5 — the table view holds the whole field', () => {
  it('carries every series, including the ones the plot leaves unlabelled', () => {
    renderRank();
    // The table is where an unlabelled series is identified, so it must never be filtered.
    expect(screen.getAllByText('Driver 20').length).toBeGreaterThan(0);
  });
});
