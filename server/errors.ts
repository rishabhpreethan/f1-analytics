import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { DatabaseUnavailableError } from './db';
import { type ApiErrorBody, type ErrorCode, ERROR_MESSAGES, errorBody } from './schemas/error';

/**
 * The non-leaking error boundary (S-6, S-9).
 *
 * Every response body is built from `ERROR_MESSAGES`, which holds fixed strings. No
 * branch here can emit a stack frame, a SQL fragment, a `SQLITE_*` code or a
 * filesystem path. Detail goes to the server console and nowhere else.
 */

export const ERROR_STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  INVALID_PARAM: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  DATABASE_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class ApiError extends Error {
  /** Whole seconds, set only by the rate limiter. */
  readonly retryAfterSeconds?: number;

  constructor(
    readonly code: ErrorCode,
    readonly status: ContentfulStatusCode,
    message: string,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Build an `ApiError` with the status and client-visible message fixed by its code. */
export function apiError(code: ErrorCode, retryAfterSeconds?: number): ApiError {
  return new ApiError(code, ERROR_STATUS[code], ERROR_MESSAGES[code], retryAfterSeconds);
}

export interface ErrorResponse {
  status: ContentfulStatusCode;
  body: ApiErrorBody;
  headers: Record<string, string>;
}

/**
 * Map any throwable to a status and a body. Pure, so every branch is unit-testable:
 * an unrecognised error becomes `500 INTERNAL`, never a passthrough.
 */
export function toErrorResponse(err: unknown): ErrorResponse {
  if (err instanceof ApiError) {
    const headers: Record<string, string> = {};
    if (err.retryAfterSeconds !== undefined) {
      headers['Retry-After'] = String(err.retryAfterSeconds);
    }
    return { status: err.status, body: errorBody(err.code), headers };
  }
  if (err instanceof DatabaseUnavailableError) {
    return {
      status: ERROR_STATUS.DATABASE_UNAVAILABLE,
      body: errorBody('DATABASE_UNAVAILABLE'),
      headers: {},
    };
  }
  return { status: ERROR_STATUS.INTERNAL, body: errorBody('INTERNAL'), headers: {} };
}

/**
 * What the server prints for a throwable. Pure, so what reaches the console is asserted
 * rather than hoped for.
 *
 * **A 4xx is not a fault and must not print a stack trace.** Before F2 there were no
 * route parameters, so `ApiError` was only ever constructed by the rate limiter and this
 * distinction could not be observed. With `:year` live, every mistyped URL produced ten
 * frames of Hono internals and four absolute repository paths — per request, at up to 120
 * requests a minute. That is not an S-6 leak (S-6 governs the response body, and detail
 * to server logs is explicitly permitted) but it is worse operationally than a leak would
 * be visible: a genuine 500 becomes unfindable in the noise, which is exactly when the
 * trace is the thing you need.
 *
 * So a client error logs one line naming its code and status, a **server** error keeps
 * the full object, and anything unrecognised keeps it too — an unknown throwable is by
 * definition the case where the detail has not yet been understood.
 */
export function logLine(err: unknown): [string] | [string, unknown] {
  if (err instanceof DatabaseUnavailableError) {
    // Already explained once at startup, so a fresh clone does not drown the actionable
    // message under one stack trace per request.
    return [`[api] request refused: the data is not available (${err.reason}).`];
  }
  if (err instanceof ApiError && err.status < 500) {
    return [`[api] request rejected: ${err.code} (${String(err.status)}).`];
  }
  return ['[api] request failed:', err];
}

export function onError(err: unknown, c: Context): Response {
  // The one place detail is allowed to exist.
  console.error(...logLine(err));
  const { status, body, headers } = toErrorResponse(err);
  for (const [name, value] of Object.entries(headers)) c.header(name, value);
  return c.json(body, status);
}

export function notFound(c: Context): Response {
  return c.json(errorBody('NOT_FOUND'), ERROR_STATUS.NOT_FOUND);
}
