// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
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

import { BarChart } from './BarChart';
import { LineChart } from './LineChart';
import type { BarDatum, SeriesInput } from './types';

/**
 * **What this file can prove, and what it cannot.**
 *
 * jsdom performs no layout: every element measures 0×0, there is no `ResizeObserver`, and
 * `SVGElement.getBBox` does not exist. So **nothing here asserts a position, a size or a visual
 * relationship** — a chart rendered in this environment is 0px wide and every mark is at the
 * origin. Those properties are untested by construction and are named as such in the hand-off.
 *
 * What is decidable, and is asserted below, is **structure and contract**: that every series gets
 * its own path, that a `null` reading becomes a gap rather than a zero, that the table view exists
 * and holds the same values, that the toggles work, and that the five states render what §6.5.3
 * says they render. Those are the failures that would ship silently; a mark 3px out of place would
 * be visible to Rishabh on the first look.
 *
 * `matchMedia` answers `true` to `reduce` here on purpose, so no tween is ever created and the DOM
 * under test is the **resting** state — which MR-2 requires to be the final, readable one.
 */

const SEASON: SeriesInput[] = [
  {
    reference: 'verstappen',
    teamReference: 'red_bull',
    label: 'Verstappen',
    points: [
      { x: 1, y: 25 },
      { x: 2, y: 43 },
      { x: 3, y: 61 },
    ],
  },
  {
    reference: 'norris',
    teamReference: 'mclaren',
    label: 'Norris',
    points: [
      { x: 1, y: 18 },
      /* Round 2: did not start. **A gap, never a zero** — a line that dips to the axis says he
       * scored nothing, which is a different claim from having no entry. */
      { x: 2, y: null },
      { x: 3, y: 33 },
    ],
  },
];

const RECORDS: BarDatum[] = [
  { key: 'hamilton', label: 'Hamilton', value: 105, teamReference: 'mercedes' },
  { key: 'schumacher', label: 'Schumacher', value: 91, teamReference: 'ferrari' },
  { key: 'verstappen', label: 'Verstappen', value: 68, teamReference: 'red_bull' },
];

afterEach(cleanup);

