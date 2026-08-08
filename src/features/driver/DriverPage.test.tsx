// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
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

import type { Driver } from '@schemas/driver';
import { DriverPage } from './DriverPage';

/**
 * **The driver page, and what jsdom can decide about it.**
 *
 * Not: layout, the ribbon's cell heights, the chart's bar geometry, or whether anything is visible.
 *
 * Yes: **the seams and the honesty rules** — that every entity the page names is a link (§1.0a),
 * that a two-team season is one row with two destinations, that a coverage-limited figure is a dash
 * rather than a zero, and that no career points total exists anywhere on the surface.
 *
 * The fixture is Häkkinen-shaped: a career that straddles the qualifying boundary, a season split
 * across two teams, and a fastest-lap denominator of zero.
 */

const DRIVER: Driver = {
  driver: {
    ref: 'mika_hakkinen',
    code: null,
    forename: 'Mika',
    surname: 'Häkkinen',
    nationality: 'Finnish',
    countryCode: 'FI',
    permanentCarNumber: null,
    dateOfBirth: '1968-09-28',
  },
  career: {
    firstSeason: 1991,
    lastSeason: 2001,
    seasonsEntered: 11,
    firstRace: {
      year: 1991,
      round: 1,
      name: 'United States Grand Prix',
      date: '1991-03-10',
      circuitRef: 'phoenix',
      circuitName: 'Phoenix street circuit',
    },
    lastRace: {
      year: 2001,
      round: 17,
      name: 'Japanese Grand Prix',
      date: '2001-10-14',
      circuitRef: 'suzuka',
      circuitName: 'Suzuka Circuit',
    },
    ageAtFirstRace: 22,
    ageAtLastRace: 33,
  },
  totals: {
    entries: 161,
    races: 161,
    starts: 161,
    nonStarts: 0,
    wins: 20,
    podiums: 51,
    pointsFinishes: 87,
    poles: 26,
    racesWithQualifying: 41,
    fastestLaps: 0,
    racesWithFastestLapData: 0,
    dnfs: 61,
    mechanicalDnfs: 42,
    accidentDnfs: 19,
    disqualifications: 0,
    championships: 2,
  },
  seasons: [
    {
      year: 1998,
      teams: [{ ref: 'mclaren', name: 'McLaren', firstRound: 1, lastRound: 16, entries: 16 }],
      entries: 16,
      starts: 16,
      wins: 8,
      podiums: 11,
      bestFinish: 1,
      points: 100,
      position: 1,
      championshipWins: 8,
      adjustment: 'none',
      isSeasonComplete: true,
      isChampion: true,
    },
    {
      year: 1993,
      teams: [
        { ref: 'lotus', name: 'Team Lotus', firstRound: 1, lastRound: 13, entries: 0 },
        { ref: 'mclaren', name: 'McLaren', firstRound: 14, lastRound: 16, entries: 3 },
      ],
      entries: 3,
      starts: 3,
      wins: 0,
      podiums: 1,
      bestFinish: 3,
      points: 4,
      position: 15,
      championshipWins: 0,
      adjustment: 'none',
      isSeasonComplete: true,
      isChampion: false,
    },
  ],
  races: [
    {
      year: 1998,
      round: 1,
      name: 'Australian Grand Prix',
      date: '1998-03-08',
      circuitRef: 'albert_park',
      circuitName: 'Albert Park Grand Prix Circuit',
      teamRef: 'mclaren',
      teamName: 'McLaren',
      carNumber: 8,
      entries: 1,
      gridPosition: 1,
      gridStatus: 'grid',
      position: 1,
      outcome: 'finished',
      detail: 'Finished',
      isClassified: true,
      points: 10,
      lapsCompleted: 58,
      qualifyingPosition: 1,
      qualifyingSession: 'QB',
      roundHasQualifying: true,
      hasFastestLap: false,
      roundHasFastestLapData: false,
      positionsGained: 0,
    },
    {
      year: 1993,
      round: 14,
      name: 'Portuguese Grand Prix',
      date: '1993-09-26',
      circuitRef: 'estoril',
      circuitName: 'Autódromo do Estoril',
      teamRef: 'mclaren',
      teamName: 'McLaren',
      carNumber: 7,
      entries: 1,
      gridPosition: 3,
      gridStatus: 'grid',
      position: null,
      outcome: 'accident',
      detail: 'Spun off',
      isClassified: false,
      points: 0,
      lapsCompleted: 32,
      qualifyingPosition: null,
      qualifyingSession: null,
      roundHasQualifying: false,
      hasFastestLap: false,
      roundHasFastestLapData: false,
      positionsGained: null,
    },
  ],
  gridVsFinish: {
    racesCounted: 100,
    meanPositionsGained: 0.6,
    bestGain: 12,
    worstLoss: -8,
    gained: 44,
    lost: 30,
    held: 26,
    excluded: { unclassified: 61, pitLaneStarts: 0, unknownGrid: 0 },
  },
  qualifyingVsRace: {
    racesCounted: 30,
    meanDelta: -0.4,
    racesWithQualifying: 41,
    meanQualifyingPosition: 4.2,
  },
};

