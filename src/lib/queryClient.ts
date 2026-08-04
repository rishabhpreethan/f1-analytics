import { QueryClient } from '@tanstack/react-query';

/**
 * TanStack Query owns every server response. Server data is **never** mirrored into
 * React state (ARCHITECTURE.md §3) — mirroring is how staleness bugs start.
 *
 * The database is immutable between refreshes, so a long `staleTime` costs nothing and
 * refetching on window focus would be pure noise.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60_000,
      retry: 1,
    },
  },
});
