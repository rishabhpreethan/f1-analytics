import { describe, expect, it } from 'vitest';
import { formatDuration, formatGap, formatIsoDate } from './format';

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

describe('formatDuration — DESIGN_SYSTEM §2.4, and the figures are real', () => {
  it.each([
    [45_678, '45.678', 'a sub-minute lap'],
    [82_091, '1:22.091', "2026 R1's fastest lap"],
    [85_228, '1:25.228', 'the median lap of the same race'],
    [1_168_144, '19:28.144', 'the red-flag lap that forced the axis ceiling'],
    [17_649, '17.649', "2026 R1's quickest pit stop"],
    [1_081_553, '18:01.553', 'and its slowest'],
    [5_766_857, '1:36:06.857', "1988 R1's winning race time"],
    [12_131_000, '3:22:11.000', "1951 R4's, the longest in the fixtures"],
  ])('%i → %s (%s)', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });

  it('pads seconds to two digits under a minute so a column stays aligned', () => {
    expect(formatDuration(5_200)).toBe('05.200');
    expect(formatDuration(0)).toBe('00.000');
  });

  it('pads milliseconds to three, so 1.05s is not 1:5', () => {
    expect(formatDuration(61_050)).toBe('1:01.050');
    expect(formatDuration(61_005)).toBe('1:01.005');
  });

  it('rolls over at exactly a minute and exactly an hour', () => {
    expect(formatDuration(59_999)).toBe('59.999');
    expect(formatDuration(60_000)).toBe('1:00.000');
    expect(formatDuration(3_599_999)).toBe('59:59.999');
    expect(formatDuration(3_600_000)).toBe('1:00:00.000');
  });

  /**
   * An elapsed duration is never negative, so a negative input is a defect upstream. An
   * em dash asks a visible question; `-1:00.000` would look like a plausible reading.
   */
  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'returns an em dash for %p rather than a plausible-looking wrong number',
    (ms) => {
      expect(formatDuration(ms)).toBe('—');
    },
  );

  it('never emits NaN or undefined for any finite non-negative input', () => {
    for (const ms of [0, 1, 999, 1_000, 59_999, 60_000, 82_091, 3_600_000, 86_399_999]) {
      expect(formatDuration(ms)).not.toMatch(/NaN|undefined/);
    }
  });
});

describe('formatGap — the sign glyph is part of the spec', () => {
  it.each([
    [0, '+0.000'],
    [1_234, '+1.234'],
    [9_876, '+9.876'],
    [74_556, '+1:14.556'],
  ])('%i → %s', (ms, expected) => {
    expect(formatGap(ms)).toBe(expected);
  });

  /**
   * §2.4: "Negative and positive deltas use a leading sign glyph (`+` / `−`, U+2212 for
   * minus so it matches digit width), never colour alone, and never a bare hyphen."
   * Asserted on the code point, because the two characters are visually near-identical
   * and an ASCII hyphen would break the tabular alignment silently.
   */
  it('uses U+2212 for a negative delta, never the ASCII hyphen', () => {
    expect(formatGap(-1_234)).toBe('−1.234');
    expect(formatGap(-1_234).charCodeAt(0)).toBe(0x2212);
    expect(formatGap(-1_234)).not.toContain('-');
  });

  /**
   * The one place `formatGap` and `formatDuration` deliberately differ. §2.4 gives the gap
   * form as `+S.mmm`, and the sport writes `+1.234` — not `+01.234`.
   */
  it('does not zero-pad the seconds, unlike formatDuration', () => {
    expect(formatGap(1_234)).toBe('+1.234');
    expect(formatDuration(1_234)).toBe('01.234');
  });

  it('zero is a measurement, not an em dash', () => {
    expect(formatGap(0)).toBe('+0.000');
  });

  it('escalates past a minute — 1988 R1 P5 finished 74,556 ms behind', () => {
    expect(formatGap(74_556)).toBe('+1:14.556');
    expect(formatGap(3_600_000)).toBe('+1:00:00.000');
  });

  it('returns an em dash for a non-finite input', () => {
    expect(formatGap(Number.NaN)).toBe('—');
  });
});