/**
 * `DataUnavailableState` reaches for a query client to offer its retry, so the provider is part of
 * the harness rather than of the page. Retries are off: a failing query that retries three times
 * turns a state assertion into a timing one.
 */
function renderPage(over: Partial<Parameters<typeof DriverPage>[0]> = {}) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <DriverPage
          driver={DRIVER}
          pending={false}
          error={null}
          onRetry={() => undefined}
          {...over}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe('the masthead — DR-1', () => {
  it('sets the name as the page’s one h1', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Mika Häkkinen');
  });

  it('renders no code badge at all when the driver has none', () => {
    /*
     * `abbreviation` is null for 774 of 881. An empty or `—` badge would be the common case and
     * would state a fact about our source rather than about the driver (§6.6.2.1).
     */
    const { container } = renderPage();
    expect(container.querySelector('.entity-code')).toBeNull();
  });

  it('renders the code badge when the driver has one', () => {
    const { container } = renderPage({
      driver: { ...DRIVER, driver: { ...DRIVER.driver, code: 'HAK' } },
    });
    expect(container.querySelector('.entity-code')?.textContent).toBe('HAK');
  });

  it('states the ages at first and last race, never an age today', () => {
    /*
     * There is no date of death anywhere in the schema, so an age computed against the clock would
     * confidently report Fangio at 114. This is permanent, not a gap to close later.
     */
    renderPage();
    expect(screen.getByText('Debut at 22, last race at 33')).toBeTruthy();
  });

  it('shows the career span from the payload rather than counting seasons', () => {
    renderPage();
    expect(screen.getByText('1991–2001')).toBeTruthy();
  });
});

describe('career totals — DR-2 and §6.6.2.2', () => {
  it('shows a dash for a figure whose denominator is zero, and never a nought', () => {
    const { container } = renderPage();
    const tiles = [...container.querySelectorAll('.stat-tile')];
    const fastest = tiles.find((tile) => tile.textContent?.startsWith('Fastest laps'));
    expect(fastest?.querySelector('.stat-tile-figure')?.getAttribute('data-unavailable')).toBe(
      'true',
    );
    expect(fastest?.textContent).not.toContain('0');
  });

  it('shows a partial figure with a marker rather than hiding it', () => {
    const { container } = renderPage();
    const tiles = [...container.querySelectorAll('.stat-tile')];
    const poles = tiles.find((tile) => tile.textContent?.startsWith('Poles'));
    expect(poles?.querySelector('.stat-tile-figure')?.textContent).toContain('26');
    expect(poles?.querySelector('.stat-tile-marker')).not.toBeNull();
  });

  it('carries one footnote per distinct reason, not one per tile', () => {
    const { container } = renderPage();
    expect(container.querySelectorAll('.stat-notes li')).toHaveLength(2);
  });

  it('never renders a career points total anywhere on the page', () => {
    /*
     * Trap 4 — 24 point systems and several best-N eras. This asserts on the tile labels rather
     * than on the page text, because "Points finishes" legitimately contains the word.
     */
    const { container } = renderPage();
    const labels = [...container.querySelectorAll('.stat-tile dt')].map((dt) => dt.textContent);
    expect(labels).not.toContain('Points');
    expect(labels).not.toContain('Career points');
  });
});

