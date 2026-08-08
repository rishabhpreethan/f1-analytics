// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

import type { Team, TeamSeason, TeamSeasonDriver } from '@schemas/team';
import { TeamPage } from './TeamPage';
import { mergeYears, teamLineupRows, teamRibbon, teamSplitRows } from './presenters';

/**
 * **The team page.** jsdom decides the seams, the copy and the arithmetic; it decides nothing about
 * layout, and the two charts' geometry is unverified by construction.
 *
 * The fixture spans the one boundary that matters on this surface: a **1957** season, before the
 * Constructors' Championship existed, beside a modern one.
 */

function driver(over: Partial<TeamSeasonDriver>): TeamSeasonDriver {
  return {
    driverRef: 'phil_hill',
    code: null,
    forename: 'Phil',
    surname: 'Hill',
    firstRound: 1,
    lastRound: 8,
    entries: 8,
    starts: 8,
    wins: 3,
    podiums: 5,
    bestFinish: 1,
    racePoints: 34,
    racePointsShare: 0.6,
    ...over,
  };
}

function season(over: Partial<TeamSeason>): TeamSeason {
  return {
    year: 1961,
    entries: 16,
    races: 8,
    wins: 5,
    podiums: 12,
    bestFinish: 1,
    points: 40,
    position: 1,
    championshipWins: 5,
    adjustment: 'none',
    hasTeamStandings: true,
    isSeasonComplete: true,
    isChampion: true,
    driverRacePointsTotal: 56,
    drivers: [driver({}), driver({ driverRef: 'von_trips', surname: 'von Trips', racePoints: 22 })],
    ...over,
  };
}

const TEAM: Team = {
  team: { ref: 'ferrari', name: 'Ferrari', nationality: 'Italian', countryCode: 'IT' },
  career: {
    firstSeason: 1957,
    lastSeason: 1961,
    seasonsEntered: 5,
    firstRace: null,
    lastRace: null,
  },
  totals: {
    races: 60,
    entries: 132,
    wins: 12,
    podiums: 40,
    driversUsed: 14,
    championships: 1,
  },
  seasons: [
    season({
      year: 1957,
      hasTeamStandings: false,
      position: null,
      points: null,
      championshipWins: null,
      isChampion: false,
      wins: 0,
      driverRacePointsTotal: 0,
      drivers: [driver({ racePoints: 0, wins: 0 })],
    }),
    season({ year: 1961 }),
  ],
};

function renderPage(over: Partial<Parameters<typeof TeamPage>[0]> = {}) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <TeamPage team={TEAM} pending={false} error={null} onRetry={() => undefined} {...over} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe('mergeYears — a gap in a spell is real and must survive', () => {
  it('merges consecutive years into one run', () => {
    expect(mergeYears([2007, 2008, 2009])).toEqual([[2007, 2009]]);
  });

  it('keeps two spells apart — Räikkönen at Ferrari is the case', () => {
    /*
     * A merge that ignored the gap would draw 2007–2018 as one unbroken span and quietly delete
     * the six seasons he spent elsewhere. That is exactly what a bar-per-driver would have done,
     * and it is the reason CN-3 is a span chart.
     */
    expect(mergeYears([2007, 2008, 2009, 2014, 2015])).toEqual([
      [2007, 2009],
      [2014, 2015],
    ]);
  });

  it('is order- and duplicate-insensitive', () => {
    expect(mergeYears([2009, 2007, 2008, 2008])).toEqual([[2007, 2009]]);
  });

  it('returns nothing for no years, rather than a zero-width span', () => {
    expect(mergeYears([])).toEqual([]);
  });
});

