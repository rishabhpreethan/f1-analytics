/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { circuitFixture, driverFixture, teamFixture } from '@schemas/entity.fixture';
import { useCircuit, useDriver, useTeam } from './useEntity';

/**
 * What is worth a hook test rather than a selector test on this surface: **the request that
 * is made, and the request that is not**.
 *
 * There is no availability gate here as there is on the race page, so the behaviours that
 * can go wrong are the path, the disabled state while a URL parameter is unresolved, and
 * the refusal to render a payload that does not match its own schema. All three are
 * assertions about the `fetch` call list or about an error, not about anything rendered —
 * jsdom performs no layout and could not tell us anything about the page regardless.
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

describe('the three entity hooks', () => {
  it.each([
    ['driver', useDriver, 'ascari', driverFixture, '/api/drivers/ascari'],
    ['team', useTeam, 'brawn', teamFixture, '/api/teams/brawn'],
    ['circuit', useCircuit, 'monza', circuitFixture, '/api/circuits/monza'],
  ] as const)(
    'use%s requests the path ARCHITECTURE §6 specifies',
    async (_kind, hook, ref, fixture, path) => {
      fetchMock.mockResolvedValue(jsonResponse(fixture));
      const { result } = renderHook(() => hook(ref), { wrapper: wrapper() });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(paths()).toEqual([path]);
    },
  );

  /**
   * The disabled case. `resolveEntityRef` returns null for a malformed slug, and a hook
   * that fired anyway would request `/api/drivers/null` — a 400 the reader never asked for,
   * on every keystroke of a bad URL.
   */
  it.each([
    ['driver', useDriver],
    ['team', useTeam],
    ['circuit', useCircuit],
  ] as const)('use%s makes no request while the reference is unresolved', (_kind, hook) => {
    renderHook(() => hook(null), { wrapper: wrapper() });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * A payload that does not match its own schema is an error, not something to render.
   * Half-rendering a drifted payload is how a wrong number reaches a reader (`lib/api.ts`).
   */
  it('surfaces a drifted payload as MALFORMED rather than rendering it', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ driver: { ref: 'ascari' } }));
    const { result } = renderHook(() => useDriver('ascari'), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.code).toBe('MALFORMED');
  });

  it('surfaces a 404 with its own code so the surface can say "no such driver"', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, 404),
    );
    const { result } = renderHook(() => useDriver('nobody'), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.code).toBe('NOT_FOUND');
    // Terminal: asked once, not retried into the same answer.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keys the three caches separately so one reference cannot serve another resource', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(jsonResponse(url.includes('/drivers/') ? driverFixture : circuitFixture)),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const shared = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const driver = renderHook(() => useDriver('monza'), { wrapper: shared });
    const circuit = renderHook(() => useCircuit('monza'), { wrapper: shared });
    await waitFor(() => {
      expect(driver.result.current.isSuccess && circuit.result.current.isSuccess).toBe(true);
    });
    expect(paths().sort()).toEqual(['/api/circuits/monza', '/api/drivers/monza']);
  });
});