describe('§6.5.5 — the table view, on every chart, in the same place', () => {
  it('offers a Chart / Table toggle in the header', () => {
    render(<LineChart series={SEASON} title="Points" ariaLabel="Points by round" />);
    expect(screen.getByRole('button', { name: 'Chart' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Table' })).toBeTruthy();
  });

  it('replaces the plot IN PLACE, keeping the header and the caption', async () => {
    render(
      <LineChart
        series={SEASON}
        title="Points"
        ariaLabel="Points by round"
        caption="Cumulative points."
        xTitle="Round"
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Table' }));

    expect(screen.queryByRole('img', { name: 'Points by round' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Points' })).toBeTruthy();
    expect(screen.getAllByText('Cumulative points.').length).toBeGreaterThan(0);
  });

  it('holds every series as a column and every x as a row, including the missing reading', () => {
    render(<LineChart series={SEASON} title="Points" ariaLabel="Points by round" xTitle="Round" />);
    /* The print copy of the table is always in the DOM (§6.5.6), which is what makes this
     * readable without toggling — and is itself the assertion that print gets both. */
    const tables = screen.getAllByRole('table');
    const table = tables[0];
    expect(table).toBeTruthy();
    if (table === undefined) return;
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Round', 'Verstappen', 'Norris']);
    // Round 2 for Norris prints an em dash. Never `0`, and never an empty cell.
    expect(
      within(table)
        .getAllByRole('cell')
        .map((td) => td.textContent),
    ).toContain('—');
  });
});

describe('§6 — a `null` reading is a gap in the line, never a zero', () => {
  it('breaks the path rather than routing it through the axis', () => {
    const { container } = render(
      <LineChart series={SEASON} title="Points" ariaLabel="Points by round" />,
    );
    const paths = [...container.querySelectorAll('path.chart-line')];
    expect(paths).toHaveLength(2);
    const norris = paths[1]?.getAttribute('d') ?? '';
    /* d3-shape's `defined` emits a second `M` where the series resumes. One `M` would mean the
     * gap was drawn through, which is the defect. */
    expect((norris.match(/M/g) ?? []).length).toBe(2);
  });

  it('draws a marker only where there is a reading', () => {
    const { container } = render(
      <LineChart series={SEASON} title="Points" ariaLabel="Points by round" />,
    );
    // 3 for Verstappen + 2 for Norris. A marker at the missing round would be a mark for no datum.
    // Scoped to the mark layer: the legend key draws the same glyph, and counting both would make
    // this test pass for the wrong reason the day the legend changed.
    expect(container.querySelectorAll('.chart-marks path.chart-marker')).toHaveLength(5);
  });
});

describe('§6.5.2 — legend at ≥2 series, direct labels at ≤4', () => {
  it('renders a legend item per series, with a name in ink', () => {
    render(<LineChart series={SEASON} title="Points" ariaLabel="Points by round" />);
    const legend = screen.getAllByRole('list')[0];
    expect(legend).toBeTruthy();
    if (legend === undefined) return;
    expect(within(legend).getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders a direct label per series at the end of its line', () => {
    const { container } = render(
      <LineChart series={SEASON} title="Points" ariaLabel="Points by round" />,
    );
    const labels = [...container.querySelectorAll('text.chart-direct-label')].map(
      (node) => node.textContent,
    );
    expect(labels).toEqual(['Verstappen', 'Norris']);
  });

  it('strikes a series through in the legend when it has no data in the window', () => {
    /*
     * §6.5.3's partial state. The series stays in the legend rather than disappearing: a missing
     * row is a question the reader has to answer, a struck row is an answer.
     */
    const partial: SeriesInput[] = [
      SEASON[0] as SeriesInput,
      {
        reference: 'senna',
        teamReference: 'mclaren',
        label: 'Senna',
        points: [
          { x: 1, y: null },
          { x: 2, y: null },
        ],
      },
    ];
    render(<LineChart series={partial} title="Points" ariaLabel="Points by round" />);
    const struck = screen.getAllByRole('listitem').find((li) => li.textContent === 'Senna');
    expect(struck?.getAttribute('data-empty')).toBe('true');
  });
});

describe('§6.5.1 — the reading is announced, not only drawn', () => {
  it('gives the plot one tab stop and a live region', () => {
    const { container } = render(
      <LineChart series={SEASON} title="Points" ariaLabel="Points by round" />,
    );
    expect(container.querySelector('rect.chart-hit')?.getAttribute('tabindex')).toBe('0');
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy();
  });

  it('steps the crosshair with the arrow keys and announces the values', async () => {
    render(
      <LineChart
        series={SEASON}
        title="Points"
        ariaLabel="Points by round"
        formatX={(x) => `Round ${String(x)}`}
      />,
    );
    const hit = screen.getByRole('application');
    hit.focus();
    await userEvent.keyboard('{ArrowRight}');
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toContain('Round');
    // Sorted by value descending, so the leader is read first (§6.5.1).
    expect(live?.textContent).toMatch(/Verstappen .*Norris/);
  });

  it('reads "no data" rather than a number where a series has none', async () => {
    render(<LineChart series={SEASON} title="Points" ariaLabel="Points by round" />);
    const hit = screen.getByRole('application');
    hit.focus();
    await userEvent.keyboard('{End}');
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain('no data');
  });
});

describe('§6.5.3 — the five states, and only one of them is a fault', () => {
  it('paints no-coverage NEUTRAL, never a status colour', () => {
    /*
     * Absent lap data before 1996 is a property of the sport's history, not a fault of the product
     * or of the reader. A red panel says the opposite.
     */
    const { container } = render(
      <LineChart
        series={[]}
        title="Lap times"
        ariaLabel="Lap times by lap"
        state="no-coverage"
        stateCopy={{
          body: 'Lap times begin in 1996. This race is from 1988, so there are no lap times to chart. Results, grid positions and championship standings are available for it.',
        }}
      />,
    );
    expect(container.querySelector('.chart-state')?.getAttribute('data-tone')).toBe('neutral');
    expect(screen.getByText(/Lap times begin in 1996/)).toBeTruthy();
    // The copy says all three things: where the boundary is, which side this falls on, and what
    // IS available instead — the third is the one that gets dropped and the only one that helps.
    expect(screen.getByText(/Results, grid positions and championship standings/)).toBeTruthy();
  });

  it('removes the axes under an error, because axes imply the data is merely late', () => {
    const { container } = render(
      <LineChart
        series={SEASON}
        title="Points"
        ariaLabel="Points by round"
        state="error"
        stateCopy={{ body: 'This chart could not load.' }}
      />,
    );
    expect(container.querySelector('svg.chart-svg')).toBeNull();
    expect(screen.getByText('This chart could not load.')).toBeTruthy();
  });

  it('keeps the axes under no-coverage, so the reader can still see the scale', () => {
    const { container } = render(
      <LineChart
        series={SEASON}
        title="Points"
        ariaLabel="Points by round"
        state="no-coverage"
        stateCopy={{ body: 'Lap times begin in 1996.' }}
      />,
    );
    expect(container.querySelector('svg.chart-svg')).not.toBeNull();
  });
});

describe('§6.3 — the bar chart decides its own orientation', () => {
  it('rotates on a label over twelve characters rather than rotating the label', () => {
    const { container } = render(
      <BarChart
        data={[
          { key: 'a', label: 'Schumacher M.', value: 91 },
          { key: 'b', label: 'Senna', value: 41 },
        ]}
        title="Wins"
        ariaLabel="Most wins"
        valueTitle="Wins"
      />,
    );
    // The rotated chart's category labels are end-anchored down the left gutter.
    const ticks = [...container.querySelectorAll('text.chart-tick')];
    expect(ticks.some((t) => t.getAttribute('text-anchor') === 'end')).toBe(true);
  });

  it('stays upright for a handful of short labels', () => {
    const { container } = render(
      <BarChart
        data={[
          { key: 'a', label: 'HAM', value: 105 },
          { key: 'b', label: 'MSC', value: 91 },
        ]}
        title="Wins"
        ariaLabel="Most wins"
        valueTitle="Wins"
        categoryTitle="Driver"
      />,
    );
    const ticks = [...container.querySelectorAll('text.chart-tick')];
    expect(ticks.some((t) => t.getAttribute('text-anchor') === 'middle')).toBe(true);
  });

  it('never rotates a tick label, in either orientation', () => {
    // Angled tick labels are ~20% slower to read; §6.3 rotates the chart instead, always.
    const { container } = render(
      <BarChart data={RECORDS} title="Wins" ariaLabel="Most wins" valueTitle="Wins" />,
    );
    for (const tick of container.querySelectorAll('text.chart-tick')) {
      expect(tick.getAttribute('transform')).toBeNull();
    }
  });

  it('carries the same identity swatch into the table', () => {
    render(<BarChart data={RECORDS} title="Wins" ariaLabel="Most wins" valueTitle="Wins" />);
    const table = screen.getAllByRole('table')[0];
    expect(table).toBeTruthy();
    if (table === undefined) return;
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((th) => th.textContent),
    ).toEqual(['Hamilton', 'Schumacher', 'Verstappen']);
    expect(table.querySelectorAll('.chart-table-swatch')).toHaveLength(3);
  });
});

describe('§6.2 / §3.3a.3 — no component holds a colour', () => {
  it('writes every series colour as a var(), never as a hex', () => {
    const { container } = render(
      <LineChart series={SEASON} title="Points" ariaLabel="Points by round" />,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    expect(container.innerHTML).toContain('var(--team-red_bull-plot)');
  });

  it('paints identity from the brand colour and the mark from the plotting variant', () => {
    /*
     * Two roles, never mixed up (§3.3a.1). The legend shows both on purpose: a plotting variant of
     * a brand colour is not the colour anyone has on a cap, so the swatch keeps the recognition
     * and the key keeps the findability.
     */
    const { container } = render(
      <LineChart series={SEASON} title="Points" ariaLabel="Points by round" />,
    );
    expect(container.innerHTML).toContain('var(--team-red_bull)');
    expect(container.innerHTML).toContain('var(--team-red_bull-plot)');
  });
});

describe('§6.4a — a teammate comparison arrives with marker and dash already on', () => {
  it('splits the pair by shade AND gives it two shapes and two dash patterns', () => {
    const teammates: SeriesInput[] = [
      {
        reference: 'russell',
        teamReference: 'mercedes',
        label: 'Russell',
        points: [{ x: 1, y: 8 }],
      },
      {
        reference: 'antonelli',
        teamReference: 'mercedes',
        label: 'Antonelli',
        points: [{ x: 1, y: 6 }],
      },
    ];
    const { container } = render(
      <LineChart series={teammates} title="Points" ariaLabel="Teammates by round" />,
    );
    const html = container.innerHTML;
    expect(html).toContain('var(--team-mercedes-plot-deep)');
    expect(html).toContain('var(--team-mercedes-plot-bright)');
    const dashes = [...container.querySelectorAll('path.chart-line')].map((p) =>
      p.getAttribute('stroke-dasharray'),
    );
    expect(new Set(dashes).size).toBe(2);
  });
});

/**
 * §6.5.1's tooltip — **the origin its transform is measured from.**
 *
 * G-30 moves the tooltip with `gsap.quickSetter(el, 'x'|'y', 'px')`, which writes a transform. A
 * transform is measured from the element's own box, so without an explicit origin the box sits at
 * its **static flow position** — after the `<svg>`, below the plot area — and every coordinate the
 * chart computed against `plot.top` is offset by the whole height of the chart. That shipped: the
 * tooltip rendered under the plot, over the legend, clipped by the panel edge.
 *
 * This is the assertion that catches it, and it is only possible because the origin is inline: the
 * Tailwind Vite plugin claims `?raw` imports of `charts.css` and returns an empty string, so no
 * CSS-text test could have guarded it.
 */
describe('§6.5.1 — the tooltip is positioned from an explicit origin', () => {
  it('declares left and top, so the GSAP transform starts at the container corner', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <LineChart series={SEASON} title="Points" ariaLabel="Points by round" />,
    );

    const hit = container.querySelector('.chart-hit');
    expect(hit).toBeTruthy();
    await user.pointer({ target: hit as Element, coords: { x: 10, y: 10 } });

    const tooltip = container.querySelector<HTMLElement>('.chart-tooltip');
    expect(tooltip, 'no tooltip rendered on pointer move').toBeTruthy();
    expect(tooltip?.style.left).toBe('0px');
    expect(tooltip?.style.top).toBe('0px');
  });
});

/**
 * §6.3's clipped measure axis, and the two things that make it **honest rather than lossy**: the
 * count is legible without hovering anything, and the exact values are one action away.
 *
 * The figures are 2026 R1's: fastest 82.091s, ceiling 123.137s, and a slowest lap of 1,168.144s
 * spent stationary under a red flag. An axis that accommodated that lap would compress every racing
 * lap into 7% of the plot.
 */
const WITH_STOPPAGE: SeriesInput[] = [
  {
    reference: 'verstappen',
    teamReference: 'red_bull',
    label: 'Verstappen',
    points: [
      { x: 1, y: 82_091 },
      { x: 2, y: 1_168_144 },
      { x: 3, y: 85_228 },
    ],
  },
];

describe('§6.3 — a clipped axis states what it clipped', () => {
  const CEILING = 123_137;
  const fmt = (ms: number) => `${String(Math.round(ms / 1000))}s`;

  function renderClipped() {
    return render(
      <LineChart
        series={WITH_STOPPAGE}
        title="Lap times"
        ariaLabel="Lap time by lap"
        yCeiling={CEILING}
        formatY={fmt}
      />,
    );
  }

  it('counts the off-scale readings in a note, without needing a hover', () => {
    renderClipped();
    expect(screen.getByText(/1 lap is slower than 123s/)).toBeTruthy();
  });

  it('pluralises the count', () => {
    render(
      <LineChart
        series={[
          {
            ...(WITH_STOPPAGE[0] as SeriesInput),
            points: [
              { x: 1, y: 1_168_144 },
              { x: 2, y: 900_000 },
            ],
          },
        ]}
        title="Lap times"
        ariaLabel="Lap time by lap"
        yCeiling={CEILING}
        formatY={fmt}
      />,
    );
    expect(screen.getByText(/2 laps are slower than 123s/)).toBeTruthy();
  });

  it('draws a caret for the clipped reading, and not an ordinary marker', () => {
    const { container } = renderClipped();
    expect(container.querySelectorAll('.chart-offscale')).toHaveLength(1);
  });

  it('says nothing at all when no reading exceeds the ceiling', () => {
    render(<LineChart series={SEASON} title="Points" ariaLabel="Points" yCeiling={1_000_000} />);
    expect(screen.queryByText(/slower than/)).toBeNull();
  });

  it('reaches the table view in one action — which is what makes clipping lossless', async () => {
    const user = userEvent.setup();
    renderClipped();
    await user.click(screen.getByRole('button', { name: 'Show exact times' }));
    // The table is the frame's other view; the exact 1,168s value lives there.
    expect(screen.getByRole('button', { name: 'Table' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('withdraws the note in the table view, where nothing is clipped', async () => {
    const user = userEvent.setup();
    renderClipped();
    await user.click(screen.getByRole('button', { name: 'Show exact times' }));
    expect(screen.queryByText(/slower than 123s/)).toBeNull();
  });

  it('keeps the clipped reading in the series rather than dropping it', () => {
    // A clipped value is *present*, just not where it appears — so the line does not break and the
    // caret marks the right lap. jsdom collapses every coordinate to the origin, so what is
    // decidable is the number of points the path was built from, not where they are.
    const { container } = renderClipped();
    const d = container.querySelector('.chart-line')?.getAttribute('d') ?? '';
    expect(d.split('L')).toHaveLength(3);
  });
});
