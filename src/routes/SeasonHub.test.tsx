// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { META_REAL } from '@schemas/meta.fixture';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Season, SeasonList } from '@schemas/season';
import { selectSeasonNotices } from '@/features/season/selectors';
import { SeasonHub } from './SeasonHub';

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

/**
 * **The surface assembled, against real payload shapes.**
 *
 * The unit files below `features/season/` prove the shaping; this one proves the three queries,
 * the selectors, the presenters and five components **compose without throwing** — which is the
 * one failure mode none of them can see individually and the one that would greet Rishabh as a
 * blank page.
 *
 * It cannot see layout. jsdom has no layout, no `ResizeObserver` and no `getBBox`, so the row
 * grid, the dial's tick widths, the sticky standings column and the identity bar's rendered colour
 * are **untested by construction** and are named as such in the hand-off.
 *
 * The fixtures are trimmed real rows — 2026's two unnumbered cancellations and 1950's best-4
 * scoring with no Constructors' Championship — because those are the two seasons whose designed
 * states differ most from a mock.
 */

const round = (
  over: Partial<Season['rounds'][number]> &
    Pick<Season['rounds'][number], 'round' | 'date' | 'name'>,
): Season['rounds'][number] => ({
  circuitRef: 'albert_park',
  circuitName: 'Albert Park Grand Prix Circuit',
  hasResults: true,
  hasSprint: false,
  hasLapData: true,
  winners: [],
  ...over,
});

const RUSSELL = {
  driverRef: 'russell',
  code: 'RUS',
  forename: 'George',
  surname: 'Russell',
  team: { ref: 'mercedes', name: 'Mercedes' },
  points: 25,
};

const SEASON_2026: Season = {
  year: 2026,
  scheduledRounds: 22,
  completedRounds: 2,
  isComplete: false,
  rounds: [
    round({ round: 1, name: 'Australian Grand Prix', date: '2026-03-08', winners: [RUSSELL] }),
    round({ round: 2, name: 'Chinese Grand Prix', date: '2026-05-03', hasResults: false }),
  ],
  cancelledRounds: [
    {
      name: 'Bahrain Grand Prix',
      date: '2026-04-12',
      circuitRef: 'bahrain',
      circuitName: 'Bahrain International Circuit',
    },
  ],
  scoring: {
    systemRef: 's2026',
    systemName: '2026 - Present Championship',
    driverCounting: 'all',
    driverBestResults: null,
    teamCounting: 'all',
    teamBestResults: null,
  },
  standings: {
    asOfRound: 1,
    drivers: [
      {
        position: 1,
        driverRef: 'antonelli',
        code: 'ANT',
        forename: 'Andrea Kimi',
        surname: 'Antonelli',
        nationality: 'Italian',
        points: 204,
        wins: 6,
        bestFinish: 1,
        teams: [{ ref: 'mercedes', name: 'Mercedes', firstRound: 1, lastRound: 2, entries: 2 }],
        adjustment: 'none',
      },
    ],
    teams: [
      {
        position: 1,
        teamRef: 'mercedes',
        name: 'Mercedes',
        nationality: 'German',
        points: 358,
        wins: 8,
        bestFinish: 1,
        adjustment: 'none',
      },
    ],
  },
};

/** 1950 — best-4 scoring, no Constructors' Championship, and no lap data at all. */
const SEASON_1950: Season = {
  year: 1950,
  scheduledRounds: 1,
  completedRounds: 1,
  isComplete: true,
  rounds: [
    round({
      round: 1,
      name: 'British Grand Prix',
      date: '1950-05-13',
      circuitRef: 'silverstone',
      circuitName: 'Silverstone Circuit',
      hasLapData: false,
      winners: [
        {
          driverRef: 'farina',
          code: null,
          forename: 'Nino',
          surname: 'Farina',
          team: { ref: 'alfa', name: 'Alfa Romeo' },
          points: 9,
        },
      ],
    }),
  ],
  cancelledRounds: [],
  scoring: {
    systemRef: 's1950',
    systemName: '1950 - 1953 Championship',
    driverCounting: 'bestN',
    driverBestResults: 4,
    teamCounting: 'none',
    teamBestResults: null,
  },
  standings: {
    asOfRound: 1,
    drivers: [
      {
        position: 1,
        driverRef: 'farina',
        code: null,
        forename: 'Nino',
        surname: 'Farina',
        nationality: 'Italian',
        points: 30,
        wins: 3,
        bestFinish: 1,
        teams: [{ ref: 'alfa', name: 'Alfa Romeo', firstRound: 1, lastRound: 1, entries: 1 }],
        adjustment: 'none',
      },
    ],
    teams: [],
  },
};

