import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../app';
import { invalidateMemo } from '../cache/memo';
import { DB_PATH } from '../config';
import { __resetDb } from '../db';
import { compareDataSchema, compareSeasonsSchema } from '../schemas/compare';
import { apiErrorSchema } from '../schemas/error';

/**
 * The comparison routes' contract.
 *
 * **The parameter-rejection cases need no database and therefore run in CI**, which is where they
 * matter: `?e=` is the first query parameter in this product, so S-4 stops being vacuous here, and
 * a suite that hid it behind a `skipIf` would assert nothing on the runner. A 400 is decided before
 * any statement runs, so none of them needs `data/f1.db`.
 */

const hasDatabase = existsSync(DB_PATH);

async function codeOf(res: Response): Promise<string | false> {
  const parsed = apiErrorSchema.safeParse(await res.json());
  return parsed.success && parsed.data.error.code;
}

describe('GET /api/compare — parameter validation (S-4), no database needed', () => {
  it.each([
    ['/api/compare', 'no e at all — there is no default comparison'],
    ['/api/compare?e=', 'an empty e'],
    ['/api/compare?e=,', 'nothing but a separator'],
    ['/api/compare?e=hamilton,', 'a trailing separator'],
    ['/api/compare?e=,hamilton', 'a leading separator'],
    ['/api/compare?e=a,,b', 'an empty element'],
    ['/api/compare?e=a,b,c,d,e', 'a fifth entity — truncation would answer another question'],
    ['/api/compare?e=hamilton,hamilton', 'a driver against themself'],
    ["/api/compare?e=hamilton'--", 'a SQL fragment'],
    ['/api/compare?e=hamilton%20OR%201=1', 'an injection attempt'],
    ['/api/compare?e=../../etc/passwd', 'a traversal attempt'],
    [`/api/compare?e=${'x'.repeat(33)}`, 'a reference longer than any in the archive'],
    [`/api/compare?e=${'x'.repeat(200)}`, 'an oversized parameter, refused before it is split'],
    ['/api/compare?e=hamilton&kind=team', 'a lens that does not exist yet'],
    ['/api/compare?e=hamilton&kind=', 'an empty kind'],
    ['/api/compare?e=hamilton&kind=DRIVER', 'the right lens in the wrong case'],
  ])('rejects %s (%s) with 400 INVALID_PARAM', async (path) => {
    const res = await app.request(path);
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe('INVALID_PARAM');
  });

  it.each([
    '/api/compare/seasons?e=a,b,c,d,e',
    '/api/compare/seasons?e=hamilton,hamilton',
    "/api/compare/seasons?e=hamilton'--",
    '/api/compare/seasons',
    '/api/compare/seasons?e=',
  ])('rejects %s on the season lens with 400', async (path) => {
    const res = await app.request(path);
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe('INVALID_PARAM');
  });

  /** S-6: the body must not repeat the thing that caused it. */
  it('never echoes the rejected value back in the body', async () => {
    const res = await app.request("/api/compare?e=hamilton'--");
    expect(JSON.stringify(await res.json())).toBe(
      JSON.stringify({
        error: { code: 'INVALID_PARAM', message: 'One or more parameters were invalid.' },
      }),
    );
  });

  it('never emits a stack frame, SQL text or a filesystem path (S-6)', async () => {
    for (const path of ['/api/compare?e=%%%', '/api/compare/seasons?e=%%%']) {
      const text = JSON.stringify(await (await app.request(path)).json());
      expect(text).not.toMatch(
        /SELECT|FROM |JOIN |sqlite|json_each|\bat \w+ \(|\/Users\/|node_modules/i,
      );
    }
  });

  it('answers 404 for a method other than GET, since only GET is registered', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await app.request('/api/compare?e=hamilton', { method });
      expect(res.status).toBe(404);
    }
  });
});

/* ================================================================================================
 * Against the live database.
 * ============================================================================================== */

describe.skipIf(!hasDatabase)('the comparison routes — against the data', () => {
  afterAll(() => {
    invalidateMemo();
    __resetDb();
  });

  it('answers the career lens with a payload matching its own schema', async () => {
    const res = await app.request('/api/compare?e=hamilton,rosberg,max_verstappen,fangio');
    expect(res.status).toBe(200);
    expect(compareDataSchema.safeParse(await res.json()).success).toBe(true);
  });

  it('accepts a single entity, and defaults `kind` to driver', async () => {
    expect((await app.request('/api/compare?e=hamilton')).status).toBe(200);
    expect((await app.request('/api/compare?e=hamilton&kind=driver')).status).toBe(200);
  });

  it('answers the season lens with a payload matching its own schema', async () => {
    const res = await app.request('/api/compare/seasons?e=hamilton,max_verstappen');
    expect(res.status).toBe(200);
    expect(compareSeasonsSchema.safeParse(await res.json()).success).toBe(true);
  });

  /** A well-formed reference the archive cannot compare is a 404, never a 400 (convention 2). */
  it('answers 404 for a well-formed slug no driver holds', async () => {
    const res = await app.request('/api/compare?e=not_a_real_driver');
    expect(res.status).toBe(404);
    expect(await codeOf(res)).toBe('NOT_FOUND');
  });

  it('answers 404 for a driver in the dataset who never started a Grand Prix', async () => {
    expect((await app.request('/api/compare?e=ecclestone')).status).toBe(404);
  });

  it('answers 404 on the season lens for a driver with no race in the archive', async () => {
    const res = await app.request('/api/compare/seasons?e=ecclestone');
    expect(res.status).toBe(404);
    expect(await codeOf(res)).toBe('NOT_FOUND');
  });

  it('sends Cache-Control on both lenses', async () => {
    for (const path of ['/api/compare?e=hamilton', '/api/compare/seasons?e=hamilton']) {
      expect((await app.request(path)).headers.get('Cache-Control')).toBe('public, max-age=3600');
    }
  });

  it('does not let the two patterns shadow each other', async () => {
    expect((await app.request('/api/compare?e=hamilton')).status).toBe(200);
    expect((await app.request('/api/compare/seasons?e=hamilton')).status).toBe(200);
    expect((await app.request('/api/compare/nonsense?e=hamilton')).status).toBe(404);
  });

  it('ignores a query parameter it does not define', async () => {
    const res = await app.request('/api/compare?e=hamilton&sort=wins&limit=99999');
    expect(res.status).toBe(200);
  });
});
