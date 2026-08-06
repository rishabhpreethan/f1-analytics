import { type UseQueryResult, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Meta, metaSchema } from '@schemas/meta';
import { type ApiRequestError, apiGet } from '@/lib/api';

export const metaQueryKey = ['meta'] as const;

/**
 * The one place `/api/meta` is fetched. Components never fetch (ARCHITECTURE.md §3);
 * they receive props.
 *
 * `DATABASE_UNAVAILABLE` is deliberately never retried: on a fresh clone it will not
 * resolve, and retrying only delays the designed state that tells the reader what to
 * do about it.
 */
export function useMeta(): UseQueryResult<Meta, ApiRequestError> {
  return useQuery<Meta, ApiRequestError>({
    queryKey: metaQueryKey,
    queryFn: () => apiGet('/api/meta', metaSchema),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: (failureCount, error) => error.code !== 'DATABASE_UNAVAILABLE' && failureCount < 1,
  });
}

/**
 * The "Try again" action behind every meta-driven state card.
 *
 * It lives in the feature rather than in the state components for two reasons: the query
 * key stays in one place, and the components stay free of fetching — invalidating a key
 * asks TanStack Query to refetch, it does not perform a request itself
 * (`ARCHITECTURE.md` §3).
 *
 * Honest by construction: on a fresh clone this succeeds the moment the database file is
 * in place, and until then it re-renders the same explanation rather than pretending.
 */
export function useRetryMeta(): () => void {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: metaQueryKey });
  };
}
