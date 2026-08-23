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
 *
 * ---
 *
 * ⚠ **Where a field is also a schema's, this file IMPORTS it rather than restating it** _(added
 * 2026-08-23)_. Restating drifted twice while nobody noticed — `championshipPositionIsFinal` was
 * missing from `CompareSeason`, and `Ledger.tied`'s comment described a constraint the data had
 * already disproved. A restated shape does not fail a typecheck when the schema moves; it simply
 * stops describing what arrives, and the surface silently cannot see a field that is on the wire.
 * `GridVsFinish` is therefore imported from `@schemas/entity`, which is the same path
 * `src/features/driver` already uses for the identical object.
 */

import type { GridVsFinish } from '@schemas/entity';

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
  /**
   * Dead heats.
   *
   * ⚠ **Not grid-only, which is what this comment used to say.** 9 races carry two `grid = 1`
   * rows, so a tie was assumed to be a qualifying artefact — but the schema measured **85 same-team
   * pairings where both drivers were classified in the same finishing position**, all of them
   * 1950s shared drives, where two men drove one car and were classified together. So the race
   * ledger ties too, and a surface that treated `tied > 0` as impossible there would be wrong 85
   * times.
   */
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
  /**
   * **Places gained from the grid** — the same object `GET /api/drivers/:reference` publishes, from
   * the same builder, so the two pages cannot disagree about a driver's career.
   *
   * Three properties of it decide how it may be drawn (§6.6.6.14 C):
   *
   * 1. `meanPositionsGained` is **null for 155 of the 818 drivers with a race** — never classified
   *    in one they started from a grid slot. All are pickable. A zero-length bar at the origin
   *    would say "started and finished level every time", which is a different and false claim, so
   *    the null needs a real no-measurement state.
   * 2. **`gained`/`lost`/`held` can disagree with the mean's sign**, and the disagreement is the
   *    honest part: a handful of large losses against many small gains. They are drawn beside the
   *    bar for that reason and not as decoration.
   * 3. `excluded.unclassified` is the caption. A mean over the races where the metric applies is a
   *    different claim from a mean over every race, and the reader can only tell which they are
   *    looking at if the gap is printed.
   */
  gridVsFinish: GridVsFinish;
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
  /**
   * `false` while the season is still being run, so the placing above is where the driver stood
   * after the last round held rather than where he finished. 2026 is 10 of 22 rounds in.
   *
   * The career arc draws it as an ordinary point — it is the honest current standing — and names it
   * in a note, because a line whose last point is provisional and unlabelled invites a reader to
   * treat a mid-season position as a career result.
   */
  championshipPositionIsFinal: boolean;
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

/* ------------------------------------------------------------------ the picker's directory */

/**
 * One driver the reader may add. **A superset of `CompareIdentity`, with every extra field
 * optional**, so a caller that has only identities is still a valid caller and the picker degrades
 * to names rather than breaking.
 *
 * The extras are what make the picker usable rather than a list of 818 surnames: a span and a race
 * count are how a reader tells one Brabham from another, and the colour is how the bay they are
 * about to fill is recognisable before it is filled.
 */
export interface CompareCandidate extends CompareIdentity {
  /** The team whose colour represents this driver: most starts, ties to the most recent. */
  colorTeamRef?: string;
  firstSeason?: number;
  lastSeason?: number;
  /** Races **started**, collapsed to one row per driver per race (trap 17). */
  races?: number;
}

/* ------------------------------------------------------------------------- the season lens */

/** One numbered round. Cancelled rounds carry `number IS NULL` and are excluded (trap 15). */
export interface SeasonRound {
  number: number;
  name: string;
}

/**
 * A contiguous run of rounds during which one person occupied the other seat.
 *
 * `ref === null` is not an absence of data — it is the statement that **the car had no single
 * other seat** at those rounds, either because the driver's team fielded nothing else or because
 * it fielded several. Both happen: 1957's Maserati entered between four and eleven other cars at
 * every round Fangio started.
 */
export interface SeatSegment {
  ref: string | null;
  /** The occupant's full name. Empty when `ref` is null. */
  label: string;
  fromRound: number;
  toRound: number;
}

/**
 * **The other seat in one principal's car, across one season.**
 *
 * A seat, not a person — Rishabh's model, and the truthful one: only **890 of 3,435
 * driver-seasons (26%) have exactly one team-mate all year**, so nominating a primary team-mate
 * would be wrong three times in four. Every array is indexed by the season's round list, so
 * `points[i]` belongs to `rounds[i]`.
 */
export interface SeasonSeat {
  /** Who held the seat at each round; `null` where there was no single other car. */
  occupant: (string | null)[];
  /** That occupant's **own** cumulative championship points at that round. */
  points: (number | null)[];
  /** That occupant's finishing position at that round; `null` if unclassified or absent. */
  finish: (number | null)[];
  /** The occupant runs, in round order. One entry per contiguous run, including the null runs. */
  segments: SeatSegment[];
  /** How many other cars the team fielded at each round. `> 1` is the 1950s works-team case. */
  carsBeside: (number | null)[];
}

/** One selected driver's season, round by round. Arrays are indexed by the season's round list. */
export interface SeasonEntrant {
  ref: string;
  /** `false` when the driver started no race that season — a designed state, not an empty array. */
  entered: boolean;
  /** Every team the driver raced for that season, in round order. 318 driver-seasons have two. */
  teamRefs: string[];
  /**
   * The team at each round, `null` where the driver did not start it.
   *
   * Present as well as `teamRefs` because a series takes **one** colour and a driver who changed
   * teams mid-season has two. The surface picks the car he raced most and says so in a note
   * (§6.6.6.10) — it cannot do that from a de-duplicated list.
   */
  teamAt: (string | null)[];
  /** Cumulative championship points after each round, **net of dropped scores** where they apply. */
  points: (number | null)[];
  /** Championship position after each round. */
  standing: (number | null)[];
  /** Finishing position at each round; `null` if unclassified or absent. */
  finish: (number | null)[];
  seat: SeasonSeat;
}

/**
 * **One season, round by round** — the second lens on `/compare` (`DESIGN_SYSTEM.md` §6.6.6.10).
 *
 * This is the one place in the product that can honestly show **points**. Trap 4 forbids summing
 * points *across* eras, not within a season: one calendar, one scoring system, one set of rules.
 * The career lens refuses totals loudly, so this lens has to say out loud why the rule changed
 * here — see `bestResults`, which is the sharpest case of it.
 */
export interface CompareSeasonLens {
  year: number;
  /** `false` while the season is in progress. 2026 has raced 10 of its 22 numbered rounds. */
  complete: boolean;
  /**
   * `> 0` when only the best N results counted toward the championship that season, `null`
   * otherwise. 1957 counted the best **5 of 8**, which is why Fangio's line is flat from round 6.
   * From `championship_system.driver_best_results`.
   */
  bestResults: number | null;
  /** The championship system's own name, for the copy. Never an undocumented enum (trap 14). */
  systemName: string;
  rounds: SeasonRound[];
  entrants: SeasonEntrant[];
}
