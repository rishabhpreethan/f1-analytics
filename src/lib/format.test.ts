import { describe, expect, it } from 'vitest';
import { formatIsoDate } from './format';

describe('formatIsoDate', () => {
  it('is stable and locale-independent', () => {
    expect(formatIsoDate('2026-07-19')).toBe('19 Jul 2026');
    expect(formatIsoDate('1950-05-13')).toBe('13 May 1950');
    // Leading zeros are dropped from the day but never from the year.
    expect(formatIsoDate('2011-01-01')).toBe('1 Jan 2011');
  });

  it('returns an unparseable input unchanged, never "Invalid Date"', () => {
    for (const input of ['', 'tomorrow', '19-07-2026', '2026-13-01', '2026-07-32', '2026-7-9']) {
      expect(formatIsoDate(input)).toBe(input);
      expect(formatIsoDate(input)).not.toContain('Invalid');
    }
  });
});
