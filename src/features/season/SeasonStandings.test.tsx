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

import { SeasonStandings } from './SeasonStandings';
import type { DriverStandingRow, TeamStandingRow } from './selectors';

/**
 * **The three groups, and the two rows that must not be filed as "scored nothing".**
 *
 * Every fixture here is a real row. 2007 McLaren reads 0 points beside 8 wins and no position; 1997
 * Michael Schumacher reads 78 points with no position; 2020 Racing Point reads 195, which is the
 * post-penalty figure and is already applied. If any of the three ends up behind the unscored
 * disclosure, the table has misstated a championship.
 *
 * Layout is untestable here — no column widths, no `display: none` at a breakpoint, no sticky
 * header. `.standings-optional`'s media query in particular is invisible to jsdom and is named as
 * unverified in the hand-off.
 */

const driver = (
  over: Partial<DriverStandingRow> & Pick<DriverStandingRow, 'driverRef' | 'surname' | 'position'>,
): DriverStandingRow => ({
  code: null,
  forename: 'A',
  nationality: 'Italian',
  points: 0,
  wins: 0,
  bestFinish: null,
  teams: [{ ref: 'alfa', name: 'Alfa Romeo', firstRound: 1, lastRound: 1, entries: 1 }],
  adjustment: 'none',
  principalTeam: { ref: 'alfa', name: 'Alfa Romeo', firstRound: 1, lastRound: 1, entries: 1 },
  changedTeam: false,
  colorRef: 'alfa',
  ...over,
});

const team = (
  over: Partial<TeamStandingRow> & Pick<TeamStandingRow, 'teamRef' | 'name' | 'position'>,
): TeamStandingRow => ({
  nationality: 'British',
  points: 0,
  wins: 0,
  bestFinish: null,
  adjustment: 'none',
  colorRef: over.teamRef,
  ...over,
});

/** 1997 — Villeneuve champion, Schumacher excluded from the classification with 78 points. */
const DRIVERS_1997: DriverStandingRow[] = [
  driver({ driverRef: 'villeneuve', surname: 'Villeneuve', position: 1, points: 81, wins: 7 }),
  driver({
    driverRef: 'michael_schumacher',
    surname: 'Schumacher',
    position: null,
    points: 78,
    wins: 5,
    adjustment: 'excluded',
  }),
  // The unscored group: a one-race entrant with no points and no exclusion.
  driver({ driverRef: 'nobody', surname: 'Nobody', position: null }),
];

/** 2007 — McLaren excluded from the Constructors' Championship: 0 points beside 8 wins. */
const TEAMS_2007: TeamStandingRow[] = [
  team({ teamRef: 'ferrari', name: 'Ferrari', position: 1, points: 204, wins: 9, bestFinish: 1 }),
  team({
    teamRef: 'mclaren',
    name: 'McLaren',
    position: null,
    points: 0,
    wins: 8,
    adjustment: 'excluded',
  }),
];

function renderStandings(over: Partial<Parameters<typeof SeasonStandings>[0]> = {}) {
  return render(
    <SeasonStandings
      year={1997}
      drivers={DRIVERS_1997}
      teams={TEAMS_2007}
      driverNotices={[]}
      teamNotices={[]}
      asOfRound={17}
      isComplete
      pending={false}
      {...over}
    />,
  );
}

afterEach(cleanup);

describe('an excluded entity stays in the table', () => {
  it('shows 1997 Schumacher with his 78 points, not behind a disclosure', () => {
    renderStandings();
    // The name cell is `forename surname` in one span, so the match is on the whole rendered name.
    const row = screen.getByText('A Schumacher').closest('tr');
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText('78')).toBeTruthy();
  });

  it('shows 2007 McLaren with 0 points beside 8 wins', () => {
    renderStandings();
    const row = screen.getByText('McLaren').closest('tr');
    expect(within(row as HTMLElement).getByText('8')).toBeTruthy();
    expect(row?.getAttribute('data-adjustment')).toBe('excluded');
  });

  it('marks the exclusion rather than showing a bare dash for the position', () => {
    // A `—` reads as missing data. "Excluded" reads as a decision, which is what it was.
    renderStandings();
    expect(screen.getAllByText('Excluded').length).toBeGreaterThan(0);
  });

  it('explains the exclusion once, not once per row', () => {
    renderStandings({ teams: [] });
    const footnotes = screen.getAllByText(/excluded from the final championship classification/);
    expect(footnotes).toHaveLength(1);
  });

  it('says the figures are as recorded, never that they were re-applied', () => {
    renderStandings({ teams: [] });
    expect(screen.getByText(/as the record holds them/)).toBeTruthy();
  });
});

