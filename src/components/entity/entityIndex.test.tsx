// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
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

import type { CircuitListItem, DriverListItem, TeamListItem } from '@schemas/directory';
import { WORLD_LAND_PATH } from '@/components/entity/worldLand';
import { CircuitIndexPage } from '@/features/circuit/CircuitIndexPage';
import { DriverIndexPage } from '@/features/driver/DriverIndexPage';
import { TeamIndexPage } from '@/features/team/TeamIndexPage';

/**
 * **What this file can prove, and what it cannot.**
 *
 * jsdom performs no layout and no compositing, so nothing here asserts a ladder bar's width, a
 * decade column's height, where the atlas puts a pip, whether the console sticks, whether
 * `content-visibility` skips anything, or what colour an identity bar resolves to — a custom
 * property reads as `''` in this environment. Those are **untested by construction** and named as
 * such in the hand-off; the arithmetic behind every one of them is asserted in `strata.test.ts` and
 * `indexModel.test.ts` instead.
 *
 * What *is* decidable is the behaviour contract, and every case below is a shape in the database:
 *
 * - **F1 is a pyramid.** 818 of 881 drivers started, 219 reached a podium, 116 won, 35 were
 *   champion. The page has to *say* that, and a ladder rung has to filter to exactly what it counts.
 * - **The default view is not alphabetical.** That was the whole complaint.
 * - **91 drivers never started a Grand Prix** — kept out of the browse, kept in the record, and
 *   reachable in one click.
 * - **Madring has a numbered 2026 round and no result.** It is *not yet raced*, and it is on the
 *   current calendar — `lastScheduledYear`, never `lastYear`.
 * - **`Räikkönen` must be findable by typing `raikkonen`.**
 * - **Every row is a link to its profile**, which is this page's entire purpose.
 *
 * `matchMedia` answers `true` to `reduce`, so no tween is created and the DOM under test is the
 * **resting** state — which MR-2 requires to be the final, readable one.
 */

const driver = (
  over: Partial<DriverListItem> & Pick<DriverListItem, 'ref' | 'forename' | 'surname'>,
): DriverListItem => ({
  code: null,
  nationality: 'British',
  countryCode: 'GBR',
  races: 100,
  starts: 100,
  wins: 0,
  podiums: 0,
  championships: 0,
  bestChampionshipPosition: null,
  firstSeason: 1990,
  lastSeason: 2000,
  colorTeamRef: null,
  ...over,
});

const team = (over: Partial<TeamListItem> & Pick<TeamListItem, 'ref' | 'name'>): TeamListItem => ({
  nationality: 'Italian',
  countryCode: 'ITA',
  races: 100,
  wins: 0,
  podiums: 0,
  championships: 0,
  bestChampionshipPosition: null,
  firstSeason: 1990,
  lastSeason: 2000,
  ...over,
});

const circuit = (
  over: Partial<CircuitListItem> & Pick<CircuitListItem, 'ref' | 'name'>,
): CircuitListItem => ({
  locality: 'Monza',
  country: 'Italy',
  countryCode: 'ITA',
  latitude: 45.6156,
  longitude: 9.28111,
  roundsHeld: 76,
  racesWithResults: 75,
  firstYear: 1950,
  lastYear: 2026,
  lastScheduledYear: 2026,
  ...over,
});

/**
 * Seven drivers, one per state the page distinguishes. Figures are the real ones wherever a real
 * driver is named, so a wrong assertion is also a factually wrong assertion.
 *
 * | | tier | why it is here |
 * |---|---|---|
 * | Hamilton | champion | the most decorated row; must open the page |
 * | Ascari | champion | a champion who is alphabetically **first** — proves the order is merit |
 * | Barrichello | winner | won races, never a title |
 * | Alesi | podium | 201 starts, 32 podiums, **0 wins** — a measured zero, not an absence |
 * | Crawford | starter | one start, nothing else |
 * | Amati | none | **entered three Grands Prix and started none** — `races` 3, `starts` 0 |
 * | Ecclestone | none | in the record, no race entry at all |
 */
