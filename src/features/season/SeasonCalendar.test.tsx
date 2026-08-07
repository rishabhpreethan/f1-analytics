// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
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

import type { CancelledRound, SeasonRound } from '@schemas/season';
import { SeasonCalendar } from './SeasonCalendar';
import { mergeCalendar } from './presenters';

/**
 * **What this file can prove, and what it cannot.**
 *
 * jsdom performs no layout, so nothing here asserts a position, a width, a grid column or the
 * identity bar's rendered colour — a custom property resolves to `''` in this environment. The
 * row grid, the sticky behaviour and the bar are **untested by construction** and are named as
 * such in the hand-off.
 *
 * What *is* decidable is the content contract, and every case below is a row in the database:
 *
 * - **1951 R4 had two winners.** A calendar that renders `winners[0]` loses Fagioli. This file
 *   asserts both names appear.
 * - **2026 has two rounds with no number.** They must render in place, with no invented number.
 * - **A round with no results is scheduled, not empty.** The copy must not read as a data gap.
 *
 * `matchMedia` answers `true` to `reduce`, so no tween is created and the DOM under test is the
 * **resting** state — which MR-2 requires to be the final, readable one.
 */

const round = (
  over: Partial<SeasonRound> & Pick<SeasonRound, 'round' | 'date' | 'name'>,
): SeasonRound => ({
  circuitRef: 'silverstone',
  circuitName: 'Silverstone Circuit',
  hasResults: true,
  hasSprint: false,
  hasLapData: false,
  winners: [],
  ...over,
});

const winner = (driverRef: string, surname: string, points: number) => ({
  driverRef,
  code: null,
  forename: 'A',
  surname,
  team: { ref: 'alfa', name: 'Alfa Romeo' },
  points,
});

/** 1951 French Grand Prix — Fangio and Fagioli shared a car and split the win's points 5 / 4. */
const SHARED_DRIVE = round({
  round: 4,
  name: 'French Grand Prix',
  date: '1951-07-01',
  winners: [winner('fangio', 'Fangio', 5), winner('fagioli', 'Fagioli', 4)],
});

const CANCELLED: CancelledRound = {
  name: 'Bahrain Grand Prix',
  date: '2026-04-12',
  circuitRef: 'bahrain',
  circuitName: 'Bahrain International Circuit',
};

function renderCalendar(rounds: SeasonRound[], cancelled: CancelledRound[] = [], markLaps = false) {
  return render(
    <SeasonCalendar
      entries={mergeCalendar(rounds, cancelled)}
      notices={[]}
      markLapCoverage={markLaps}
      pending={false}
    />,
  );
}

afterEach(cleanup);

describe('a shared drive has two winners, and both are named', () => {
  it('renders every driver in `winners`, not the first', () => {
    renderCalendar([SHARED_DRIVE]);
    expect(screen.getByText(/Fangio/)).toBeTruthy();
    expect(screen.getByText(/Fagioli/)).toBeTruthy();
  });

  it('states the relationship in words rather than by adjacency', () => {
    renderCalendar([SHARED_DRIVE]);
    expect(screen.getAllByText(/shared with/).length).toBeGreaterThan(0);
  });

  it('gives the second driver no lesser weight than the first', () => {
    // Both are `.round-winner-entry`. A design that demoted one would have to use another class.
    const { container } = renderCalendar([SHARED_DRIVE]);
    expect(container.querySelectorAll('.round-winner-entry')).toHaveLength(2);
  });
});

describe('a cancelled round carries no number', () => {
  it('renders in date order rather than in an appendix', () => {
    const { container } = renderCalendar(
      [
        round({ round: 3, name: 'Japanese Grand Prix', date: '2026-03-29' }),
        round({ round: 4, name: 'Miami Grand Prix', date: '2026-05-03' }),
      ],
      [CANCELLED],
    );
    const rows = [...container.querySelectorAll('.round-row')];
    expect(rows).toHaveLength(3);
    expect(rows[1]?.getAttribute('data-status')).toBe('cancelled');
  });

  it('shows an em-dash where the number goes, never a fabricated one', () => {
    const { container } = renderCalendar([], [CANCELLED]);
    expect(container.querySelector('.round-number')?.textContent).toBe('—');
  });

  it('says it did not take place rather than showing an empty winner', () => {
    renderCalendar([], [CANCELLED]);
    expect(screen.getByText('Did not take place')).toBeTruthy();
  });
});

describe('a round that has not happened is not missing data', () => {
  it('reads as scheduled, never as a gap in the record', () => {
    renderCalendar([
      round({ round: 11, name: 'Hungarian Grand Prix', date: '2026-07-26', hasResults: false }),
    ]);
    expect(screen.getByText('Not yet raced')).toBeTruthy();
    expect(screen.queryByText(/no data/i)).toBeNull();
  });

  it('still shows the scheduled date', () => {
    renderCalendar([
      round({ round: 11, name: 'Hungarian Grand Prix', date: '2026-07-26', hasResults: false }),
    ]);
    expect(screen.getByText('26 Jul 2026')).toBeTruthy();
  });
});

describe('the lap-coverage marker earns its place only on a partial season', () => {
  const rounds = [
    round({
      round: 1,
      name: 'A',
      date: '1996-03-10',
      hasLapData: true,
      winners: [winner('a', 'A', 10)],
    }),
    round({
      round: 2,
      name: 'B',
      date: '1996-03-31',
      hasLapData: false,
      winners: [winner('b', 'B', 10)],
    }),
  ];

  it('marks the rounds without lap times when the season is mixed', () => {
    renderCalendar(rounds, [], true);
    expect(screen.getAllByText('No lap times')).toHaveLength(1);
  });

  it('is silent when the whole season is the same — the season notice says it better', () => {
    renderCalendar(rounds, [], false);
    expect(screen.queryByText('No lap times')).toBeNull();
  });
});

describe('structure', () => {
  it('is an ordered list, so a screen reader gets position and count for free', () => {
    const { container } = renderCalendar([round({ round: 1, name: 'A', date: '2026-03-08' })]);
    expect(container.querySelector('ol.season-calendar')).toBeTruthy();
  });

  it('holds its box while the query is in flight, and says busy once', () => {
    render(<SeasonCalendar entries={null} notices={[]} markLapCoverage={false} pending />);
    const busy = screen.getByRole('list', { name: 'Season calendar' });
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect(within(busy).queryAllByRole('status')).toHaveLength(0);
  });

  it('marks a sprint round', () => {
    renderCalendar([
      round({ round: 2, name: 'Chinese Grand Prix', date: '2026-03-15', hasSprint: true }),
    ]);
    expect(screen.getByText('Sprint')).toBeTruthy();
  });
});
