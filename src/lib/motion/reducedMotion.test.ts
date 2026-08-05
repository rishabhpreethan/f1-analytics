import { describe, expect, it, vi } from 'vitest';
import { MOTION_QUERY_ALLOW, MOTION_QUERY_REDUCE, prefersReducedMotion } from './reducedMotion';

/**
 * CT-4. Three cases, and the third is the one that matters: a missing `matchMedia` must
 * not throw. jsdom has none by default, and some embedded webviews have none at all — a
 * predicate that throws there takes the whole shell down.
 */

function windowWith(matches: boolean): Pick<Window, 'matchMedia'> {
  return {
    matchMedia: vi.fn((query: string) => ({
      matches,
      media: query,
    })) as unknown as Window['matchMedia'],
  };
}

describe('CT-4 — prefersReducedMotion', () => {
  it('is true when matchMedia reports a match', () => {
    const win = windowWith(true);
    expect(prefersReducedMotion(win)).toBe(true);
    expect(win.matchMedia).toHaveBeenCalledWith(MOTION_QUERY_REDUCE);
  });

  it('is false when matchMedia reports no match', () => {
    expect(prefersReducedMotion(windowWith(false))).toBe(false);
  });

  it('is false, not a throw, when matchMedia is absent', () => {
    expect(prefersReducedMotion({} as Pick<Window, 'matchMedia'>)).toBe(false);
  });

  it('is false, not a throw, when matchMedia itself throws', () => {
    const win = {
      matchMedia: vi.fn(() => {
        throw new Error('unsupported media feature');
      }),
    } as unknown as Pick<Window, 'matchMedia'>;
    expect(prefersReducedMotion(win)).toBe(false);
  });

  it('states the two complementary queries the mechanism is built on', () => {
    expect(MOTION_QUERY_REDUCE).toBe('(prefers-reduced-motion: reduce)');
    expect(MOTION_QUERY_ALLOW).toBe('(prefers-reduced-motion: no-preference)');
  });
});
