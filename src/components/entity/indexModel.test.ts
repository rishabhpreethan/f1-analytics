import { describe, expect, it } from 'vitest';
import {
  NO_SEASON_GROUP,
  buildHaystack,
  compareRank,
  driverSortKey,
  filterItems,
  groupItems,
  normalise,
  railDomain,
  sortItems,
  spanRailGeometry,
  type IndexItem,
  type SortOption,
} from './indexModel';

/**
 * The index's logic is the half of this feature jsdom can actually verify, so it is asserted
 * directly rather than through a rendered list (`DESIGN_SYSTEM.md` §6.6.4). Everything about where
 * the rail's bracket *lands* on screen is untestable by construction; everything about the
 * arithmetic that decides it is tested here.
 */

function item(overrides: Partial<IndexItem> & Pick<IndexItem, 'ref'>): IndexItem {
  return {
    href: `/drivers/${overrides.ref}`,
    title: overrides.ref,
    sortKey: overrides.ref,
    haystack: overrides.ref,
    code: null,
    subtitle: null,
    identityRef: null,
    markKind: 'driver',
    firstSeason: null,
    lastSeason: null,
    isCurrent: false,
    raced: true,
    chip: null,
    figures: [],
    ariaLabel: overrides.ref,
    tier: 'starter',
    band: 'starts-1',
    rank: [],
    titles: null,
    ...overrides,
  };
}

describe('normalise', () => {
  it('folds diacritics so an ASCII query finds an accented name', () => {
    expect(normalise('Häkkinen')).toBe('hakkinen');
    expect(normalise('Pérez')).toBe('perez');
    expect(normalise('Räikkönen')).toBe('raikkonen');
    expect(normalise('Nürburgring')).toBe('nurburgring');
  });

  it('lower-cases without losing non-diacritic characters', () => {
    expect(normalise('Scott_Brown')).toBe('scott_brown');
    expect(normalise('brabham-alfa_romeo')).toBe('brabham-alfa_romeo');
  });
});

describe('filterItems', () => {
  const items = [
    item({ ref: 'hamilton', haystack: 'hamilton lewis ham british gbr' }),
    item({ ref: 'hakkinen', haystack: 'hakkinen mika finnish' }),
    item({ ref: 'verstappen', haystack: 'verstappen max ver dutch' }),
  ];

  it('returns everything for an empty or whitespace query', () => {
    expect(filterItems(items, '')).toHaveLength(3);
    expect(filterItems(items, '   ')).toHaveLength(3);
  });

  it('matches a diacritic-folded query against a folded haystack', () => {
    expect(filterItems(items, 'Häkkinen').map((row) => row.ref)).toEqual(['hakkinen']);
    expect(filterItems(items, 'hakkinen').map((row) => row.ref)).toEqual(['hakkinen']);
  });

  it('requires every token, in any order', () => {
    expect(filterItems(items, 'lewis ham').map((row) => row.ref)).toEqual(['hamilton']);
    expect(filterItems(items, 'ham lewis').map((row) => row.ref)).toEqual(['hamilton']);
    expect(filterItems(items, 'lewis dutch')).toHaveLength(0);
  });

  it('matches a nationality, which is the only nationality filter the page has', () => {
    expect(filterItems(items, 'british').map((row) => row.ref)).toEqual(['hamilton']);
  });

  it('preserves order — a search shrinks the list, it never re-ranks it', () => {
    // 'ha' hits both Hamilton and Häkkinen; Hamilton is first in and must be first out even
    // though 'hakkinen' is the better prefix match.
    expect(filterItems(items, 'ha').map((row) => row.ref)).toEqual(['hamilton', 'hakkinen']);
  });
});

