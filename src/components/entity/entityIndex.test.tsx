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
import { CircuitIndexPage } from '@/features/circuit/CircuitIndexPage';
import { DriverIndexPage } from '@/features/driver/DriverIndexPage';
import { TeamIndexPage } from '@/features/team/TeamIndexPage';

/**
 * **What this file can prove, and what it cannot.**
 *
 * jsdom performs no layout and no compositing, so nothing here asserts where the span rail's
 * bracket lands, whether the console sticks, whether `content-visibility` skips anything, or what
 * colour an identity bar resolves to — a custom property reads as `''` in this environment. Those
 * are **untested by construction** and named as such in the hand-off; the geometry behind the rail
 * is asserted arithmetically in `indexModel.test.ts` instead.
 *
 * What *is* decidable is the behaviour contract, and every case below is a row in the database:
 *
 * - **63 of 881 drivers never started a Grand Prix.** They must be listed, marked, and must not
 *   render identically to a driver with a career.
 * - **Madring has a numbered 2026 round and no result.** It is *not yet raced*, never *never*.
 * - **`Räikkönen` must be findable by typing `raikkonen`** — SQLite's BINARY collation is why the
 *   sort and the search are client-side at all.
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
  firstSeason: 1990,
  lastSeason: 2000,
  ...over,
});

const team = (over: Partial<TeamListItem> & Pick<TeamListItem, 'ref' | 'name'>): TeamListItem => ({
  nationality: 'Italian',
  countryCode: 'ITA',
  races: 100,
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
  roundsHeld: 76,
  racesWithResults: 75,
  firstYear: 1950,
  lastYear: 2026,
  ...over,
});

const DRIVERS: DriverListItem[] = [
  driver({
    ref: 'hamilton',
    forename: 'Lewis',
    surname: 'Hamilton',
    code: 'HAM',
    races: 372,
    firstSeason: 2007,
    lastSeason: 2026,
  }),
  driver({
    ref: 'raikkonen',
    forename: 'Kimi',
    surname: 'Räikkönen',
    code: 'RAI',
    nationality: 'Finnish',
    countryCode: 'FIN',
    races: 349,
    firstSeason: 2001,
    lastSeason: 2021,
  }),
  driver({
    ref: 'ascari',
    forename: 'Alberto',
    surname: 'Ascari',
    nationality: 'Italian',
    countryCode: 'ITA',
    races: 32,
    firstSeason: 1950,
    lastSeason: 1955,
  }),
  /* The state this feature exists to get right: in the record, never on a grid. */
  driver({
    ref: 'ecclestone',
    forename: 'Bernie',
    surname: 'Ecclestone',
    races: 0,
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

afterEach(cleanup);

/**
 * The group headings' labels, in order.
 *
 * `aria-label` is read rather than the accessible name because the masthead is also a `region` —
 * it is named by `aria-labelledby`, so it contributes a `null` here and is filtered out. Reading
 * accessible names instead would have made "no grouping" assert against a list containing the
 * page's own title.
 */
function groupLabels(): string[] {
  return screen
    .getAllByRole('region')
    .map((group) => group.getAttribute('aria-label'))
    .filter((label): label is string => label !== null);
}

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

  it('links a driver with no career too — the profile exists and is otherwise unreachable', () => {
    renderDrivers();
    expect(screen.getByRole('link', { name: /Bernie Ecclestone/ }).getAttribute('href')).toBe(
      '/drivers/ecclestone',
    );
  });

  it('names each link as a sentence rather than as a run of cell values', () => {
    renderDrivers();
    expect(
      screen.getByRole('link', { name: 'Lewis Hamilton, British, 372 races, 2007 to 2026' }),
    ).toBeTruthy();
  });

  it('names a raceless driver by what is true of them, not by a row of zeroes', () => {
    renderDrivers();
    expect(
      screen.getByRole('link', {
        name: 'Bernie Ecclestone, British, never started a Grand Prix',
      }),
    ).toBeTruthy();
  });
});

describe('a driver who never raced does not render like one who did', () => {
  it('marks the row, states the count once above the list, and lists them all the same', () => {
    renderDrivers();
    const row = screen.getByRole('link', { name: /Bernie Ecclestone/ });
    expect(within(row).getByText('Never raced')).toBeTruthy();
    expect(
      screen.getByText(/1 of the 4 drivers in the record never started a Grand Prix\./),
    ).toBeTruthy();
  });

  it('prints the measured 0 for races and an em-dash for the seasons that do not exist', () => {
    renderDrivers();
    const row = screen.getByRole('link', { name: /Bernie Ecclestone/ });
    // `0` is what the query counted. `firstSeason` is null *exactly* when races is 0, so printing
    // a `0` there would state a season that never happened — §1.0's absent-vs-zero distinction.
    expect(within(row).getByText('0')).toBeTruthy();
    expect(within(row).getAllByText('—')).toHaveLength(2);
  });

  it('shows no notice at all when every entity raced', () => {
    renderDrivers(DRIVERS.filter((row) => row.races > 0));
    expect(screen.queryByText(/never started a Grand Prix\./)).toBeNull();
  });
});

