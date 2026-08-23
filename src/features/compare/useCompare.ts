import { type UseQueryResult, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CompareData,
  type CompareSeasons,
  compareDataSchema,
  compareSeasonsSchema,
} from '@schemas/compare';
import type { DriverList } from '@schemas/directory';
import { type ApiRequestError, apiGet, isTerminalApiError } from '@/lib/api';
import type { CompareCandidate } from './types';

/**
 * The only place the two comparison endpoints are fetched. Components never fetch
 * (ARCHITECTURE.md §3); they receive props.
 *
 * ================================================================================ two queries
 *
 * `GET /api/compare` and `GET /api/compare/seasons` are separate keys on purpose. The lens switch
 * must not refetch a career payload that has not changed, and neither must a change of year — the
 * season payload already carries every season the selection ran, so the year rail costs no network
 * at all (`ARCHITECTURE.md` §8: "chart interaction < 100 ms, no network").
 *
 * ============================================================================ what the key is
 *
 * **The references, in the reader's order.** Not sorted: the surface assigns colour and ladder
 * position by selection order, so `?e=hamilton,fangio` and `?e=fangio,hamilton` are two different
 * pages and must be two cache entries. Sorting the key would serve one from the other's cache and
 * repaint the page for the same URL.
 *
 * ================================================================================== staleness
 *
 * An hour, matching the `Cache-Control` the server sends, so the browser cache and the query cache
 * expire together. `gcTime` is longer than `staleTime` because flipping the lens and coming back is
 * the normal interaction and a 127 KB season payload should not be re-fetched for it.
 *
 * A `NOT_FOUND` is terminal (`isTerminalApiError`): a slug the archive cannot compare will still be
 * uncomparable on a second try, and retrying only delays the state that says so.
 */

const HOUR_MS = 3_600_000;
const SESSION_MS = 24 * HOUR_MS;

export const compareQueryKey = (refs: readonly string[]) => ['compare', refs.join(',')] as const;
export const compareSeasonsQueryKey = (refs: readonly string[]) =>
  ['compare-seasons', refs.join(',')] as const;

const retry = (failureCount: number, error: ApiRequestError): boolean =>
  !isTerminalApiError(error) && failureCount < 1;

/** The career lens. `refs` empty disables the query rather than asking for nothing. */
export function useCompare(refs: readonly string[]): UseQueryResult<CompareData, ApiRequestError> {
  return useQuery<CompareData, ApiRequestError>({
    queryKey: compareQueryKey(refs),
    queryFn: () => apiGet(`/api/compare?e=${refs.join(',')}`, compareDataSchema),
    enabled: refs.length > 0,
    staleTime: HOUR_MS,
    gcTime: SESSION_MS,
    retry,
  });
}

/** The season lens: every season the selection entered, in one response. */
export function useCompareSeasons(
  refs: readonly string[],
): UseQueryResult<CompareSeasons, ApiRequestError> {
  return useQuery<CompareSeasons, ApiRequestError>({
    queryKey: compareSeasonsQueryKey(refs),
    queryFn: () => apiGet(`/api/compare/seasons?e=${refs.join(',')}`, compareSeasonsSchema),
    enabled: refs.length > 0,
    staleTime: HOUR_MS,
    gcTime: SESSION_MS,
    retry,
  });
}

/** The "Try again" action behind the page's error state. Invalidating asks; it does not fetch. */
export function useRetryCompare(refs: readonly string[]): () => void {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: compareQueryKey(refs) });
    void client.invalidateQueries({ queryKey: compareSeasonsQueryKey(refs) });
  };
}

/**
 * The picker's directory, from the driver index the application already caches.
 *
 * **Pure, and therefore here rather than in a component** (ARCHITECTURE.md §3). Two decisions it
 * makes, both measured:
 *
 * - **818 of 881 drivers, not all of them.** The other 63 hold no race in the archive, so
 *   `GET /api/compare` answers 404 for them — offering one in the picker would put a bay on the
 *   page that can never fill. `races > 0` is exactly the filter, and `firstSeason` is null on
 *   exactly the same rows, which `schemas/directory.ts` asserts on all 881.
 * - **Most races first.** The alphabet is the wrong order for a picker whose reader is looking for
 *   somebody they have heard of, and it puts Adolfo Cruz above Ayrton Senna. The surname sort the
 *   index page uses is a *browsing* order; this is a *finding* one.
 *
 * `colorTeamRef` comes from the driver index, which publishes it for this — the picker has to make
 * a bay recognisable before it is filled, and cannot ask the comparison endpoint about a driver who
 * is not in the comparison yet.
 */
export function selectCandidates(list: DriverList | undefined): CompareCandidate[] {
  if (list === undefined) return [];
  return list.drivers
    .filter((driver) => driver.races > 0)
    .map((driver) => ({
      ref: driver.ref,
      forename: driver.forename,
      surname: driver.surname,
      code: driver.code,
      ...(driver.colorTeamRef === null ? {} : { colorTeamRef: driver.colorTeamRef }),
      ...(driver.firstSeason === null ? {} : { firstSeason: driver.firstSeason }),
      ...(driver.lastSeason === null ? {} : { lastSeason: driver.lastSeason }),
      races: driver.races,
    }))
    .sort((a, b) => b.races - a.races || a.surname.localeCompare(b.surname));
}
