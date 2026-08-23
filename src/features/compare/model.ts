import type {
  ArchiveSeason,
  Chain,
  ChainLink,
  CompareEntity,
  ComparePair,
  Ledger,
  Relation,
} from './types';

/**
 * **The compare surface's pure arithmetic.** No React, no d3, no DOM — the same split
 * `src/components/charts/geometry.ts` uses, and for the same reason: jsdom performs no layout, so
 * a rendered element proves nothing about where it is. Everything positional on this page is
 * decided here and asserted in `model.test.ts`.
 */

/* --------------------------------------------------------------------- the shared time axis */

export interface Domain {
  /** First year, inclusive. */
  start: number;
  /** Last year, **exclusive** — a season occupies the slot between its year and the next. */
  end: number;
}

/**
 * The one axis the whole page shares.
 *
 * **Every year-bearing mark on `/compare` is plotted against this same domain** — the chain, the
 * era strip, the season trajectory — so a reader can drop their eye vertically from a link in 1957
 * to the 1957 column in the era strip and it is the same 1957. That single decision is what makes
 * the surface one instrument rather than a stack of widgets, and it is the same device `SpanRail`
 * uses to turn 881 rows into one history (§7.12).
 *
 * The end is `lastYear + 1` so the most recent season has width rather than sitting on the edge as
 * a zero-width tick.
 */
export function archiveDomain(archive: readonly ArchiveSeason[]): Domain {
  const head = archive[0];
  if (head === undefined) return { start: 1950, end: 2027 };
  let start = head.year;
  let end = head.year;
  for (const season of archive) {
    if (season.year < start) start = season.year;
    if (season.year > end) end = season.year;
  }
  return { start, end: end + 1 };
}

/** A year's left edge as a fraction of the domain, clamped. */
export function yearFraction(year: number, domain: Domain): number {
  const span = domain.end - domain.start;
  if (span <= 0) return 0;
  return clamp01((year - domain.start) / span);
}

/**
 * The decade labels under the axis. Whole decades **inside** the domain only — a `1940` tick on a
 * 1950-start axis would sit at a negative offset and be clipped, which reads as a rendering fault
 * rather than as an axis that starts at 1950.
 */