describe('teamLineupRows — CN-3', () => {
  it('gives a single season a span of one season’s width, not zero', () => {
    /*
     * `[1974, 1974]` is a span of zero width and paints nothing. The axis is "start of season", so
     * a one-season spell runs `[1974, 1975)`.
     */
    const { rows } = teamLineupRows(TEAM, 24);
    const spans = rows.flatMap((row) => row.spans);
    expect(spans.every((span) => span.end > span.start)).toBe(true);
  });

  it('sorts by first season, never by success', () => {
    // Sorting by wins would encode rank in vertical position and repaint on any filter (§6.2).
    const { rows } = teamLineupRows(TEAM, 24);
    expect(rows[0]?.label).toBeDefined();
    const firsts = rows.map((row) => row.spans[0]?.start ?? 0);
    expect([...firsts].sort((a, b) => a - b)).toEqual(firsts);
  });

  it('reports the true driver count even when the plot is capped', () => {
    // A silently truncated roster would be a lie; the caller states the cap from `total`.
    const { rows, total } = teamLineupRows(TEAM, 1);
    expect(rows).toHaveLength(1);
    expect(total).toBe(2);
  });

  it('caps by starts, so the roster shown is who actually raced most', () => {
    const busy = {
      ...TEAM,
      seasons: [
        season({
          drivers: [
            driver({ driverRef: 'a', surname: 'Alpha', starts: 1 }),
            driver({ driverRef: 'b', surname: 'Bravo', starts: 40 }),
          ],
        }),
      ],
    };
    expect(teamLineupRows(busy, 1).rows[0]?.reference).toBe('b');
  });

  it('paints every row in the TEAM’s colour, never a per-driver one', () => {
    // On a team page the team is the identity; colouring drivers differently would imply an
    // encoding that does not exist (§6.6.2.6).
    const { rows } = teamLineupRows(TEAM, 24);
    expect(rows.every((row) => row.teamReference === 'ferrari')).toBe(true);
  });
});

describe('teamSplitRows — CN-4', () => {
  it('sends the raw race points and lets the chart normalise', () => {
    /*
     * §6.6.3 — the component owns the normalisation, because a caller free to pre-normalise is
     * free to send a row summing to 0.9 and nothing on screen would look wrong.
     */
    const rows = teamSplitRows(TEAM);
    expect(rows.find((r) => r.key === '1961')?.segments.map((s) => s.value)).toEqual([34, 22]);
  });

  it('labels a driver with no code by surname, never by a derived abbreviation', () => {
    // §6.5.4a — deriving `HIL` would invent a convention the sport never used for him.
    const rows = teamSplitRows(TEAM);
    expect(rows[0]?.segments[0]?.shortLabel).toBe('Hill');
  });

  it('orders newest season first', () => {
    expect(teamSplitRows(TEAM).map((r) => r.key)).toEqual(['1961', '1957']);
  });
});

describe('teamRibbon — the 1958 boundary is `unranked`, never `absent`', () => {
  it('passes a pre-1958 season through with a null position and its own explanation', () => {
    /*
     * `absent` means *did not race*. Ferrari raced in 1957; there was no Constructors'
     * Championship to place in. Collapsing the two would be §7.9's whole failure mode.
     */
    const cells = teamRibbon(TEAM.seasons);
    const first = cells.find((c) => c.year === 1957);
    expect(first?.position).toBeNull();
    expect(first?.detail).toContain('No Constructors’ Championship');
  });
});

describe('the page', () => {
  it('sets the team name as the one h1', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ferrari');
  });

  it('links every driver it names to their driver page — §1.0a', () => {
    renderPage();
    expect(screen.getAllByRole('link', { name: 'Phil Hill' })[0]?.getAttribute('href')).toBe(
      '/drivers/phil_hill',
    );
  });

  it('links every season to its season hub page — §1.0a', () => {
    renderPage();
    expect(screen.getByRole('link', { name: '1961' }).getAttribute('href')).toBe('/seasons/1961');
  });

  it('says “No championship” for a pre-1958 season rather than an em-dash', () => {
    // An em-dash reads as missing data. The championship did not exist; that is a different sport,
    // not a gap in the record (§3.4.3).
    renderPage();
    expect(screen.getAllByText('No championship').length).toBeGreaterThan(0);
  });

  it('claims no lineage anywhere, because `base_team` holds zero rows', () => {
    renderPage({ team: null, error: { code: 'NOT_FOUND' } });
    expect(screen.getByText(/separate teams here, because the data holds no lineage/)).toBeTruthy();
  });

  it('states in the caption that a share is comparable across eras and points are not', () => {
    renderPage();
    expect(screen.getByText(/24 different points systems have been used/)).toBeTruthy();
  });

  it('keeps the masthead above a failure below it', () => {
    const { container } = renderPage({ team: null, error: { code: 'INTERNAL' } });
    expect(container.querySelector('.entity-masthead')).not.toBeNull();
  });
});