const DRIVERS: DriverListItem[] = [
  driver({
    ref: 'hamilton',
    forename: 'Lewis',
    surname: 'Hamilton',
    code: 'HAM',
    races: 372,
    starts: 371,
    wins: 105,
    podiums: 202,
    championships: 7,
    bestChampionshipPosition: 1,
    firstSeason: 2007,
    lastSeason: 2026,
  }),
  driver({
    ref: 'ascari',
    forename: 'Alberto',
    surname: 'Ascari',
    nationality: 'Italian',
    countryCode: 'ITA',
    races: 32,
    starts: 32,
    wins: 13,
    podiums: 17,
    championships: 2,
    bestChampionshipPosition: 1,
    firstSeason: 1950,
    lastSeason: 1955,
  }),
  driver({
    ref: 'barrichello',
    forename: 'Rubens',
    surname: 'Barrichello',
    code: 'BAR',
    nationality: 'Brazilian',
    countryCode: 'BRA',
    races: 326,
    starts: 322,
    wins: 11,
    podiums: 68,
    bestChampionshipPosition: 2,
    firstSeason: 1993,
    lastSeason: 2011,
  }),
  driver({
    ref: 'alesi',
    forename: 'Jean',
    surname: 'Alesi',
    nationality: 'French',
    countryCode: 'FRA',
    races: 202,
    starts: 201,
    wins: 0,
    podiums: 32,
    bestChampionshipPosition: 4,
    firstSeason: 1989,
    lastSeason: 2001,
  }),
  driver({
    ref: 'crawford',
    forename: 'Jak',
    surname: 'Crawford',
    nationality: 'American',
    countryCode: 'USA',
    races: 1,
    starts: 1,
    firstSeason: 2026,
    lastSeason: 2026,
  }),
  driver({
    ref: 'amati',
    forename: 'Giovanna',
    surname: 'Amati',
    nationality: 'Italian',
    countryCode: 'ITA',
    races: 3,
    starts: 0,
    firstSeason: 1992,
    lastSeason: 1992,
  }),
  driver({
    ref: 'ecclestone',
    forename: 'Bernie',
    surname: 'Ecclestone',
    races: 0,
    starts: 0,
    firstSeason: null,
    lastSeason: null,
  }),
];

function renderDrivers(rows: DriverListItem[] = DRIVERS) {
  return render(
    <MemoryRouter>
      <DriverIndexPage
        data={{ drivers: rows }}
        pending={false}
        error={null}
        onRetry={() => undefined}
      />
    </MemoryRouter>,
  );
}

