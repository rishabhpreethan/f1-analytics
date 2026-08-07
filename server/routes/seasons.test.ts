import { existsSync } from 'node:fs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app';
import { invalidateMemo } from '../cache/memo';
import { DB_PATH } from '../config';
import { __resetDb } from '../db';
import { apiErrorSchema } from '../schemas/error';
import { seasonListSchema, seasonSchema, standingsProgressionSchema } from '../schemas/season';

/**
 * The route contract: what a request is allowed to do, and what a response is allowed
 * to say.
 *
 * The **parameter-rejection cases need no database** and therefore run in CI, which is
 * where they matter: S-4 is the one security control on this surface that a code change
 * can silently break, and a suite that only exercised it behind a `skipIf` would assert
 * nothing on the runner. They are kept out of the gated block on purpose — a 400 is
 * decided before any query runs.
 */

const hasDatabase = existsSync(DB_PATH);

async function bodyOf(res: Response): Promise<unknown> {
  return res.json();
}

describe('GET /api/seasons/:year — parameter validation (S-4), no database needed', () => {
  /**
   * `/api/seasons/` never reaches the validator: Hono does not match an empty segment
   * against `:year`, so the 404 handler answers. Asserted rather than assumed, because
   * the empty string is precisely the input `z.coerce.number()` reads as the year 0 —
   * this records that on this router it cannot even get that far.
   */
  it('answers 404 for an empty year segment — the router never matches it', async () => {
    const res = await app.request('/api/seasons/');
    expect(res.status).toBe(404);
  });

  it.each([
    ['abc', 'not a number'],
    ['0x7c6', 'hexadecimal 1990'],
    ['1990.5', 'a float'],
    ['%201990', 'leading whitespace, encoded'],
    ['+1990', 'signed'],
    ['-1990', 'negative'],
    ['19900', 'five digits'],
    ['990', 'three digits'],
    ['1e3', 'exponent notation'],
    ['1949', 'below the first season'],
    ["1990'--", 'a SQL fragment'],
    ['1990%20OR%201=1', 'an injection attempt'],
  ])('rejects %s (%s) with 400 INVALID_PARAM', async (year) => {
    const res = await app.request(`/api/seasons/${year}`);
    expect(res.status).toBe(400);
    const parsed = apiErrorSchema.safeParse(await bodyOf(res));
    expect(parsed.success && parsed.data.error.code).toBe('INVALID_PARAM');
  });

  it('rejects a malformed year on the standings route too', async () => {
    const res = await app.request('/api/seasons/abc/standings');
    expect(res.status).toBe(400);
  });

  /**
   * S-6. The 400 must not echo the thing that caused it — an error body that repeats a
   * request value is the first half of a reflected-content problem, and it is also how a
   * SQL fragment ends up rendered on a page.
   */
  it('never echoes the rejected value back in the body', async () => {
    const res = await app.request("/api/seasons/1990'--");
    const text = JSON.stringify(await bodyOf(res));
    expect(text).not.toContain('1990');
    expect(text).not.toContain('--');
    expect(text).toBe(
      JSON.stringify({
        error: { code: 'INVALID_PARAM', message: 'One or more parameters were invalid.' },
      }),
    );
  });

  it('never emits a stack frame, SQL text or a filesystem path (S-6)', async () => {
    const text = JSON.stringify(await bodyOf(await app.request('/api/seasons/abc')));
    expect(text).not.toMatch(/SELECT|FROM |JOIN |sqlite|\bat \w+ \(|\/Users\/|node_modules/i);
  });

  it('answers 404 for a method other than GET, since only GET is registered', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await app.request('/api/seasons', { method });
      expect(res.status).toBe(404);
    }
  });
});

describe.skipIf(!hasDatabase)('the season routes — against the data', () => {
  beforeEach(() => {
    invalidateMemo();
  });

  afterAll(() => {
    invalidateMemo();
    __resetDb();
  });

  it('GET /api/seasons returns 77 seasons that match the schema', async () => {
    const res = await app.request('/api/seasons');
    expect(res.status).toBe(200);
    const parsed = seasonListSchema.safeParse(await bodyOf(res));
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.seasons).toHaveLength(77);
  });

  it('GET /api/seasons/2026 returns the partial current season', async () => {
    const res = await app.request('/api/seasons/2026');
    expect(res.status).toBe(200);
    const parsed = seasonSchema.safeParse(await bodyOf(res));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.scheduledRounds).toBe(22);
    expect(parsed.data.completedRounds).toBe(10);
    expect(parsed.data.cancelledRounds).toHaveLength(2);
    expect(parsed.data.isComplete).toBe(false);
  });

  it('GET /api/seasons/1950 returns a complete season with no team standings', async () => {
    const parsed = seasonSchema.safeParse(await bodyOf(await app.request('/api/seasons/1950')));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.isComplete).toBe(true);
    expect(parsed.data.scoring.teamCounting).toBe('none');
    expect(parsed.data.standings.teams).toEqual([]);
  });

  it('GET /api/seasons/2026/standings returns the progression', async () => {
    const res = await app.request('/api/seasons/2026/standings');
    expect(res.status).toBe(200);
    expect(standingsProgressionSchema.safeParse(await bodyOf(res)).success).toBe(true);
  });

  /**
   * The distinction the two failure modes exist for. 2027 is a syntactically perfect
   * year; telling its reader they made a syntax error would send them looking in the
   * wrong place.
   */
  it('answers 404, not 400, for a well-formed year the data does not hold', async () => {
    for (const path of ['/api/seasons/2027', '/api/seasons/2099/standings']) {
      const res = await app.request(path);
      expect(res.status).toBe(404);
      const parsed = apiErrorSchema.safeParse(await bodyOf(res));
      expect(parsed.success && parsed.data.error.code).toBe('NOT_FOUND');
    }
  });

  it('sends Cache-Control on every season response — the data is immutable', async () => {
    for (const path of ['/api/seasons', '/api/seasons/2026', '/api/seasons/2026/standings']) {
      const res = await app.request(path);
      expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
    }
  });

  it('carries the same security headers as every other response (S-9)', async () => {
    const res = await app.request('/api/seasons');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
  });

  it('routes /api/seasons to the list, not to the :year handler', async () => {
    const parsed = seasonListSchema.safeParse(await bodyOf(await app.request('/api/seasons')));
    expect(parsed.success).toBe(true);
  });
});
