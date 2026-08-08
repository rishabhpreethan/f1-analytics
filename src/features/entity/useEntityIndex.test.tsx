/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { circuitListFixture, driverListFixture, teamListFixture } from '@schemas/directory.fixture';
import { useCircuitIndex, useDriverIndex, useTeamIndex } from './useEntityIndex';

/**
 * What is worth a hook test on this surface: **the request that is made, the request that
 * is not made twice, and the payload that is refused.**
 *
 * These endpoints take no parameter, so there is no disabled state and no 404 to test — the
 * behaviours that can go wrong are the path, the cache key, and the refusal to render a
 * payload that does not match its own schema. All three are assertions about the `fetch`
 * call list or about an error. jsdom performs no layout and could tell us nothing about a
 * rendered list of 881 rows regardless.
 */

function wrapper(): (props: { children: ReactNode }) => ReactNode {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
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

describe('the three index hooks', () => {
  it.each([
    ['Driver', useDriverIndex, driverListFixture, '/api/drivers'],
    ['Team', useTeamIndex, teamListFixture, '/api/teams'],
    ['Circuit', useCircuitIndex, circuitListFixture, '/api/circuits'],
  ] as const)(
    'use%sIndex requests the path ARCHITECTURE §6 specifies',
    async (_kind, hook, fixture, path) => {
      fetchMock.mockResolvedValue(jsonResponse(fixture));
      const { result } = renderHook(() => hook(), { wrapper: wrapper() });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(paths()).toEqual([path]);
    },
  );

  /**
   * **No query string.** The routes take no parameter and ignore one if sent, so a hook
   * that appended `?sort=` would be requesting a URL the server has no opinion about — and
   * would split the cache on a key the response does not vary by.
   */
  it('sends no query string on any of the three', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        jsonResponse(
          url === '/api/drivers'
            ? driverListFixture
            : url === '/api/teams'
              ? teamListFixture
              : circuitListFixture,
        ),
      ),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const shared = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const drivers = renderHook(() => useDriverIndex(), { wrapper: shared });
    const teams = renderHook(() => useTeamIndex(), { wrapper: shared });
    const circuits = renderHook(() => useCircuitIndex(), { wrapper: shared });
    await waitFor(() => {
      expect(
        drivers.result.current.isSuccess &&
          teams.result.current.isSuccess &&
          circuits.result.current.isSuccess,
      ).toBe(true);
    });
    expect(paths().sort()).toEqual(['/api/circuits', '/api/drivers', '/api/teams']);
    for (const path of paths()) expect(path).not.toContain('?');
  });

  /**
   * A payload that does not match its own schema is an error, not something to render.
   * Half-rendering a drifted directory is how a reader ends up with a link that 404s.
   */
  it('surfaces a drifted payload as MALFORMED rather than rendering it', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ drivers: [{ ref: 'alonso' }] }));
    const { result } = renderHook(() => useDriverIndex(), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.code).toBe('MALFORMED');
  });

  /**
   * A bare array where an object is expected — the shape this payload would have had if the
   * envelope were dropped. It must fail rather than parse to something empty.
   */
  it('refuses a bare array payload', async () => {
    fetchMock.mockResolvedValue(jsonResponse(driverListFixture.drivers));
    const { result } = renderHook(() => useDriverIndex(), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.code).toBe('MALFORMED');
  });

  /**
   * A missing database will still be missing, so the designed state appears at once rather
   * than after a retry the reader waits through twice.
   */
  it('does not retry DATABASE_UNAVAILABLE', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Unavailable.' } }, 503),
    );
    const { result } = renderHook(() => useDriverIndex(), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.code).toBe('DATABASE_UNAVAILABLE');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /**
   * Three separate cache keys, and none of them shares a key with the profile hooks — a
   * directory served where a profile was asked for would render a page of undefineds.
   */
  it('keys the three lists separately', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(jsonResponse(url === '/api/drivers' ? driverListFixture : teamListFixture)),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const shared = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const drivers = renderHook(() => useDriverIndex(), { wrapper: shared });
    const teams = renderHook(() => useTeamIndex(), { wrapper: shared });
    await waitFor(() => {
      expect(drivers.result.current.isSuccess && teams.result.current.isSuccess).toBe(true);
    });
    expect(drivers.result.current.data?.drivers[0]?.ref).toBe('alonso');
    expect(teams.result.current.data?.teams[0]?.ref).toBe('ferrari');
  });

  /** One request for two consumers of the same list — the whole point of a shared key. */
  it('fetches a list once however many surfaces read it', async () => {
    fetchMock.mockResolvedValue(jsonResponse(driverListFixture));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const shared = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const a = renderHook(() => useDriverIndex(), { wrapper: shared });
    const b = renderHook(() => useDriverIndex(), { wrapper: shared });
    await waitFor(() => {
      expect(a.result.current.isSuccess && b.result.current.isSuccess).toBe(true);
    });
    expect(paths()).toEqual(['/api/drivers']);
  });
});
