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

import { CareerRibbon } from './CareerRibbon';
import { CircuitLocator } from './CircuitLocator';
import { EntityPortrait } from './EntityPortrait';
import { monogram, toDms } from './format';
import { RIBBON_FILL_FLOOR, buildRibbon, positionFill, ribbonLabelYears } from './ribbon';
import type { RibbonSeason } from './ribbon';

/**
 * **The three shared entity components, and what jsdom can decide about them.**
 *
 * Not: any height, width, position, or whether a cell is visible. jsdom performs no layout, so the
 * ribbon's 72px track, the locator's projection *on screen* and the portrait's box are all
 * unverified by construction and named as such in the hand-off.
 *
 * Yes: the arithmetic, and every place a value could silently become the wrong *kind* of value —
 * a fill of zero standing in for "did not race", a career whose gap years vanish, a coordinate that
 * rounds to sixty seconds, a monogram derived where the sport's own code exists. Each of those
 * renders something plausible and wrong, which is the class of defect this project keeps finding.
 */

const CAREER: RibbonSeason[] = [
  { year: 2007, position: 2 },
  { year: 2008, position: 1, champion: true },
  { year: 2009, position: 5 },
  /* 2010 and 2011 are deliberately absent from the input — a sabbatical, and the gap is the point. */
  { year: 2012, position: 4 },
  { year: 2013, position: null },
];

afterEach(cleanup);

describe('positionFill — §7.9.2, the fill is a rank and it is inverted', () => {
  it('gives P1 the full height, because in F1 up means faster', () => {
    expect(positionFill(1, 20)).toBe(1);
  });

  it('gives the entity’s own deepest season the floor, never zero', () => {
    // A zero-height fill is indistinguishable from `absent`, which is the §1.0 collapse.
    expect(positionFill(20, 20)).toBeCloseTo(RIBBON_FILL_FLOOR, 12);
    expect(positionFill(20, 20)).toBeGreaterThan(0);
  });

  it('scales against the entity’s own worst season, not the size of the grid', () => {
    /*
     * A title fight scaled to P26 would flatten four contenders into four near-identical stubs.
     * P4 of a P1–P4 career must be visibly shorter than P4 of a P1–P20 one, and taller than the
     * floor in the first case.
     */
    expect(positionFill(4, 4)).toBeCloseTo(RIBBON_FILL_FLOOR, 12);
    expect(positionFill(4, 20)).toBeGreaterThan(0.8);
  });

  it('returns full height when there is no range to spend, rather than dividing by zero', () => {
    // A career of exactly one ranked season. `(1-1)/(1-1)` is NaN, and a NaN height paints nothing.
    expect(positionFill(1, 1)).toBe(1);
    expect(Number.isNaN(positionFill(1, 1))).toBe(false);
  });

  it('clamps a position deeper than the reference instead of going negative', () => {
    expect(positionFill(40, 20)).toBeCloseTo(RIBBON_FILL_FLOOR, 12);
  });

  it('decreases monotonically as the position gets worse', () => {
    const fills = [1, 2, 3, 10, 20].map((p) => positionFill(p, 20));
    for (let i = 1; i < fills.length; i += 1) {
      expect(fills[i]).toBeLessThan(fills[i - 1] ?? 2);
    }
  });
});

describe('buildRibbon — a career is a span, not a list of seasons', () => {
  it('emits one cell per year across the whole span, gaps included', () => {
    const cells = buildRibbon(CAREER);
    expect(cells.map((c) => c.year)).toEqual([2007, 2008, 2009, 2010, 2011, 2012, 2013]);
  });

  it('marks the years the entity sat out as `absent`, so the hole in the career survives', () => {
    const cells = buildRibbon(CAREER);
    expect(cells.filter((c) => c.kind === 'absent').map((c) => c.year)).toEqual([2010, 2011]);
  });

  it('keeps `unranked` distinct from `absent` — contested with no position is not "did not race"', () => {
    const cells = buildRibbon(CAREER);
    expect(cells.find((c) => c.year === 2013)?.kind).toBe('unranked');
    expect(cells.find((c) => c.year === 2010)?.kind).toBe('absent');
  });

  it('reads the title from the payload and never derives one from a position', () => {
    /*
     * DR-2's "championships" is a count of titles, not a threshold. A season finishing P1 in a
     * *sprint* standing, or a season whose championship was decided by exclusion, is exactly the
     * case a derived rule gets wrong — so `champion` is carried, not computed.
     */
    const cells = buildRibbon([
      { year: 1950, position: 1, champion: false },
      { year: 1951, position: 1, champion: true },
    ]);
    expect(cells.map((c) => c.champion)).toEqual([false, true]);
  });

  it('returns nothing for an empty career rather than a zero-width strip', () => {
    expect(buildRibbon([])).toEqual([]);
  });

  it('gives a one-season P12 career the floor, not full height — the top of the scale is P1', () => {
    /*
     * **This assertion was written the other way round and the code was right.** The instinct is
     * that an entity's only season should fill its own strip, because there is "no range to spend".
     * There is: §6.3's position-axis rule — *"the minimum of a position axis is always P1, never
     * derived from the data"* — applies here too, and the ribbon follows it exactly. The top of the
     * scale is a championship; the bottom is the entity's own worst season.
     *
     * A driver who raced once and finished P12 gets a short cell, which is what happened. Filling
     * the strip would have paid a champion's mark to a midfielder for the sole reason that he has
     * no second season to be compared against.
     *
     * `positionFill(1, 1)` is the genuinely degenerate case — a career spent entirely at P1 — and
     * that one *is* full height, because the entity is at the top of the scale rather than at the
     * bottom of a scale with no length.
     */
    const cells = buildRibbon([{ year: 1961, position: 12 }]);
    expect(cells).toHaveLength(1);
    expect(cells[0]?.fill).toBeCloseTo(RIBBON_FILL_FLOOR, 12);
  });
});

