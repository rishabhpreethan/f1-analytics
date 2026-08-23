/**
 * **The compare view model.** `DESIGN_SYSTEM.md` §6.6.6.
 *
 * These are **the shapes the surface consumes**, in the chart kit's sense (§6 — *"fixture shapes,
 * not an endpoint's, because a chart component that only works against one response is that
 * endpoint's renderer rather than a kit"*). They are also the shapes this feature has **asked**
 * `GET /api/compare` to publish, field for field, and the reason they are written down here first
 * is §6.6.5's rule:
 *
 * > *when a surface can only be designed one way, check whether the payload is the constraint
 * > before accepting the design.*
 *
 * The index pages were rejected because that check happened too late. So the data requirement is
 * stated by the surface, in the surface's own language, before the schema sets.
 *
 * ---
 *
 * **Nothing here carries a colour.** An entity carries `colorTeamRef` and nothing else;
 * `src/lib/entityColor.ts` turns a `team.reference` into a token name and no hex crosses this
 * boundary (§3.3a.3).
 */

/** A driver's identity. `code` is null for 774 of 881 drivers and is never derived from a surname. */
export interface CompareIdentity {
  ref: string;
  forename: string;
  surname: string;
  code: string | null;
}

/**
 * A two-sided count. **Every head-to-head in this feature is one of these**, and the denominator
 * travels with the numerators for the reason `DESIGN_SYSTEM.md` §6.6.2.2 gives: a rate whose
 * denominator is not printed is a rate a reader cannot check.
 *
 * `rated` is the number of events the comparison could be made on; `pool` is the number it *could
 * have* been made on had everything finished. `rated < pool` is the normal case, not a fault —
 * Senna and Prost shared 16 races in 1988 and both were classified in 12 of them.
 */
export interface Ledger {
  /** Events where both sides have a comparable result. */
  rated: number;
  /** Events both sides took part in at all. `rated <= pool`. */
  pool: number;
  a: number;
  b: number;
  /** Dead heats. Only reachable on the grid ledger — 9 races carry two `grid = 1` rows. */
  tied: number;
}

/** One selected entity. */
export interface CompareEntity {
  identity: CompareIdentity;
  /** The team whose colour represents this driver: most starts, ties to the most recent. */
  colorTeamRef: string;
  firstSeason: number;
  lastSeason: number;
  seasonsEntered: number;
  totals: {
    races: number;
    starts: number;
    wins: number;
    podiums: number;
    dnfs: number;
    classifiedFinishes: number;
    championships: number;
  };
  /**
   * The career teammate record — **the one fine-grained metric that spans 1950–2026**, because it
   * is normalised by machinery rather than by era. 3,435 of 3,627 driver-seasons have a teammate.
   *
   * ⚠ **`rated` counts pairings, not races.** Fangio's reads 93 against 51 starts, because a 1950s
   * constructor entered as many as 29 cars in one Grand Prix and every same-team pair in a race is
   * one comparison. The surface must say so wherever this number appears; it is not an error.
   */
  teammates: {
    count: number;
    race: Ledger;
    grid: Ledger;
  };
  seasons: CompareSeason[];
}

export interface CompareSeason {
  year: number;
  teamRefs: string[];
  starts: number;
  wins: number;
  podiums: number;
  dnfs: number;
  /** Final championship placing. Null means unranked, never last (`season.ts`). */
  championshipPosition: number | null;
}

/**
 * How two entities are related. **The page's first act is to establish this**, because it decides
 * which evidence is admissible — and refusing an inadmissible comparison out loud is the honesty
 * requirement made visible rather than merely obeyed.
 */
export type Relation = 'teammate' | 'contemporary' | 'disjoint';

export interface ComparePair {
  a: string;
  b: string;
  relation: Relation;
  sharedRaces: number;
  sameTeamRaces: number;
  sharedSeasons: number[];
  /**
   * The seasons the two shared a **team**, with that team named. Empty for every pair that was
   * never a teammate pair — which is most of them, and is exactly what `relation` reports.
   *
   * It is an array of seasons rather than a single team because 318 driver-seasons in this archive
   * map one driver to more than one team (`server/schemas/driver.ts`), so a teammate pairing can
   * legitimately span two identities of one organisation, or two organisations outright.
   */
  sameTeamSeasons: { year: number; teamRef: string; teamName: string }[];
  /** Whole years between one career ending and the other beginning. `0` when they overlap. */
  yearsApart: number;
  /** Both classified, over every race both entered — **whatever car each was in**. */
  race: Ledger;
  /** Both with a starting slot, over the same set. */
  grid: Ledger;
}

/** One measured teammate pairing: the unit of evidence the chain is built from. */
export interface ChainLink {
  from: string;
  to: string;
  firstYear: number;
  lastYear: number;
  teams: { year: number; teamRef: string; teamName: string }[];
  race: Ledger;
  grid: Ledger;
}

/**
 * The teammate chain. 861 drivers, 7,468 season-level pairings, **846 in one connected
 * component** — so almost any two drivers in the archive are joined by a path of real, measured
 * head-to-heads.
 *
 * **It is the path of strongest evidence among the shortest paths**, never an arbitrary one: ties
 * are broken by maximising the weakest link's rated-race count, then the total, then `reference`
 * ascending. A chain that changed between two page loads would be worthless.
 */
export interface Chain {
  a: string;
  b: string;
  /** Number of links. The number of drivers on the chain is `length + 1`. */
  length: number;
  links: ChainLink[];
}

/** One archive season. 77 rows, 1950–2026, and the spine every year-axis on the page shares. */
export interface ArchiveSeason {
  year: number;
  /** `max(number)`, never `count(*)` — 2026 has 24 calendar rows and 22 rounds (trap 15). */
  rounds: number;
}

export interface CompareData {
  entities: CompareEntity[];
  pairs: ComparePair[];
  chains: Chain[];
  /** Every driver named anywhere in `chains`, so a link can print a name without a second request. */
  people: Record<string, CompareIdentity>;
  archive: ArchiveSeason[];
}
