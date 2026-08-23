import { describe, expect, it } from 'vitest';
import type { DriverList, DriverListItem } from '@schemas/directory';
import { compareQueryKey, compareSeasonsQueryKey, selectCandidates } from './useCompare';

/**
 * The picker's directory, and the two cache keys.
 *
 * `selectCandidates` is the only logic in this module — the hooks themselves are declarations, and
 * a test that mounted them would be testing TanStack Query. What is worth pinning is the filter,
 * because getting it wrong puts a bay on the page that can never fill: `GET /api/compare` answers
 * **404** for a driver with no race, and 63 of the 881 in the directory are exactly that.
 */

const driver = (over: Partial<DriverListItem> & { ref: string }): DriverListItem => ({
  code: null,
  forename: 'A',
  surname: 'Driver',
  nationality: null,
  countryCode: null,
  races: 10,
  starts: 10,
  wins: 0,
  podiums: 0,
  championships: 0,
  bestChampionshipPosition: null,
  firstSeason: 1990,
  lastSeason: 2000,
  colorTeamRef: 'red',
  ...over,
});

const list = (drivers: DriverListItem[]): DriverList => ({ drivers });

describe('selectCandidates', () => {
  it('returns nothing before the directory has arrived', () => {
    expect(selectCandidates(undefined)).toEqual([]);
  });

  /** The 63 who never raced would 404 the comparison endpoint; the picker must not offer them. */
  it('drops a driver with no race in the archive', () => {
    const candidates = selectCandidates(
      list([
        driver({ ref: 'raced', races: 1 }),
        driver({ ref: 'never', races: 0, firstSeason: null, lastSeason: null, colorTeamRef: null }),
      ]),
    );
    expect(candidates.map((candidate) => candidate.ref)).toEqual(['raced']);
  });

  /** A finding order, not a browsing one: the alphabet puts Adolfo Cruz above Ayrton Senna. */
  it('orders by races descending, then by surname', () => {
    const candidates = selectCandidates(
      list([
        driver({ ref: 'few', races: 5, surname: 'Aaa' }),
        driver({ ref: 'many', races: 400, surname: 'Zzz' }),
        driver({ ref: 'same-b', races: 5, surname: 'Bbb' }),
      ]),
    );
    expect(candidates.map((candidate) => candidate.ref)).toEqual(['many', 'few', 'same-b']);
  });

  it('carries the four fields the picker draws a bay from', () => {
    const [candidate] = selectCandidates(
      list([
        driver({
          ref: 'hamilton',
          code: 'HAM',
          forename: 'Lewis',
          surname: 'Hamilton',
          races: 390,
          firstSeason: 2007,
          lastSeason: 2026,
          colorTeamRef: 'mercedes',
        }),
      ]),
    );
    expect(candidate).toEqual({
      ref: 'hamilton',
      code: 'HAM',
      forename: 'Lewis',
      surname: 'Hamilton',
      races: 390,
      firstSeason: 2007,
      lastSeason: 2026,
      colorTeamRef: 'mercedes',
    });
  });

  /**
   * The extras are optional on `CompareCandidate`, so a null is **omitted** rather than published
   * as `undefined` — `exactOptionalPropertyTypes` is on, and the picker's own fallbacks read
   * "absent", not "present and empty".
   */
  it('omits an absent colour rather than publishing an empty one', () => {
    const [candidate] = selectCandidates(list([driver({ ref: 'x', colorTeamRef: null })]));
    expect(candidate === undefined ? [] : Object.keys(candidate)).not.toContain('colorTeamRef');
  });
});

describe('the cache keys', () => {
  /** Two orders are two pages: colour and ladder position follow the reader's order. */
  it('distinguishes two selections that differ only in order', () => {
    expect(compareQueryKey(['a', 'b'])).not.toEqual(compareQueryKey(['b', 'a']));
    expect(compareSeasonsQueryKey(['a', 'b'])).not.toEqual(compareSeasonsQueryKey(['b', 'a']));
  });

  /** Two lenses, two keys: flipping the lens must not refetch the career payload. */
  it('keeps the two lenses on separate keys', () => {
    expect(compareQueryKey(['a'])[0]).not.toBe(compareSeasonsQueryKey(['a'])[0]);
  });
});
