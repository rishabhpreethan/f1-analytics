// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { META_REAL } from '@schemas/meta.fixture';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';

/**
 * Which state `main` shows when `/api/meta` fails — branch logic, not appearance.
 *
 * Not one of the 69 numbered tests. It is here because two F0 acceptance criteria are
 * about exactly this mapping (Design Spec §7, Technical Spec §2.7 / E1, E16, E17): a
 * `503` must produce the instructional "no database found" state, and **no response
 * detail may reach the screen** — no path, no stack frame, no SQLite code. Asserting
 * that mechanically is cheaper than trusting it.
 */

function errorResponse(code: string, message: string, status: number): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Returns the `fetch` mock, so a test can assert **that** a retry happened rather than
 * inferring it from having waited long enough for one.
 *
 * `retry: false` is not the whole story and reading it as such is how this file became
 * flaky: `useMeta` sets `retry` per-query, so the default never applies to `/api/meta` —
 * it retries once, and `retryDelay` is what the default decides. Left at the production
 * value that is **one real second**, which every failure-state test below then sat
 * through, twice in one case, inside vitest's 5 s test timeout. `0` removes the sleep and
 * nothing else: the retry still happens, `useMeta`'s predicate still runs, the error still
 * arrives only once attempts are exhausted. Nothing here asserts the backoff schedule,
 * and a unit test is the wrong place to assert it if anything ever needs to.
 */
function renderApp(response: () => Response) {
  const fetchMock = vi.fn(() => Promise.resolve(response()));
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })}
    >
      <App />
    </QueryClientProvider>,
  );
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  window.history.pushState({}, '', '/');
});

describe('when /api/meta is unavailable', () => {
  it('renders the instructional no-database state, and leaks nothing (E1, S-6)', async () => {
    const fetchMock = renderApp(() =>
      errorResponse('DATABASE_UNAVAILABLE', 'The data is not available.', 503),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'No database found' }),
    ).toBeDefined();
    // The other half of `useMeta`'s retry contract: this one code is never retried, so on a
    // fresh clone the instructional state arrives at once instead of after a backoff.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('DATABASE_UNAVAILABLE')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();

    // The header survives, with the quiet dot rather than an error colour.
    expect(await screen.findByRole('img', { name: 'Data coverage unavailable' })).toBeDefined();
    expect(screen.getAllByRole('navigation', { name: 'Primary' })).toHaveLength(1);

    // Nothing resembling a stack frame, an absolute path or SQL reaches the document.
    const rendered = document.body.textContent ?? '';
    expect(rendered).not.toMatch(/\/(Users|home|var|tmp)\//);
    expect(rendered).not.toContain('SQLITE_');
    expect(rendered).not.toMatch(/\bat \w+ \(/);
    expect(rendered.toLowerCase()).not.toContain('select ');
  });

  // Both of these are retried once before the state settles — `useMeta` retries
  // everything except `DATABASE_UNAVAILABLE`. That is asserted on the call count, not on
  // elapsed time; see `renderApp`.
  it('distinguishes a rate limit from a generic failure (E16, E17)', async () => {
    const rateLimited = renderApp(() =>
      errorResponse('RATE_LIMITED', 'Too many requests. Please slow down.', 429),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Too many requests' }),
    ).toBeDefined();
    expect(screen.getByText('RATE_LIMITED')).toBeDefined();
    expect(rateLimited).toHaveBeenCalledTimes(2);
    cleanup();
    vi.unstubAllGlobals();

    const internal = renderApp(() => errorResponse('INTERNAL', 'Something went wrong.', 500));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeDefined();
    expect(screen.getByText('INTERNAL')).toBeDefined();
    expect(internal).toHaveBeenCalledTimes(2);
  });

  it('renders the route surface and the footer echo when the data is there', async () => {
    renderApp(
      () =>
        new Response(JSON.stringify(META_REAL), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    // `/` is the landing page from CR-007 (§10 #23), not the season hub.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Settle the argument.' }),
    ).toBeDefined();
    expect(
      await screen.findByText('Complete results through 2026 Round 10 · Seasons 1950–2026'),
    ).toBeDefined();
  });
});

describe('the route table', () => {
  /**
   * Twelve routes plus the catch-all (`ARCHITECTURE.md` §5). Asserted by **direct entry**,
   * not by client navigation: a route that only resolves after a link click is a route a
   * shared URL cannot reach, and every analytical state in this product is meant to be
   * addressable.
   */
  /**
   * The two season entries are **regular expressions, and that is the point** (F2, 2026-08-07).
   * They used to be the placeholder's literal headings, `Current season` and `2024 Season`. The
   * real surface's `h1` is the season *year*, which is a season picker — so its accessible name
   * is data-dependent (`2026 season. Choose a different season.`) and would hard-code today's
   * latest season into a routing test. What this test is for is that the path resolves to the
   * season hub, and a level-1 heading naming a season is exactly that claim, stated in a way that
   * does not break when the record is refreshed.
   */
  const ROUTES: ReadonlyArray<[path: string, heading: string | RegExp]> = [
    ['/', 'Settle the argument.'],
    ['/seasons', /season/i],
    ['/seasons/2024', /^2024 season/i],
    /*
     * A regex for the same reason the two season rows are (F3, 2026-08-07): the race page's `h1` is
     * the round *number* with the race name appended for screen readers, so its accessible name is
     * data-dependent — and in this test's fixture the race query cannot resolve, so the masthead is
     * in its own resolving state. What the route table asserts is that the path reaches the race
     * page, and a level-1 heading naming a race or a round is that claim.
     */
    ['/seasons/2024/races/3', /race|round/i],
    ['/drivers', 'Drivers'],
    ['/drivers/max_verstappen', 'Driver'],
    ['/teams', 'Teams'],
    ['/teams/ferrari', 'Team'],
    ['/circuits', 'Circuits'],
    ['/circuits/spa', 'Circuit'],
    ['/compare', 'Compare'],
    ['/records', 'Records'],
    ['/not-a-real-route', 'No page at this address'],
  ];

  it.each(ROUTES)('resolves %s on direct entry', async (path, heading) => {
    window.history.pushState({}, '', path);
    renderApp(
      () =>
        new Response(JSON.stringify(META_REAL), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeDefined();
  });

  it('has no redirect in either direction between / and /seasons', async () => {
    // §10 #23: `/` changed meaning rather than moving, so neither URL rewrites the other.
    // A redirect would be visible here as the wrong heading, or as a changed pathname.
    for (const [path, heading] of [
      ['/', 'Settle the argument.'],
      ['/seasons', /season/i],
    ] as const) {
      window.history.pushState({}, '', path);
      renderApp(
        () =>
          new Response(JSON.stringify(META_REAL), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      );
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeDefined();
      expect(window.location.pathname).toBe(path);
      cleanup();
      vi.unstubAllGlobals();
    }
  });
});
