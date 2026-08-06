/**
 * In-process memoisation for aggregate responses (DL-4).
 *
 * The database is immutable between refreshes, so a short TTL is enough to make the
 * cold path a once-per-TTL event while keeping the data-coverage figures honest.
 * Established here on a trivial case so every later aggregate endpoint reuses it.
 */

interface Entry {
  value: unknown;
  expiresAt: number;
}

const entries = new Map<string, Entry>();

export function memoize<T>(key: string, ttlMs: number, produce: () => T): T {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const value = produce();
  entries.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** Test-only: drop one key, or every key. */
export function invalidateMemo(key?: string): void {
  if (key === undefined) entries.clear();
  else entries.delete(key);
}
