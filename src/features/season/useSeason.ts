import { type UseQueryResult, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Season,
  type SeasonList,
  type StandingsProgression,
  seasonListSchema,
  seasonSchema,
  standingsProgressionSchema,
} from '@schemas/season';
import { type ApiRequestError, apiGet, isTerminalApiError } from '@/lib/api';

/**
 * The only place the season endpoints are fetched. Components never fetch
 * (ARCHITECTURE.md §3); they receive props.
 *
 * **`staleTime` is an hour, not five minutes.** The database is immutable between
 * refreshes and a completed season's standings have been settled for decades — 1950's
 * for 76 years. It matches the `Cache-Control` the server sends, so the browser cache and
 * the query cache expire together rather than one silently masking the other.
 *
 * The progression is a **separate hook from the season**, matching the endpoint split: it
 * is the larger payload (36 KB for 2024 against 15 KB) and only the chart needs it, so a
 * hub that renders a calendar and a table does not pay for it.
 */

export const seasonsQueryKey = ['seasons'] as const;
export const seasonQueryKey = (year: number) => ['season', year] as const;
export const seasonStandingsQueryKey = (year: number) => ['season-standings', year] as const;

const HOUR_MS = 3_600_000;

/** Every season, newest first. Small and immutable — the season selector's source. */
export function useSeasons(): UseQueryResult<SeasonList, ApiRequestError> {
  return useQuery<SeasonList, ApiRequestError>({
    queryKey: seasonsQueryKey,
    queryFn: () => apiGet('/api/seasons', seasonListSchema),
    staleTime: HOUR_MS,
    gcTime: HOUR_MS,
    retry: (failureCount, error) => !isTerminalApiError(error) && failureCount < 1,
  });
}

/**
 * One season's calendar and current standings.
 *
 * `year` may be null while it is still being resolved from `/api/meta` — a bare
 * `/seasons` has no year in the URL (ARCHITECTURE.md §5). The query is disabled rather
 * than fired with a guessed year, so nothing requests `/api/seasons/NaN`.
 */
export function useSeason(year: number | null): UseQueryResult<Season, ApiRequestError> {
  return useQuery<Season, ApiRequestError>({
    queryKey: seasonQueryKey(year ?? 0),
    queryFn: () => apiGet(`/api/seasons/${String(year)}`, seasonSchema),
    enabled: year !== null,
    staleTime: HOUR_MS,
    gcTime: HOUR_MS,
    retry: (failureCount, error) => !isTerminalApiError(error) && failureCount < 1,
  });
}

/** Round-by-round championship progression for drivers and teams (SC-1, SC-2). */
export function useSeasonStandings(
  year: number | null,
): UseQueryResult<StandingsProgression, ApiRequestError> {
  return useQuery<StandingsProgression, ApiRequestError>({
    queryKey: seasonStandingsQueryKey(year ?? 0),
    queryFn: () => apiGet(`/api/seasons/${String(year)}/standings`, standingsProgressionSchema),
    enabled: year !== null,
    staleTime: HOUR_MS,
    gcTime: HOUR_MS,
    retry: (failureCount, error) => !isTerminalApiError(error) && failureCount < 1,
  });
}

/**
 * The "Try again" action behind a season-hub state card.
 *
 * It lives in the feature rather than in the state components so the query keys stay in
 * one place and the components stay free of fetching — invalidating a key asks TanStack
 * Query to refetch, it does not perform a request itself (ARCHITECTURE.md §3).
 *
 * Honest by construction: a 404 will produce the same 404, and the state card says so
 * rather than spinning.
 */
export function useRetrySeason(year: number | null): () => void {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: seasonsQueryKey });
    if (year === null) return;
    void client.invalidateQueries({ queryKey: seasonQueryKey(year) });
    void client.invalidateQueries({ queryKey: seasonStandingsQueryKey(year) });
  };
}