describe('the season table — DR-3, and the 318 two-team seasons', () => {
  it('renders a two-team season as ONE row with TWO team links', () => {
    /*
     * Measured: 318 driver-seasons map one driver to more than one team. Two rows would claim two
     * championship positions in one year; one team would delete the other.
     */
    const { container } = renderPage();
    const rows = [...container.querySelectorAll('.standings-table tbody tr')];
    const split = rows.find((row) => row.textContent?.includes('1993'));
    expect(split).toBeDefined();
    expect(
      within(split as HTMLElement).getAllByRole('link', { name: /Lotus|McLaren/ }),
    ).toHaveLength(2);
    expect(rows.filter((row) => row.textContent?.includes('1993'))).toHaveLength(1);
  });

  it('links every season to its season hub page — §1.0a', () => {
    renderPage();
    expect(screen.getByRole('link', { name: '1998' }).getAttribute('href')).toBe('/seasons/1998');
  });

  it('links every team to its team page — §1.0a', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Team Lotus' }).getAttribute('href')).toBe(
      '/teams/lotus',
    );
  });

  it('sorts newest season first', () => {
    const { container } = renderPage();
    const years = [...container.querySelectorAll('.standings-table tbody th')].map((th) =>
      th.textContent?.slice(0, 4),
    );
    expect(years).toEqual(['1998', '1993']);
  });

  it('marks a title season without recomputing one', () => {
    const { container } = renderPage();
    const champion = [...container.querySelectorAll('.standings-table tbody tr')].find((row) =>
      row.textContent?.includes('1998'),
    );
    expect(champion?.textContent).toContain('Champion');
  });

  it('has no total row, because a career points total is not a quantity', () => {
    const { container } = renderPage();
    expect(container.querySelector('.standings-table tfoot')).toBeNull();
  });
});

describe('DR-4 / DR-5 — one chart, two measures', () => {
  it('offers both measures as one segmented control above the plot', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Grid → finish' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Qualifying → finish' })).toBeTruthy();
  });

  it('disables the qualifying segment and explains it in TEXT when nothing is measurable', () => {
    /*
     * NV-8 — a coverage-aware control reuses §7.4's sentence, and it is text beside the control
     * rather than a `title`: a `title` is unreachable by touch, unreachable by keyboard in most
     * browsers, and invisible in a screenshot.
     */
    renderPage({
      driver: {
        ...DRIVER,
        races: DRIVER.races.map((r) => ({ ...r, qualifyingPosition: null })),
      },
    });
    expect(
      screen.getByRole('button', { name: 'Qualifying → finish' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.getByText(/Qualifying data begins in 1994/)).toBeTruthy();
  });

  it('keeps the qualifying segment enabled for a career that straddles the boundary', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: 'Qualifying → finish' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('states the excluded races in the note rather than absorbing them into the mean', () => {
    // 61 of Häkkinen's races ended in a retirement; a mean over the other 100 is a different claim.
    renderPage();
    expect(
      screen.getByText(/Excludes 61 races that ended without a classified finish/),
    ).toBeTruthy();
  });
});

describe('the states', () => {
  it('shows a not-found card that says what an address is, rather than a bare 404', () => {
    renderPage({ driver: null, error: { code: 'NOT_FOUND' } });
    expect(screen.getByText('No such driver')).toBeTruthy();
  });

  it('keeps the masthead above every failure below it', () => {
    /*
     * The rule every masthead in this product follows: no failure or absence further down the page
     * can blank the top of it. Here the payload is null, so the masthead is a skeleton — but it is
     * still a masthead with an eyebrow, not an empty page with an error in it.
     */
    const { container } = renderPage({ driver: null, error: { code: 'INTERNAL' }, pending: false });
    expect(container.querySelector('.entity-masthead')).not.toBeNull();
    expect(screen.getByText('This driver could not be loaded')).toBeTruthy();
  });

  it('renders the database-unavailable state instead of the page', () => {
    const { container } = renderPage({ driver: null, error: { code: 'DATABASE_UNAVAILABLE' } });
    expect(container.querySelector('.entity-masthead')).toBeNull();
  });

  it('holds the totals grid’s eight columns while loading, so nothing below it moves', () => {
    const { container } = renderPage({ driver: null, pending: true });
    expect(container.querySelectorAll('.stat-tile')).toHaveLength(8);
  });
});