function renderCircuits(rows: CircuitListItem[]) {
  return render(
    <MemoryRouter>
      <CircuitIndexPage
        data={{ circuits: rows }}
        pending={false}
        error={null}
        onRetry={() => undefined}
      />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

/**
 * The group headings' labels, in order.
 *
 * `aria-label` is read rather than the accessible name because the masthead and the board are also
 * `region`s — both are named by `aria-labelledby`, so they contribute a `null` here and are
 * filtered out.
 */
function groupLabels(): string[] {
  return screen
    .getAllByRole('region')
    .map((group) => group.getAttribute('aria-label'))
    .filter((label): label is string => label !== null);
}

/** Every row's accessible name, in render order. */
function rowNames(): string[] {
  return screen.getAllByRole('link').map((link) => link.getAttribute('aria-label') ?? '');
}

/* ========================================================================================= */

describe('the page is about something before it is a list', () => {
  it('draws the population as a ladder, one rung per stratum, each with its own count', () => {
    renderDrivers();
    const ladder = screen.getByRole('group', { name: 'How far they got' });
    expect(
      within(ladder)
        .getAllByRole('button')
        .map((rung) => rung.getAttribute('aria-label')),
    ).toEqual([
      'Champions: 2 drivers — won a drivers’ title',
      'Race winners: 1 drivers — won a Grand Prix, never a title',
      'Podium finishers: 1 drivers — reached a podium, never won',
      'Grand Prix starters: 1 drivers — started, never a podium',
      'Never started: 2 drivers — in the record, never on a grid',
    ]);
  });

  it('makes the strata disjoint, so the rungs add up to the whole payload', () => {
    // A rung that reads 116 and filters to 80 rows is a page arguing with itself. Every bar's
    // count is exactly the number of rows clicking it produces.
    renderDrivers();
    const ladder = screen.getByRole('group', { name: 'How far they got' });
    const counts = within(ladder)
      .getAllByRole('button')
      .map((rung) => Number(/: (\d+) drivers/.exec(rung.getAttribute('aria-label') ?? '')?.[1]));
    expect(counts.reduce((total, count) => total + count, 0)).toBe(DRIVERS.length);
  });

  it('draws the decade collapse, counting an entity in every decade its span covers', () => {
    renderDrivers();
    const eras = screen.getByRole('group', { name: 'The field, by decade' });
    expect(
      within(eras)
        .getAllByRole('button')
        .map((column) => column.getAttribute('aria-label')),
    ).toEqual([
      '1950s: 1 drivers',
      '1960s: 0 drivers',
      '1970s: 0 drivers',
      '1980s: 1 drivers',
      '1990s: 3 drivers',
      '2000s: 3 drivers',
      '2010s: 2 drivers',
      '2020s: 2 drivers, a decade the record has not finished',
    ]);
  });

  it('states the pyramid in the masthead, every figure counted from the payload', () => {
    renderDrivers();
    expect(screen.getByText('7 in the record')).toBeTruthy();
    expect(screen.getByText('5 started a Grand Prix')).toBeTruthy();
    expect(screen.getByText('3 won one')).toBeTruthy();
    expect(screen.getByText('2 became champion')).toBeTruthy();
  });

  it('disables a rung nobody is in, rather than offering an empty result', () => {
    renderDrivers(DRIVERS.filter((row) => row.championships === 0));
    expect(
      screen.getByRole('button', { name: /^Champions: 0 drivers/ }).hasAttribute('disabled'),
    ).toBe(true);
  });
});

describe('the default view is not alphabetical — the whole complaint', () => {
  it('opens on the most decorated driver, not the first surname', () => {
    renderDrivers();
    // Alphabetically this list starts at Alesi. It opens on Hamilton because the default lens is
    // achievement and the merit vector is [titles, wins, podiums, best position, starts].
    expect(rowNames()[0]).toContain('Lewis Hamilton');
  });

  it('groups by achievement tier, in the ladder’s own order', () => {
    renderDrivers();
    expect(groupLabels()).toEqual([
      'Champions',
      'Race winners',
      'Podium finishers',
      'Grand Prix starters',
    ]);
  });

  it('orders inside a tier by merit — Hamilton before Ascari, not Ascari before Hamilton', () => {
    renderDrivers();
    const champions = rowNames().slice(0, 2);
    expect(champions[0]).toContain('Lewis Hamilton');
    expect(champions[1]).toContain('Alberto Ascari');
  });
});

describe('the ladder and the decades are controls, not decoration', () => {
  it('filters the list to a stratum and marks the rung pressed', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.click(screen.getByRole('button', { name: /^Champions:/ }));
    expect(rowNames()).toHaveLength(2);
    expect(screen.getByRole('button', { name: /^Champions:/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('releases the filter when the same rung is pressed again', async () => {
    const user = userEvent.setup();
    renderDrivers();
    const champions = screen.getByRole('button', { name: /^Champions:/ });
    await user.click(champions);
    await user.click(champions);
    expect(rowNames()).toHaveLength(5);
  });

  it('filters by decade', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.click(screen.getByRole('button', { name: '1950s: 1 drivers' }));
    expect(rowNames()).toHaveLength(1);
    expect(rowNames()[0]).toContain('Alberto Ascari');
  });

  it('intersects the two filters rather than replacing one with the other', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.click(screen.getByRole('button', { name: /^Champions:/ }));
    await user.click(screen.getByRole('button', { name: '2010s: 2 drivers' }));
    expect(rowNames()).toHaveLength(1);
    expect(rowNames()[0]).toContain('Lewis Hamilton');
  });

  it('leaves the ladder’s counts alone while a decade is selected', async () => {
    // Rule 4: the board measures the whole payload, exactly as the span rail's domain does. A
    // ladder that rescaled under a filter would make the same stratum say something different
    // depending on what else was on screen.
    const user = userEvent.setup();
    renderDrivers();
    await user.click(screen.getByRole('button', { name: '1950s: 1 drivers' }));
    expect(screen.getByRole('button', { name: /^Champions: 2 drivers/ })).toBeTruthy();
  });

  it('shows a chip for every live filter and releases it on click', async () => {
    const user = userEvent.setup();
    renderDrivers();
    expect(screen.queryByRole('button', { name: /^Remove the/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: /^Champions:/ }));
    await user.click(screen.getByRole('button', { name: '1950s: 1 drivers' }));
    expect(screen.getByRole('button', { name: 'Remove the Champions filter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove the 1950s filter' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Remove the 1950s filter' }));
    expect(screen.queryByRole('button', { name: 'Remove the 1950s filter' })).toBeNull();
    expect(rowNames()).toHaveLength(2);
  });

  it('explains an impossible combination instead of showing a blank panel', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.click(screen.getByRole('button', { name: /^Champions:/ }));
    await user.click(screen.getByRole('button', { name: '1980s: 1 drivers' }));
    expect(screen.getByText('No driver is in every group you have selected.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Show all drivers' }));
    expect(rowNames()).toHaveLength(5);
  });

  it('reports the intersection in the live count, since the ladder does not', async () => {
    const user = userEvent.setup();
    renderDrivers();
    expect(screen.getByText('7 drivers')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Champions:/ }));
    expect(screen.getByText('2 of 7 drivers')).toBeTruthy();
  });
});

describe('the drivers who never started — kept in the record, out of the browse', () => {
  it('leaves them out of the default list', () => {
    renderDrivers();
    expect(screen.queryByRole('link', { name: /Bernie Ecclestone/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Giovanna Amati/ })).toBeNull();
  });

  /*
   * **28 drivers in the real archive entered a Grand Prix and started none.** Keying this on
   * `races > 0` would miss every one of them: Amati has three entries and no start, so she would
   * be filed with the drivers who raced and would carry no marker of any kind.
   */
  it('counts them in a footnote under the list, and reveals them on one click', async () => {
    const user = userEvent.setup();
    renderDrivers();
    expect(
      screen.getByText('2 of the 7 drivers in the record never started a Grand Prix.'),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Show them' }));
    expect(screen.getByRole('link', { name: /Bernie Ecclestone/ }).getAttribute('href')).toBe(
      '/drivers/ecclestone',
    );
    expect(screen.getByRole('link', { name: /Giovanna Amati/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide them' })).toBeTruthy();
  });

  it('shows the stratum when it is selected on the ladder, toggle or no toggle', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.click(screen.getByRole('button', { name: /^Never started:/ }));
    expect(rowNames()).toHaveLength(2);
    // …and the footnote gets out of the way, because the ladder is already answering it.
    expect(screen.queryByRole('button', { name: 'Show them' })).toBeNull();
  });

  it('marks the row and never dresses an absence as a zero', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.click(screen.getByRole('button', { name: 'Show them' }));
    const row = screen.getByRole('link', { name: /Bernie Ecclestone/ });
    expect(within(row).getByText('Never started')).toBeTruthy();
    // `0` starts, `0` wins and `0` podiums are measured; the debut year is genuinely absent,
    // because `firstSeason` is null exactly when `races` is 0.
    expect(within(row).getAllByText('0')).toHaveLength(3);
    expect(within(row).getAllByText('—')).toHaveLength(1);
  });

  it('names such a row by what is true of them, not by a run of zeroes', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.click(screen.getByRole('button', { name: 'Show them' }));
    expect(
      screen.getByRole('link', {
        name: 'Bernie Ecclestone, British, never started a Grand Prix',
      }),
    ).toBeTruthy();
    // Amati was entered in 1992, so her row says so — a season she was in is not a season she
    // raced in, and the two are different sentences.
    expect(
      screen.getByRole('link', {
        name: 'Giovanna Amati, Italian, never started a Grand Prix, 1992',
      }),
    ).toBeTruthy();
  });

  it('shows no footnote at all when everyone in the payload started', () => {
    renderDrivers(DRIVERS.filter((row) => row.starts > 0));
    expect(screen.queryByText(/never started a Grand Prix\./)).toBeNull();
  });
});

describe('the front door — every row goes somewhere', () => {
  it('links each driver to their profile, which is the whole point of the page', () => {
    renderDrivers();
    expect(screen.getByRole('link', { name: /Lewis Hamilton/ }).getAttribute('href')).toBe(
      '/drivers/hamilton',
    );
    expect(screen.getByRole('link', { name: /Alberto Ascari/ }).getAttribute('href')).toBe(
      '/drivers/ascari',
    );
  });

  it('names each link as a sentence rather than as a run of cell values', () => {
    renderDrivers();
    expect(
      screen.getByRole('link', {
        name: 'Lewis Hamilton, British, 371 starts, 105 wins, 7-time world champion, 2007 to 2026',
      }),
    ).toBeTruthy();
  });

  it('says "0 wins" for a driver who started 201 times and never won — a measured zero', () => {
    renderDrivers();
    expect(
      screen.getByRole('link', { name: 'Jean Alesi, French, 201 starts, 0 wins, 1989 to 2001' }),
    ).toBeTruthy();
  });

  it('marks a champion beside the name and states the count in words as well', () => {
    renderDrivers();
    const row = screen.getByRole('link', { name: /Lewis Hamilton/ });
    // The glyph is `aria-hidden`; the accessible name carries the fact. Never icon alone.
    expect(within(row).getByText('×7')).toBeTruthy();
    expect(row.getAttribute('aria-label')).toContain('7-time world champion');
  });
});

describe('search', () => {
  it('finds an accented surname from an ASCII query', async () => {
    const user = userEvent.setup();
    renderDrivers([
      ...DRIVERS,
      driver({
        ref: 'raikkonen',
        forename: 'Kimi',
        surname: 'Räikkönen',
        code: 'RAI',
        races: 353,
        starts: 349,
        wins: 21,
        podiums: 103,
        championships: 1,
        bestChampionshipPosition: 1,
        firstSeason: 2001,
        lastSeason: 2021,
      }),
    ]);
    await user.type(screen.getByRole('searchbox', { name: 'Search drivers' }), 'raikkonen');
    expect(screen.getByRole('link', { name: /Kimi Räikkönen/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Lewis Hamilton/ })).toBeNull();
  });

  it('matches a three-letter code, which is what an F1 reader types', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.type(screen.getByRole('searchbox', { name: 'Search drivers' }), 'HAM');
    expect(screen.getByRole('link', { name: /Lewis Hamilton/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Jean Alesi/ })).toBeNull();
  });

  it('matches a nationality, which is the only nationality filter there is', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.type(screen.getByRole('searchbox', { name: 'Search drivers' }), 'french');
    expect(screen.getByRole('link', { name: /Jean Alesi/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Lewis Hamilton/ })).toBeNull();
  });

  it('explains an empty result and offers a way out — never a blank panel', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.type(screen.getByRole('searchbox', { name: 'Search drivers' }), 'zzz');
    expect(screen.getByText('No driver matches “zzz”.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Show all drivers' }));
    expect(screen.getByRole('link', { name: /Lewis Hamilton/ })).toBeTruthy();
  });

  it('clears on Escape without losing the field', async () => {
    const user = userEvent.setup();
    renderDrivers();
    const field = screen.getByRole('searchbox', { name: 'Search drivers' });
    await user.type(field, 'zzz');
    await user.keyboard('{Escape}');
    expect((field as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('link', { name: /Lewis Hamilton/ })).toBeTruthy();
  });

  it('still offers the code on the driver page, where the sport does use one', () => {
    renderDrivers();
    expect(
      screen.getByRole('searchbox', { name: 'Search drivers' }).getAttribute('placeholder'),
    ).toBe('Search a name, a code or a nationality');
  });

  it('shows the clear control only when there is something to clear', async () => {
    const user = userEvent.setup();
    renderDrivers();
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    await user.type(screen.getByRole('searchbox', { name: 'Search drivers' }), 'a');
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeTruthy();
  });
});

describe('the lens — one control, four readings of the same population', () => {
  it('offers four lenses as real radios, so the platform supplies the keyboard behaviour', () => {
    renderDrivers();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => (radio as HTMLInputElement).value)).toEqual([
      'tier',
      'era',
      'career',
      'az',
    ]);
    // Achievement, not A–Z. This assertion *is* the redesign.
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
  });

  it('regroups by decade under Era', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.click(screen.getByRole('radio', { name: 'Era' }));
    expect(groupLabels()).toEqual(['1950s', '1980s', '1990s', '2000s', '2020s']);
  });

  it('regroups by career length under Career, longest first', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.click(screen.getByRole('radio', { name: 'Career' }));
    expect(groupLabels()).toEqual(['150 starts or more', '11–49 starts', 'A single start']);
  });

  it('regroups by initial letter under A–Z, surname first', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.click(screen.getByRole('radio', { name: 'A–Z' }));
    expect(groupLabels()).toEqual(['A', 'B', 'C', 'H']);
  });

  it('keeps the board’s filter across a lens change', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.click(screen.getByRole('button', { name: /^Champions:/ }));
    await user.click(screen.getByRole('radio', { name: 'A–Z' }));
    expect(rowNames()).toHaveLength(2);
    expect(groupLabels()).toEqual(['A', 'H']);
  });
});

