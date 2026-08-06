import { type ErrorCode, apiErrorSchema } from '@schemas/error';
import type { ZodType } from 'zod';

/**
 * The only way this application talks to its server.
 *
 * The `path` parameter is typed `/api/${string}`, so an absolute URL is a **compile
 * error** rather than something review has to catch. That is DL-2 (no third-party
 * network call on any request path) enforced by the type system, and `connect-src
 * 'self'` enforces the same rule again in the browser.
 *
 * There is no retry logic here — TanStack Query owns retries.
 */

export type ApiRequestErrorCode = ErrorCode | 'NETWORK' | 'MALFORMED';

export class ApiRequestError extends Error {
  constructor(
    readonly code: ApiRequestErrorCode,
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

export async function apiGet<T>(path: `/api/${string}`, schema: ZodType<T>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiRequestError('NETWORK', null, 'The request could not be completed.');
  }

  if (!res.ok) {
    const envelope = apiErrorSchema.safeParse(await readJson(res));
    if (envelope.success) {
      throw new ApiRequestError(envelope.data.error.code, res.status, envelope.data.error.message);
    }
    throw new ApiRequestError(
      'MALFORMED',
      res.status,
      'The server returned an unexpected response.',
    );
  }

  // A response that does not match its own schema is an error, not something to
  // render. Half-rendering a drifted payload is how a wrong number reaches a reader.
  const parsed = schema.safeParse(await readJson(res));
  if (!parsed.success) {
    throw new ApiRequestError(
      'MALFORMED',
      res.status,
      'The server returned an unexpected response.',
    );
  }
  return parsed.data;
}