describe('sortItems', () => {
  const nameSort: SortOption = {
    id: 'az',
    label: 'A–Z',
    figure: null,
    by: 'name',
    group: 'letter',
  };
  const debutSort: SortOption = {
    id: 'debut',
    label: 'Debut',
    figure: null,
    by: 'debut',
    group: 'decade',
  };
  const winsSort: SortOption = {
    id: 'wins',
    label: 'Wins',
    figure: 0,
    by: 'figure',
    group: 'none',
  };

  it('does not mutate its input — the source array belongs to the query cache', () => {
    const items = [item({ ref: 'b', sortKey: 'b' }), item({ ref: 'a', sortKey: 'a' })];
    sortItems(items, nameSort);
    expect(items.map((row) => row.ref)).toEqual(['b', 'a']);
  });

  it('orders alphabetically by the normalised sort key', () => {
    const items = [
      item({ ref: 'hill', sortKey: driverSortKey('Damon', 'Hill') }),
      item({ ref: 'hakkinen', sortKey: driverSortKey('Mika', 'Häkkinen') }),
      item({ ref: 'hilliard', sortKey: driverSortKey('X', 'Hilliard') }),
    ];
    expect(sortItems(items, nameSort).map((row) => row.ref)).toEqual([
      'hakkinen',
      'hill',
      'hilliard',
    ]);
  });

  it('sorts a debut ascending and puts a driver with no season LAST, not first', () => {
    const items = [
      item({ ref: 'modern', sortKey: 'modern', firstSeason: 2007 }),
      item({ ref: 'nobody', sortKey: 'nobody', firstSeason: null }),
      item({ ref: 'ancient', sortKey: 'ancient', firstSeason: 1950 }),
    ];
    expect(sortItems(items, debutSort).map((row) => row.ref)).toEqual([
      'ancient',
      'modern',
      'nobody',
    ]);
  });

  it('sorts a metric descending and still puts absence last', () => {
    const items = [
      item({ ref: 'alesi', sortKey: 'alesi', figures: [0] }),
      item({ ref: 'never', sortKey: 'never', figures: [null] }),
      item({ ref: 'senna', sortKey: 'senna', figures: [41] }),
    ];
    // The whole point: `null` must not read as a high score under a descending sort, and
    // `0` must not read as absence.
    expect(sortItems(items, winsSort).map((row) => row.ref)).toEqual(['senna', 'alesi', 'never']);
  });

  it('breaks every tie on the sort key, so 765 winless drivers have a total order', () => {
    const items = [
      item({ ref: 'c', sortKey: 'c', figures: [0] }),
      item({ ref: 'a', sortKey: 'a', figures: [0] }),
      item({ ref: 'b', sortKey: 'b', figures: [0] }),
    ];
    expect(sortItems(items, winsSort).map((row) => row.ref)).toEqual(['a', 'b', 'c']);
  });

  it('treats a missing figure column as absent rather than throwing', () => {
    const items = [item({ ref: 'a', sortKey: 'a', figures: [] })];
    expect(sortItems(items, winsSort).map((row) => row.ref)).toEqual(['a']);
  });

  /* ------------------------------------------------- §6.6.5 the achievement lens */

  const tierSort: SortOption = {
    id: 'tier',
    label: 'Achievement',
    figure: 1,
    by: 'tier',
    group: 'tier',
    headings: [
      { key: 'champion', label: 'Champions' },
      { key: 'winner', label: 'Race winners' },
      { key: 'starter', label: 'Grand Prix starters' },
    ],
  };

  it('orders the groups as the page declared them, not alphabetically by key', () => {
    // `champion` < `starter` < `winner` as strings, which is the wrong ladder. The order is
    // editorial and comes from `headings`; no comparator could derive it.
    const items = [
      item({ ref: 's', sortKey: 's', tier: 'starter', rank: [0, 0] }),
      item({ ref: 'w', sortKey: 'w', tier: 'winner', rank: [0, 5] }),
      item({ ref: 'c', sortKey: 'c', tier: 'champion', rank: [7, 105] }),
    ];
    expect(sortItems(items, tierSort).map((row) => row.ref)).toEqual(['c', 'w', 's']);
  });

  it('orders inside a group by merit, so /drivers opens on Hamilton and not on Abate', () => {
    // The one behaviour the redesign exists for: the default view's first row is the most
    // decorated driver in the payload, not the first surname in it.
    const items = [
      item({ ref: 'abate', sortKey: 'abate,carlo', tier: 'champion', rank: [1, 2, 4] }),
      item({ ref: 'hamilton', sortKey: 'hamilton,lewis', tier: 'champion', rank: [7, 105, 202] }),
    ];
    expect(sortItems(items, tierSort).map((row) => row.ref)).toEqual(['hamilton', 'abate']);
  });

  it('walks the whole merit vector, so a podium count breaks a wins tie', () => {
    const items = [
      item({ ref: 'fewer', sortKey: 'a', tier: 'winner', rank: [0, 11, 40] }),
      item({ ref: 'more', sortKey: 'b', tier: 'winner', rank: [0, 11, 68] }),
    ];
    expect(sortItems(items, tierSort).map((row) => row.ref)).toEqual(['more', 'fewer']);
  });

  it('falls back to the name once merit ties completely', () => {
    const items = [
      item({ ref: 'z', sortKey: 'z', tier: 'starter', rank: [0, 0, 0] }),
      item({ ref: 'a', sortKey: 'a', tier: 'starter', rank: [0, 0, 0] }),
    ];
    expect(sortItems(items, tierSort).map((row) => row.ref)).toEqual(['a', 'z']);
  });

  it('puts an undeclared group LAST, so a forgotten tier is visible rather than promoted', () => {
    const items = [
      item({ ref: 'ghost', sortKey: 'ghost', tier: 'mystery', rank: [99] }),
      item({ ref: 'known', sortKey: 'known', tier: 'starter', rank: [0] }),
    ];
    expect(sortItems(items, tierSort).map((row) => row.ref)).toEqual(['known', 'ghost']);
  });

  it('sorts a band lens by the declared band order too', () => {
    const bandSort: SortOption = {
      id: 'career',
      label: 'Career',
      figure: 0,
      by: 'band',
      group: 'band',
      headings: [
        { key: 'starts-150', label: '150 starts or more' },
        { key: 'starts-1', label: 'A single start' },
      ],
    };
    const items = [
      item({ ref: 'one', sortKey: 'one', band: 'starts-1', rank: [0, 0, 0, -1, 1] }),
      item({ ref: 'many', sortKey: 'many', band: 'starts-150', rank: [0, 0, 0, -1, 322] }),
    ];
    expect(sortItems(items, bandSort).map((row) => row.ref)).toEqual(['many', 'one']);
  });
});

