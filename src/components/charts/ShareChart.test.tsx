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

import { ShareChart, type ShareRow } from './ShareChart';
import { normaliseShareRow } from './geometry';

/**
 * **The share chart, and what jsdom can decide about it.**
 *
 * Not: band layout, the 2px gaps, whether a label fits its segment, or where anything is — width is
 * 0 here and every mark collapses to the origin. Named as unverified in the hand-off.
 *
 * Yes: **the normalisation**, which is the whole reason this component exists rather than a stacked
 * bar. Every assertion below is about a property that could silently ship wrong — a row that sums to
 * something other than 1, a `NaN` width from a zero total, a share table disagreeing with the plot
 * about the same row — and each is arithmetic, so jsdom's blindness costs nothing.
 *
 * The fixture is a real intra-team split: 2007 McLaren (Hamilton and Alonso both on 109) and 2016
 * Mercedes (Rosberg 385, Hamilton 380), plus a season the team scored nothing.
 */

const ROWS: ShareRow[] = [
  {
    key: '2016',
    label: '2016',
    segments: [
      {
        reference: 'rosberg',
        teamReference: 'mercedes',
        label: 'Nico Rosberg',
        shortLabel: 'ROS',
        value: 385,
      },
      {
        reference: 'hamilton',
        teamReference: 'mercedes',
        label: 'Lewis Hamilton',
        shortLabel: 'HAM',
        value: 380,
      },
    ],
  },
  {
    key: '2007',
    label: '2007',
    segments: [
      {
        reference: 'alonso',
        teamReference: 'mclaren',
        label: 'Fernando Alonso',
        shortLabel: 'ALO',
        value: 109,
      },
      {
        reference: 'hamilton',
        teamReference: 'mclaren',
        label: 'Lewis Hamilton',
        shortLabel: 'HAM',
        value: 109,
      },
    ],
  },
];

const SCORELESS: ShareRow = {
  key: '1977',
  label: '1977',
  segments: [
    { reference: 'a', teamReference: 'apollon', label: 'Loris Kessel', value: 0 },
    { reference: 'b', teamReference: 'apollon', label: 'Reserve', value: 0 },
  ],
};

function renderShare(over: Partial<Parameters<typeof ShareChart>[0]> = {}) {
  return render(
    <ShareChart
      rows={ROWS}
      title="Points split"
      ariaLabel="Share of the team's driver points by season"
      measureTitle="Share of the team's driver points (%)"
      valueTitle="Points"
      entityTitle="Driver"
      categoryTitle="Season"
      emptyRowLabel="No points scored"
      {...over}
    />,
  );
}

afterEach(cleanup);

describe('normaliseShareRow — the invariant the component enforces instead of trusting the caller', () => {
  it('sums a row to exactly 1, whatever the raw values are', () => {
    const laid = normaliseShareRow(ROWS[0]?.segments ?? []);
    expect(laid).not.toBeNull();
    expect(laid?.at(-1)?.end).toBeCloseTo(1, 12);
    expect(laid?.[0]?.start).toBe(0);
  });

  it('lays segments end to end with no gap and no overlap', () => {
    const laid = normaliseShareRow(ROWS[0]?.segments ?? []) ?? [];
    for (let i = 1; i < laid.length; i += 1) {
      expect(laid[i]?.start).toBeCloseTo(laid[i - 1]?.end ?? -1, 12);
    }
  });

  it('splits an exact tie down the middle — 2007 McLaren, 109 apiece', () => {
    const laid = normaliseShareRow(ROWS[1]?.segments ?? []) ?? [];
    expect(laid[0]?.end).toBeCloseTo(0.5, 12);
  });

  it('returns null for a zero total rather than dividing — 0/0 is NaN, and a NaN width paints nothing', () => {
    /*
     * §1.0's exact failure mode: something absent given the meaning of something present. An
     * un-guarded division here would emit `width="NaN"` and the row would silently vanish, which
     * looks like a rendering fault rather than like a season in which the team scored nothing.
     */
    expect(normaliseShareRow(SCORELESS.segments)).toBeNull();
  });

  it('returns null for an empty row, which is the same question with no members', () => {
    expect(normaliseShareRow([])).toBeNull();
  });

  it('treats a negative value as no contribution rather than as a reversed segment', () => {
    // A negative share has no meaning; clamping keeps the row summing to 1 instead of past it.
    const laid =
      normaliseShareRow([
        { reference: 'a', value: 10 },
        { reference: 'b', value: -4 },
      ]) ?? [];
    expect(laid[0]?.end).toBeCloseTo(1, 12);
    expect(laid[1]?.start).toBeCloseTo(1, 12);
    expect(laid[1]?.end).toBeCloseTo(1, 12);
  });

  it('is order-preserving, so the caller’s entity order is the drawing order', () => {
    const laid = normaliseShareRow(ROWS[0]?.segments ?? []) ?? [];
    expect(laid.map((s) => s.reference)).toEqual(['rosberg', 'hamilton']);
  });
});

