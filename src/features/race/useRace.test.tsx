/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { laps2026Fixture, race1988Fixture, race2026Fixture } from '@schemas/race.fixture';
import { useRace, useRaceLaps, useRaceStints } from './useRace';

/**
 * The one behaviour worth a hook test rather than a selector test: **that the lap-scale
 * queries do not fire when the race has nothing to give them.**
 *
 * It is asserted on the `fetch` call list rather than on a rendered result, because the
 * requirement is about a request that must *not* happen — 484 races have no lap data, and a
 * client that fetched anyway would work perfectly and be wrong.
 */

function wrapper(): (props: { children: ReactNode }) => ReactNode {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const fetchMock = vi.fn();

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function paths(): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

describe('useRace', () => {
  it('requests the hierarchical path ARCHITECTURE §6 specifies', async () => {
    fetchMock.mockResolvedValue(jsonResponse(race2026Fixture));
    const { result } = renderHook(() => useRace({ year: 2026, round: 1 }), {
      wrapper: wrapper(),
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(paths()).toEqual(['/api/seasons/2026/races/1']);
  });

  /**
   * A bare or malformed address resolves to null and the query is disabled, so nothing
   * requests `/api/seasons/NaN/races/NaN`.
   */
  it('fires nothing at all when the address has not resolved', () => {
    renderHook(() => useRace(null), { wrapper: wrapper() });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('useRaceLaps / useRaceStints — the request that must not happen', () => {
  /**
   * 1988 R1. The reduced page is the common case — 484 races predate 1990 and none has a
   * lap row — so the client must learn there is nothing from the spine's flags and stop.
   */
  it('fires neither lap-scale query for a race with no lap and no pit data', () => {
    renderHook(
      () => {
        useRaceLaps(race1988Fixture);
        useRaceStints(race1988Fixture);
      },
      { wrapper: wrapper() },
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fires both for a race that has everything', async () => {
    fetchMock.mockResolvedValue(jsonResponse(laps2026Fixture));
    renderHook(
      () => {
        useRaceLaps(race2026Fixture);
        useRaceStints(race2026Fixture);
      },
      { wrapper: wrapper() },
    );
    await waitFor(() => {
      expect(paths()).toHaveLength(2);
    });
    expect(paths().sort()).toEqual([
      '/api/seasons/2026/races/1/laps',
      '/api/seasons/2026/races/1/stints',
    ]);
  });

  /**
   * 1996 — and, measured, 2021 R12 as well: lap data present, pit data absent. The two flags
   * are independent, so the halfway case must fetch exactly one of the two.
   */
  it('fires only the lap query when pit data is absent', async () => {
    fetchMock.mockResolvedValue(jsonResponse(laps2026Fixture));
    const race = { ...race2026Fixture, availability: { hasLapData: true, hasPitData: false } };
    renderHook(
      () => {
        useRaceLaps(race);
        useRaceStints(race);
      },
      { wrapper: wrapper() },
    );
    await waitFor(() => {
      expect(paths()).toHaveLength(1);
    });
    expect(paths()).toEqual(['/api/seasons/2026/races/1/laps']);
  });

  it('fires nothing while the race payload has not arrived', () => {
    renderHook(
      () => {
        useRaceLaps(undefined);
        useRaceStints(undefined);
      },
      { wrapper: wrapper() },
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * The keys carry the year and the round, so two races never share a cache entry. Asserted
   * because a key that omitted the round would serve round 1's laps for round 2 — a defect
   * that renders perfectly.
   */
  it('keys the cache by year and round, so two races cannot share an entry', async () => {
    fetchMock.mockResolvedValue(jsonResponse(laps2026Fixture));
    const other = { ...race2026Fixture, round: 2 };
    renderHook(
      () => {
        useRaceLaps(race2026Fixture);
        useRaceLaps(other);
      },
      { wrapper: wrapper() },
    );
    await waitFor(() => {
      expect(paths()).toHaveLength(2);
    });
    expect(paths().sort()).toEqual([
      '/api/seasons/2026/races/1/laps',
      '/api/seasons/2026/races/2/laps',
    ]);
  });
});
