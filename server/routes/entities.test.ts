import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../app';
import { DB_PATH } from '../config';
import { __resetDb } from '../db';
import { invalidateMemo } from '../cache/memo';
import { apiErrorSchema } from '../schemas/error';
import { circuitSchema } from '../schemas/circuit';
import { driverSchema } from '../schemas/driver';
import { teamSchema } from '../schemas/team';

/**
 * The route contract for the three entity pages: what a request is allowed to do, and
 * what a response is allowed to say.
 *
 * The **parameter-rejection cases need no database** and therefore run in CI, which is
 * where they matter most: S-4 is the one security control on this surface that a code
 * change can silently break, and `:reference` is the first *string* parameter in this
 * product — the two before it were four digits and one or two digits. A 400 is decided
 * before any query runs, so those tests sit outside the gated block.
 */

const hasDatabase = existsSync(DB_PATH);

const RESOURCES = ['drivers', 'teams', 'circuits'] as const;

async function bodyOf(res: Response): Promise<unknown> {
  return res.json();
}

/* ==================================================================================
 * S-4 — no database needed.
 * ================================================================================== */

describe('S-4 — :reference rejects rather than coerces', () => {
  const malformed: [string, string][] = [
    ['', 'empty'],
    ['%20', 'a space'],
    ['max%20verstappen', 'a space inside the slug'],
    ['max.verstappen', 'a dot'],
    ['max/verstappen', 'a path separator'],
    ["alonso'--", 'a SQL fragment'],
    ['alonso%27%20OR%201=1', 'an injection attempt'],
    ['%2E%2E%2F%2E%2E%2Fetc%2Fpasswd', 'path traversal, encoded'],
    ['<script>', 'markup'],
    ['a'.repeat(33), 'beyond the 32-character format ceiling'],
    ['dr%C3%A4ger', 'a non-ASCII letter'],
  ];

  for (const resource of RESOURCES) {
    it.each(malformed)(`/api/${resource}/%s (%s) is 400 INVALID_PARAM`, async (reference) => {
      const res = await app.request(`/api/${resource}/${reference}`);
      // An empty or slash-bearing reference does not match the route at all and is a
      // 404 from the router; everything that reaches the handler is a 400. Both are
      // rejections and neither reaches a query.
      expect([400, 404]).toContain(res.status);
      if (res.status === 400) {
        const parsed = apiErrorSchema.safeParse(await bodyOf(res));
        expect(parsed.success && parsed.data.error.code).toBe('INVALID_PARAM');
      }
    });
  }

  /**
   * S-6 on the exact byte. No error body may echo the value that caused it, or a SQL
   * fragment reaches a page through an error message.
   */
  it('never echoes the offending reference in the body', async () => {
    const res = await app.request(`/api/drivers/alonso'--`);
    const text = await res.text();
    expect(text).not.toContain('alonso');
    expect(text).not.toContain('--');
    expect(text).not.toMatch(/SELECT|FROM|driver_championship/i);
    expect(text).not.toContain('/Users/');
  });

  /**
   * The pattern that reads as obviously right and is wrong. Three driver references carry
   * an uppercase letter, so a lowercase-only allowlist would 400 them — and nobody would
   * notice, because nobody types those URLs by hand.
   */
  it.each(['scott_Brown', 'Changy', 'Cannoc'])(
    'accepts the uppercase reference %s rather than rejecting it',
    async (reference) => {
      const res = await app.request(`/api/drivers/${reference}`);
      expect(res.status).not.toBe(400);
    },
  );

  it.each(['campbell-jones', 'brabham-alfa_romeo', 'ain-diab'])(
    'accepts the hyphenated reference %s',
    async (reference) => {
      const res = await app.request(`/api/drivers/${reference}`);
      expect(res.status).not.toBe(400);
    },
  );

  it('registers GET only — every other method falls through', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await app.request('/api/drivers/alonso', { method });
      expect(res.status).toBe(404);
    }
  });
});

/* ==================================================================================
 * Against the live database.
 * ================================================================================== */

describe.skipIf(!hasDatabase)('entity routes against the live database', () => {
  afterAll(() => {
    __resetDb();
    invalidateMemo();
  });

  it.each([
    ['drivers', 'alonso', driverSchema],
    ['teams', 'ferrari', teamSchema],
    ['circuits', 'monza', circuitSchema],
  ])(
    'GET /api/%s/%s returns a payload that passes its own schema',
    async (resource, ref, schema) => {
      const res = await app.request(`/api/${resource}/${ref}`);
      expect(res.status).toBe(200);
      const parsed = schema.safeParse(await bodyOf(res));
      expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3))).toBe(true);
    },
  );

  /**
   * ARCHITECTURE.md §6 convention 2: a **well-formed** reference the dataset does not hold
   * is a 404, not a 400. Collapsing the two would tell a reader who typed a real name that
   * they made a syntax error.
   */
  it.each(RESOURCES)('GET /api/%s/nobody is 404 NOT_FOUND, not 400', async (resource) => {
    const res = await app.request(`/api/${resource}/nobody`);
    expect(res.status).toBe(404);
    const parsed = apiErrorSchema.safeParse(await bodyOf(res));
    expect(parsed.success && parsed.data.error.code).toBe('NOT_FOUND');
  });

  it('sends Cache-Control on a successful entity response', async () => {
    const res = await app.request('/api/drivers/alonso');
    expect(res.headers.get('Cache-Control')).toMatch(/^public, max-age=\d+$/);
  });

  /**
   * The three literal first segments cannot collide with `/seasons/:year`, and the
   * existing routes must still answer. Registration order is asserted rather than assumed.
   */
  it('does not shadow the season and race routes', async () => {
    expect((await app.request('/api/seasons/2026')).status).toBe(200);
    expect((await app.request('/api/seasons/2026/races/1')).status).toBe(200);
    expect((await app.request('/api/meta')).status).toBe(200);
  });

  it('no response body carries a stack trace, SQL text or an absolute path (S-6)', async () => {
    for (const path of [
      '/api/drivers/alonso',
      '/api/teams/ferrari',
      '/api/circuits/monza',
      '/api/drivers/nobody',
      "/api/drivers/alonso'--",
    ]) {
      const text = await (await app.request(path)).text();
      expect(text).not.toMatch(/\/Users\/|node_modules|SQLITE_|\bat Object\./);
      expect(text).not.toMatch(/\bSELECT\b|\bJOIN\b|session_entry/);
    }
  });
});