describe('compareRank', () => {
  it('is descending — a bigger figure comes first', () => {
    expect(compareRank([7], [2])).toBeLessThan(0);
    expect(compareRank([2], [7])).toBeGreaterThan(0);
  });

  it('moves to the next element only on a tie', () => {
    expect(compareRank([1, 21], [1, 11])).toBeLessThan(0);
    expect(compareRank([1, 21, 103], [1, 21, 103])).toBe(0);
  });

  /*
   * The one case that could silently invert the whole list: `bestChampionshipPosition` is a rank,
   * so 1 beats 20, and `championshipMerit` inverts it before it reaches here. A missing element
   * compares below a measured zero — absence is not a low score (§1.0); here it is lower still.
   */
  it('treats a missing element as below a measured zero', () => {
    expect(compareRank([0], [])).toBeLessThan(0);
    expect(compareRank([], [0])).toBeGreaterThan(0);
  });

  it('compares vectors of different lengths without throwing', () => {
    expect(compareRank([1, 2, 3], [1])).toBeLessThan(0);
  });
});

describe('groupItems', () => {
  it('buckets by initial letter and counts each bucket', () => {
    const items = [
      item({ ref: 'a1', sortKey: 'alesi,jean' }),
      item({ ref: 'a2', sortKey: 'andretti,mario' }),
      item({ ref: 'b1', sortKey: 'brabham,jack' }),
    ];
    const groups = groupItems(items, 'letter');
    expect(groups.map((group) => [group.label, group.count])).toEqual([
      ['A', 2],
      ['B', 1],
    ]);
  });

  it('sends a non-alphabetic initial to its own # bucket', () => {
    const groups = groupItems([item({ ref: 'x', sortKey: '1st,driver' })], 'letter');
    expect(groups[0]?.label).toBe('#');
  });

  it('buckets by decade with 1959 in the 1950s and 1960 in the 1960s', () => {
    const items = [
      item({ ref: 'a', sortKey: 'a', firstSeason: 1959 }),
      item({ ref: 'b', sortKey: 'b', firstSeason: 1960 }),
    ];
    expect(groupItems(items, 'decade').map((group) => group.label)).toEqual(['1950s', '1960s']);
  });

  it('gives an entity with no season its own named bucket, never the 1950s', () => {
    const items = [
      item({ ref: 'a', sortKey: 'a', firstSeason: 1950 }),
      item({ ref: 'b', sortKey: 'b', firstSeason: null }),
    ];
    const groups = groupItems(items, 'decade');
    expect(groups.map((group) => group.label)).toEqual(['1950s', NO_SEASON_GROUP]);
  });

  it('preserves the sorted order of the decades rather than sorting the keys as strings', () => {
    const items = [
      item({ ref: 'a', sortKey: 'a', firstSeason: 1990 }),
      item({ ref: 'b', sortKey: 'b', firstSeason: 2000 }),
      item({ ref: 'c', sortKey: 'c', firstSeason: 2020 }),
    ];
    // Sorted as strings this would be `1990s, 2000s, 2020s` by luck; the case that would break
    // is any key ordering that is not insertion order, so the assertion is the sequence itself.
    expect(groupItems(items, 'decade').map((group) => group.label)).toEqual([
      '1990s',
      '2000s',
      '2020s',
    ]);
  });

  it('labels a tier bucket from the page’s headings, not from the raw key', () => {
    const items = [
      item({ ref: 'a', sortKey: 'a', tier: 'champion' }),
      item({ ref: 'b', sortKey: 'b', tier: 'winner' }),
    ];
    const groups = groupItems(items, 'tier', [
      { key: 'champion', label: 'Champions' },
      { key: 'winner', label: 'Race winners' },
    ]);
    expect(groups.map((group) => [group.label, group.count])).toEqual([
      ['Champions', 1],
      ['Race winners', 1],
    ]);
  });

  it('labels a band bucket the same way', () => {
    const groups = groupItems([item({ ref: 'a', sortKey: 'a', band: 'starts-150' })], 'band', [
      { key: 'starts-150', label: '150 starts or more' },
    ]);
    expect(groups[0]?.label).toBe('150 starts or more');
  });

  it('falls back to the raw key when a heading is missing, so the mistake is visible', () => {
    // A blank header would be indistinguishable from the unlabelled group a metric lens makes,
    // which would hide an undeclared tier instead of showing it.
    const groups = groupItems([item({ ref: 'a', sortKey: 'a', tier: 'mystery' })], 'tier', []);
    expect(groups[0]?.label).toBe('mystery');
  });

  it('returns exactly one unlabelled group for a metric sort, and none for an empty list', () => {
    expect(groupItems([item({ ref: 'a' })], 'none')).toEqual([
      { key: 'all', label: '', count: 1, items: [expect.objectContaining({ ref: 'a' })] },
    ]);
    expect(groupItems([], 'none')).toEqual([]);
    expect(groupItems([], 'letter')).toEqual([]);
  });
});