describe('teams are the same surface, with a sharper pyramid', () => {
  const TEAMS: TeamListItem[] = [
    team({
      ref: 'ferrari',
      name: 'Ferrari',
      races: 1134,
      wins: 250,
      podiums: 845,
      championships: 16,
      bestChampionshipPosition: 1,
      firstSeason: 1950,
      lastSeason: 2026,
    }),
    team({ ref: 'jordan', name: 'Jordan', races: 250, wins: 4, podiums: 19, firstSeason: 1991 }),
    team({ ref: 'life', name: 'Life', races: 0, firstSeason: null, lastSeason: null }),
  ];

  function renderTeams() {
    return render(
      <MemoryRouter>
        <TeamIndexPage
          data={{ teams: TEAMS }}
          pending={false}
          error={null}
          onRetry={() => undefined}
        />
      </MemoryRouter>,
    );
  }

  /**
   * A team has no three-letter code — that is a driver concept — and the copy claimed it did on
   * both the placeholder and the empty-search help. Caught in Rishabh's capture.
   */
  it('never offers to search a team by a code, because a team has none', () => {
    renderTeams();
    const field = screen.getByRole('searchbox', { name: 'Search teams' });
    expect(field.getAttribute('placeholder')).toBe('Search a team or a nationality');
    expect(field.getAttribute('placeholder')).not.toContain('code');
  });

  it('keeps the code out of the empty-search help as well', async () => {
    const user = userEvent.setup();
    renderTeams();
    await user.type(screen.getByRole('searchbox', { name: 'Search teams' }), 'zzz');
    expect(
      screen.getByText('Search matches a team name, a nationality or the reference in the URL.'),
    ).toBeTruthy();
  });

  it('renders under the heading the dock links with, and links to a profile', () => {
    renderTeams();
    // `Teams`, matching `navItems.ts`. A nav item and the page it lands on must agree — the route
    // table in `RootLayout.test.tsx` caught this when the heading read `Constructors`.
    expect(screen.getByRole('heading', { level: 1, name: 'Teams' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Ferrari/ }).getAttribute('href')).toBe(
      '/teams/ferrari',
    );
  });

  it('uses the sport’s own word on the top rung, since a constructors’ title is not a drivers’ one', () => {
    renderTeams();
    expect(screen.getByRole('button', { name: /^Constructors’ champions: 1 teams/ })).toBeTruthy();
  });

  it('keeps the team that entered and never started out of the browse', () => {
    renderTeams();
    expect(screen.queryByRole('link', { name: /Life/ })).toBeNull();
    expect(
      screen.getByText('1 of the 3 teams in the record never started a Grand Prix.'),
    ).toBeTruthy();
  });
});

