import { z } from 'zod';

/**
 * The error envelope, shared with the client via the `@schemas/*` alias.
 *
 * This module may import **only** `zod` (ARCHITECTURE.md §3): one server-only import
 * here breaks the browser bundle.
 */

export const ERROR_CODES = [
  'INVALID_PARAM',
  'NOT_FOUND',
  'RATE_LIMITED',
  'DATABASE_UNAVAILABLE',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Client-visible messages. Fixed strings with no interpolation, so no branch can put
 * a path, a SQL fragment or a driver code into a response body (S-6).
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_PARAM: 'One or more parameters were invalid.',
  NOT_FOUND: 'Not found.',
  RATE_LIMITED: 'Too many requests. Please slow down.',
  DATABASE_UNAVAILABLE: 'The data is not available.',
  INTERNAL: 'Something went wrong.',
};

export const apiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum(ERROR_CODES),
    message: z.string().min(1),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

/** Build the envelope for a code. The message is never caller-supplied. */
export function errorBody(code: ErrorCode): ApiErrorBody {
  return { error: { code, message: ERROR_MESSAGES[code] } };
}