describe('spanRailGeometry', () => {
  it('places a full-domain span across the whole column', () => {
    expect(spanRailGeometry(1950, 2026, 1950, 2026)).toEqual({ offset: 0, length: 1 });
  });

  it('places a mid-domain span proportionally', () => {
    const geometry = spanRailGeometry(1988, 2026, 1950, 2026);
    expect(geometry?.offset).toBeCloseTo(0.5, 10);
    expect(geometry?.length).toBeCloseTo(0.5, 10);
  });

  it('gives a single-season entity zero length rather than a full-column bracket', () => {
    const geometry = spanRailGeometry(2000, 2000, 1950, 2026);
    expect(geometry).not.toBeNull();
    expect(geometry?.length).toBe(0);
  });

  it('returns null — not a zero-width bracket at the origin — when there is nothing to plot', () => {
    // A `{0, 0}` here would be indistinguishable from a 1950 debut, which is exactly the
    // absent-vs-zero collapse the whole feature is designed against.
    expect(spanRailGeometry(null, null, 1950, 2026)).toBeNull();
    expect(spanRailGeometry(null, 2026, 1950, 2026)).toBeNull();
  });

  it('treats a missing last season as a single season at the first', () => {
    expect(spanRailGeometry(1975, null, 1950, 2026)).toEqual({
      offset: (1975 - 1950) / 76,
      length: 0,
    });
  });

  it('returns null for a degenerate domain rather than producing NaN percentages', () => {
    expect(spanRailGeometry(1990, 2000, 2000, 2000)).toBeNull();
    expect(spanRailGeometry(1990, 2000, 2000, 1990)).toBeNull();
  });

  it('clamps a year outside the domain instead of placing a bracket outside the column', () => {
    expect(spanRailGeometry(1940, 2030, 1950, 2026)).toEqual({ offset: 0, length: 1 });
  });

  it('never produces a negative length from an inverted span', () => {
    const geometry = spanRailGeometry(2000, 1990, 1950, 2026);
    expect(geometry?.length).toBe(0);
    expect(geometry?.offset).toBeCloseTo((2000 - 1950) / 76, 10);
  });
});

