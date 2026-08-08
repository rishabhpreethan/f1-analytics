import { type UseQueryResult, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Circuit, circuitSchema } from '@schemas/circuit';
import { type Driver, driverSchema } from '@schemas/driver';
import { type Team, teamSchema } from '@schemas/team';
import { type ApiRequestError, apiGet, isTerminalApiError } from '@/lib/api';

/**
 * The only place the three entity **profile** endpoints are fetched. Components never fetch
 * (ARCHITECTURE.md §3); they receive props.
 *
 * The three **index** endpoints are `useEntityIndex.ts` beside this file — a separate module
 * because they answer a different question: no parameter, so nothing to leave unresolved,
 * nothing to 404, and no reference in the query key.
 *
 * ==================================================== one module for three, on purpose
 *
 * `useDriver`, `useTeam` and `useCircuit` are the same hook three times — one reference in,
 * one payload out, no dependent request and no availability gate. That is the whole
 * difference from `useRace`, where `useRaceLaps` takes the **payload** rather than a year
 * and a round so the flag that says whether there is anything to fetch lives on the object
 * the hook already needs. Nothing here has a second request to gate, so nothing here needs
 * that shape, and three files that differ only in a schema name would drift.
 *
 * ============================================================================= staleness
 *
 * `staleTime` is an hour, matching the `Cache-Control` the server sends, so the browser
 * cache and the query cache expire together rather than one silently masking the other.
 * These payloads are as immutable as the archive: a driver's career totals change when a
 * race is added to the database and at no other time.
 *
 * ================================================================================ retries
 *
 * A 404 is terminal (`isTerminalApiError`), so a mistyped slug says so immediately rather
 * than spinning through a retry that will produce the same 404. `enabled` is false while
 * the URL parameter has not resolved to a valid reference, so nothing ever requests
 * `/api/drivers/undefined`.
 */

export const driverQueryKey = (reference: string) => ['driver', reference] as const;
export const teamQueryKey = (reference: string) => ['team', reference] as const;
export const circuitQueryKey = (reference: string) => ['circuit', reference] as const;

const HOUR_MS = 3_600_000;

const retry = (failureCount: number, error: ApiRequestError): boolean =>
  !isTerminalApiError(error) && failureCount < 1;

export function useDriver(reference: string | null): UseQueryResult<Driver, ApiRequestError> {
  return useQuery<Driver, ApiRequestError>({
    queryKey: driverQueryKey(reference ?? ''),
    queryFn: () => apiGet(`/api/drivers/${String(reference)}`, driverSchema),
    enabled: reference !== null,
    staleTime: HOUR_MS,
    gcTime: HOUR_MS,
    retry,
  });
}

export function useTeam(reference: string | null): UseQueryResult<Team, ApiRequestError> {
  return useQuery<Team, ApiRequestError>({
    queryKey: teamQueryKey(reference ?? ''),
    queryFn: () => apiGet(`/api/teams/${String(reference)}`, teamSchema),
    enabled: reference !== null,
    staleTime: HOUR_MS,
    gcTime: HOUR_MS,
    retry,
  });
}

export function useCircuit(reference: string | null): UseQueryResult<Circuit, ApiRequestError> {
  return useQuery<Circuit, ApiRequestError>({
    queryKey: circuitQueryKey(reference ?? ''),
    queryFn: () => apiGet(`/api/circuits/${String(reference)}`, circuitSchema),
    enabled: reference !== null,
    staleTime: HOUR_MS,
    gcTime: HOUR_MS,
    retry,
  });
}

/**
 * The "Try again" action behind an entity-page state card.
 *
 * It lives in the feature rather than in the state components so the query keys stay in one
 * place and the components stay free of fetching — invalidating a key asks TanStack Query
 * to refetch, it does not perform a request itself (ARCHITECTURE.md §3).
 *
 * Honest by construction: a 404 produces the same 404, and `isTerminalApiError` already
 * stops the automatic retry so the state card says so rather than spinning.
 */
export function useRetryEntity(
  kind: 'driver' | 'team' | 'circuit',
  reference: string | null,
): () => void {
  const client = useQueryClient();
  return () => {
    if (reference === null) return;
    const key =
      kind === 'driver'
        ? driverQueryKey(reference)
        : kind === 'team'
          ? teamQueryKey(reference)
          : circuitQueryKey(reference);
    void client.invalidateQueries({ queryKey: key });
  };
}
