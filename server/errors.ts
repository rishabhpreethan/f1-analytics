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

export function onError(err: unknown, c: Context): Response {
  // The one place detail is allowed to exist.
  console.error('[api] request failed:', err);
  const { status, body, headers } = toErrorResponse(err);
  for (const [name, value] of Object.entries(headers)) c.header(name, value);
  return c.json(body, status);
}

export function notFound(c: Context): Response {
  return c.json(errorBody('NOT_FOUND'), ERROR_STATUS.NOT_FOUND);
}
