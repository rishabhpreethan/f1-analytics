import { describe, expect, it } from 'vitest';
import { COMPARE_FIXTURE } from './fixture';
import {
  archiveDomain,
  balanceFractions,
  chainGeometry,
  chainPivots,
  chainWeakestLink,
  decadeTicks,
  orientChain,
  orientLedger,
  pairFor,
  rateRails,
  scoreLabel,
  verdict,
  winShare,
  yearFraction,
} from './model';
import type { ChainLink, Ledger } from './types';

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