export function decadeTicks(domain: Domain): { year: number; offset: number }[] {
  const ticks: { year: number; offset: number }[] = [];
  const first = Math.ceil(domain.start / 10) * 10;
  for (let year = first; year < domain.end; year += 10) {
    ticks.push({ year, offset: yearFraction(year, domain) });
  }
  return ticks;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/* ------------------------------------------------------------------------- the chain, drawn */

export interface ChainConnector {
  /** Where the vertical drop from the row above lands, as a fraction of the domain. */
  dropX: number;
  /** Left edge of the horizontal run at this row's centre. */
  runStart: number;
  /** Its length. Zero when the two links overlap in time and no run is needed. */
  runLength: number;
}

export interface ChainLinkGeometry {
  offset: number;
  length: number;
  /** Null on the first row: there is nothing above it to connect to. */
  connector: ChainConnector | null;
}

/**
 * The staircase.
 *
 * Each link is a capsule laid at **the seasons the two were actually teammates**, one row per
 * link, reading downward from the present into the past. The connector is an L — a vertical drop
 * at the pivot driver's nearest edge, then a horizontal run to the next capsule — and the run's
 * length is a real quantity: **the years the pivot driver raced between the two pairings**. A
 * chain that drew the links edge to edge would claim a continuity the careers do not have.
 *
 * The horizontal run is dashed and the capsule is solid, because one is measured time and the
 * other is inference. That is §6.3's crosshair idiom (`--border-strong`, dashed `2 3`) applied to
 * a mark rather than to furniture.
 *
 * A link's capsule spans `[firstYear, lastYear + 1)`, so a single-season pairing has the width of
 * one season rather than none.
 */
export function chainGeometry(links: readonly ChainLink[], domain: Domain): ChainLinkGeometry[] {
  const spans = links.map((link) => {
    const offset = yearFraction(link.firstYear, domain);
    const end = yearFraction(link.lastYear + 1, domain);
    return { offset, length: Math.max(end - offset, 0) };
  });

  return spans.map((span, index) => {
    if (index === 0) return { ...span, connector: null };
    const prev = spans[index - 1];
    if (prev === undefined) return { ...span, connector: null };
    const prevLeft = prev.offset;
    const prevRight = prev.offset + prev.length;
    const left = span.offset;
    const right = span.offset + span.length;

    if (right <= prevLeft) {
      return {
        ...span,
        connector: { dropX: prevLeft, runStart: right, runLength: prevLeft - right },
      };
    }
    if (left >= prevRight) {
      return {
        ...span,
        connector: { dropX: prevRight, runStart: prevRight, runLength: left - prevRight },
      };
    }
    /* The two pairings overlap in time — the pivot driver had both teammates in one window. The
     * drop lands inside the overlap and there is no run to draw. */
    const dropX = Math.max(prevLeft, left);
    return { ...span, connector: { dropX, runStart: dropX, runLength: 0 } };
  });
}

/**
 * The driver every pair of consecutive links has in common — the person the chain pivots on.
 * Returned per row so the connector can be labelled with a name instead of being a bare line.
 */
export function chainPivots(links: readonly ChainLink[]): (string | null)[] {
  return links.map((_link, index) => (index === 0 ? null : (links[index - 1]?.to ?? null)));
}

/**
 * The weakest link's rated-race count. **The chain's own honesty figure**, printed with it: a
 * chain whose weakest link is `0` contains a pairing that never produced a single race both
 * drivers finished, and half of all teammate pairings in the archive are in that state
 * (2,378 of 4,637, counted). Presenting such a chain without saying so would be the same failure
 * as a blank chart with no explanation.
 */
export function chainWeakestLink(chain: Chain): number {
  if (chain.links.length === 0) return 0;
  return chain.links.reduce(
    (min, link) => Math.min(min, link.race.rated),
    Number.POSITIVE_INFINITY,
  );
}

/* ------------------------------------------------------------------------------- the ledger */

export interface Balance {
  a: number;
  b: number;
  tied: number;
}

/**
 * A ledger as three fractions of one track. **Null when nothing is rated** — an undrawn bar and a
 * 50/50 bar are opposite statements, and the second one is a lie the reader cannot detect.
 */
export function balanceFractions(ledger: Ledger): Balance | null {
  if (ledger.rated <= 0) return null;
  const total = ledger.a + ledger.b + ledger.tied;
  if (total <= 0) return null;
  return { a: ledger.a / total, b: ledger.b / total, tied: ledger.tied / total };
}

/** The share of rated events one side took, `0`–`1`. Null when nothing is rated. */
export function winShare(ledger: Ledger, side: 'a' | 'b'): number | null {
  const decided = ledger.a + ledger.b;
  if (decided <= 0) return null;
  return (side === 'a' ? ledger.a : ledger.b) / decided;
}

/** `189–135`. En dash, never a hyphen: it is a score, not a range and not a minus sign. */
export function scoreLabel(ledger: Ledger): string {
  return `${String(ledger.a)}–${String(ledger.b)}`;
}

/* -------------------------------------------------------------------------- rate comparison */

/**
 * A cross-era rate. **The numerator and the denominator both travel**, because §6.2's ban on
 * career-points axes has a positive form: a comparison across eras is a rate, and a rate the
 * reader cannot see the denominator of is not checkable.
 */
export interface Rate {
  ref: string;
  numerator: number;
  denominator: number;
  /** `null` when the denominator is zero — never `0`, which would read as "never did it". */
  value: number | null;
}

export function rate(ref: string, numerator: number, denominator: number): Rate {
  return { ref, numerator, denominator, value: denominator > 0 ? numerator / denominator : null };
}

export interface RateRail {
  id: string;
  label: string;
  /** What the denominator is, in words. Printed under the rail, always. */
  denominatorLabel: string;
  values: Rate[];
  /** The largest value on the rail, used as the track's ceiling. Never a fixed 100%. */
  ceiling: number;
}

/**
 * The five rates the whole archive supports.
 *
 * **Every one is a rate and none is a total**, which is not a stylistic preference: 24 point
 * systems and six best-N eras mean a career total is not comparable across the boundary
 * (`REQUIREMENTS.md` §5.2, trap 4). Season length nearly tripled — 8.4 rounds per season in the
 * 1950s against 21.9 in the 2020s — so even a win *count* is an era artefact before it is an
 * achievement.
 *
 * `teammate` is the load-bearing one and it is deliberately last, because it needs the most
 * explanation: it is the only fine-grained measure that is normalised by *machinery* rather than
 * by opportunity, and it is the only one that is equally meaningful in 1955 and 2026.
 */
export function rateRails(entities: readonly CompareEntity[]): RateRail[] {
  const rails: RateRail[] = [
    {
      id: 'wins',
      label: 'Win rate',
      denominatorLabel: 'of races started',
      values: entities.map((e) => rate(e.identity.ref, e.totals.wins, e.totals.starts)),
      ceiling: 0,
    },
    {
      id: 'podiums',
      label: 'Podium rate',
      denominatorLabel: 'of races started',
      values: entities.map((e) => rate(e.identity.ref, e.totals.podiums, e.totals.starts)),
      ceiling: 0,
    },
    {
      id: 'finishes',
      label: 'Classified finishes',
      denominatorLabel: 'of races started — an era measure as much as a driver one',
      values: entities.map((e) =>
        rate(e.identity.ref, e.totals.classifiedFinishes, e.totals.starts),
      ),
      ceiling: 0,
    },
    {
      id: 'teammate-grid',
      label: 'Out-qualified a teammate',
      denominatorLabel: 'of same-car pairings with both on the grid',
      values: entities.map((e) =>
        rate(e.identity.ref, e.teammates.grid.a, e.teammates.grid.a + e.teammates.grid.b),
      ),
      ceiling: 0,
    },
    {
      id: 'teammate-race',
      label: 'Finished ahead of a teammate',
      denominatorLabel:
        'of same-car pairings both finished — the one measure normalised by machinery',
      values: entities.map((e) =>
        rate(e.identity.ref, e.teammates.race.a, e.teammates.race.a + e.teammates.race.b),
      ),
      ceiling: 0,
    },
  ];

  /* The ceiling is the largest value **on that rail**, floored at 1 so a rail whose leader is at
   * 0.9 does not draw them at the full width and imply a perfect record. It is never a shared
   * ceiling across rails: a win rate and a teammate rate live on different natural scales and one
   * track for both would flatten the interesting one. */
  for (const rail of rails) {
    const max = rail.values.reduce((acc, v) => Math.max(acc, v.value ?? 0), 0);
    rail.ceiling = max > 0 ? Math.min(1, Math.max(max, 0.05)) : 1;
  }
  return rails;
}

/* -------------------------------------------------------------------------- pairs and copy */

/** Pairs in a stable order — the order the entities were selected in, never by any measure. */
export function pairFor(pairs: readonly ComparePair[], a: string, b: string): ComparePair | null {
  return pairs.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a)) ?? null;
}

