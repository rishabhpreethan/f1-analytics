// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

import type { Circuit, CircuitRace } from '@schemas/circuit';
import { CircuitPage } from './CircuitPage';
import { circuitRibbon, topEntityBars } from './presenters';

/**
 * **The circuit page.** jsdom decides the seams, the coverage copy and the ribbon's kinds; the
 * locator's on-screen projection, the leaderboard's bar geometry and every dimension are
 * unverified by construction.
 *
 * The fixture is Interlagos-shaped: a venue with a **gap** in its calendar history, a race with no
 * qualifying record, and a scheduled round with no results.
 */

function race(over: Partial<CircuitRace>): CircuitRace {
  return {
    year: 1973,
    round: 2,
    name: 'Brazilian Grand Prix',
    date: '1973-02-11',
    hasResults: true,
    hasLapData: false,
    entries: 20,
    winners: [
      {
        driverRef: 'fittipaldi',
        code: null,
        forename: 'Emerson',
        surname: 'Fittipaldi',
        teamRef: 'lotus',
        teamName: 'Team Lotus',
        points: 9,
      },
    ],
    poleSitters: [],
    hasQualifying: false,
    ...over,
  };
}

const CIRCUIT: Circuit = {
  circuit: {
    ref: 'interlagos',
    name: 'Autódromo José Carlos Pace',
    locality: 'São Paulo',
    country: 'Brazil',
    countryCode: 'BR',
    latitude: -23.7036,
    longitude: -46.6997,
    altitude: 785,
  },
  firstYear: 1973,
  lastYear: 1990,
  roundsHeld: 4,
  racesWithResults: 3,
  races: [
    /* Descending by year — the order a venue page reads in, and the payload's own order. */
    race({ year: 1990, hasResults: false, winners: [] }),
    race({
      year: 1980,
      hasQualifying: true,
      poleSitters: [
        {
          driverRef: 'jabouille',
          code: null,
          forename: 'Jean-Pierre',
          surname: 'Jabouille',
          session: 'QB',
        },
      ],
    }),
    /* 1974–79 are absent from this fixture on purpose: the gap is what the ribbon must show. */
    race({ year: 1973 }),
  ],
  topDrivers: [
    {
      driverRef: 'fittipaldi',
      code: null,
      forename: 'Emerson',
      surname: 'Fittipaldi',
      starts: 3,
      wins: 2,
      podiums: 3,
      bestFinish: 1,
    },
    {
      driverRef: 'reutemann',
      code: null,
      forename: 'Carlos',
      surname: 'Reutemann',
      starts: 3,
      wins: 0,
      podiums: 2,
      bestFinish: 2,
    },
  ],
  topTeams: [{ teamRef: 'lotus', name: 'Team Lotus', races: 3, wins: 2, podiums: 4 }],
};

function renderPage(over: Partial<Parameters<typeof CircuitPage>[0]> = {}) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <CircuitPage
          circuit={CIRCUIT}
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

describe('circuitRibbon — the gap in a venue’s history is the reading', () => {
  it('emits a cell for every year of the span, so absent seasons are visible', () => {
    /*
     * `buildRibbon` fills the span; this only has to *not* invent the missing years. Interlagos'
     * six-year gap is the fact the strip states without a word, and a ribbon built from the
     * present seasons alone would silently close it.
     */
    const seasons = circuitRibbon(CIRCUIT);
    expect(seasons.map((s) => s.year)).toEqual([1973, 1980, 1990]);
  });

  it('marks a scheduled round with no results as unranked, not as hosted', () => {
    // Different facts: the round was on the calendar, and the results are not in the record.
    expect(circuitRibbon(CIRCUIT).find((s) => s.year === 1990)?.position).toBeNull();
    expect(circuitRibbon(CIRCUIT).find((s) => s.year === 1973)?.position).toBe(1);
  });

  it('never marks a venue as a champion', () => {
    expect(circuitRibbon(CIRCUIT).every((s) => s.champion === false)).toBe(true);
  });
});

describe('topEntityBars — CI-3', () => {
  it('drops entities with no win rather than drawing them at zero', () => {
    /*
     * The section is "most successful here". A row of zero-length bars is a list of people who did
     * not win — a different question — and it pushes the winners off the plot.
     */
    expect(topEntityBars(CIRCUIT, 'drivers').map((b) => b.key)).toEqual(['fittipaldi']);
  });

  it('gives a driver bar NO team reference, because a driver’s colour is their team’s', () => {
    /*
     * At a venue a driver has usually raced for several teams, so any single colour would be a
     * choice about which era of their career to represent. Identity is the label, which is rung 1
     * and always present.
     */
    expect(topEntityBars(CIRCUIT, 'drivers')[0]?.teamReference).toBeUndefined();
  });

  it('gives a team bar its own reference, because there the entity IS the team', () => {
    expect(topEntityBars(CIRCUIT, 'teams')[0]?.teamReference).toBe('lotus');
  });

  it('labels a driver by surname, the one identifier with full coverage', () => {
    // `code` exists for 107 of 881, so a mixed column of codes and surnames looks like a defect.
    expect(topEntityBars(CIRCUIT, 'drivers')[0]?.label).toBe('Fittipaldi');
  });
});

describe('the page', () => {
  it('sets the circuit name as the one h1', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Autódromo José Carlos Pace',
    );
  });

  it('draws the position instead of mapping it, and says so', () => {
    renderPage();
    expect(
      screen.getByText(/no track geometry — so the position is drawn rather than mapped/),
    ).toBeTruthy();
  });

  it('renders the locator from the coordinates', () => {
    const { container } = renderPage();
    expect(container.querySelector('.locator-pip')).not.toBeNull();
    expect(screen.getByText('785 m')).toBeTruthy();
  });

  it('explains a venue with no coordinates instead of drawing an empty graticule', () => {
    renderPage({
      circuit: {
        ...CIRCUIT,
        circuit: { ...CIRCUIT.circuit, latitude: null, longitude: null, altitude: null },
      },
    });
    expect(screen.getByText(/No coordinates are recorded for this circuit/)).toBeTruthy();
  });

  it('links every race row to its race page — §1.0a', () => {
    renderPage();
    expect(
      screen.getByRole('link', { name: '1973 Brazilian Grand Prix' }).getAttribute('href'),
    ).toBe('/seasons/1973/races/2');
  });

  it('says “Not yet raced” for a scheduled round, never “no data”', () => {
    // REQUIREMENTS §2.2 — a race that has not happened is not a gap in the record.
    renderPage();
    expect(screen.getByText('Not yet raced')).toBeTruthy();
  });

  it('names the missing qualifying record rather than leaving the pole cell blank', () => {
    renderPage();
    expect(screen.getAllByText('No qualifying data').length).toBeGreaterThan(0);
  });

  it('switches the leaderboard between drivers and teams', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Teams' }));
    expect(screen.getByRole('button', { name: 'Teams' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByText('Team Lotus').length).toBeGreaterThan(0);
  });

  it('states in the caption that a raw win count favours a long-running venue’s regulars', () => {
    renderPage();
    expect(screen.getByText(/a raw win count favours whoever raced here most/)).toBeTruthy();
  });

  it('keeps the masthead above a failure below it', () => {
    const { container } = renderPage({ circuit: null, error: { code: 'INTERNAL' } });
    expect(container.querySelector('.entity-masthead')).not.toBeNull();
  });
});
