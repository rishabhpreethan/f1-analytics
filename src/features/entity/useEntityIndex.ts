import { type UseQueryResult, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CircuitList,
  type DriverList,
  type TeamList,
  circuitListSchema,
  driverListSchema,
  teamListSchema,
} from '@schemas/directory';
import { type ApiRequestError, apiGet, isTerminalApiError } from '@/lib/api';

/**
 * The only place the three **index** endpoints are fetched. Components never fetch
 * (ARCHITECTURE.md §3); they receive props.
 *
 * Beside `useEntity.ts` rather than inside it because the two answer different questions —
 * `useDriver(ref)` is one entity and takes a parameter that can be unresolved, while
 * `useDriverIndex()` is the whole dimension and takes nothing. Nothing here is `enabled`,
 * nothing here can 404, and nothing here has a reference in its query key.
 *
 * ============================================================================= staleness
 *
 * An hour, matching the `Cache-Control` the server sends and the server-side memo TTL, so
 * all three layers expire together rather than one silently masking another. These
 * payloads are as immutable as the archive — the directory changes when a race is added to
 * the database and at no other time.
 *
 * `gcTime` is deliberately **longer** than `staleTime` here, which is the one place this
 * differs from the profile hooks. A reader browses the index, opens a profile, comes back,
 * opens another — and a 139 KB payload dropped from the cache in between would be
 * re-fetched on every return. Keeping it for the session costs ~180 KB of memory for all
 * three lists together, which is less than one lap payload.
 *
 * ================================================================================ retries
 *
 * A missing database will still be missing (`isTerminalApiError`), so the designed state
 * appears at once rather than after two round-trips. Nothing else here is terminal: these
 * routes have no parameter, so `NOT_FOUND` and `INVALID_PARAM` are unreachable and a
 * failure is a genuine fault worth one retry.
 *
 * ================================================================= no sorting or filtering
 *
 * These hooks return the payload and nothing more. Sorting, searching and grouping are
 * pure functions of a list and live in `src/components/entity/indexModel.ts`, where they
 * are unit-tested without a network — and the locale-aware sort has to be there rather
 * than on the server, because SQLite compares text with BINARY collation and puts
 * `Räikkönen` after `Ryan`.
 */

export const driverIndexQueryKey = ['driver-index'] as const;
export const teamIndexQueryKey = ['team-index'] as const;
export const circuitIndexQueryKey = ['circuit-index'] as const;

const HOUR_MS = 3_600_000;
const SESSION_MS = 24 * HOUR_MS;

const retry = (failureCount: number, error: ApiRequestError): boolean =>
  !isTerminalApiError(error) && failureCount < 1;

export function useDriverIndex(): UseQueryResult<DriverList, ApiRequestError> {
  return useQuery<DriverList, ApiRequestError>({
    queryKey: driverIndexQueryKey,
    queryFn: () => apiGet('/api/drivers', driverListSchema),
    staleTime: HOUR_MS,
    gcTime: SESSION_MS,
    retry,
  });
}

export function useTeamIndex(): UseQueryResult<TeamList, ApiRequestError> {
  return useQuery<TeamList, ApiRequestError>({
    queryKey: teamIndexQueryKey,
    queryFn: () => apiGet('/api/teams', teamListSchema),
    staleTime: HOUR_MS,
    gcTime: SESSION_MS,
    retry,
  });
}

export function useCircuitIndex(): UseQueryResult<CircuitList, ApiRequestError> {
  return useQuery<CircuitList, ApiRequestError>({
    queryKey: circuitIndexQueryKey,
    queryFn: () => apiGet('/api/circuits', circuitListSchema),
    staleTime: HOUR_MS,
    gcTime: SESSION_MS,
    retry,
  });
}

/**
 * The "Try again" action behind an index-page error state.
 *
 * It lives here rather than in the state components so the query keys stay in one place and
 * the components stay free of fetching — invalidating a key asks TanStack Query to refetch,
 * it does not perform a request itself (ARCHITECTURE.md §3).
 */
export function useRetryEntityIndex(kind: 'driver' | 'team' | 'circuit'): () => void {
  const client = useQueryClient();
  return () => {
    const queryKey =
      kind === 'driver'
        ? driverIndexQueryKey
        : kind === 'team'
          ? teamIndexQueryKey
          : circuitIndexQueryKey;
    void client.invalidateQueries({ queryKey });
  };
}
