// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { META_REAL } from '@schemas/meta.fixture';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Landing } from './Landing';

import CAPABILITY_GRID_SRC from '@/features/landing/CapabilityGrid.tsx?raw';
import COVERAGE_RULER_SRC from '@/features/landing/CoverageRuler.tsx?raw';
import HERO_SECTION_SRC from '@/features/landing/HeroSection.tsx?raw';
import STAT_STRIP_SRC from '@/features/landing/StatStrip.tsx?raw';
import LANDING_SRC from './Landing.tsx?raw';

/**
 * **CT-20**, and **CT-14's second half** — the hard-coded-statistic guard.
 *
 * The grep is the more valuable of the two. `77`, `1950`, `2026`, `22`, `10` and `1996` are all
 * correct today and all wrong after the next database refresh, silently, on the most visible
 * surface in the product; a figure typed into JSX would pass every other test in this suite and
 * every visual review, and would then quietly lie. §S.1 rule 2 makes it a defect rather than a
 * placeholder, and this is the only thing that can enforce that.
 */

/**
 * Returns the `fetch` mock, so a test can assert **that** a retry happened rather than
 * inferring it from having waited long enough for one.
 *
 * `retry: false` is not the whole story and reading it as such is how this file became
 * flaky: `useMeta` sets `retry` per-query, so the default never applies to `/api/meta` —
 * it retries once, and `retryDelay` is what the default decides. Left at the production
 * value that is **one real second**, which the failure-state tests below then sat through
 * inside vitest's 5 s test timeout. `0` removes the sleep and nothing else: the retry
 * still happens, `useMeta`'s predicate still runs, the error still arrives only once
 * attempts are exhausted. Nothing here asserts the backoff schedule.
 */
function renderLanding(response: () => Response) {
  const fetchMock = vi.fn(() => Promise.resolve(response()));
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })}
    >
      <MemoryRouter initialEntries={['/']}>
        <Landing />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return fetchMock;
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fail(code: string, status: number): Response {
  return new Response(JSON.stringify({ error: { code, message: 'no' } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CT-14 — no landing component carries a hard-coded statistic', () => {
  const SOURCES: ReadonlyArray<[name: string, source: string]> = [
    ['Landing.tsx', LANDING_SRC],
    ['HeroSection.tsx', HERO_SECTION_SRC],
    ['StatStrip.tsx', STAT_STRIP_SRC],
    ['CapabilityGrid.tsx', CAPABILITY_GRID_SRC],
    ['CoverageRuler.tsx', COVERAGE_RULER_SRC],
  ];

  /**
   * Three allowances, each stated with its reason rather than the pattern being loosened until it
   * passed. Nothing here is a coverage window, a count, or a year the data decides.
   */
  const ALLOWED: ReadonlyArray<[pattern: RegExp, why: string]> = [
    [
      /No race before 1990 has any lap data at all\./g,
      'Design Spec §9 fixes this sentence verbatim. 1990 is not a coverage window — it is a fact ' +
        'about the data that does not move: zero of the 484 races before 1990 carry lap rows.',
    ],
    [
      /a 1954 season and a 2024 season can be read side by side/g,
      'Design Spec §3.4 card 06 body, verbatim. Two illustrative years in prose, not a statistic ' +
        'about what the database holds.',
    ],
    [
      /\* 100/g,
      'Fraction-to-percentage arithmetic on a value that came from a selector. Not a figure.',
    ],
  ];

  it.each(SOURCES)('%s hard-codes no statistic', (name, source) => {
    // Comments are stripped: the documentation in these files cites figures in order to explain
    // why they must not be typed, and forbidding that would be perverse.
    let code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const [pattern] of ALLOWED) code = code.replace(pattern, '');

    const digits = [...code.matchAll(/\d{3,}/g)].map((match) => match[0]);
    expect(digits, `${name} hard-codes ${digits.join(', ')}`).toEqual([]);
  });

  it.each(SOURCES)('%s contains none of the six figures §S.1 names', (name, source) => {
    // The sharper form of the same rule. These are the values that are correct today and wrong
    // after the next refresh, and they are the ones §S.1 rule 2 lists by name.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const figure of ['77', '1950', '2026', '1996']) {
      expect(code.includes(figure), `${name} contains ${figure}`).toBe(false);
    }
  });

  it('renders the real figures from the response, not from a literal', async () => {
    renderLanding(() => ok(META_REAL));

    // 77 seasons, 10 of 22 rounds, laps from 1996, 1950—2026 — every one from the payload.
    // Asserted on `data-countup-to`, not on the rendered text: G-17 is mid-flight at this point
    // and the visible figure is a frame of the count-up. The attribute is the value that came out
    // of the selector, which is what this test is actually about.
    const figures = await waitFor(() => {
      const found = document.querySelectorAll('[data-countup-to]');
      expect(found.length).toBeGreaterThan(0);
      return found;
    });
    expect([...figures].map((el) => el.getAttribute('data-countup-to'))).toEqual(['77', '10']);
    // 1996 legitimately appears twice — the stat tile and the coverage table's "available from"
    // cell — and both read it from `meta.coverage.laps.from`.
    expect(screen.getAllByText('1996').length).toBe(2);
    expect(screen.getByText('1950—2026')).toBeDefined();
    expect(screen.getByText(/77 seasons of Formula 1/)).toBeDefined();
    expect(screen.getByRole('link', { name: /Explore the 2026 season/ })).toBeDefined();
  });

  it('follows the payload rather than the calendar when the payload changes', async () => {
    const shifted = {
      ...META_REAL,
      seasons: { firstYear: 1950, latestYear: 2031, count: 82 },
      latestSeason: {
        ...META_REAL.latestSeason,
        year: 2031,
        scheduledRounds: 25,
        completedRounds: 4,
      },
    };
    renderLanding(() => ok(shifted));

    await waitFor(() => {
      expect(document.querySelector('[data-countup-to="82"]')).not.toBeNull();
    });
    expect(screen.getByText('1950—2031')).toBeDefined();
    expect(document.querySelector('[data-countup-to="77"]')).toBeNull();
  });
});