export function chainFor(chains: readonly Chain[], a: string, b: string): Chain | null {
  return chains.find((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a)) ?? null;
}

/**
 * A pair's ledger **oriented to the entities as the caller holds them**. The payload publishes
 * `a`/`b` in its own order; a component that assumed the two agreed would silently invert every
 * score, which is the class of defect that survives a long time because the numbers look right.
 */
export function orientLedger(pair: ComparePair, first: string): { race: Ledger; grid: Ledger } {
  if (pair.a === first) return { race: pair.race, grid: pair.grid };
  return { race: flip(pair.race), grid: flip(pair.grid) };
}

function flip(ledger: Ledger): Ledger {
  return { rated: ledger.rated, pool: ledger.pool, a: ledger.b, b: ledger.a, tied: ledger.tied };
}

export function orientChain(chain: Chain, first: string): Chain {
  if (chain.a === first) return chain;
  return {
    a: chain.b,
    b: chain.a,
    length: chain.length,
    links: [...chain.links].reverse().map((link) => ({
      ...link,
      from: link.to,
      to: link.from,
      race: flip(link.race),
      grid: flip(link.grid),
    })),
  };
}

export function fullName(entity: { forename: string; surname: string }): string {
  return `${entity.forename} ${entity.surname}`;
}

/* --------------------------------------------------------------------------- the verdict */

export interface Verdict {
  relation: Relation;
  /** Three or four words. The largest type in the band and the page's actual thesis. */
  headline: string;
  /** One sentence that names the figure the headline rests on, and what it does not licence. */
  lead: string;
}

/**
 * **The page's first act.** `DESIGN_SYSTEM.md` §6.6.6.1.
 *
 * Before a single number is compared, the surface states **what kind of comparison this is** —
 * because that is what decides which evidence is admissible, and because saying it out loud is the
 * difference between a product that obeys `REQUIREMENTS.md` §5.3's honesty rules and one that
 * *demonstrates* them.
 *
 * The three tiers are computed from the data, never chosen by the user. There is no "mode" control
 * on this page and there must never be one: a reader cannot ask for a like-for-like comparison of
 * two drivers who never shared a car, and offering the switch would imply they could.
 */
export function verdict(
  pair: ComparePair,
  first: CompareEntity,
  second: CompareEntity,
  teamName: string | null,
): Verdict {
  const a = first.identity.surname;
  const b = second.identity.surname;

  if (pair.relation === 'teammate') {
    const at = teamName === null ? '' : ` at ${teamName}`;
    return {
      relation: 'teammate',
      headline: 'Same car.',
      lead: `${a} and ${b} started ${String(pair.sameTeamRaces)} Grands Prix as teammates${at}. Same machinery, same races, same conditions — this is the only like-for-like comparison the sport produces, and everything below rests on it.`,
    };
  }

  if (pair.relation === 'contemporary') {
    return {
      relation: 'contemporary',
      headline: 'Same grid, different cars.',
      lead: `${a} and ${b} started ${String(pair.sharedRaces)} of the same Grands Prix across ${String(pair.sharedSeasons.length)} seasons, and never one of them in the same car. A head-to-head here measures two cars at least as much as it measures two drivers.`,
    };
  }

  const earlier = first.lastSeason <= second.firstSeason ? first : second;
  const later = earlier === first ? second : first;
  return {
    relation: 'disjoint',
    headline: 'Never on the same grid.',
    lead: `${String(pair.yearsApart)} years separate ${earlier.identity.surname}'s last Grand Prix in ${String(earlier.lastSeason)} from ${later.identity.surname}'s first in ${String(later.firstSeason)}. There is no race, no car and no points system the two of them share, so nothing on this page is a direct result — and the rates below are indexed to opportunity, not summed.`,
  };
}
