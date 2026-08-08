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

  it('gives two team-mates two different plotting tokens — §6.4a’s shade pair', () => {
    const { container } = renderShare();
    const styles = [...container.querySelectorAll('.chart-span')]
      .slice(0, 2)
      .map((mark) => mark.getAttribute('style'));
    expect(styles[0]).not.toEqual(styles[1]);
  });

  it('hatches the alternating segments only when colour is exhausted at three or more drivers', () => {
    // §6.4a property 4 — one hue supplies at most two mutually separated shades, and a third driver
    // of one team is a real season (a mid-season replacement), not an edge case.
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
    expect(container.querySelectorAll('path[fill^="url(#"]')).toHaveLength(1);
    cleanup();

    const { container: pair } = renderShare();
    expect(pair.querySelectorAll('path[fill^="url(#"]')).toHaveLength(0);
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