describe('search', () => {
  it('finds an accented surname from an ASCII query', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.type(screen.getByRole('searchbox', { name: 'Search drivers' }), 'raikkonen');
    expect(screen.getByRole('link', { name: /Kimi Räikkönen/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Lewis Hamilton/ })).toBeNull();
  });

  it('matches a three-letter code, which is what an F1 reader types', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.type(screen.getByRole('searchbox', { name: 'Search drivers' }), 'HAM');
    expect(screen.getByRole('link', { name: /Lewis Hamilton/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Alberto Ascari/ })).toBeNull();
  });

  it('matches a nationality, which is the only nationality filter there is', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.type(screen.getByRole('searchbox', { name: 'Search drivers' }), 'italian');
    expect(screen.getByRole('link', { name: /Alberto Ascari/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Kimi Räikkönen/ })).toBeNull();
  });

  it('reports the filtered count against the total, live', async () => {
    const user = userEvent.setup();
    renderDrivers();
    expect(screen.getByText('4 drivers')).toBeTruthy();
    await user.type(screen.getByRole('searchbox', { name: 'Search drivers' }), 'italian');
    expect(screen.getByText('1 of 4 drivers')).toBeTruthy();
    expect(screen.queryByText('4 drivers')).toBeNull();
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

  it('shows the clear control only when there is something to clear', async () => {
    const user = userEvent.setup();
    renderDrivers();
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    await user.type(screen.getByRole('searchbox', { name: 'Search drivers' }), 'a');
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeTruthy();
  });
});

describe('sort — and the grouping that follows from it', () => {
  it('groups by initial letter under A–Z, with a count per letter', () => {
    renderDrivers();
    // Surname-first ordering, so Ascari files under A and Räikkönen under R.
    expect(groupLabels()).toEqual(['A', 'E', 'H', 'R']);
  });

  it('regroups by decade when the sort becomes Debut', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.click(screen.getByRole('radio', { name: 'Debut' }));
    expect(groupLabels()).toEqual(['1950s', '2000s', 'No season recorded']);
  });

  it('drops the grouping entirely for a metric sort, since a ranking has no bucket', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.click(screen.getByRole('radio', { name: 'Races' }));
    expect(groupLabels()).toEqual([]);
  });

  it('puts the raceless driver last under a descending metric sort, never first', async () => {
    const user = userEvent.setup();
    renderDrivers();
    await user.click(screen.getByRole('radio', { name: 'Races' }));
    const names = screen.getAllByRole('link').map((link) => link.getAttribute('aria-label') ?? '');
    expect(names[0]).toContain('Lewis Hamilton');
    expect(names.at(-1)).toContain('Bernie Ecclestone');
  });

  it('offers the sort as real radios, so the platform supplies the keyboard behaviour', () => {
    renderDrivers();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => (radio as HTMLInputElement).value)).toEqual([
      'az',
      'debut',
      'races',
    ]);
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
  });
});

describe('the other two indexes are the same surface', () => {
  it('renders constructors with their own noun and links to a team profile', () => {
    render(
      <MemoryRouter>
        <TeamIndexPage
          data={{ teams: [team({ ref: 'ferrari', name: 'Ferrari', races: 1105 })] }}
          pending={false}
          error={null}
          onRetry={() => undefined}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Constructors' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Ferrari/ }).getAttribute('href')).toBe(
      '/teams/ferrari',
    );
    expect(screen.getByText('1 constructors')).toBeTruthy();
  });

  it('calls a scheduled venue “not yet raced”, never “never raced”', () => {
    render(
      <MemoryRouter>
        <CircuitIndexPage
          data={{
            circuits: [
              circuit({ ref: 'monza', name: 'Autodromo Nazionale di Monza' }),
              circuit({
                ref: 'madring',
                name: 'Madring',
                locality: 'Madrid',
                country: 'Spain',
                roundsHeld: 1,
                racesWithResults: 0,
                firstYear: null,
                lastYear: null,
              }),
            ],
          }}
          pending={false}
          error={null}
          onRetry={() => undefined}
        />
      </MemoryRouter>,
    );
    const row = screen.getByRole('link', { name: /Madring/ });
    expect(within(row).getByText('Not yet raced')).toBeTruthy();
    expect(screen.queryByText('Never raced')).toBeNull();
    expect(
      screen.getByText(/1 of these circuits has a numbered round and no result yet\./),
    ).toBeTruthy();
    // The two numbers are two facts: the round is scheduled, the race has not been run.
    expect(within(row).getByText('1')).toBeTruthy();
  });

  it('names a circuit link by its place, and says plainly that nothing has run there', () => {
    render(
      <MemoryRouter>
        <CircuitIndexPage
          data={{
            circuits: [
              circuit({
                ref: 'madring',
                name: 'Madring',
                locality: 'Madrid',
                country: 'Spain',
                roundsHeld: 1,
                racesWithResults: 0,
                firstYear: null,
                lastYear: null,
              }),
            ],
          }}
          pending={false}
          error={null}
          onRetry={() => undefined}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('link', { name: 'Madring, Madrid, Spain, no Grand Prix run here yet' }),
    ).toBeTruthy();
  });
});

describe('states', () => {
  it('holds the panel open with skeleton rows while the query is in flight', () => {
    render(
      <MemoryRouter>
        <DriverIndexPage data={null} pending error={null} onRetry={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('list', { name: 'Loading' })).toBeTruthy();
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

describe('the masthead counts what it was given', () => {
  it('states the total, the span and how many are still going', () => {
    renderDrivers();
    expect(screen.getByRole('heading', { level: 1, name: 'Drivers' })).toBeTruthy();
    // `4 in the record`, deliberately worded differently from the console's live `4 drivers`:
    // the two would otherwise be the same sentence twice, 40px apart.
    expect(screen.getByText('4 in the record')).toBeTruthy();
    expect(screen.getByText('1950–2026')).toBeTruthy();
    expect(screen.getByText('1 racing in 2026')).toBeTruthy();
  });
});
