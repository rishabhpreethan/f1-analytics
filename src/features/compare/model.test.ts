import { describe, expect, it } from 'vitest';
import { COMPARE_FIXTURE } from './fixture';
import {
  archiveDomain,
  careerArc,
  balanceFractions,
  chainGeometry,
  chainPivots,
  chainWeakestLink,
  decadeTicks,
  orientChain,
  orientLedger,
  pairFor,
  rateRails,
  resultMix,
  scoreLabel,
  verdict,
  winShare,
  yearFraction,
} from './model';
import type { ChainLink, ComparePair, Ledger } from './types';

/**
 * The compare surface's arithmetic (`DESIGN_SYSTEM.md` §6.6.6).
 *
 * **jsdom performs no layout**, so nothing here proves the staircase looks right. What it proves is
 * every number that decides where a mark goes — which is the half of the CR-007 spotlight bug that
 * *was* testable, and was not tested.
 */

const ledger = (a: number, b: number, rated = a + b, pool = rated, tied = 0): Ledger => ({
  rated,
  pool,
  a,
  b,
  tied,
});

const link = (from: string, to: string, firstYear: number, lastYear: number): ChainLink => ({
  from,
  to,
  firstYear,
  lastYear,
  teams: [{ year: firstYear, teamRef: 'x', teamName: 'X' }],
  race: ledger(1, 1),
  grid: ledger(1, 1),
});

describe('the shared time axis', () => {
  const domain = archiveDomain(COMPARE_FIXTURE.archive);

  it('runs from the first archive season to one past the last', () => {
    expect(domain).toEqual({ start: 1950, end: 2027 });
  });

  it('gives the last season width rather than putting it on the edge', () => {
    /* A domain ending at 2026 would place 2026 at exactly 1 and a one-season capsule there would
     * have zero width — visually identical to a mark that failed to render. */
    expect(yearFraction(2026, domain)).toBeLessThan(1);
    expect(yearFraction(2027, domain)).toBe(1);
  });

  it('puts 1950 at the origin and clamps anything outside', () => {
    expect(yearFraction(1950, domain)).toBe(0);
    expect(yearFraction(1900, domain)).toBe(0);
    expect(yearFraction(2200, domain)).toBe(1);
  });

  it('emits only whole decades inside the domain', () => {
    const ticks = decadeTicks(domain);
    expect(ticks[0]?.year).toBe(1950);
    expect(ticks.at(-1)?.year).toBe(2020);
    expect(ticks.every((tick) => tick.offset >= 0 && tick.offset <= 1)).toBe(true);
  });

  it('survives an empty archive rather than dividing by zero', () => {
    expect(archiveDomain([])).toEqual({ start: 1950, end: 2027 });
    expect(yearFraction(1980, { start: 2000, end: 2000 })).toBe(0);
  });
});

describe('the chain staircase', () => {
  const domain = { start: 1950, end: 2027 };

  it('lays a capsule across the seasons the pair were teammates, inclusive of the last', () => {
    const [only] = chainGeometry([link('a', 'b', 2013, 2016)], domain);
    expect(only?.offset).toBeCloseTo(yearFraction(2013, domain), 10);
    /* 2013–2016 is four seasons wide, not three: the capsule ends at the start of 2017. */
    expect(only?.length).toBeCloseTo(4 / 77, 10);
  });

  it('gives a single-season pairing the width of one season, never zero', () => {
    const [only] = chainGeometry([link('a', 'b', 2005, 2005)], domain);
    expect(only?.length).toBeCloseTo(1 / 77, 10);
  });

  it('draws no connector on the first row', () => {
    const rows = chainGeometry([link('a', 'b', 2013, 2016)], domain);
    expect(rows[0]?.connector).toBeNull();
  });

  it('drops from the previous capsule and runs left to the next when time separates them', () => {
    const rows = chainGeometry([link('a', 'b', 2013, 2016), link('b', 'c', 2010, 2012)], domain);
    const connector = rows[1]?.connector;
    /* The drop lands on the earlier edge of the row above — the direction of travel is backwards
     * through time — and the run reaches back to the near edge of this row's capsule. */
    expect(connector?.dropX).toBeCloseTo(yearFraction(2013, domain), 10);
    expect(connector?.runStart).toBeCloseTo(yearFraction(2013, domain), 10);
    expect(connector?.runLength).toBeCloseTo(0, 10);
  });

  it('measures the run as the years the pivot driver raced with neither teammate', () => {
    const rows = chainGeometry([link('a', 'b', 2013, 2016), link('b', 'c', 2005, 2008)], domain);
    const connector = rows[1]?.connector;
    /* 2009 through 2012 — four seasons the shared driver raced without either of them. */
    expect(connector?.runLength).toBeCloseTo(4 / 77, 10);
    expect(connector?.runStart).toBeCloseTo(yearFraction(2009, domain), 10);
  });

  it('runs the other way when the next pairing is later, rather than emitting a negative width', () => {
    const rows = chainGeometry([link('a', 'b', 2005, 2008), link('b', 'c', 2013, 2016)], domain);
    const connector = rows[1]?.connector;
    expect(connector?.runLength).toBeGreaterThan(0);
    expect(connector?.runStart).toBeCloseTo(yearFraction(2009, domain), 10);
  });

  it('draws no run when the two pairings overlap in time', () => {
    const rows = chainGeometry([link('a', 'b', 2010, 2016), link('b', 'c', 2012, 2014)], domain);
    expect(rows[1]?.connector?.runLength).toBe(0);
  });

  it('names the pivot driver for every row after the first', () => {
    expect(chainPivots([link('a', 'b', 2013, 2016), link('b', 'c', 2010, 2012)])).toEqual([
      null,
      'b',
    ]);
  });

  it('reports the weakest link, which is the chain honesty figure', () => {
    const chain = {
      a: 'a',
      b: 'c',
      length: 2,
      links: [
        { ...link('a', 'b', 2013, 2016), race: ledger(39, 27) },
        { ...link('b', 'c', 2010, 2012), race: ledger(0, 0, 0, 12) },
      ],
    };
    expect(chainWeakestLink(chain)).toBe(0);
    expect(chainWeakestLink({ ...chain, links: [] })).toBe(0);
  });
});