describe('ribbonLabelYears — both ends always, then every fifth', () => {
  it('labels the first and last year of any career', () => {
    const labels = ribbonLabelYears(buildRibbon(CAREER));
    expect(labels.has(2007)).toBe(true);
    expect(labels.has(2013)).toBe(true);
  });

  it('never places a stride label adjacent to an endpoint label', () => {
    // 2010 is a multiple of five and two years from 2012's end; 2025 beside 2026 is the collision.
    const labels = ribbonLabelYears(
      buildRibbon([
        { year: 2007, position: 1 },
        { year: 2026, position: 1 },
      ]),
    );
    expect(labels.has(2025)).toBe(false);
    expect(labels.has(2010)).toBe(true);
  });

  it('labels a single-season career exactly once', () => {
    expect(ribbonLabelYears(buildRibbon([{ year: 1961, position: 3 }])).size).toBe(1);
  });
});

describe('CareerRibbon — the rendered strip', () => {
  it('writes the fill as a unitless custom property, so CSS owns the geometry', () => {
    const { container } = render(
      <CareerRibbon
        seasons={CAREER}
        ariaLabel="Championship position by season"
        measureLabel="Championship position"
      />,
    );
    const cells = [...container.querySelectorAll('.ribbon-cell')];
    expect(cells).toHaveLength(7);
    expect(cells[1]?.getAttribute('style')).toContain('--ribbon-fill: 1');
  });

  it('is one tab stop, not one per season', () => {
    const { container } = render(
      <CareerRibbon seasons={CAREER} ariaLabel="Career" measureLabel="Championship position" />,
    );
    // A 76-cell strip of focusable cells is a keyboard trap; §7.9.3 makes the track the tab stop.
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(1);
    expect(container.querySelector('.ribbon-track')?.getAttribute('tabindex')).toBe('0');
  });

  it('steps the cursor with the arrow keys and announces the reading', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CareerRibbon seasons={CAREER} ariaLabel="Career" measureLabel="Championship position" />,
    );
    const track = container.querySelector('.ribbon-track') as HTMLElement;
    track.focus();
    await user.keyboard('{ArrowRight}');
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toContain('2008');
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toContain(
      'Championship position P1',
    );
  });

  it('jumps to the ends with Home and End', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CareerRibbon seasons={CAREER} ariaLabel="Career" measureLabel="Championship position" />,
    );
    (container.querySelector('.ribbon-track') as HTMLElement).focus();
    await user.keyboard('{End}');
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toContain('2013');
    await user.keyboard('{Home}');
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toContain('2007');
  });

  it('says what an absent year means rather than leaving the readout blank', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CareerRibbon
        seasons={CAREER}
        ariaLabel="Career"
        measureLabel="Championship position"
        absentCopy="Did not race"
      />,
    );
    const cells = container.querySelectorAll('.ribbon-cell');
    await user.pointer({ target: cells[3] as Element });
    expect(screen.getByText('Did not race')).toBeTruthy();
  });

  it('reserves the readout line before anything is hovered, so nothing below it moves', () => {
    const { container } = render(
      <CareerRibbon seasons={CAREER} ariaLabel="Career" measureLabel="Championship position" />,
    );
    // A non-breaking space, not an empty string: an empty inline box collapses to zero height.
    expect(container.querySelector('.ribbon-readout')?.textContent).toBe(' ');
  });

  it('renders a skeleton that is the strip’s own geometry, not a slab', () => {
    const { container } = render(
      <CareerRibbon seasons={[]} ariaLabel="Career" measureLabel="Position" pending />,
    );
    expect(container.querySelectorAll('.ribbon-cell').length).toBeGreaterThan(0);
    expect(container.querySelector('.ribbon')?.getAttribute('aria-busy')).toBe('true');
  });
});

