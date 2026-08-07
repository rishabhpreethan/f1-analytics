import { describe, expect, it } from 'vitest';
import { mergeAdjacent } from './bands';

/**
 * RD-4's inferred-neutralisation bands.
 *
 * This is the one part of the degradation surface a test can decide — the rest is a scatter and a
 * fitted line in a plot jsdom renders at width 0. It matters more than its size suggests, because a
 * band is a **claim about the race** and its shape changes the claim: five separate one-lap regions
 * read as five incidents, one five-lap region reads as one safety car.
 */

describe('mergeAdjacent', () => {
  it('makes a single flagged lap a lap-wide region, not a zero-width line', () => {
    // The band marks the interval the lap occupies on the axis, not the instant it starts.
    expect(mergeAdjacent([7])).toEqual([{ key: 'band-7', from: 7, to: 8 }]);
  });

  it('merges a run of consecutive laps into ONE band', () => {
    // Five one-lap rects with hairline gaps would read as five incidents rather than one.
    expect(mergeAdjacent([12, 13, 14, 15, 16])).toEqual([{ key: 'band-12', from: 12, to: 17 }]);
  });

  it('keeps two separate periods separate', () => {
    expect(mergeAdjacent([5, 6, 20, 21])).toEqual([
      { key: 'band-5', from: 5, to: 7 },
      { key: 'band-20', from: 20, to: 22 },
    ]);
  });

  it('does not merge across a one-lap gap — racing resumed in between', () => {
    expect(mergeAdjacent([5, 7])).toEqual([
      { key: 'band-5', from: 5, to: 6 },
      { key: 'band-7', from: 7, to: 8 },
    ]);
  });

  it('sorts an unsorted input rather than trusting the caller', () => {
    expect(mergeAdjacent([14, 12, 13])).toEqual([{ key: 'band-12', from: 12, to: 15 }]);
  });

  it('de-duplicates, so a repeated lap does not extend a band', () => {
    expect(mergeAdjacent([9, 9, 9])).toEqual([{ key: 'band-9', from: 9, to: 10 }]);
  });

  it('returns nothing for a race with no inferred laps — the common case', () => {
    // Most races are flagged nowhere, and the note is absent rather than empty.
    expect(mergeAdjacent([])).toEqual([]);
  });

  it('gives every band a stable key derived from its first lap, never an index', () => {
    // An index key would reshuffle every band when one earlier period appeared or disappeared.
    const keys = mergeAdjacent([3, 4, 30]).map((band) => band.key);
    expect(keys).toEqual(['band-3', 'band-30']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('does not mutate the caller’s array', () => {
    const laps = [14, 12, 13];
    mergeAdjacent(laps);
    expect(laps).toEqual([14, 12, 13]);
  });
});