describe('the ledger', () => {
  it('splits a track by the three outcomes', () => {
    expect(balanceFractions(ledger(3, 1))).toEqual({ a: 0.75, b: 0.25, tied: 0 });
  });

  it('returns null rather than a 50/50 bar when nothing is rated', () => {
    /* An undrawn bar and an even bar are opposite statements, and the second is a lie a reader
     * cannot detect. Half the archive's teammate pairings are in this state. */
    expect(balanceFractions(ledger(0, 0, 0, 12))).toBeNull();
    expect(winShare(ledger(0, 0, 0, 12), 'a')).toBeNull();
  });

  it('prints a score with an en dash, never a hyphen', () => {
    expect(scoreLabel(ledger(189, 135))).toBe('189–135');
  });

  it('orients a pair ledger to the caller order rather than the payload order', () => {
    const pair = pairFor(COMPARE_FIXTURE.pairs, 'hamilton', 'rosberg');
    expect(pair).not.toBeNull();
    if (pair === null) return;
    const forward = orientLedger(pair, 'hamilton');
    const backward = orientLedger(pair, 'rosberg');
    expect(forward.race.a).toBe(backward.race.b);
    expect(forward.race.b).toBe(backward.race.a);
    /* Verified against the record before anything was drawn: Hamilton led Rosberg over their four
     * Mercedes seasons, and the 2016 slice of it was 10–9. */
    expect(forward.race.a).toBeGreaterThan(forward.race.b);
  });

  it('reverses a chain, its links and every link score when read from the other end', () => {
    const chain = COMPARE_FIXTURE.chains.find((c) => c.a === 'hamilton' && c.b === 'fangio');
    expect(chain).toBeDefined();
    if (chain === undefined) return;
    const reversed = orientChain(chain, 'fangio');
    expect(reversed.a).toBe('fangio');
    expect(reversed.b).toBe('hamilton');
    expect(reversed.links).toHaveLength(chain.links.length);
    expect(reversed.links[0]?.from).toBe(chain.links.at(-1)?.to);
    expect(reversed.links[0]?.race.a).toBe(chain.links.at(-1)?.race.b);
    /* A reversed chain still walks through time in one direction — this one ends at Hamilton. */
    expect(reversed.links.at(-1)?.to).toBe('hamilton');
  });
});