const SEASON_LIST: SeasonList = {
  seasons: [
    {
      year: 2026,
      rounds: 22,
      completedRounds: 2,
      cancelledRounds: 1,
      isComplete: false,
      hasTeamStandings: true,
    },
    {
      year: 1950,
      rounds: 7,
      completedRounds: 7,
      cancelledRounds: 0,
      isComplete: true,
      hasTeamStandings: false,
    },
  ],
};

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Routes by URL, because this surface makes three different requests and they are not alike. */
function renderHub(path: string, seasons: Record<string, Season> = { 2026: SEASON_2026 }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      // Narrowed rather than `String(input)`: a `Request` stringifies to `[object Object]`, so the
      // whole router would silently fall through to the 404 branch.
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/meta')) return Promise.resolve(ok(META_REAL));
      if (/\/api\/seasons$/.test(url)) return Promise.resolve(ok(SEASON_LIST));
      const match = /\/api\/seasons\/(\d{4})$/.exec(url);
      const season = match === null ? undefined : seasons[match[1] ?? ''];
      if (season !== undefined) return Promise.resolve(ok(season));
      return Promise.resolve(
        new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'no' } }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );

  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/seasons" element={<SeasonHub />} />
          <Route path="/seasons/:year" element={<SeasonHub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the surface assembles', () => {
  it('resolves a bare /seasons to the current season from /api/meta', async () => {
    renderHub('/seasons');
    expect(await screen.findByRole('heading', { level: 1, name: /2026 season/i })).toBeTruthy();
  });

  it('renders the year named in the URL', async () => {
    renderHub('/seasons/1950', { 1950: SEASON_1950 });
    expect(await screen.findByRole('heading', { level: 1, name: /1950 season/i })).toBeTruthy();
  });

  it('leads with the championship leader while a season is in progress', async () => {
    renderHub('/seasons');
    expect(await screen.findByText('Championship leader')).toBeTruthy();
    // Twice, and correctly so: the masthead's title card and the standings table's first row. The
    // card is the headline reading; the table is the full field.
    expect(screen.getAllByText('Andrea Kimi Antonelli')).toHaveLength(2);
  });

  it('leads with the champion once a season is complete', async () => {
    renderHub('/seasons/1950', { 1950: SEASON_1950 });
    expect(await screen.findByText("Drivers' Champion")).toBeTruthy();
  });
});

describe('the notices land where they change a number', () => {
  it('puts the in-progress sentence in the masthead', async () => {
    renderHub('/seasons');
    expect(await screen.findByText(/season is in progress/)).toBeTruthy();
  });

  it('puts the cancellation on the calendar, and the round still has no number', async () => {
    const { container } = { container: document.body };
    renderHub('/seasons');
    await screen.findByText(/were cancelled|was cancelled/);
    const cancelledRow = container.querySelector('.round-row[data-status="cancelled"]');
    expect(cancelledRow?.querySelector('.round-number')?.textContent).toBe('—');
  });

  it('explains a season with no lap timing without calling it an error', async () => {
    renderHub('/seasons/1950', { 1950: SEASON_1950 });
    const notice = await screen.findByText(/Lap-by-lap timing isn't available for 1950/);
    // Neutral, never a status colour — §3.4.3. A `chart-note` class would be `--status-info-wash`.
    expect(notice.closest('.season-note')).toBeTruthy();
  });
});

describe('failure keeps the way out', () => {
  /*
   * **2025, not 1949.** A year *outside* the range never reaches a 404 — `resolveSeasonYear`
   * range-checks it against `/api/meta` and degrades to the default season with a notice, which is
   * the right outcome for a typo. The 404 state is for a well-formed, in-range year the data does
   * not hold, so the fixture map simply omits it.
   */
  it('renders the masthead and the picker when the season 404s', async () => {
    renderHub('/seasons/2025', {});
    expect(await screen.findByRole('heading', { level: 1, name: /2025 season/i })).toBeTruthy();
    expect(await screen.findByText('No 2025 season')).toBeTruthy();
  });

  it('does not paint a missing season as a fault', async () => {
    renderHub('/seasons/2025', {});
    const title = await screen.findByText('No 2025 season');
    const card = title.closest('.state-card');
    expect(card?.querySelector('.state-card-tile-neutral')).toBeTruthy();
  });

  it('does not contradict itself about the range it holds', async () => {
    renderHub('/seasons/2025', {});
    await screen.findByText('No 2025 season');
    // The old copy read "seasons run from 1950 to 2026, and 2025 is not one of them".
    expect(screen.queryByText(/is not one of them/)).toBeNull();
  });
});

/**
 * **The guard for a defect Rishabh caught by looking.**
 *
 * `noticeSlot` routes each of the eight codes to the surface whose numbers it changes. That is the
 * right design and it has one failure mode: a code routed to a surface **that does not exist yet**
 * renders nowhere, silently, and every unit test still passes. It happened — `bestNResults` and
 * `noTeamChampionship` were routed to `standings` and `constructors` before either was built, so
 * 1950 showed one notice out of three and nothing failed.
 *
 * This asserts the property directly: **every notice a season emits appears somewhere on the page.**
 * It is a test of the routing table against the surfaces that actually exist, which is the only
 * thing that could have caught it.
 */
describe('every notice a season emits reaches the page', () => {
  it('renders all three of 1950’s notices — best-4, no Constructors’ Championship, no lap data', async () => {
    renderHub('/seasons/1950', { 1950: SEASON_1950 });
    const notices = selectSeasonNotices(SEASON_1950);

    // Three, and if the selector ever emits a fourth this fails rather than quietly ignoring it.
    expect(notices.map((notice) => notice.code).sort()).toEqual([
      'bestNResults',
      'noLapData',
      'noTeamChampionship',
    ]);

    // `noTeamChampionship` is the one code whose text is rendered inside a state card rather than a
    // note, so the assertion is on the text and not on the container.
    for (const notice of notices) {
      expect(await screen.findByText(notice.text)).toBeTruthy();
    }
  });

  it('renders both of 2026’s — in progress, and the two cancellations', async () => {
    renderHub('/seasons');
    for (const notice of selectSeasonNotices(SEASON_2026)) {
      expect(await screen.findByText(notice.text)).toBeTruthy();
    }
  });
});

describe('a year the record does not hold degrades rather than crashing', () => {
  it('shows the current season and says which year was rejected', async () => {
    renderHub('/seasons/1066');
    await waitFor(() => {
      expect(screen.getByText(/1066/)).toBeTruthy();
    });
    expect(await screen.findByRole('heading', { level: 1, name: /2026 season/i })).toBeTruthy();
  });
});
