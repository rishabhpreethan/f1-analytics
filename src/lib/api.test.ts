import { META_REAL } from '@schemas/meta.fixture';
import { metaSchema } from '@schemas/meta';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, apiGet } from './api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(impl: () => Promise<Response>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => impl()),
  );
}

async function expectApiError(promise: Promise<unknown>): Promise<ApiRequestError> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(ApiRequestError);
    return err as ApiRequestError;
  }
  throw new Error('expected apiGet to reject');
}

describe('apiGet', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a valid response into a typed value', async () => {
    mockFetch(() => Promise.resolve(jsonResponse(META_REAL)));
    await expect(apiGet('/api/meta', metaSchema)).resolves.toEqual(META_REAL);
  });

  it('surfaces a 503 error envelope as DATABASE_UNAVAILABLE', async () => {
    mockFetch(() =>
      Promise.resolve(
        jsonResponse(
          { error: { code: 'DATABASE_UNAVAILABLE', message: 'The data is not available.' } },
          503,
        ),
      ),
    );
    const err = await expectApiError(apiGet('/api/meta', metaSchema));
    expect(err.code).toBe('DATABASE_UNAVAILABLE');
    expect(err.status).toBe(503);
    expect(err.message).toBe('The data is not available.');
  });

  it('treats an HTML error body as MALFORMED', async () => {
    mockFetch(() =>
      Promise.resolve(
        new Response('<!doctype html><title>500</title>', {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );
    const err = await expectApiError(apiGet('/api/meta', metaSchema));
    expect(err.code).toBe('MALFORMED');
    expect(err.status).toBe(500);
  });

  it('treats a 200 that fails the schema as MALFORMED', async () => {
    mockFetch(() => Promise.resolve(jsonResponse({ seasons: { firstYear: 1950 } })));
    const err = await expectApiError(apiGet('/api/meta', metaSchema));
    expect(err.code).toBe('MALFORMED');
  });

  it('treats a network rejection as NETWORK', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    const err = await expectApiError(apiGet('/api/meta', metaSchema));
    expect(err.code).toBe('NETWORK');
    expect(err.status).toBeNull();
  });

  it('makes an absolute URL a compile error (DL-2)', async () => {
    mockFetch(() => Promise.resolve(jsonResponse(META_REAL)));
    await expect(
      // @ts-expect-error — only same-origin `/api/...` paths are accepted by the type.
      apiGet('https://example.test/api/meta', metaSchema),
    ).resolves.toBeDefined();
  });
});
