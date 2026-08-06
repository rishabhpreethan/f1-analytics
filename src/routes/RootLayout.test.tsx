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

function renderApp(response: () => Response): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(response())),
  );
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <App />
    </QueryClientProvider>,
  );
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
    renderApp(() => errorResponse('DATABASE_UNAVAILABLE', 'The data is not available.', 503));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'No database found' }),
    ).toBeDefined();
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
  // everything except `DATABASE_UNAVAILABLE`, and TanStack Query's first backoff is a
  // second — so the wait is longer than the default.
  const AFTER_RETRY = { timeout: 4000 };

  it('distinguishes a rate limit from a generic failure (E16, E17)', async () => {
    renderApp(() => errorResponse('RATE_LIMITED', 'Too many requests. Please slow down.', 429));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Too many requests' }, AFTER_RETRY),
    ).toBeDefined();
    expect(screen.getByText('RATE_LIMITED')).toBeDefined();
    cleanup();
    vi.unstubAllGlobals();

    renderApp(() => errorResponse('INTERNAL', 'Something went wrong.', 500));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Something went wrong' }, AFTER_RETRY),
    ).toBeDefined();
    expect(screen.getByText('INTERNAL')).toBeDefined();
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
  const ROUTES: ReadonlyArray<[path: string, heading: string]> = [
    ['/', 'Settle the argument.'],
    ['/seasons', 'Current season'],
    ['/seasons/2024', '2024 Season'],
    ['/seasons/2024/races/3', 'Round 3'],
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
      ['/seasons', 'Current season'],
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
