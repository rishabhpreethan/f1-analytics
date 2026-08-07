import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../app';
import { DB_PATH } from '../config';
import { __resetDb } from '../db';
import { apiErrorSchema } from '../schemas/error';
import { raceLapsSchema, raceSchema, raceStintsSchema } from '../schemas/race';

/**
 * The route contract for the race page: what a request is allowed to do, and what a
 * response is allowed to say.
 *
 * The **parameter-rejection cases need no database** and therefore run in CI, which is
 * where they matter most: S-4 is the one security control on this surface that a code
 * change can silently break, and `:round` is the first parameter added since `:year`.
 * A 400 is decided before any query runs, so those tests sit outside the gated block.
 */

const hasDatabase = existsSync(DB_PATH);

async function bodyOf(res: Response): Promise<unknown> {
  return res.json();
}

/* ==================================================================================
 * S-4 — no database needed.
 * ================================================================================== */

describe('S-4 — :round rejects rather than coerces', () => {
  it.each([
    ['0', 'round zero does not exist'],
    ['01', 'a second spelling of round 1'],
    ['1.0', 'a float that coerces to 1'],
    ['0x1', 'hexadecimal 1'],
    ['+1', 'signed'],
    ['-1', 'negative'],
    ['1e1', 'exponent notation'],
    ['100', 'three digits'],
    ['51', 'beyond the format ceiling'],
    ['abc', 'not a number'],
    ["1'--", 'a SQL fragment'],
    ['1%20OR%201=1', 'an injection attempt'],
    ['%201', 'leading whitespace, encoded'],
    ['NaN', 'the string NaN'],
  ])('rejects round %s (%s) with 400 INVALID_PARAM', async (round) => {
    const res = await app.request(`/api/seasons/2026/races/${round}`);
    expect(res.status).toBe(400);
    const parsed = apiErrorSchema.safeParse(await bodyOf(res));
    expect(parsed.success && parsed.data.error.code).toBe('INVALID_PARAM');
  });

  it.each([
    ['abc', 'not a number'],
    ['0x7c6', 'hexadecimal 1990'],
    ['1990.5', 'a float'],
    ['1949', 'below the first season'],
    ["1990'--", 'a SQL fragment'],
  ])('rejects year %s (%s) with 400 INVALID_PARAM', async (year) => {
    const res = await app.request(`/api/seasons/${year}/races/1`);
    expect(res.status).toBe(400);
    const parsed = apiErrorSchema.safeParse(await bodyOf(res));
    expect(parsed.success && parsed.data.error.code).toBe('INVALID_PARAM');
  });

  it('rejects a malformed round on the laps and stints routes too', async () => {
    for (const path of ['/api/seasons/2026/races/0/laps', '/api/seasons/2026/races/0/stints']) {
      const res = await app.request(path);
      expect(res.status).toBe(400);
    }
  });

  /**
   * `/api/seasons/2026/races/` never reaches the validator: Hono does not match an empty
   * segment against `:round`, so the 404 handler answers. Asserted rather than assumed,
   * because the empty string is precisely the input `z.coerce.number()` reads as 0.
   */
  it('answers 404 for an empty round segment — the router never matches it', async () => {
    const res = await app.request('/api/seasons/2026/races/');
    expect(res.status).toBe(404);
  });

  /**
   * S-6 on the exact byte. A parameter carrying a SQL fragment must not come back in the
   * body, or `/api/seasons/2026/races/1'--` puts SQL text on a page.
   */
  it('never echoes the offending value, on either parameter (S-6)', async () => {
    for (const path of ["/api/seasons/2026/races/1'--", "/api/seasons/1990'--/races/1"]) {
      const res = await app.request(path);
      const text = JSON.stringify(await bodyOf(res));
      expect(text).not.toContain("'--");
      expect(text).not.toMatch(/SELECT|FROM|lap|session_entry/i);
    }
  });

  it('registers only GET — no other method reaches a handler', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await app.request('/api/seasons/2026/races/1', { method });
      expect(res.status).toBe(404);
    }
  });
});

/* ==================================================================================
 * Against the live database. Skipped where `data/f1.db` is absent — which is CI, and
 * the reporter prints the skip.
 * ================================================================================== */

