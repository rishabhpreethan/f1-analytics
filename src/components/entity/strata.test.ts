import { describe, expect, it } from 'vitest';
import type { IndexItem } from './indexModel';
import {
  applySelection,
  asideCount,
  bandOf,
  buildStrata,
  decadeOf,
  eraBuckets,
  inDecade,
  NO_SELECTION,
  type BandDefinition,
  type StratumDefinition,
} from './strata';

/**
 * The population layer is the half of the redesign jsdom can actually verify, so it is asserted
 * here rather than through a rendered board (`DESIGN_SYSTEM.md` §6.6.5). Nothing below renders
 * anything: no bar width, no column height and no hatch is testable in this environment.
 *
 * Every case is a real shape in the archive.
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

const STRATA: readonly StratumDefinition[] = [
  { key: 'champion', label: 'Champions', sublabel: 'won a title' },
  { key: 'winner', label: 'Race winners', sublabel: 'won a race' },
  { key: 'starter', label: 'Starters', sublabel: 'started' },
  { key: 'none', label: 'Never started', sublabel: 'never on a grid', aside: true },
];

describe('buildStrata', () => {
  const items = [
    item({ ref: 'a', tier: 'champion' }),
    item({ ref: 'b', tier: 'winner' }),
    item({ ref: 'c', tier: 'winner' }),
    item({ ref: 'd', tier: 'starter' }),
    item({ ref: 'e', tier: 'starter' }),
    item({ ref: 'f', tier: 'starter' }),
    item({ ref: 'g', tier: 'starter' }),
    item({ ref: 'h', tier: 'none' }),
  ];

  it('counts every stratum, in the order they were declared', () => {
    expect(buildStrata(items, STRATA).map((stratum) => [stratum.key, stratum.count])).toEqual([
      ['champion', 1],
      ['winner', 2],
      ['starter', 4],
      ['none', 1],
    ]);
  });

  it('scales the bars against the largest stratum, not against the total', () => {
    // The driver page's largest tier is 571 of 881: a fraction-of-total bar would top out at 65%
    // and leave the widest mark on the page visibly short of its own track.
    const bars = buildStrata(items, STRATA);
    expect(bars.map((stratum) => stratum.extent)).toEqual([0.25, 0.5, 1, 0.25]);
  });

  it('runs the emphasis ramp rarest-loudest, by position and never by count', () => {
    const bars = buildStrata(items, STRATA);
    expect(bars[0]?.emphasis).toBe(1);
    // `starter` is the biggest count and the third rung, so it is the third emphasis — the point of
    // the ladder is that 35 champions read louder than 571 starters, not fainter.
    expect(bars[2]?.emphasis).toBeLessThan(bars[0]?.emphasis ?? 0);
  });

  it('gives an empty stratum a zero extent rather than a NaN', () => {
    // `count / max` with max 0 is NaN, which renders as no bar at all rather than as an error.
    const bars = buildStrata([], STRATA);
    expect(bars.map((stratum) => stratum.extent)).toEqual([0, 0, 0, 0]);
    expect(bars.every((stratum) => Number.isFinite(stratum.extent))).toBe(true);
  });

  it('drops an item whose tier no page declared, rather than inventing an "other" bucket', () => {
    const bars = buildStrata([...items, item({ ref: 'x', tier: 'mystery' })], STRATA);
    expect(bars.reduce((total, stratum) => total + stratum.count, 0)).toBe(8);
  });
});

describe('eraBuckets', () => {
  /*
   * The real distribution, and the reason the decade chart exists at all: **313 drivers were on
   * the grid in the 1950s and 40 in the 2020s.** Verified against `data/f1.db` — the span-overlap
   * count reproduces the measured distinct-starters-per-decade figure exactly for all eight
   * decades, because no driver's career skips a whole decade.
   */
  const items = [
    item({ ref: 'ascari', firstSeason: 1950, lastSeason: 1955 }),
    item({ ref: 'alesi', firstSeason: 1989, lastSeason: 2001 }),
    item({ ref: 'barrichello', firstSeason: 1993, lastSeason: 2011 }),
    item({ ref: 'hamilton', firstSeason: 2007, lastSeason: 2026 }),
    item({ ref: 'ecclestone', firstSeason: null, lastSeason: null }),
  ];

  it('counts an entity in every decade its span covers', () => {
    expect(eraBuckets(items, 2026).map((bucket) => [bucket.decade, bucket.count])).toEqual([
      [1950, 1],
      [1960, 0],
      [1970, 0],
      [1980, 1],
      [1990, 2],
      [2000, 3],
      [2010, 2],
      [2020, 1],
    ]);
  });

  it('keeps an empty decade as a column rather than closing the gap', () => {
    // The 1960s and 1970s are zero in this fixture. Dropping them would put the 1950s next to the
    // 1980s and make the axis lie about the interval between two bars.
    expect(eraBuckets(items, 2026)).toHaveLength(8);
  });

  it('never counts an entity with no season', () => {
    const total = eraBuckets([item({ ref: 'x', firstSeason: null })], 2026);
    expect(total).toEqual([]);
  });

  it('flags only the decade the archive has not finished', () => {
    const partial = eraBuckets(items, 2026).filter((bucket) => bucket.partial);
    expect(partial.map((bucket) => bucket.decade)).toEqual([2020]);
  });

  it('flags nothing when the latest season is unknown', () => {
    expect(eraBuckets(items, null).some((bucket) => bucket.partial)).toBe(false);
  });

  it('labels short for the axis and long for the accessible name', () => {
    const first = eraBuckets(items, 2026)[0];
    expect(first?.label).toBe('50s');
    expect(first?.longLabel).toBe('1950s');
  });

  it('treats a single-season entity as present in that decade', () => {
    expect(eraBuckets([item({ ref: 'amati', firstSeason: 1992, lastSeason: 1992 })], 2026)).toEqual(
      [{ decade: 1990, label: '90s', longLabel: '1990s', count: 1, extent: 1, partial: false }],
    );
  });
});

