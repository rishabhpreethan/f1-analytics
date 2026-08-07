// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
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

import { ScatterChart, TREND_R2_FLOOR, type ScatterGroup } from './ScatterChart';

/**
 * **RD-4's chart form, and the assertions are all about honesty rather than appearance.**
 *
 * jsdom gives no layout, so nothing here checks where a point or a band sits. What is decidable is the
 * set of rules this form exists to enforce: a model is not drawn like a measurement, a fit that
 * explains nothing is not drawn at all, its r² is always available anyway, and an inferred region is
 * hatched rather than filled.
 */

const STRONG: ScatterGroup = {
  reference: 'stint-1',
  teamReference: 'mercedes',
  label: 'Stint 1',
  points: [
    { x: 2, y: 90_000 },
    { x: 3, y: 90_400 },
    { x: 4, y: 90_800 },
    { x: 5, y: 91_200 },
  ],
  fit: { slope: 400, intercept: 89_200, r2: 0.99, n: 4 },
};

/** A slope that looks confident and explains almost nothing — the case the floor exists for. */
const NOISY: ScatterGroup = {
  reference: 'stint-2',
  teamReference: 'ferrari',
  label: 'Stint 2',
  points: [
    { x: 10, y: 91_000 },
    { x: 11, y: 94_000 },
    { x: 12, y: 90_500 },
    { x: 13, y: 93_000 },
  ],
  fit: { slope: 120, intercept: 90_800, r2: 0.12, n: 4 },
};

/** Fewer than three clean laps defines no line at all. */
const UNFITTABLE: ScatterGroup = {
  reference: 'stint-3',
  teamReference: 'red_bull',
  label: 'Stint 3',
  points: [{ x: 20, y: 92_000 }],
  fit: null,
};

function renderScatter(
  groups: ScatterGroup[],
  over: Partial<Parameters<typeof ScatterChart>[0]> = {},
) {
  return render(
    <ScatterChart
      groups={groups}
      title="Lap time within each stint"
      ariaLabel="Lap time through each stint, with a fitted trend."
      xTitle="Lap"
      yTitle="Lap time"
      {...over}
    />,
  );
}

afterEach(cleanup);

describe('a model is never drawn like a measurement', () => {
  it('dashes the trend, where the data is solid marks', () => {
    // Dash survives a screenshot, a printout and greyscale — the same reason §6.4 spends it.
    const { container } = renderScatter([STRONG]);
    const trend = container.querySelector('.chart-trend');
    expect(trend).toBeTruthy();
    // The dash itself is in `charts.css`; what is decidable here is that the trend is its own
    // element with its own class rather than another data path.
    expect(trend?.tagName.toLowerCase()).toBe('line');
    expect(container.querySelectorAll('.chart-line')).toHaveLength(0);
  });

  it('draws the points as marks in every case, fit or no fit', () => {
    const { container } = renderScatter([STRONG, UNFITTABLE]);
    expect(container.querySelectorAll('.chart-marker')).toHaveLength(5);
  });

  it('joins nothing — consecutive laps are not a continuous quantity to interpolate', () => {
    const { container } = renderScatter([STRONG]);
    expect(container.querySelector('path.chart-line')).toBeNull();
  });
});

describe('a fit that explains nothing is not drawn', () => {
  it('withholds the trend below the r² floor', () => {
    const { container } = renderScatter([NOISY]);
    expect(container.querySelectorAll('.chart-trend')).toHaveLength(0);
  });

  it('draws it above the floor', () => {
    const { container } = renderScatter([STRONG]);
    expect(container.querySelectorAll('.chart-trend')).toHaveLength(1);
  });

  it('draws nothing when no fit is defined at all', () => {
    const { container } = renderScatter([UNFITTABLE]);
    expect(container.querySelectorAll('.chart-trend')).toHaveLength(0);
  });

  it('lets the caller move the floor, since it is a judgement rather than a measurement', () => {
    const { container } = renderScatter([NOISY], { trendFloor: 0.1 });
    expect(container.querySelectorAll('.chart-trend')).toHaveLength(1);
  });

  it('has a floor at the conventional weak-but-real threshold', () => {
    expect(TREND_R2_FLOOR).toBe(0.5);
  });
});

describe('the r² is always available even when the line is not', () => {
  it('states the slope and the r² in the table for a withheld fit', () => {
    /*
     * The whole point of withholding the line: the reader should be able to see that the trend they
     * are not being shown would have explained 12% of the variation. A table showing the slope alone
     * would launder the same model the missing line is qualifying.
     */
    renderScatter([NOISY]);
    expect(screen.getAllByText('0.12').length).toBeGreaterThan(0);
  });

  it('shows an em-dash rather than a zero slope where no fit exists', () => {
    // A zero slope would claim a flat trend; there is no trend.
    const { container } = renderScatter([UNFITTABLE]);
    const cells = [...(container.querySelectorAll('.chart-table tbody tr')[0]?.children ?? [])].map(
      (c) => c.textContent,
    );
    expect(cells[3]).toBe('—');
    expect(cells[4]).toBe('—');
  });

  it('states the fit once per group, not once per point', () => {
    const { container } = renderScatter([STRONG]);
    const rows = [...container.querySelectorAll('.chart-table tbody tr')];
    expect(rows).toHaveLength(4);
    expect(rows[1]?.children[4]?.textContent).toBe('');
  });
});

describe('an inferred region is hatched, never filled', () => {
  const BANDS = [{ key: 'band-12', from: 12, to: 17 }];

  it('paints the band with a pattern rather than a colour', () => {
    /*
     * Hatch already means "a different kind of thing" in this system (rung 4, §6.4), so it costs no
     * new vocabulary. A solid band would read as recorded data — and there is no safety-car flag
     * anywhere in the data for it to be recorded from.
     */
    const { container } = renderScatter([STRONG], { bands: BANDS });
    const band = container.querySelector('.chart-band');
    expect(band?.getAttribute('fill')).toMatch(/^url\(#/);
  });

  it('defines the hatch as a 45° pattern', () => {
    const { container } = renderScatter([STRONG], { bands: BANDS });
    const pattern = container.querySelector('pattern');
    expect(pattern?.getAttribute('patternTransform')).toBe('rotate(45)');
  });

  it('sits behind the marks, so no point is obscured by an inference about it', () => {
    const { container } = renderScatter([STRONG], { bands: BANDS });
    const svg = container.querySelector('svg');
    const bandEl = svg?.querySelector('.chart-band');
    const marks = svg?.querySelector('.chart-marks');
    expect(bandEl).toBeTruthy();
    expect(marks).toBeTruthy();
    expect(
      (bandEl as Element).compareDocumentPosition(marks as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders no band element when nothing was inferred — the common case', () => {
    const { container } = renderScatter([STRONG]);
    expect(container.querySelectorAll('.chart-band')).toHaveLength(0);
  });

  it('is aria-hidden, because the note states it in words', () => {
    const { container } = renderScatter([STRONG], { bands: BANDS });
    expect(container.querySelector('.chart-band')?.closest('[aria-hidden="true"]')).toBeTruthy();
  });
});