describe('the verdict', () => {
  const byRef = new Map(COMPARE_FIXTURE.entities.map((e) => [e.identity.ref, e]));

  /** Resolves the three arguments together so a missing fixture row fails as a missing row. */
  function spokenFor(a: string, b: string, team: string | null) {
    const pair = pairFor(COMPARE_FIXTURE.pairs, a, b);
    const first = byRef.get(a);
    const second = byRef.get(b);
    expect(pair).not.toBeNull();
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (pair === null || first === undefined || second === undefined) return null;
    return verdict(pair, first, second, team);
  }

  it('calls a shared car a shared car, and names the team', () => {
    const spoken = spokenFor('hamilton', 'rosberg', 'Mercedes');
    expect(spoken?.relation).toBe('teammate');
    expect(spoken?.headline).toBe('Same car.');
    expect(spoken?.lead).toContain('Mercedes');
  });

  it('says out loud that a shared grid is not a shared car', () => {
    const spoken = spokenFor('hamilton', 'max_verstappen', null);
    expect(spoken?.relation).toBe('contemporary');
    expect(spoken?.lead).toContain('never one of them in the same car');
  });

  it('does not claim a shared grid for two drivers who shared only a season', () => {
    /*
     * **Senna and Coulthard, 1994** — the fourth case, and the one the three-tier copy got wrong.
     * Queried: Senna started rounds 1–3 of 1994 and Coulthard rounds 5–13, so they shared the
     * season and **no race at all**. `contemporary` is the right tier — `disjoint`'s sentence
     * denies them a shared points system and in 1994 they had one — but "Same grid, different
     * cars" was simply false, since they were never on a grid together.
     *
     * Built here rather than taken from the fixture because the fixture's four drivers hold no
     * such pair, and `verdict` is a pure function of the three arguments.
     */
    const pair: ComparePair = {
      a: 'senna',
      b: 'coulthard',
      relation: 'contemporary',
      sharedRaces: 0,
      sameTeamRaces: 0,
      sharedSeasons: [1994],
      sameTeamSeasons: [],
      yearsApart: 0,
      race: { rated: 0, pool: 0, a: 0, b: 0, tied: 0 },
      grid: { rated: 0, pool: 0, a: 0, b: 0, tied: 0 },
    };
    const first = byRef.get('hamilton');
    const second = byRef.get('rosberg');
    if (first === undefined || second === undefined) throw new Error('fixture');
    const spoken = verdict(pair, first, second, null);

    expect(spoken.relation).toBe('contemporary');
    expect(spoken.tier).toBe('Same season');
    expect(spoken.headline).toBe('Same season, never the same race.');
    expect(spoken.headline).not.toContain('grid');
    expect(spoken.lead).toContain('both raced in 1994');
    expect(spoken.lead).toContain('never started a Grand Prix together');
    /* And it points at the one thing that IS comparable, rather than only refusing. */
    expect(spoken.lead).toContain('points system');
  });

  it('still calls a genuinely shared grid a shared grid', () => {
    const spoken = spokenFor('hamilton', 'max_verstappen', null);
    expect(spoken?.tier).toBe('Same grid');
    expect(spoken?.headline).toBe('Same grid, different cars.');
  });

  it('refuses the comparison outright when the careers never met, and says which way round', () => {
    const spoken = spokenFor('max_verstappen', 'fangio', null);
    expect(spoken?.relation).toBe('disjoint');
    expect(spoken?.headline).toBe('Never on the same grid.');
    /* The earlier career is named first however the pair was selected. */
    expect(spoken?.lead).toMatch(/Fangio's last Grand Prix in 1958/);
    expect(spoken?.lead).toContain('nothing on this page is a direct result');
  });
});

describe('the rate rails', () => {
  const rails = rateRails(COMPARE_FIXTURE.entities);

  it('publishes five rates and not one total', () => {
    expect(rails.map((rail) => rail.id)).toEqual([
      'wins',
      'podiums',
      'finishes',
      'teammate-grid',
      'teammate-race',
    ]);
    /* Nothing on this page may be a career total: 24 point systems and six best-N eras. */
    expect(rails.every((rail) => rail.values.every((v) => v.value === null || v.value <= 1))).toBe(
      true,
    );
  });

  it('carries the numerator and the denominator on every value', () => {
    for (const rail of rails) {
      for (const value of rail.values) {
        expect(value.denominator).toBeGreaterThan(0);
        expect(value.numerator).toBeLessThanOrEqual(value.denominator);
      }
    }
  });

  it('scales each rail to its own leader, never to a shared ceiling', () => {
    const wins = rails.find((rail) => rail.id === 'wins');
    const finishes = rails.find((rail) => rail.id === 'finishes');
    expect(wins?.ceiling).not.toBe(finishes?.ceiling);
    expect(wins?.ceiling).toBeCloseTo(
      Math.max(...(wins?.values.map((v) => v.value ?? 0) ?? [0])),
      10,
    );
  });

  it('reports a null rate rather than zero when the denominator is empty', () => {
    const sample = COMPARE_FIXTURE.entities[0];
    expect(sample).toBeDefined();
    if (sample === undefined) return;
    const [only] = rateRails([{ ...sample, totals: { ...sample.totals, starts: 0, wins: 0 } }]);
    /* Never `0`, which reads as "never did it" for a driver who never had the chance. */
    expect(only?.values[0]?.value).toBeNull();
  });
});

describe('the result mix (§6.6.6.14)', () => {
  const mix = () => resultMix(COMPARE_FIXTURE.entities);
  const rowFor = (ref: string) => mix().find((row) => row.ref === ref);
  const partOf = (ref: string, tone: string) =>
    rowFor(ref)?.parts.find((part) => part.tone === tone)?.value;

  it('splits every driver into exactly four parts that sum to his OWN starts', () => {
    /*
     * The invariant the whole chart rests on. `ShareChart` normalises whatever it is handed, so a
     * row that summed to 0.94 of the starts would still render as a full bar and would overstate
     * every part in it by 6% with nothing on screen looking wrong.
     */
    for (const row of mix()) {
      expect(row.parts).toHaveLength(4);
      const total = row.parts.reduce((sum, part) => sum + part.value, 0);
      expect(total, `${row.surname} sums to ${String(total)} of ${String(row.starts)}`).toBe(
        row.starts,
      );
    }
  });

  it('reproduces the three measured mixes, on the payload’s own starts', () => {
    /*
     * ⚠ Fangio reads **24/11/6/10 of 51**, not the 24/11/9/14 of 58 §6.6.6.12 recorded when this
     * chart was proposed. 58 is a raw count of classification rows and 51 is `starts`: 40 races
     * between 1950 and 1964 classify one driver two or three times (trap 17). The index says 51,
     * so this says 51 — a chart that disagreed with the rest of the product about how many races a
     * man started would be a defect however readable it was.
     */
    expect(rowFor('fangio')?.parts.map((part) => part.value)).toEqual([24, 11, 6, 10]);
    expect(rowFor('fangio')?.starts).toBe(51);
    expect(rowFor('hamilton')?.parts.map((part) => part.value)).toEqual([106, 101, 151, 32]);
    expect(rowFor('hamilton')?.starts).toBe(390);
  });

  it('keeps the parts nested — a win is a podium is a classified finish', () => {
    // Every part after the first is a subtraction, so double-counting a win as a podium too is the
    // failure this catches. Fangio: 35 podiums of which 24 were wins, so 11 podium-only.
    expect(partOf('fangio', 'win')).toBe(24);
    expect(partOf('fangio', 'podium')).toBe(11);
  });

  it('takes the fourth part from `starts − classified`, never from `dnfs`', () => {
    /*
     * They are different numbers and both are right: Hamilton retired from **34** races and has
     * **32** starts with no classification, because a car that covers enough of the distance is
     * still given a finishing position when it stops. Using `dnfs` would break the sum by two AND
     * mislabel the band, so the subtraction is the value and `dnfs` travels beside it for the copy.
     */
    expect(partOf('hamilton', 'unclassified')).toBe(32);
    expect(rowFor('hamilton')?.dnfs).toBe(34);
  });

  it('is in selection order and is never sorted by any value', () => {
    // §6.2, and §6.6.6.5's own correction: reading one driver across the page is a vertical scan at
    // a fixed offset, which a value sort would turn into a search that moves when a bay is added.
    expect(mix().map((row) => row.ref)).toEqual(
      COMPARE_FIXTURE.entities.map((entity) => entity.identity.ref),
    );
  });

  it('emits the four tones in ramp order, strongest first', () => {
    expect(rowFor('fangio')?.parts.map((part) => part.tone)).toEqual([
      'win',
      'podium',
      'classified',
      'unclassified',
    ]);
  });

  it('gives a driver who entered and never started four zeroes, not a negative band', () => {
    /*
     * 91 drivers in this archive entered a Grand Prix and started none. A share of zero starts is
     * `0/0`, and the row is a designed state in `ShareChart` rather than a division — but only if
     * this returns zeroes rather than, say, `starts − classifiedFinishes` going negative on a
     * payload where the two disagree.
     */
    const entered = COMPARE_FIXTURE.entities[0];
    if (entered === undefined) throw new Error('fixture has no entities');
    const [row] = resultMix([
      {
        ...entered,
        totals: { ...entered.totals, starts: 0, wins: 0, podiums: 0, classifiedFinishes: 0 },
      },
    ]);
    expect(row?.parts.map((part) => part.value)).toEqual([0, 0, 0, 0]);
  });

  it('clamps rather than emitting a negative part when totals disagree', () => {
    const entered = COMPARE_FIXTURE.entities[0];
    if (entered === undefined) throw new Error('fixture has no entities');
    const [row] = resultMix([
      /* A selector that counted more podiums than classified finishes would otherwise draw a
       * negative width, which SVG renders as nothing at all — absent given the meaning of
       * present (§1.0). */
      {
        ...entered,
        totals: { ...entered.totals, starts: 10, wins: 2, podiums: 8, classifiedFinishes: 5 },
      },
    ]);
    expect(row?.parts.map((part) => part.value)).toEqual([2, 6, 0, 5]);
  });
});

describe('the career-relative arc (§6.6.6.14 B)', () => {
  const arc = () => careerArc(COMPARE_FIXTURE.entities);
  const seriesFor = (ref: string) => arc().series.find((entry) => entry.reference === ref);

  it('starts every driver at x = 1, whatever year his debut was', () => {
    /*
     * The whole chart. Fangio debuts in 1950 and Verstappen in 2015, and they occupy the same
     * column — the axis IS the normalisation, which is why this one needs no caveat about what is
     * being held constant.
     */
    for (const entry of arc().series) {
      expect(entry.points[0]?.x, entry.label).toBe(1);
    }
  });

  it('runs each line exactly as long as the career, not as long as the longest', () => {
    const fangio = COMPARE_FIXTURE.entities.find((e) => e.identity.ref === 'fangio');
    const span = (fangio?.lastSeason ?? 0) - (fangio?.firstSeason ?? 0) + 1;
    expect(seriesFor('fangio')?.points).toHaveLength(span);
  });

  it('emits a null point for a year inside the career with no season — never omits it', () => {
    /*
     * ⚠ The defect this exists to prevent. `d3-shape`'s `defined` breaks a line at a null and joins
     * straight through a **missing** array entry, so omitting a sabbatical would draw one unbroken
     * line across it and state that the driver raced. The point has to be present and null.
     */
    const entity = COMPARE_FIXTURE.entities[0];
    if (entity === undefined) throw new Error('fixture has no entities');
    const sabbatical = {
      ...entity,
      seasons: [
        {
          year: 2001,
          teamRefs: [],
          starts: 17,
          wins: 0,
          podiums: 0,
          dnfs: 2,
          championshipPosition: 10,
        },
        {
          year: 2004,
          teamRefs: [],
          starts: 18,
          wins: 1,
          podiums: 3,
          dnfs: 1,
          championshipPosition: 7,
        },
      ],
    };
    const { series, absences } = careerArc([sabbatical]);
    expect(series[0]?.points).toEqual([
      { x: 1, y: 10 },
      { x: 2, y: null },
      { x: 3, y: null },
      { x: 4, y: 7 },
    ]);
    expect(absences[0]?.years).toEqual([2002, 2003]);
  });

  it('separates "did not race" from "raced but was not ranked" — one gap, two facts', () => {
    /*
     * The chart draws both as a break and cannot tell them apart, so the model returns them apart
     * and the copy names which is which. `championshipPosition: null` means unranked, never last.
     */
    const entity = COMPARE_FIXTURE.entities[0];
    if (entity === undefined) throw new Error('fixture has no entities');
    const { absences, unranked } = careerArc([
      {
        ...entity,
        seasons: [
          {
            year: 1958,
            teamRefs: [],
            starts: 2,
            wins: 0,
            podiums: 0,
            dnfs: 2,
            championshipPosition: null,
          },
          {
            year: 1959,
            teamRefs: [],
            starts: 8,
            wins: 0,
            podiums: 1,
            dnfs: 3,
            championshipPosition: 9,
          },
        ],
      },
    ]);
    expect(absences).toEqual([]);
    expect(unranked[0]?.years).toEqual([1958]);
  });

  it('carries the driver code as the short label and never invents one', () => {
    // `driver.code` is null for 774 of 881 drivers; `RankChart` falls back to the full label, and a
    // surname sliced to three letters would be a fabricated abbreviation.
    for (const entry of arc().series) {
      const entity = COMPARE_FIXTURE.entities.find((e) => e.identity.ref === entry.reference);
      expect(entry.shortLabel).toBe(entity?.identity.code ?? null);
    }
  });

  it('skips a driver with no seasons rather than drawing an empty line at the axis', () => {
    const entity = COMPARE_FIXTURE.entities[0];
    if (entity === undefined) throw new Error('fixture has no entities');
    expect(careerArc([{ ...entity, seasons: [] }]).series).toEqual([]);
  });
});