describe('structure', () => {
  it('draws one mark per segment across every row', () => {
    const { container } = renderShare();
    expect(container.querySelectorAll('.chart-span')).toHaveLength(4);
  });

  it('gives a zero-total row one labelled band and no series marks at all', () => {
    const { container } = renderShare({ rows: [SCORELESS] });
    expect(container.querySelectorAll('.chart-span')).toHaveLength(0);
    expect(container.querySelectorAll('.chart-share-empty')).toHaveLength(1);
    expect(screen.getAllByText('No points scored').length).toBeGreaterThan(0);
  });

  it('labels every row in the gutter, so identity never depends on colour', () => {
    renderShare();
    expect(screen.getAllByText('2016').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2007').length).toBeGreaterThan(0);
  });

  it('paints every segment through a token and never a literal colour', () => {
    /*
     * §6 — every colour in the kit is a `var()`, so a theme switch needs no re-render and no
     * JavaScript colour table. A hex reaching an inline style would work on screen and break at
     * sunset, which is the kind of defect no rendering test would report.
     */
    const { container } = renderShare();
    for (const mark of container.querySelectorAll('.chart-span')) {
      expect(mark.getAttribute('style') ?? '').toMatch(/--series:\s*var\(--/);
    }
  });

  it('gives two team-mates the SAME plotting token — one car, one colour (§6.4a)', () => {
    const { container } = renderShare();
    const styles = [...container.querySelectorAll('.chart-span')]
      .slice(0, 2)
      .map((mark) => mark.getAttribute('style'));
    expect(styles[0]).toEqual(styles[1]);
  });

  it('hatches the odd seat of every car, because a fill has no dash to carry the seat', () => {
    // §6.4a, 2026-08-23. The line chart separates two seats of one car with a dash; a share
    // chart's mark is a fill, so the same distinction is carried by rung 4's 45° hatch.
    const three: ShareRow = {
      key: '2020',
      label: '2020',
      segments: [
        { reference: 'a', teamReference: 'racing_point', label: 'Pérez', value: 125 },
        { reference: 'b', teamReference: 'racing_point', label: 'Stroll', value: 75 },
        { reference: 'c', teamReference: 'racing_point', label: 'Hülkenberg', value: 10 },
      ],
    };
    const { container } = render(
      <ShareChart
        rows={[three]}
        title="Points split"
        ariaLabel="Share"
        measureTitle="Share (%)"
        valueTitle="Points"
      />,
    );
    // Three seats: seats 0 and 2 plain, seat 1 hatched.
    expect(container.querySelectorAll('path[fill^="url(#"]')).toHaveLength(1);
    cleanup();

    // Two rows of two seats each: seat 1 of each car hatched, so two. Under the shade pair these
    // rows carried no hatch at all and their segments were told apart by colour alone.
    const { container: pair } = renderShare();
    expect(pair.querySelectorAll('path[fill^="url(#"]')).toHaveLength(2);
  });
});

describe('§6.5.5 — the table view', () => {
  it('carries the raw value AND the share, because the plot expresses only one of them', () => {
    const { container } = renderShare();
    const cells = [...(container.querySelectorAll('.chart-table tbody tr')[0]?.children ?? [])];
    expect(cells.map((c) => c.textContent)).toEqual(['2016', 'Nico Rosberg', '385', '50%']);
  });

  it('agrees with the plot about a zero-total row — “—”, never “0%”', () => {
    const { container } = renderShare({ rows: [SCORELESS] });
    const shares = [...container.querySelectorAll('.chart-table tbody tr')].map(
      (row) => row.children[3]?.textContent,
    );
    expect(shares).toEqual(['—', '—']);
  });

  it('names the category and entity columns from the caller rather than assuming a driver', () => {
    renderShare({ categoryTitle: 'Season', entityTitle: 'Driver' });
    expect(screen.getAllByText('Season').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Driver').length).toBeGreaterThan(0);
  });
});

describe('interaction', () => {
  it('dims siblings on hover — opacity only, never a colour change', async () => {
    const user = userEvent.setup();
    const { container } = renderShare();
    await user.pointer({
      target: container.querySelector('.chart-hit') as Element,
      coords: { x: 1, y: 1 },
    });
    expect(container.querySelector('.chart-marks')?.getAttribute('data-dimmed')).toBe('true');
  });

  it('names the season, the entity, the raw value and the share in the tooltip', async () => {
    const user = userEvent.setup();
    const { container } = renderShare();
    await user.pointer({
      target: container.querySelector('.chart-hit') as Element,
      coords: { x: 1, y: 1 },
    });
    const tooltip = container.querySelector('.chart-tooltip');
    expect(tooltip?.textContent).toContain('2016 · Nico Rosberg');
    expect(tooltip?.textContent).toContain('385');
    expect(tooltip?.textContent).toContain('50%');
  });
});

/**
 * **77 rows is not a hypothetical — it is Ferrari.** In a 360px plot that is a 4.0px band step, and
 * the season labels in the gutter and the driver codes inside the segments both rendered as an
 * illegible stack. jsdom performs no layout, so what is verifiable here is that the chart **asks**
 * for a plot deep enough; that the figure it asks for is sufficient is `geometry.test.ts`'s
 * `bandPlotHeight` property, computed against the real band scale.
 */
describe('a long history is grown, never crushed', () => {
  const many = (count: number): ShareRow[] =>
    Array.from({ length: count }, (_, i) => ({
      key: String(1950 + i),
      label: String(1950 + i),
      segments: [
        {
          reference: `d${String(i)}`,
          teamReference: 'ferrari',
          label: `Driver ${String(i)}`,
          shortLabel: 'LEC',
          value: 10,
        },
      ],
    }));

  it('asks for at least a line of height per season across Ferrari’s 77', () => {
    const { container } = renderShare({ rows: many(77) });
    const plot = container.querySelector('.chart-plot') as HTMLElement;
    expect(Number.parseFloat(plot.style.minHeight)).toBeGreaterThanOrEqual(76 * 16);
  });

  it('sets a floor and never a height, so the responsive token still governs a short history', () => {
    const { container } = renderShare();
    const plot = container.querySelector('.chart-plot') as HTMLElement;
    expect(plot.style.height).toBe('');
    expect(Number.parseFloat(plot.style.minHeight)).toBeLessThan(240);
  });

  it('asks for the same floor in every state, so nothing reflows as the query resolves', () => {
    // §6.5.3 — the figure is a function of the data, so loading and ready must agree exactly.
    const read = (state: 'loading' | 'ready') => {
      const { container, unmount } = renderShare({ rows: many(77), state });
      const value = (container.querySelector('.chart-plot') as HTMLElement).style.minHeight;
      unmount();
      return value;
    };
    expect(read('loading')).toBe(read('ready'));
  });
});

/**
 * **§6.3a — outcome tones.** What jsdom can decide here is exactly the set of things that would
 * otherwise ship silently wrong: which mode the chart chose, which segment got the hatch, whether
 * the row still carries one entity colour, and whether the text rule holds. What it cannot decide
 * is any of the four fills, because a custom property resolves to `''` in this environment and
 * `color-mix()` is never computed — the colours are `validate:palette tones` V-38's job, not this
 * file's, and the two are deliberately not duplicated.
 */
const MIX: ShareRow[] = [
  {
    key: 'fangio',
    label: 'Fangio',
    segments: [
      { reference: 'win', teamReference: 'maserati', label: 'Won', value: 24, tone: 'win' },
      {
        reference: 'podium',
        teamReference: 'maserati',
        label: 'Podium',
        value: 11,
        tone: 'podium',
      },
      {
        reference: 'classified',
        teamReference: 'maserati',
        label: 'Finished',
        value: 6,
        tone: 'classified',
      },
      {
        reference: 'unclassified',
        teamReference: 'maserati',
        label: 'Not classified',
        value: 10,
        tone: 'unclassified',
      },
    ],
  },
];

describe('§6.3a — the outcome ramp', () => {
  const renderMix = (over: Partial<Parameters<typeof ShareChart>[0]> = {}) =>
    renderShare({ rows: MIX, entityTitle: 'Result', categoryTitle: 'Driver', ...over });

  it('marks every segment with its tone, in ramp order', () => {
    const { container } = renderMix();
    expect(
      [...container.querySelectorAll('.chart-marks .chart-span')].map((m) =>
        m.getAttribute('data-tone'),
      ),
    ).toEqual(['win', 'podium', 'classified', 'unclassified']);
  });

  it('keeps one entity colour across the whole row — the tone is a ramp, not a palette', () => {
    /*
     * The point of the mode. Four `assignEntityColours` members with one `teamReference` take one
     * plot token; if a later change ever coloured the segments as entities again, this row would
     * paint four different cars for one driver and read as four competitors.
     */
    const { container } = renderMix();
    const styles = [...container.querySelectorAll('.chart-marks .chart-span')].map((m) =>
      m.getAttribute('style'),
    );
    expect(new Set(styles).size).toBe(1);
    expect(styles[0]).toMatch(/--series:\s*var\(--/);
  });

  it('hatches the not-classified step and nothing else, and steps the hatch up to --border-strong', () => {
    /*
     * In entity mode the hatch is the odd SEAT; here every segment is the same person, so keying it
     * on the seat would hatch the podium and the not-classified step and mean nothing by either.
     * The weight matters as much as the position: on `--surface-raised` the subtle border measures
     * 1.24:1 and the hatch is the only thing separating step 4 from the panel (V-38 G-38d).
     */
    const { container } = renderMix();
    const hatched = [...container.querySelectorAll('.chart-marks path[fill^="url("]')];
    expect(hatched).toHaveLength(1);
    for (const line of container.querySelectorAll('pattern .chart-hatch-line')) {
      expect(line.getAttribute('data-weight')).toBe('strong');
    }
  });

  it('draws no text inside a toned segment even when the caller supplies one', () => {
    /*
     * Measured, not tasteful (V-38): the ramp sweeps from a mid-lightness entity colour to the plot
     * surface, so neither ink clears 4.5:1 across all 44 fills — `--ink-inverse` bottoms out at
     * 3.40:1 and `--ink-primary` at 4.23:1. The rule belongs to the encoding, so the component
     * refuses the label rather than trusting every future caller to know that.
     */
    const withLabels = MIX.map((row) => ({
      ...row,
      segments: row.segments.map((segment) => ({ ...segment, shortLabel: 'XX' })),
    }));
    const { container } = renderMix({ rows: withLabels });
    expect(container.querySelectorAll('.chart-span-label')).toHaveLength(0);
  });

  it('teaches the four steps in a legend, since nothing on the bar is labelled', () => {
    const { container } = renderMix();
    const keys = [...container.querySelectorAll('.chart-tone-legend .chart-legend-item')];
    expect(keys.map((key) => key.textContent)).toEqual([
      'Won',
      'Podium, not a win',
      'Finished, off the podium',
      'Not classified',
    ]);
  });

  it('lets the surface name the tones, because a tone is a position and not a noun', () => {
    renderMix({
      toneLabels: {
        win: 'Victory',
        podium: 'Rostrum',
        classified: 'Classified',
        unclassified: 'Retired or not classified',
      },
    });
    expect(screen.getAllByText('Victory').length).toBeGreaterThan(0);
  });

  it('falls back to entity colour when only SOME segments carry a tone', () => {
    /*
     * A chart in which one row is outcomes and another is entities would be two encodings on one
     * axis. The mode is therefore all-or-nothing, and the fallback is the shipped behaviour rather
     * than a throw: a mis-shaped row should draw something honest, not nothing.
     */
    const partial = MIX.map((row) => ({
      ...row,
      segments: row.segments.map((segment, index) =>
        index === 0
          ? {
              reference: segment.reference,
              teamReference: segment.teamReference,
              label: segment.label,
              value: segment.value,
            }
          : segment,
      ),
    }));
    const { container } = renderMix({ rows: partial });
    for (const mark of container.querySelectorAll('.chart-marks .chart-span')) {
      expect(mark.getAttribute('data-tone')).toBeNull();
    }
  });

  it('carries every figure into the table view, which is where the counts live', () => {
    /*
     * §6.5.5 with a second job here: because no number is drawn on the bar, the table is not a
     * courtesy for the CVD and print cases — it is the only place the four counts appear as text.
     */
    renderMix();
    expect(screen.getByText('24')).toBeTruthy();
    expect(screen.getByText('47%')).toBeTruthy(); // 24 of 51
  });
});
