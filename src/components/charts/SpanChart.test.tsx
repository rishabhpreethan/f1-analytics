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

import SPAN_CHART_SRC from './SpanChart.tsx?raw';
import { SpanChart } from './SpanChart';
import { spanPath } from './geometry';
import type { SpanRow } from './SpanChart';

/**
 * **The span chart, and what jsdom can decide about it.**
 *
 * Not: the band layout, the 2px gaps, the label fitting, the reveal, or any position — width is 0
 * here and every mark collapses to the origin. Those are named as unverified in the hand-off.
 *
 * Yes: that a span's *path* rounds the row's outer ends and squares its interior boundaries, that the
 * table derives inclusive lengths, that a pinned domain survives, and that a row with one stint is
 * not treated as a row with none. The fixtures are a real 2026 R1 strategy — a two-stopper and a
 * one-stopper over 58 laps.
 */

const ROWS: SpanRow[] = [
  {
    reference: 'antonelli',
    teamReference: 'mercedes',
    label: 'Antonelli',
    spans: [
      { key: 'ant-1', start: 1, end: 18, label: '18' },
      { key: 'ant-2', start: 19, end: 40, label: '22' },
      { key: 'ant-3', start: 41, end: 58, label: '18' },
    ],
  },
  {
    reference: 'hamilton',
    teamReference: 'ferrari',
    label: 'Hamilton',
    spans: [
      { key: 'ham-1', start: 1, end: 30, label: '30' },
      { key: 'ham-2', start: 31, end: 58, label: '28' },
    ],
  },
];

function renderSpans(over: Partial<Parameters<typeof SpanChart>[0]> = {}) {
  return render(
    <SpanChart
      rows={ROWS}
      title="Stints"
      ariaLabel="Stint length by driver"
      measureTitle="Lap"
      domain={[1, 58]}
      {...over}
    />,
  );
}

afterEach(cleanup);

describe('spanPath — the radius is on the row’s outer ends only', () => {
  it('rounds a leading edge and squares the trailing one', () => {
    const path = spanPath(0, 0, 100, 20, 4, { leading: true, trailing: false });
    // One arc pair for the leading end, none for the trailing.
    expect(path.match(/A /g)).toHaveLength(2);
  });

  it('rounds both ends on a single-span row', () => {
    const path = spanPath(0, 0, 100, 20, 4, { leading: true, trailing: true });
    expect(path.match(/A /g)).toHaveLength(4);
  });

  it('squares an interior span entirely', () => {
    // A rounded interior edge would imply a gap in the sequence that is not there.
    const path = spanPath(0, 0, 100, 20, 4, { leading: false, trailing: false });
    expect(path.match(/A /g)).toBeNull();
  });

  it('clamps the radius so a narrow span cannot invert its own curves', () => {
    const path = spanPath(0, 0, 3, 20, 4, { leading: true, trailing: true });
    // Radius clamps to width/2 = 1.5, so the arcs still resolve rather than crossing over.
    expect(path).toContain('A 1.5 1.5');
  });

  it('closes the path, so the fill is a region and not a stroke', () => {
    expect(spanPath(0, 0, 10, 10, 2, { leading: true, trailing: true })).toMatch(/Z$/);
  });

  it('emits no radius at all when asked for zero', () => {
    expect(spanPath(0, 0, 10, 10, 0, { leading: true, trailing: true })).not.toContain('A ');
  });
});

describe('structure', () => {
  it('draws one mark per span, across every row', () => {
    const { container } = renderSpans();
    expect(container.querySelectorAll('.chart-span')).toHaveLength(5);
  });

  it('labels every row in the gutter, so identity never depends on colour', () => {
    renderSpans();
    // Once in the plot gutter and once in the print copy of the table.
    expect(screen.getAllByText('Antonelli').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hamilton').length).toBeGreaterThan(0);
  });

  it('is not a stacked bar — `stack` is never imported', () => {
    /*
     * §6.6's table said this chart would use `d3-shape.stack`; it does not, and the reason is a
     * design decision worth guarding: a stint's boundaries are already known (`DATABASE.md` §6.7),
     * so stacking would round-trip spans through lengths and cumulative sums back to positions, and
     * the only thing a round trip can contribute is error.
     *
     * Asserted on the source, because the alternative — comparing rendered path widths — is exactly
     * the width-dependent assertion jsdom cannot make, and it passed vacuously when tried.
     *
     * Comments are stripped first, and that is not incidental: the first version of this assertion
     * matched the module's own doc comment explaining why `stack` is *not* used. A guard that fires
     * on its own documentation is the second one this session — see the `--identity` lookbehind in
     * `styles.invariants.test.ts`.
     */
    const code = SPAN_CHART_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    expect(code).not.toMatch(/from 'd3-shape'/);
    expect(code).not.toMatch(/\bstack\b/);
  });
});

describe('§6.5.5 — the table view carries what the plot expresses as extent', () => {
  it('derives an inclusive length, so lap 1 to lap 18 is 18 laps', () => {
    const { container } = renderSpans();
    const cells = [...(container.querySelectorAll('.chart-table tbody tr')[0]?.children ?? [])];
    // driver · phase · from · to · length
    expect(cells.map((c) => c.textContent)).toEqual(['Antonelli', '18', '1', '18', '18']);
  });

  it('gives every phase a row, not just every driver', () => {
    const { container } = renderSpans();
    /*
     * Five spans, five rows — and **five and not ten**, because in the chart view `ChartFrame`
     * renders only the print copy of the table (§6.5.6: in print the table follows the chart rather
     * than replacing it). The on-screen table exists only in the table view.
     */
    expect(container.querySelectorAll('.chart-table tbody tr')).toHaveLength(5);
  });

  it('names the measure in the column headers rather than assuming "lap"', () => {
    renderSpans({ measureTitle: 'Round' });
    expect(screen.getAllByText('From round').length).toBeGreaterThan(0);
  });
});

describe('interaction', () => {
  it('dims siblings on hover — opacity only, never a colour change', async () => {
    const user = userEvent.setup();
    const { container } = renderSpans();
    const hit = container.querySelector('.chart-hit');
    await user.pointer({ target: hit as Element, coords: { x: 1, y: 1 } });
    expect(container.querySelector('.chart-marks')?.getAttribute('data-dimmed')).toBe('true');
  });

  it('names the hovered span’s row and its extent in the tooltip', async () => {
    const user = userEvent.setup();
    const { container } = renderSpans();
    await user.pointer({
      target: container.querySelector('.chart-hit') as Element,
      coords: { x: 1, y: 1 },
    });
    expect(screen.getByText('1–18')).toBeTruthy();
  });
});

describe('the pinned domain', () => {
  it('keeps the axis at the full race distance even if every span ends earlier', () => {
    // Derived from the spans alone, a field that all retired by lap 40 would produce a 40-lap axis
    // and the reader would not see that the race ran to 58.
    const short: SpanRow[] = [
      { ...ROWS[0], spans: [{ key: 'a', start: 1, end: 40, label: '40' }] } as SpanRow,
    ];
    renderSpans({ rows: short, domain: [1, 58] });
    // The axis endpoint is forced in by `withEndpoints`, so 58 is labelled even with no span there.
    expect(screen.getAllByText('58').length).toBeGreaterThan(0);
  });
});