describe('circuits are the same surface, with a map instead of a decade chart', () => {
  const CIRCUITS: CircuitListItem[] = [
    circuit({ ref: 'monza', name: 'Autodromo Nazionale di Monza' }),
    circuit({
      ref: 'madring',
      name: 'Madring',
      locality: 'Madrid',
      country: 'Spain',
      latitude: 40.4657,
      longitude: -3.6167,
      roundsHeld: 1,
      racesWithResults: 0,
      firstYear: null,
      lastYear: null,
      lastScheduledYear: 2026,
    }),
    circuit({
      ref: 'imola',
      name: 'Autodromo Enzo e Dino Ferrari',
      locality: 'Imola',
      latitude: 44.3439,
      longitude: 11.7167,
      roundsHeld: 31,
      racesWithResults: 31,
      firstYear: 1980,
      lastYear: 2025,
      lastScheduledYear: 2025,
    }),
    circuit({
      ref: 'kyalami',
      name: 'Kyalami',
      locality: 'Midrand',
      country: 'South Africa',
      latitude: -25.9894,
      longitude: 28.0767,
      roundsHeld: 20,
      racesWithResults: 20,
      firstYear: 1967,
      lastYear: 1993,
      lastScheduledYear: 1993,
    }),
  ];

  it('stratifies by the calendar, reading lastScheduledYear and never lastYear', () => {
    // `lastYear === latest` would file Monza as retired for most of a season: 2026 is 10 of 22
    // rounds in and half the calendar has no result yet. Madring has never raced and *is* current.
    renderCircuits(CIRCUITS);
    const ladder = screen.getByRole('group', { name: 'Where they stand' });
    expect(
      within(ladder)
        .getAllByRole('button')
        .map((rung) => rung.getAttribute('aria-label')),
    ).toEqual([
      'On the 2026 calendar: 2 circuits — a numbered round this season, run or still to come',
      'Last used in 2025: 1 circuits — on the previous calendar and not this one',
      'No longer used: 1 circuits — no round since 2024 or earlier',
    ]);
  });

  it('calls a scheduled venue “not yet raced”, never “never raced”', () => {
    renderCircuits(CIRCUITS);
    const row = screen.getByRole('link', { name: /Madring/ });
    expect(within(row).getByText('Not yet raced')).toBeTruthy();
    expect(screen.queryByText('Never raced')).toBeNull();
  });

  it('names a circuit link by its place, and says plainly that nothing has run there', () => {
    renderCircuits(CIRCUITS);
    expect(
      screen.getByRole('link', { name: 'Madring, Madrid, Spain, no Grand Prix run here yet' }),
    ).toBeTruthy();
  });

  it('plots every venue on one graticule, with a summary a screen reader can use', () => {
    renderCircuits(CIRCUITS);
    expect(
      screen.getByRole('img', {
        name: '4 Formula 1 venues, plotted by latitude and longitude: 2 on the 2026 calendar, 2 not on it.',
      }),
    ).toBeTruthy();
  });

  /**
   * ⚠ **The board carried one phrase with two numbers.** The ladder's third rung reads
   * `No longer used 53` and the legend 200px to its right read `No longer used 56`. A map is a
   * two-way split and the ladder is a three-way one, so the legend's complement needs its own
   * words — the same defect, and the same fix, as the circuit masthead's two counts.
   */
  it('never repeats the ladder’s own phrase against a different number', () => {
    renderCircuits(CIRCUITS);
    // `No longer used` may appear twice — the ladder rung and the group header it produces — but
    // both are the same three-way category carrying the same count. What must not happen is the
    // legend borrowing it for its *complement*, which is a different set and a different number.
    const key = screen.getByText('Not on it').closest('p');
    expect(key?.textContent).not.toContain('No longer used');
    for (const node of screen.getAllByText('No longer used')) {
      expect(node.closest('p')).not.toBe(key);
    }
  });

  it('closes the legend’s two counts against the venue total', () => {
    renderCircuits(CIRCUITS);
    const key = screen.getByText('Not on it').closest('p');
    const counts = [...(key?.querySelectorAll('b') ?? [])].map((node) => Number(node.textContent));
    expect(counts.reduce((total, count) => total + count, 0)).toBe(CIRCUITS.length);
  });

  it('never turns the map into 78 tab stops in front of the list', () => {
    // `SeasonDial`'s decision on a bigger mark: one `role="img"`, one accessible name. The list is
    // the navigable surface.
    renderCircuits(CIRCUITS);
    const atlas = screen.getByRole('img', { name: /Formula 1 venues/ });
    expect(within(atlas).queryAllByRole('link')).toHaveLength(0);
    expect(within(atlas).queryAllByRole('button')).toHaveLength(0);
  });

  /* ------------------------------------------------------------ the coastline, §7.15 */

  it('draws the generated coastline verbatim, with no transform and no wrapper', () => {
    renderCircuits(CIRCUITS);
    const land = screen
      .getByRole('img', { name: /Formula 1 venues/ })
      .querySelector('path.atlas-land');
    expect(land).toBeTruthy();
    /*
     * Verbatim, character for character. `WORLD_LAND_PATH` is already in this viewBox's
     * coordinate space, so any wrapping, scaling or re-serialising of it is a coordinate bug of
     * exactly CR-007's kind — the pointer spotlight written in `%` instead of px, drawn outside
     * its element, invisible to jsdom. The subpath order is asserted by the same equality: the
     * Caspian is a hole and it must stay behind the ring it belongs to.
     */
    expect(land?.getAttribute('d')).toBe(WORLD_LAND_PATH);
    expect(land?.getAttribute('transform')).toBeNull();
    expect(land?.parentElement?.tagName.toLowerCase()).toBe('svg');
  });

  /**
   * ⚠ **No `fill-rule` in the markup either.** The CSS test asserts the stylesheet does not set
   * one; this asserts the attribute is absent too, because a presentation attribute would beat
   * nothing at all and lose to the stylesheet, which is precisely the sort of half-working
   * override that survives review.
   */
  it('leaves the fill-rule at the SVG default, so the Caspian punches out', () => {
    renderCircuits(CIRCUITS);
    const svg = screen.getByRole('img', { name: /Formula 1 venues/ });
    for (const node of svg.querySelectorAll('*')) {
      expect(node.getAttribute('fill-rule')).toBeNull();
    }
  });

  /**
   * ⚠ **Paint order is this component's correctness, and SVG has no z-index.**
   *
   * Plate → coastline → graticule → pips → neatline. Land after the plate or it is invisible;
   * land *before* the pips or seventy-eight venues are buried under the continents they sit on;
   * the neatline after everything or the border is eaten, because land now reaches x = 0,
   * x = 360 and y = 180. Every one of those is a silent failure in jsdom — the element exists,
   * the attributes are right, and the picture is wrong — so document order is asserted directly.
   */
  it('paints plate, then land, then graticule, then pips, then the neatline', () => {
    renderCircuits(CIRCUITS);
    const svg = screen.getByRole('img', { name: /Formula 1 venues/ });
    const children = [...svg.children];
    const at = (selector: string) => children.findIndex((node) => node.matches(selector));
    const last = (selector: string) =>
      children.length - 1 - [...children].reverse().findIndex((node) => node.matches(selector));

    const frame = at('.locator-frame');
    const land = at('.atlas-land');
    const graticule = at('.locator-graticule, .locator-prime');
    const firstPip = at('.atlas-pip');
    const neatline = at('.atlas-neatline');

    expect(frame).toBeGreaterThanOrEqual(0);
    expect(land).toBeGreaterThan(frame);
    expect(graticule).toBeGreaterThan(land);
    expect(firstPip).toBeGreaterThan(land);
    expect(neatline).toBe(children.length - 1);
    expect(neatline).toBeGreaterThan(last('.atlas-pip'));
  });

  /**
   * A retired pip must still be painted before a current one — the pre-existing rule, restated
   * here because the coastline was inserted into the middle of that sequence and an insertion is
   * exactly when an ordering gets shuffled.
   */
  it('still paints every retired pip before every current one', () => {
    renderCircuits(CIRCUITS);
    const pips = [
      ...screen.getByRole('img', { name: /Formula 1 venues/ }).querySelectorAll('.atlas-pip'),
    ].map((node) => node.getAttribute('data-current'));
    expect(pips).toContain('false');
    expect(pips).toContain('true');
    expect(pips.lastIndexOf('false')).toBeLessThan(pips.indexOf('true'));
  });

  it('has no decade chart at all — that column is the map', () => {
    renderCircuits(CIRCUITS);
    expect(screen.queryByRole('group', { name: 'Venues, by decade' })).toBeNull();
  });

  it('shows no footnote, because a venue joining the calendar is not clutter', () => {
    renderCircuits(CIRCUITS);
    expect(screen.queryByRole('button', { name: 'Show them' })).toBeNull();
  });
});