describe('CT-20 — the landing states', () => {
  it('renders the hero and a skeleton strip while the request is in flight', () => {
    renderLanding(() => ok(META_REAL));

    // The hero does not wait for data — that is the §8 rule this asserts.
    expect(screen.getByRole('heading', { level: 1, name: 'Settle the argument.' })).toBeDefined();
    expect(screen.getByRole('link', { name: /Compare drivers/ })).toBeDefined();
    // Four skeleton pairs, and the strip is `aria-busy`, so a screen reader is told once.
    expect(screen.getAllByRole('status', { name: 'Coverage figures' }).length).toBeGreaterThan(0);
  });

  it('renders the instructional state on a 503, with the hero intact and nothing leaked', async () => {
    renderLanding(() => fail('DATABASE_UNAVAILABLE', 503));

    expect(await screen.findByRole('heading', { name: 'No database found' })).toBeDefined();
    // The hero still renders in full: a missing database must not blank the front door.
    expect(screen.getByRole('heading', { level: 1, name: 'Settle the argument.' })).toBeDefined();
    // The two lower sections are replaced, not stacked with an error.
    expect(screen.queryByRole('heading', { name: 'Six ways into the record' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'What the record holds' })).toBeNull();

    // S-6: no path, no stack frame, no SQL.
    const rendered = document.body.textContent ?? '';
    expect(rendered).not.toMatch(/\/(Users|home|var|tmp)\//);
    expect(rendered).not.toContain('SQLITE_');
    expect(rendered).not.toMatch(/\bat \w+ \(/);
  });

  it('keeps the hero and states the failure quietly on a 500', async () => {
    const fetchMock = renderLanding(() => fail('INTERNAL', 500));

    // One line, at `--text-xs`, in the strip's place. **No error card in a hero** (§8) — the
    // failure is already stated below, and an alert tile in the hero is the ugliest possible
    // first impression.
    expect(await screen.findByText("Coverage figures aren't available right now.")).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Settle the argument.' })).toBeDefined();
    // The ruler gets a real error state, because that section *is* the data.
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeDefined();
    expect(screen.getByText('INTERNAL')).toBeDefined();
    // `useMeta` retries everything except `DATABASE_UNAVAILABLE`, and the state below is the
    // one that appears *after* attempts are exhausted — not after the first failure.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('distinguishes a rate limit', async () => {
    const fetchMock = renderLanding(() => fail('RATE_LIMITED', 429));
    expect(await screen.findByRole('heading', { name: 'Too many requests' })).toBeDefined();
    expect(screen.getByText('RATE_LIMITED')).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renders one h1 and two h2s, in that order', async () => {
    renderLanding(() => ok(META_REAL));
    await waitFor(() => {
      expect(document.querySelector('[data-countup-to]')).not.toBeNull();
    });

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Six ways into the record', 'What the record holds']);
  });

  it('renders the coverage ruler as a list with a table view, and no chart', async () => {
    renderLanding(() => ok(META_REAL));
    await waitFor(() => {
      expect(document.querySelector('[data-countup-to]')).not.toBeNull();
    });

    const rows = screen.getAllByRole('listitem');
    // Six data classes, every year read from `meta.coverage`.
    expect(rows.filter((row) => row.className.includes('ruler-row'))).toHaveLength(6);
    expect(screen.getByText('1950 →')).toBeDefined();
    expect(screen.getByText('1994 →')).toBeDefined();
    expect(screen.getByText('2021 →')).toBeDefined();

    // §6.2's table view exists even though this is not a chart.
    expect(screen.getByText('View as a table')).toBeDefined();
    expect(screen.getByRole('columnheader', { name: 'Available from' })).toBeDefined();
  });
});