describe('EntityPortrait — §7.10, the permanent placeholder', () => {
  it('prefers the sport’s own code where one exists', () => {
    render(
      <EntityPortrait teamReference="mercedes" code="HAM" name="Lewis Hamilton" kind="driver" />,
    );
    expect(screen.getByText('HAM')).toBeTruthy();
  });

  it('falls back to a two-letter monogram, never a derived three-letter code', () => {
    /*
     * §6.5.4a: deriving a code invents a convention the data does not carry. Two letters in a box
     * is unmistakably a monogram and cannot be mistaken for `HAK`.
     */
    expect(monogram('Mika Häkkinen', 'driver')).toBe('HÄ');
    expect(monogram('Mika Häkkinen', 'driver')).toHaveLength(2);
  });

  it('takes a driver’s monogram from the surname, which is what a timing screen shows', () => {
    expect(monogram('Jean-Pierre Jarier', 'driver')).toBe('JA');
  });

  it('handles a mononym without reading past the end of the name', () => {
    expect(monogram('Moss', 'driver')).toBe('MO');
  });

  it('caps a team monogram at three initials, so a five-word name is not a word again', () => {
    expect(monogram('Scuderia Toro Rosso Honda', 'team')).toBe('STR');
    expect(monogram('Ferrari', 'team')).toBe('F');
  });

  it('never renders an empty mark for an empty name', () => {
    expect(monogram('   ', 'driver')).toBe('—');
  });

  it('paints the identity through a token and never a literal colour', () => {
    const { container } = render(
      <EntityPortrait teamReference="ferrari" code={null} name="Alberto Ascari" kind="driver" />,
    );
    expect(container.querySelector('.portrait')?.getAttribute('style')).toMatch(
      /--identity:\s*var\(--/,
    );
  });

  it('is hidden from assistive technology, because the name beside it already says this', () => {
    const { container } = render(
      <EntityPortrait teamReference={null} code={null} name="Jack Brabham" kind="driver" />,
    );
    expect(container.querySelector('.portrait')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('CircuitLocator — §7.11', () => {
  it('converts to DMS and never prints sixty seconds', () => {
    /*
     * `26.0332777…` rounds its seconds to 60, which is not a second — it is the next minute. Left
     * alone this prints `26°01′60″`, a real coordinate written the way no atlas would write it.
     */
    expect(toDms(26.033277, 'lat')).toBe('26°01′60″ N'.replace('01′60″', '02′00″'));
  });

  it('carries the hemisphere letter rather than a minus sign', () => {
    expect(toDms(-34.9272, 'lat')).toContain('S');
    expect(toDms(-7.6875, 'lon')).toContain('W');
    expect(toDms(50.5106, 'lon')).toContain('E');
  });

  it('rolls sixty minutes into the next degree', () => {
    expect(toDms(25.999999, 'lat')).toBe('26°00′00″ N');
  });

  it('projects with the identity map — x = lon + 180, y = 90 − lat', () => {
    const { container } = render(
      <CircuitLocator
        latitude={26.0325}
        longitude={50.5106}
        altitude={7}
        place="Bahrain International Circuit"
      />,
    );
    const pip = container.querySelector('.locator-pip');
    expect(Number(pip?.getAttribute('cx'))).toBeCloseTo(230.5106, 4);
    expect(Number(pip?.getAttribute('cy'))).toBeCloseTo(63.9675, 4);
  });

  it('renders a missing altitude as an absence and never as sea level', () => {
    // Printing `0 m` would state a fact about the venue the record does not carry.
    render(<CircuitLocator latitude={0} longitude={0} altitude={null} place="Somewhere" />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('states the coordinates as text as well as drawing them', () => {
    render(
      <CircuitLocator
        latitude={-34.9272}
        longitude={138.617}
        altitude={58}
        place="Adelaide Street Circuit"
      />,
    );
    expect(screen.getByText('34.9272° S')).toBeTruthy();
    expect(screen.getByText('58 m')).toBeTruthy();
  });

  it('names the place and its position in the graphic’s accessible name', () => {
    const { container } = render(
      <CircuitLocator latitude={45.62} longitude={9.281} altitude={162} place="Monza" />,
    );
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      'Monza — 45.6200° N, 9.2810° E',
    );
  });
});
