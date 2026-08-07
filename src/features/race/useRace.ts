import { type UseQueryResult, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Race,
  type RaceLaps,
  type RaceStints,
  raceLapsSchema,
  raceSchema,
  raceStintsSchema,
} from '@schemas/race';
import { type ApiRequestError, apiGet, isTerminalApiError } from '@/lib/api';

/**
 * The only place the race endpoints are fetched. Components never fetch
 * (ARCHITECTURE.md §3); they receive props.
 *
 * ================================================ why the lap hooks take the race payload
 *
 * **`useRaceLaps` and `useRaceStints` take a `Race`, not a year and a round**, and that is
 * the load-bearing decision in this file rather than a convenience.
 *
 * 484 races in the archive predate 1990 and **exactly zero of them hold a lap row**, so the
 * reduced page is the common case. The requirement is that a client never fetches 1,649 lap
 * rows to discover there are none — and a `useRaceLaps(year, round)` signature makes
 * satisfying that requirement the caller's job, every time, forever. Taking the payload
 * makes it **structural**: the flag that says whether there is anything to fetch is
 * `race.availability.hasLapData`, it lives on the object the hook already needs, and the
 * query is disabled from it. There is no way to call this for 1988 and have it fire.
 *
 * That also gives the request order for free — the spine resolves first, so the two
 * lap-scale queries start with the answer to "is there any point" already in hand.
 *
 * `staleTime` is an hour, matching the `Cache-Control` the server sends, so the browser
 * cache and the query cache expire together rather than one silently masking the other. A
 * completed race's classification has been settled for decades; 1950's for 76 years.
 */

export const raceQueryKey = (year: number, round: number) => ['race', year, round] as const;
export const raceLapsQueryKey = (year: number, round: number) =>
  ['race-laps', year, round] as const;
export const raceStintsQueryKey = (year: number, round: number) =>
  ['race-stints', year, round] as const;

const HOUR_MS = 3_600_000;

const retry = (failureCount: number, error: ApiRequestError): boolean =>
  !isTerminalApiError(error) && failureCount < 1;

/**
 * One race's metadata, classification and availability flags — the page's spine.
 *
 * `ref` is null while the URL parameters have not resolved to a valid address
 * (`resolveRaceRef`). The query is **disabled** rather than fired with a guessed round, so
 * nothing requests `/api/seasons/NaN/races/NaN`.
 */
export function useRace(
  ref: { year: number; round: number } | null,
): UseQueryResult<Race, ApiRequestError> {
  return useQuery<Race, ApiRequestError>({
    queryKey: raceQueryKey(ref?.year ?? 0, ref?.round ?? 0),
    queryFn: () =>
      apiGet(`/api/seasons/${String(ref?.year)}/races/${String(ref?.round)}`, raceSchema),
    enabled: ref !== null,
    staleTime: HOUR_MS,
    gcTime: HOUR_MS,
    retry,
  });
}

/**
 * Per-lap positions and times for the whole field (RD-1, RD-2, RD-4).
 *
 * **Fires only when the race says it has lap data.** See the module note: this is why the
 * parameter is the payload and not a year and a round.
 *
 * It is the largest payload in the product — 1,649 rows on 2010 R18, the biggest race in
 * the archive — which is the other reason it is a separate query from the spine rather than
 * a field on it. A reader who only wants the classification never pays for it.
 */
export function useRaceLaps(race: Race | undefined): UseQueryResult<RaceLaps, ApiRequestError> {
  const enabled = race !== undefined && race.availability.hasLapData;
  return useQuery<RaceLaps, ApiRequestError>({
    queryKey: raceLapsQueryKey(race?.year ?? 0, race?.round ?? 0),
    queryFn: () =>
      apiGet(
        `/api/seasons/${String(race?.year)}/races/${String(race?.round)}/laps`,
        raceLapsSchema,
      ),
    enabled,
    staleTime: HOUR_MS,
    gcTime: HOUR_MS,
    retry,
  });
}

/**
 * Pit stops and derived stints (RD-3, RD-7, and RD-4's pit-lap exclusions).
 *
 * **Fires only when the race says it has pit data**, which is 2011+ and, measured, every
 * such race except 2021 R12 — the Belgian Grand Prix run behind the safety car, which has
 * lap rows and no stops at all.
 */
export function useRaceStints(race: Race | undefined): UseQueryResult<RaceStints, ApiRequestError> {
  const enabled = race !== undefined && race.availability.hasPitData;
  return useQuery<RaceStints, ApiRequestError>({
    queryKey: raceStintsQueryKey(race?.year ?? 0, race?.round ?? 0),
    queryFn: () =>
      apiGet(
        `/api/seasons/${String(race?.year)}/races/${String(race?.round)}/stints`,
        raceStintsSchema,
      ),
    enabled,
    staleTime: HOUR_MS,
    gcTime: HOUR_MS,
    retry,
  });
}

/**
 * The "Try again" action behind a race-page state card.
 *
 * It lives in the feature rather than in the state components so the query keys stay in one
 * place and the components stay free of fetching — invalidating a key asks TanStack Query
 * to refetch, it does not perform a request itself (ARCHITECTURE.md §3).
 *
 * Honest by construction: a 404 produces the same 404, and `isTerminalApiError` already
 * stops the automatic retry so the state card says so rather than spinning.
 */
export function useRetryRace(ref: { year: number; round: number } | null): () => void {
  const client = useQueryClient();
  return () => {
    if (ref === null) return;
    void client.invalidateQueries({ queryKey: raceQueryKey(ref.year, ref.round) });
    void client.invalidateQueries({ queryKey: raceLapsQueryKey(ref.year, ref.round) });
    void client.invalidateQueries({ queryKey: raceStintsQueryKey(ref.year, ref.round) });
  };
}