describe('decadeOf and inDecade', () => {
  it('puts 1959 in the 1950s and 1960 in the 1960s', () => {
    expect(decadeOf(1959)).toBe(1950);
    expect(decadeOf(1960)).toBe(1960);
  });

  it('matches the boundary years at both ends of a span', () => {
    const kimi = item({ ref: 'raikkonen', firstSeason: 2001, lastSeason: 2021 });
    expect(inDecade(kimi, 2000)).toBe(true);
    expect(inDecade(kimi, 2020)).toBe(true);
    expect(inDecade(kimi, 1990)).toBe(false);
  });

  it('is false for an entity with no season, never a silent true', () => {
    expect(inDecade(item({ ref: 'x', firstSeason: null }), 1990)).toBe(false);
  });
});

describe('bandOf', () => {
  const bands: readonly BandDefinition[] = [
    { key: 'starts-150', label: '150 or more', min: 150 },
    { key: 'starts-50', label: '50–149', min: 50 },
    { key: 'starts-1', label: 'A single start', min: 1 },
    { key: 'starts-0', label: 'Never started', min: 0 },
  ];

  it('takes the first match, so the boundary belongs to the higher band', () => {
    expect(bandOf(150, bands)).toBe('starts-150');
    expect(bandOf(149, bands)).toBe('starts-50');
    expect(bandOf(50, bands)).toBe('starts-50');
    expect(bandOf(49, bands)).toBe('starts-1');
  });

  it('gives zero its own band rather than folding it into "a single start"', () => {
    expect(bandOf(0, bands)).toBe('starts-0');
  });
});

describe('applySelection', () => {
  const items = [
    item({ ref: 'hamilton', tier: 'champion', firstSeason: 2007, lastSeason: 2026 }),
    item({ ref: 'ascari', tier: 'champion', firstSeason: 1950, lastSeason: 1955 }),
    item({ ref: 'alesi', tier: 'starter', firstSeason: 1989, lastSeason: 2001 }),
    item({ ref: 'ecclestone', tier: 'none', firstSeason: null, lastSeason: null }),
  ];

  it('keeps the aside stratum out of the default browse', () => {
    // The whole point of the redesign's footnote: 91 drivers who never started must not be the
    // first thing between a reader and the 818 who did.
    expect(applySelection(items, NO_SELECTION, STRATA).map((row) => row.ref)).toEqual([
      'hamilton',
      'ascari',
      'alesi',
    ]);
  });

  it('adds the aside stratum back when the footnote is toggled on', () => {
    const shown = applySelection(items, { ...NO_SELECTION, showAside: true }, STRATA);
    expect(shown.map((row) => row.ref)).toContain('ecclestone');
  });

  it('shows an aside stratum that was selected explicitly, toggle or no toggle', () => {
    // A control that selects a stratum and then returns nothing is broken. The toggle governs the
    // *default* browse; it does not get to veto the reader.
    const picked = applySelection(items, { tier: 'none', decade: null, showAside: false }, STRATA);
    expect(picked.map((row) => row.ref)).toEqual(['ecclestone']);
  });

  it('narrows to one stratum', () => {
    const picked = applySelection(
      items,
      { tier: 'champion', decade: null, showAside: false },
      STRATA,
    );
    expect(picked.map((row) => row.ref)).toEqual(['hamilton', 'ascari']);
  });

  it('narrows to one decade', () => {
    const picked = applySelection(items, { tier: null, decade: 1990, showAside: false }, STRATA);
    expect(picked.map((row) => row.ref)).toEqual(['alesi']);
  });

  it('intersects the two filters rather than replacing one with the other', () => {
    const picked = applySelection(
      items,
      { tier: 'champion', decade: 2010, showAside: false },
      STRATA,
    );
    expect(picked.map((row) => row.ref)).toEqual(['hamilton']);
  });

  it('can return nothing, which the page has a designed state for', () => {
    expect(
      applySelection(items, { tier: 'champion', decade: 1980, showAside: false }, STRATA),
    ).toEqual([]);
  });

  it('never mutates the source array', () => {
    const source = [...items];
    applySelection(source, { tier: 'champion', decade: null, showAside: false }, STRATA);
    expect(source.map((row) => row.ref)).toEqual(items.map((row) => row.ref));
  });
});

describe('asideCount', () => {
  it('counts only the strata a page marked as an aside', () => {
    const items = [
      item({ ref: 'a', tier: 'champion' }),
      item({ ref: 'b', tier: 'none' }),
      item({ ref: 'c', tier: 'none' }),
    ];
    expect(asideCount(items, STRATA)).toBe(2);
  });

  it('is zero when a page declares no aside at all — the circuit case', () => {
    const noAside: readonly StratumDefinition[] = [
      { key: 'current', label: 'On the calendar', sublabel: 'a round this season' },
      { key: 'retired', label: 'No longer used', sublabel: 'gone' },
    ];
    expect(asideCount([item({ ref: 'monza', tier: 'current' })], noAside)).toBe(0);
  });
});
