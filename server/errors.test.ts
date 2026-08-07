import { describe, expect, it } from 'vitest';
import { DatabaseUnavailableError } from './db';
import { ERROR_STATUS, apiError, logLine, toErrorResponse } from './errors';
import { ERROR_CODES, ERROR_MESSAGES, apiErrorSchema } from './schemas/error';

describe('server/errors', () => {
  it('maps every code to its status', () => {
    const expected: Record<string, number> = {
      INVALID_PARAM: 400,
      NOT_FOUND: 404,
      RATE_LIMITED: 429,
      DATABASE_UNAVAILABLE: 503,
      INTERNAL: 500,
    };
    for (const code of ERROR_CODES) {
      expect(apiError(code).status).toBe(expected[code]);
      expect(ERROR_STATUS[code]).toBe(expected[code]);
      expect(apiError(code).message).toBe(ERROR_MESSAGES[code]);
    }
  });

  it('turns an arbitrary error into 500 INTERNAL with the fixed message', () => {
    const leaky = new Error(
      "SQLITE_ERROR: no such table: season while running 'select 1' at /Users/x/data/f1.db",
    );
    const { status, body } = toErrorResponse(leaky);
    expect(status).toBe(500);
    expect(body).toEqual({ error: { code: 'INTERNAL', message: 'Something went wrong.' } });
  });

  it('turns a non-Error throwable into 500 INTERNAL', () => {
    expect(toErrorResponse('boom').status).toBe(500);
    expect(toErrorResponse(undefined).body.error.code).toBe('INTERNAL');
  });

  it('leaks no path, SQL or driver code on any branch (S-6)', () => {
    const throwables: unknown[] = [
      ...ERROR_CODES.map((code) => apiError(code)),
      new DatabaseUnavailableError('missing'),
      new DatabaseUnavailableError('unreadable'),
      new DatabaseUnavailableError('schema'),
      new Error('SQLITE_CANTOPEN: unable to open database file /abs/path/data/f1.db'),
      Object.assign(new Error('select * from season'), { code: 'SQLITE_ERROR' }),
      'a bare string',
      null,
    ];

    for (const throwable of throwables) {
      const { body } = toErrorResponse(throwable);
      const serialised = JSON.stringify(body);
      expect(apiErrorSchema.safeParse(body).success).toBe(true);
      expect(serialised).not.toMatch(/(^|[^a-z])\/[a-z]/i);
      expect(serialised).not.toContain('SQLITE_');
      expect(serialised.toLowerCase()).not.toContain('select');
      expect(serialised).not.toContain('Error:');
    }
  });

  it('maps DatabaseUnavailableError to 503 DATABASE_UNAVAILABLE', () => {
    for (const reason of ['missing', 'unreadable', 'schema'] as const) {
      const { status, body } = toErrorResponse(new DatabaseUnavailableError(reason));
      expect(status).toBe(503);
      expect(body).toEqual({
        error: { code: 'DATABASE_UNAVAILABLE', message: 'The data is not available.' },
      });
    }
  });

  it('carries Retry-After only when the rate limiter set it', () => {
    expect(toErrorResponse(apiError('RATE_LIMITED', 42)).headers).toEqual({ 'Retry-After': '42' });
    expect(toErrorResponse(apiError('RATE_LIMITED')).headers).toEqual({});
  });
});

/**
 * What the process prints, as opposed to what it returns.
 *
 * Added in F2 because `:year` made the branch reachable: before it, `ApiError` was only
 * ever constructed by the rate limiter, and a mistyped URL could not exist. Observed on a
 * running server — `/api/seasons/abc` produced ten frames of Hono internals and four
 * absolute repository paths, per request.
 */
describe('server/errors — what is logged (as distinct from what is returned)', () => {
  it('logs a client error as one line, with no stack and no path', () => {
    for (const code of ['INVALID_PARAM', 'NOT_FOUND', 'RATE_LIMITED'] as const) {
      const line = logLine(apiError(code));
      expect(line).toHaveLength(1);
      expect(line[0]).toContain(code);
      expect(line[0]).not.toMatch(/\bat \w+ \(|\/Users\/|node_modules/);
    }
  });

  it('keeps the whole object for a 500, which is when the trace is the point', () => {
    const internal = apiError('INTERNAL');
    expect(logLine(internal)).toEqual(['[api] request failed:', internal]);
  });

  it('keeps the whole object for an unrecognised throwable', () => {
    const boom = new Error('SQLITE_ERROR: no such table: season');
    expect(logLine(boom)).toEqual(['[api] request failed:', boom]);
    expect(logLine('a bare string')).toEqual(['[api] request failed:', 'a bare string']);
  });

  it('logs an unavailable database as one line naming the reason', () => {
    expect(logLine(new DatabaseUnavailableError('missing'))).toEqual([
      '[api] request refused: the data is not available (missing).',
    ]);
  });
});
