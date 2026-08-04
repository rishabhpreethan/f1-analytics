import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __rateLimitSize, __resetRateLimit, rateLimit } from './rateLimit';
import { notFound, onError } from '../errors';

const WINDOW_MS = 60_000;

function appWithLimit(max: number, maxTrackedClients = 10_000): Hono {
  const app = new Hono();
  app.use('*', rateLimit({ windowMs: WINDOW_MS, max, maxTrackedClients, enabled: true }));
  app.get('/', (c) => c.json({ ok: true }));
  app.notFound(notFound);
  app.onError(onError);
  return app;
}

/** Minimal Node-style env so `getConnInfo` can read a remote address. */
function envFor(address: string): Record<string, unknown> {
  return {
    incoming: { socket: { remoteAddress: address, remotePort: 5000, remoteFamily: 'IPv4' } },
  };
}

describe('server/middleware/rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetRateLimit();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('allows exactly max requests in a window', async () => {
    const app = appWithLimit(3);
    for (let i = 0; i < 3; i += 1) {
      const res = await app.request('/', undefined, envFor('10.0.0.1'));
      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('3');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe(String(2 - i));
    }
  });

  it('returns 429 with Retry-After on request max + 1', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = appWithLimit(2);
    await app.request('/', undefined, envFor('10.0.0.2'));
    await app.request('/', undefined, envFor('10.0.0.2'));
    const res = await app.request('/', undefined, envFor('10.0.0.2'));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(await res.json()).toEqual({
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
    });
  });

  it('resets the window after windowMs', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = appWithLimit(1);
    expect((await app.request('/', undefined, envFor('10.0.0.3'))).status).toBe(200);
    expect((await app.request('/', undefined, envFor('10.0.0.3'))).status).toBe(429);
    vi.advanceTimersByTime(WINDOW_MS + 1);
    expect((await app.request('/', undefined, envFor('10.0.0.3'))).status).toBe(200);
  });

  it('gives two different addresses independent buckets', async () => {
    const app = appWithLimit(1);
    expect((await app.request('/', undefined, envFor('10.0.0.4'))).status).toBe(200);
    expect((await app.request('/', undefined, envFor('10.0.0.5'))).status).toBe(200);
  });

  it('never tracks more clients than maxTrackedClients', async () => {
    const app = appWithLimit(5, 3);
    for (let i = 0; i < 20; i += 1) {
      const res = await app.request('/', undefined, envFor(`10.1.0.${String(i)}`));
      expect(res.status).toBe(200);
      // Remaining stays at max - 1 because every address is new, which is also the
      // proof that eviction did not corrupt another client's counter.
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('4');
      expect(__rateLimitSize()).toBeLessThanOrEqual(3);
    }
  });
});