describe('an adjusted entity keeps its position', () => {
  it('classifies 2020 Racing Point normally and says the total is post-adjustment', () => {
    renderStandings({
      drivers: [],
      teams: [
        team({
          teamRef: 'racing_point',
          name: 'Racing Point',
          position: 4,
          points: 195,
          adjustment: 'adjusted',
        }),
      ],
    });
    const row = screen.getByText('Racing Point').closest('tr');
    expect(within(row as HTMLElement).getByText('04')).toBeTruthy();
    expect(within(row as HTMLElement).getByText('195')).toBeTruthy();
    expect(screen.getByText(/after it was applied/)).toBeTruthy();
  });
});

describe('the unscored disclosure states its own count', () => {
  it('names how many and why, rather than "show more"', () => {
    renderStandings();
    expect(screen.getByText('1 further driver scored no championship points in 1997')).toBeTruthy();
  });

  it('pluralises', () => {
    renderStandings({
      drivers: [
        ...DRIVERS_1997,
        driver({ driverRef: 'nobody2', surname: 'Nobody Two', position: null }),
      ],
    });
    expect(
      screen.getByText('2 further drivers scored no championship points in 1997'),
    ).toBeTruthy();
  });

  it('does not render at all when everyone scored', () => {
    renderStandings({ drivers: [DRIVERS_1997[0] as DriverStandingRow], teams: [] });
    expect(screen.queryByText(/further driver/)).toBeNull();
  });

  it('keeps the unscored drivers reachable rather than dropping them', () => {
    renderStandings();
    expect(screen.getByText('A Nobody')).toBeTruthy();
  });
});

describe("a season with no Constructors' Championship", () => {
  const notice = {
    code: 'noTeamChampionship' as const,
    text: "There was no Constructors' Championship in 1950. It began in 1958.",
  };

  it('replaces the table rather than rendering an empty one', () => {
    const { container } = renderStandings({ year: 1950, teams: [], teamNotices: [notice] });
    // One table only — the drivers'. An empty constructor table with headers would say "there
    // should be teams here and there are none", which is the opposite of true.
    expect(container.querySelectorAll('table.standings-table')).toHaveLength(1);
    expect(screen.getByText(notice.text)).toBeTruthy();
  });

  it('is neutral, never a fault', () => {
    renderStandings({ year: 1950, teams: [], teamNotices: [notice] });
    const card = screen
      .getByText("No Constructors' Championship this season")
      .closest('.state-card');
    expect(card?.querySelector('.state-card-tile-neutral')).toBeTruthy();
  });

  it('says what IS available instead — §6.5.3’s third clause', () => {
    renderStandings({ year: 1950, teams: [], teamNotices: [notice] });
    expect(screen.getByText(/drivers' championship above is complete for 1950/)).toBeTruthy();
  });
});

describe('the scoring rule sits next to the figures it changes', () => {
  it('renders the best-N notice above the driver table, not at the top of the page', () => {
    const notice = {
      code: 'bestNResults' as const,
      text: "In 1950 only a driver's best 4 results counted toward the championship, so a season total is not the sum of their race points.",
    };
    const { container } = renderStandings({ year: 1950, driverNotices: [notice] });
    const rendered = screen.getByText(notice.text);
    const subsection = rendered.closest('.season-subsection');
    expect(subsection).toBeTruthy();
    // In the same subsection as the drivers' table, and before it in document order.
    const table = subsection?.querySelector('table.standings-table');
    expect(table).toBeTruthy();
    expect(
      rendered.compareDocumentPosition(table as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.querySelector('.season-notes')).toBeTruthy();
  });
});

describe('the table’s own conventions', () => {
  it('makes the position a row header, so every value is announced with it', () => {
    const { container } = renderStandings();
    expect(container.querySelector('th.standings-position[scope="row"]')).toBeTruthy();
  });

  it('recedes a zero so the eye finds the values that are not zero', () => {
    // Ferrari's 0 wins... no: Ferrari won 9. McLaren's 0 POINTS is the zero in this fixture, and it
    // was the one numeral in the table with no `data-zero` until F2 made the rule cover every cell.
    const { container } = renderStandings();
    const zero = [...container.querySelectorAll('.standings-num[data-zero="true"]')];
    expect(zero.length).toBeGreaterThan(0);
  });

  it('shows an em-dash for a null best finish, never P0', () => {
    renderStandings({ teams: [] });
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('P0')).toBeNull();
  });

  it('reads a season scope from asOfRound, never from a date', () => {
    renderStandings({ isComplete: false, asOfRound: 10 });
    expect(screen.getByText('Standings after Round 10.')).toBeTruthy();
  });

  it('animates no loading state', () => {
    const { container } = renderStandings({ pending: true });
    const skeletons = [...container.querySelectorAll('.skeleton')];
    expect(skeletons.length).toBeGreaterThan(0);
    for (const skeleton of skeletons) {
      expect(skeleton.closest('[data-motion="reveal-item"]')).toBeNull();
    }
  });
});