describe('railDomain', () => {
  it('takes the extent from the data, not from a literal', () => {
    const items = [
      item({ ref: 'a', firstSeason: 1994, lastSeason: 2001 }),
      item({ ref: 'b', firstSeason: 2007, lastSeason: 2026 }),
    ];
    expect(railDomain(items)).toEqual({ start: 1994, end: 2026 });
  });

  it('covers an entity whose last season is null by using its first', () => {
    const items = [
      item({ ref: 'a', firstSeason: 1960, lastSeason: null }),
      item({ ref: 'b', firstSeason: 1955, lastSeason: null }),
    ];
    expect(railDomain(items)).toEqual({ start: 1955, end: 1960 });
  });

  it('falls back to the sport when nothing in the list has a year at all', () => {
    expect(railDomain([item({ ref: 'a' })])).toEqual({ start: 1950, end: 2026 });
    expect(railDomain([])).toEqual({ start: 1950, end: 2026 });
  });

  it('falls back rather than returning a zero-width domain for a single-year list', () => {
    const items = [item({ ref: 'a', firstSeason: 2026, lastSeason: 2026 })];
    expect(railDomain(items)).toEqual({ start: 1950, end: 2026 });
  });
});

describe('driverSortKey and buildHaystack', () => {
  it('sorts by surname first and keeps a separator that orders before every letter', () => {
    expect(driverSortKey('Damon', 'Hill')).toBe('hill,damon');
    expect(driverSortKey('Damon', 'Hill') < driverSortKey('X', 'Hilliard')).toBe(true);
  });

  it('folds the sort key so an accented surname files with its letter', () => {
    expect(driverSortKey('Mika', 'Häkkinen')).toBe('hakkinen,mika');
  });

  it('drops absent pieces rather than joining blanks into the haystack', () => {
    expect(buildHaystack(['Mika', 'Häkkinen', null, undefined, '', 'Finnish'])).toBe(
      'mika hakkinen finnish',
    );
  });
});
