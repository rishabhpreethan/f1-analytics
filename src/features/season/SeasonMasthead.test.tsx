// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
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

import { SeasonCalendar } from './SeasonCalendar';
import { SeasonMasthead } from './SeasonMasthead';
import { dialCells, mergeCalendar } from './presenters';
import type { DialCell, TitleCard } from './presenters';

/**
 * **The loading window, which is the one state a capture caught being wrong.**
 *
 * Rishabh's capture of `/seasons/1951` about a second into a cold load showed the year and both
 * section headings at low opacity and nothing else. The skeletons were rendering and holding their
 * height; they were **inside G-15's stagger**, so they started at `opacity: 0`.
 *
 * `DESIGN_SYSTEM.md` §4.6.1 now states the rule — *a loading state is never animated in, so
 * `data-motion="reveal-item"` never goes on a skeleton or on a container holding one* — and the
 * first two tests below are that rule, asserted. They are the kind of test §7.8.0 asks for: they
 * assert what a change could **destroy** (a visible loading state), not the arithmetic of something
 * that positioned correctly while being invisible.
 *
 * Everything about size and position remains untestable here: jsdom performs no layout, so the
 * dial's tick widths, the title cards' grid and the identity bar's rendered colour are named as
 * unverified in the hand-off rather than asserted.
 */

const CARD: TitleCard = {
  eyebrow: "Drivers' Champion",
  name: 'Nino Farina',
  detail: 'Alfa Romeo',
  colorRef: 'alfa',
  points: 30,
  wins: 3,
};

const CELLS: DialCell[] = dialCells(
  mergeCalendar(
    [
      {
        round: 1,
        name: 'British Grand Prix',
        date: '1950-05-13',
        circuitRef: 'silverstone',
        circuitName: 'Silverstone Circuit',
        hasResults: true,
        hasSprint: false,
        hasLapData: false,
        winners: [],
      },
    ],
    [{ name: 'Bahrain Grand Prix', date: '1950-06-01', circuitRef: null, circuitName: null }],
  ),
);

function renderMasthead(over: Partial<Parameters<typeof SeasonMasthead>[0]> = {}) {
  return render(
    <MemoryRouter>
      <SeasonMasthead
        year={1950}
        years={[1949, 1950, 1951]}
        dial={CELLS}
        driverTitle={CARD}
        teamTitle={null}
        notices={[]}
        progressLine="7 rounds, all raced."
        pending={false}
        {...over}
      />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('a loading state is never animated in', () => {
  it('puts no skeleton inside a reveal container — the masthead', () => {
    const { container } = renderMasthead({ pending: true, driverTitle: null });
    const skeletons = [...container.querySelectorAll('.skeleton')];
    expect(skeletons.length).toBeGreaterThan(0);
    for (const skeleton of skeletons) {
      expect(skeleton.closest('[data-motion="reveal-item"]')).toBeNull();
    }
  });

  it('puts no skeleton inside a reveal container — the calendar', () => {
    const { container } = render(
      <MemoryRouter>
        <SeasonCalendar entries={null} notices={[]} markLapCoverage={false} pending year={1951} />
      </MemoryRouter>,
    );
    const skeletons = [...container.querySelectorAll('.skeleton')];
    expect(skeletons.length).toBeGreaterThan(0);
    for (const skeleton of skeletons) {
      expect(skeleton.closest('[data-motion="reveal-item"]')).toBeNull();
    }
  });

  it('holds the title cards’ boxes while the query is in flight, so nothing below reflows', () => {
    const { container } = renderMasthead({ pending: true, driverTitle: null });
    expect(container.querySelectorAll('.season-title-card')).toHaveLength(2);
  });

  it('drops the cards entirely on failure rather than promising a resolve', () => {
    const { container } = renderMasthead({ failed: true, driverTitle: null });
    expect(container.querySelector('.season-titles')).toBeNull();
    // The year survives: it is the reader's way out.
    expect(screen.getByRole('heading', { level: 1, name: /1950 season/i })).toBeTruthy();
  });
});

describe('the dial', () => {
  it('carries one accessible name for the whole mark, not one per tick', () => {
    renderMasthead();
    const dial = screen.getByRole('img', { name: /1950 calendar/ });
    expect(dial.querySelectorAll('.season-dial-cell')).toHaveLength(2);
  });

  it('states the count, the raced count and the cancelled count', () => {
    renderMasthead();
    expect(
      screen.getByRole('img', { name: 'The 1950 calendar: 2 events, 1 raced, 1 cancelled.' }),
    ).toBeTruthy();
  });

  it('carries no axis label — the caption is the whole scale', () => {
    // It used to render a lone `01` under the first cell, which read as a truncated axis.
    const { container } = renderMasthead();
    const caption = container.querySelector('.season-dial-scale');
    expect(caption?.textContent).toBe('The 1950 calendar: 2 events, 1 raced, 1 cancelled.');
    expect(caption?.textContent).not.toMatch(/^01/);
  });
});

describe('the title card', () => {
  it('names the championship rather than the metric', () => {
    renderMasthead();
    expect(screen.getByText("Drivers' Champion")).toBeTruthy();
    expect(screen.getByText('Nino Farina')).toBeTruthy();
  });

  it('renders one card when the season has no Constructors’ Championship', () => {
    const { container } = renderMasthead();
    expect(container.querySelectorAll('.season-title-card')).toHaveLength(1);
  });

  it('reads 30 points — the best-4 figure, never a sum this surface computed', () => {
    renderMasthead();
    expect(screen.getByText('30')).toBeTruthy();
  });

  it('singularises a solitary win', () => {
    renderMasthead({ driverTitle: { ...CARD, wins: 1 } });
    expect(screen.getByText('win')).toBeTruthy();
  });
});