describe('states', () => {
  it('holds the panel and the board open with skeletons while the query is in flight', () => {
    render(
      <MemoryRouter>
        <DriverIndexPage data={null} pending error={null} onRetry={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('list', { name: 'Loading' })).toBeTruthy();
    // Two more busy regions on the board — the ladder and the decade columns — so nothing below
    // them moves when the payload lands.
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('offers a retry on an error, and never a blank page', () => {
    const onRetry = vi.fn();
    render(
      <MemoryRouter>
        <DriverIndexPage
          data={null}
          pending={false}
          error={{ code: 'INTERNAL' }}
          onRetry={onRetry}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Drivers' })).toBeTruthy();
    expect(screen.getByText('These drivers could not be loaded')).toBeTruthy();
    expect(screen.getByText('INTERNAL')).toBeTruthy();
  });

  /**
   * A `QueryClientProvider` only for this case: `DataUnavailableState` invalidates the `/api/meta`
   * key on retry, so it needs a client. Nothing else on this page fetches — the route above it
   * does — which is why no other test in this file has one.
   */
  it('shows the missing-database state instead of an empty list', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <DriverIndexPage
            data={null}
            pending={false}
            error={{ code: 'DATABASE_UNAVAILABLE' }}
            onRetry={() => undefined}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('says the record is empty rather than showing a blank panel', () => {
    renderDrivers([]);
    expect(screen.getByText('The record holds no drivers.')).toBeTruthy();
  });
});
