import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateMemo, memoize } from './memo';

describe('server/cache/memo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invalidateMemo();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs produce once within the TTL', () => {
    const produce = vi.fn(() => 1);
    expect(memoize('k', 1000, produce)).toBe(1);
    vi.advanceTimersByTime(999);
    expect(memoize('k', 1000, produce)).toBe(1);
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('re-runs produce after the TTL', () => {
    let n = 0;
    const produce = vi.fn(() => ++n);
    expect(memoize('k', 1000, produce)).toBe(1);
    vi.advanceTimersByTime(1001);
    expect(memoize('k', 1000, produce)).toBe(2);
    expect(produce).toHaveBeenCalledTimes(2);
  });

  it('invalidateMemo forces a re-run', () => {
    let n = 0;
    const produce = vi.fn(() => ++n);
    expect(memoize('k', 60_000, produce)).toBe(1);
    invalidateMemo('k');
    expect(memoize('k', 60_000, produce)).toBe(2);
    expect(produce).toHaveBeenCalledTimes(2);
  });
});
