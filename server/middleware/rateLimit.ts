import { getConnInfo } from '@hono/node-server/conninfo';
import type { MiddlewareHandler } from 'hono';
import { IS_TEST, RATE_LIMIT } from '../config';
import { apiError } from '../errors';

/**
 * Per-IP fixed-window rate limit (S-13). No dependency: ~30 lines of logic against a
 * single-process read-only server is not worth a transitive surface
 * (ARCHITECTURE.md §10 #9).
 *
 * `X-Forwarded-For` is deliberately **never** consulted. It is client-supplied, so
 * trusting it would let one caller mint unlimited buckets. Deploying behind a proxy
 * needs a new decision-log entry, not a quiet change here.
 *
 * The bucket map is capped and evicts the oldest entry, because an unbounded map is
 * itself a denial-of-service vector.
 */

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  maxTrackedClients: number;
  /** Defaults to disabled under test, so suites are not order-dependent. */
  enabled?: boolean;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweepAt = 0;

/** Test-only: forget every bucket. */
export function __resetRateLimit(): void {
  buckets.clear();
  lastSweepAt = 0;
}

/** Test-only: how many clients are currently tracked. */
export function __rateLimitSize(): number {
  return buckets.size;
}

/**
 * Drop expired buckets. Called on request, throttled to once per window, so no timer
 * has to be kept alive for the life of the process.
 */
function sweep(now: number, windowMs: number): void {
  if (now - lastSweepAt < windowMs) return;
  lastSweepAt = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function clientKey(address: string | undefined): string {
  return address ?? 'unknown';
}

export function rateLimit(opts: RateLimitOptions = RATE_LIMIT): MiddlewareHandler {
  const enabled = opts.enabled ?? !IS_TEST;

  return async function rateLimitMiddleware(c, next) {
    if (!enabled) return next();

    let address: string | undefined;
    try {
      address = getConnInfo(c).remote.address;
    } catch {
      // No connection information available (for example an in-process test request).
      address = undefined;
    }
    const key = clientKey(address);
    const now = Date.now();

    sweep(now, opts.windowMs);

    let bucket = buckets.get(key);
    if (bucket === undefined || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      if (buckets.size >= opts.maxTrackedClients) {
        const oldest = buckets.keys().next();
        if (!oldest.done) buckets.delete(oldest.value);
      }
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, opts.max - bucket.count);
    const resetSeconds = Math.ceil(bucket.resetAt / 1000);
    c.header('X-RateLimit-Limit', String(opts.max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(resetSeconds));

    if (bucket.count > opts.max) {
      throw apiError('RATE_LIMITED', Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
    }

    return next();
  };
}