describe.skipIf(!hasDatabase)('the three race endpoints', () => {
  afterAll(() => {
    __resetDb();
  });

  it('serves a race that has everything, and it validates its own schema', async () => {
    const res = await app.request('/api/seasons/2026/races/1');
    expect(res.status).toBe(200);
    const parsed = raceSchema.safeParse(await bodyOf(res));
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success && parsed.data.availability).toEqual({
      hasLapData: true,
      hasPitData: true,
    });
  });

  /**
   * The common case: 484 races have no lap data, so the reduced page must be a 200 with
   * an honest payload rather than an error or an empty-looking success.
   */
  it('serves a 1988 race as a full 200 with both availability flags false', async () => {
    const res = await app.request('/api/seasons/1988/races/1');
    expect(res.status).toBe(200);
    const parsed = raceSchema.safeParse(await bodyOf(res));
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success && parsed.data.availability).toEqual({
      hasLapData: false,
      hasPitData: false,
    });
    expect(parsed.success && parsed.data.hasResults).toBe(true);
    expect(parsed.success && parsed.data.classification.length).toBe(26);
  });

  it('serves the lap payload, and it validates its own schema', async () => {
    const res = await app.request('/api/seasons/2026/races/1/laps');
    expect(res.status).toBe(200);
    const parsed = raceLapsSchema.safeParse(await bodyOf(res));
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success && parsed.data.lapCount).toBe(1003);
  });

  it('serves the stint payload, and it validates its own schema', async () => {
    const res = await app.request('/api/seasons/2026/races/1/stints');
    expect(res.status).toBe(200);
    const parsed = raceStintsSchema.safeParse(await bodyOf(res));
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success && parsed.data.durations.stops).toBe(32);
  });

  /**
   * A race with no lap data answers 200 with an empty payload, not 404: the resource
   * exists and the answer is "none". A 404 here would make the designed no-coverage
   * state indistinguishable from a broken URL.
   */
  it('answers 200 with an empty lap payload for a race that has none', async () => {
    const res = await app.request('/api/seasons/1988/races/1/laps');
    expect(res.status).toBe(200);
    const parsed = raceLapsSchema.safeParse(await bodyOf(res));
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success && parsed.data).toMatchObject({
      lapCount: 0,
      firstLap: null,
      lastLap: null,
      drivers: [],
    });
  });

  it.each([
    ['a round the season does not hold', '/api/seasons/2026/races/40'],
    ['a year the dataset does not hold', '/api/seasons/2027/races/1'],
    ['the same, on the laps route', '/api/seasons/2027/races/1/laps'],
    ['the same, on the stints route', '/api/seasons/2027/races/1/stints'],
  ])(
    'answers 404 NOT_FOUND for %s — a well-formed request, not a syntax error',
    async (_l, path) => {
      const res = await app.request(path);
      expect(res.status).toBe(404);
      const parsed = apiErrorSchema.safeParse(await bodyOf(res));
      expect(parsed.success && parsed.data.error.code).toBe('NOT_FOUND');
    },
  );

  it('sends Cache-Control — the dataset is immutable between refreshes', async () => {
    for (const path of [
      '/api/seasons/2026/races/1',
      '/api/seasons/2026/races/1/laps',
      '/api/seasons/2026/races/1/stints',
    ]) {
      const res = await app.request(path);
      expect(res.headers.get('Cache-Control')).toMatch(/^public, max-age=\d+$/);
    }
  });

  /**
   * The neighbouring season routes must keep working: `/seasons/:year/races/:round` is
   * four segments and `/seasons/:year/standings` is three, so nothing shadows anything —
   * asserted rather than reasoned about, because a router's matching order is exactly the
   * kind of thing that is obvious until it is not.
   */
  it('does not shadow the season routes it nests under', async () => {
    for (const path of ['/api/seasons', '/api/seasons/2026', '/api/seasons/2026/standings']) {
      expect((await app.request(path)).status).toBe(200);
    }
  });

  /**
   * §8's p95 budget for a lap endpoint is 200 ms. This is not a benchmark — a single
   * timing in a test runner under load proves little — so the assertion is deliberately
   * loose and exists to catch an order-of-magnitude regression, such as a lost index or
   * an accidental full scan. The real figures are in `queries/race.ts`, measured with
   * warm prepared statements over 30 runs: 1.45 ms for the largest race in the archive.
   */
  it('serves the largest lap payload in the archive well inside the §8 budget', async () => {
    const started = performance.now();
    const res = await app.request('/api/seasons/2010/races/18/laps');
    const elapsed = performance.now() - started;
    expect(res.status).toBe(200);
    const parsed = raceLapsSchema.safeParse(await bodyOf(res));
    expect(parsed.success && parsed.data.lapCount).toBe(1649);
    expect(elapsed).toBeLessThan(200);
  });
});
