import { describe, expect, it } from 'vitest';
import { apiErrorSchema } from './error';
import { coverageSchema, metaSchema, roundRefSchema } from './meta';
import { META_REAL } from './meta.fixture';

describe('server/schemas/meta', () => {
  it('accepts the verified payload', () => {
    expect(metaSchema.parse(META_REAL)).toEqual(META_REAL);
  });

  it('rejects round 0 and a null round', () => {
    const base = META_REAL.latestCompletedRound;
    expect(base).not.toBeNull();
    expect(roundRefSchema.safeParse({ ...base, round: 0 }).success).toBe(false);
    expect(roundRefSchema.safeParse({ ...base, round: null }).success).toBe(false);
    expect(roundRefSchema.safeParse({ ...base, round: 1 }).success).toBe(true);
  });

  it('rejects a date that is not YYYY-MM-DD', () => {
    const base = META_REAL.latestCompletedRound;
    for (const date of ['19 Jul 2026', '2026-7-19', '2026-07-19T00:00:00Z', '']) {
      expect(roundRefSchema.safeParse({ ...base, date }).success).toBe(false);
    }
  });

  it('accepts a null latestCompletedRound', () => {
    expect(metaSchema.safeParse({ ...META_REAL, latestCompletedRound: null }).success).toBe(true);
  });

  it('accepts an open-ended coverage window', () => {
    expect(coverageSchema.parse(META_REAL.coverage).laps.to).toBeNull();
  });

  it('rejects an unknown or missing coverage key', () => {
    const withExtra = { ...META_REAL.coverage, practice: { from: 2006, to: null } };
    expect(coverageSchema.safeParse(withExtra).success).toBe(false);

    const missing: Record<string, unknown> = { ...META_REAL.coverage };
    delete missing.laps;
    expect(coverageSchema.safeParse(missing).success).toBe(false);
  });
});

describe('server/schemas/error', () => {
  it('rejects an unknown error code', () => {
    expect(
      apiErrorSchema.safeParse({ error: { code: 'TEAPOT', message: 'Not found.' } }).success,
    ).toBe(false);
    expect(
      apiErrorSchema.safeParse({ error: { code: 'NOT_FOUND', message: 'Not found.' } }).success,
    ).toBe(true);
  });
});
