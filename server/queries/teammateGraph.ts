import { memoize } from '../cache/memo';
import { SEASON_CACHE_TTL_MS } from '../config';
import { prepared } from './prepared';

/**
 * The teammate graph, and the search that turns it into a chain.
 *
 * `DESIGN_SYSTEM.md` §6.6.6 asks the comparison workspace to answer "how are these two joined" for
 * any two drivers in 77 seasons. The answer is a path of **measured same-car head-to-heads**, and
 * this module owns both halves of it: the edge set, and the rule that picks one path out of the
 * many.
 *
 * ================================================================== an edge is a shared race
 *
 * **Two drivers are joined when they were in the same team in the same race — at least once.**
 * Nothing weaker. The obvious alternative is the *roster* graph, joining anyone listed against the
 * same team in the same season, and it over-claims badly: **38.6 % of its edges never shared a
 * race.** The proof case is Coulthard and Senna, both Williams drivers of 1994, who never once
 * lined up together — Senna entered rounds 1, 2 and 3 and died at Imola; Coulthard debuted at round
 * 5. A roster graph puts a link between them and a chain through that link is a fiction.
 *
 * Measured on this database, with `AND r.number IS NOT NULL` (trap 15) and race sessions only:
 *
 * | | |
 * |---|---|
 * | drivers with at least one teammate pairing | **777** |
 * | distinct pairings | **4,678** |
 * | largest connected component | **759** (the rest: one of 6, four of 2, one of 3) |
 * | pairings where the two never *both* finished | **2,419 — 51.7 %** |
 *
 * That last row is the one that shapes the search. **A hop-minimal chain can be entirely
 * unmeasured**: over half the edges in this graph record two drivers who shared a car and never
 * once both saw a chequered flag, so "Hamilton to Fangio in six" can be six links that say nothing.
 *
 * ================================================================== which path, and why that one
 *
 * The path is chosen by a Dijkstra whose edge weight is **1,001 for an unmeasured pairing and 1 for
 * a measured one**, then three tiebreaks. In order:
 *
 * 1. **Fewest unmeasured links.** The 1,001 is not arbitrary: a total cost decomposes exactly as
 *    `1000 × unmeasured + hops` for any path shorter than 1,000 hops, and this graph's diameter is
 *    nowhere near that — so cost sorts first by unmeasured count and then by hop count, in one
 *    scalar, and two paths of equal cost necessarily have the same hop count *and* the same
 *    unmeasured count. That identity is what makes the tiebreaks below well defined.
 * 2. **Fewest hops**, which falls out of the same scalar.
 * 3. **The strongest weakest link** — maximise the smallest `race.rated` on the path. A chain is
 *    only as good as its thinnest evidence, so this is the honest thing to maximise.
 * 4. **The most total evidence**, then **`reference` ascending** as the final, total order.
 *
 * **Determinism is the requirement**, not elegance: a chain that changed between two page loads
 * would be worthless. Keys 1, 2, 3 and 5 are exact — each is monotone under extending a path, so
 * the dynamic program below finds the true optimum on them. **Key 4 is not exact and is not claimed
 * to be:** a larger total can be reached through a prefix that lost on the weakest-link key, and
 * this keeps one label per node rather than enumerating equal-cost paths. It is a tiebreak among
 * paths that already agree on cost, hops and bottleneck; the `reference` key underneath it is what
 * makes the answer stable, and stability is what the surface promised.
 *
 * ============================================================================================ cost
 *
 * The edge statement is **memoised for the life of the TTL** (ARCHITECTURE.md §6 convention 4): it
 * is global, takes no parameter, and is ~4,678 rows — about 400 KB retained — against 70–90 ms of
 * aggregation. The alternative, a bidirectional expansion seeded from the four selected drivers,
 * still reaches most of a 759-node component and would pay that on every request.
 *
 * **No `lap` or `pit_stop` access anywhere in this module** (S-10, trap 7).
 */

/* ------------------------------------------------------------------------------------- SQL */

/**
 * Every round-level teammate pairing in the archive, with the strength of its race head-to-head.
 *
 * `best` collapses to one row per (race session, team, driver) before the self-join, which is
 * **trap 17 handled at the source**: 40 races between 1950 and 1964 classify the same driver two or
 * three times, and without the collapse those races would contribute a pairing of a driver with
 * themself and inflate every count around them.
 *
 * `pos` is the driver's best **classified** finishing position, and `rated` counts the pairings
 * where both sides have one. `position` is populated on all 26,093 race rows in this database —
 * including 9,683 that are *not* classified, where it is a retirement order rather than a result —
 * so `position IS NOT NULL` is not the test and `is_classified` is (trap 3).
 *
 * The self-join is `<` on the reference, so each pairing appears once, oriented `a < b`.
 */
export const SQL_TEAMMATE_EDGES = `
WITH best AS (
  SELECT session_id, team_id, driver_ref,
         min(CASE WHEN is_classified = 1 THEN position END) AS pos
  FROM v_race
  WHERE round_number IS NOT NULL
  GROUP BY session_id, team_id, driver_ref
)
SELECT a.driver_ref AS a,
       b.driver_ref AS b,
       count(*) AS pool,
       sum(a.pos IS NOT NULL AND b.pos IS NOT NULL) AS rated
FROM best a
JOIN best b
  ON b.session_id = a.session_id AND b.team_id = a.team_id AND b.driver_ref > a.driver_ref
GROUP BY a.driver_ref, b.driver_ref
ORDER BY a.driver_ref, b.driver_ref`;

const Q_TEAMMATE_EDGES = prepared(SQL_TEAMMATE_EDGES);

/* --------------------------------------------------------------------------- the graph shape */

/** One pairing as the statement returns it. */
export interface TeammateEdgeRow {
  a: string;
  b: string;
  /** Races the two shared a team in. */
  pool: number;
  /** Of those, the ones where both were classified. `0` means the pairing is unmeasured. */
  rated: number;
}

interface GraphEdge {
  to: number;
  rated: number;
  cost: number;
}

export interface TeammateGraph {
  /** Node index → `driver.reference`. Sorted, so an index is stable between builds. */
  readonly refs: readonly string[];
  readonly indexOf: ReadonlyMap<string, number>;
  readonly adjacency: readonly (readonly GraphEdge[])[];
  readonly edgeCount: number;
}

/** An unmeasured pairing costs a thousand hops plus one — see the module header. */
export const UNMEASURED_LINK_COST = 1001;
export const MEASURED_LINK_COST = 1;

export function linkCost(rated: number): number {
  return rated > 0 ? MEASURED_LINK_COST : UNMEASURED_LINK_COST;
}

/**
 * Rows → graph. Pure, so the search can be tested on a hand-built graph with no database.
 *
 * Node order is the sorted reference, not the row order, so the `reference`-ascending tiebreak in
 * the search can compare indices instead of strings on every relaxation.
 */
export function buildTeammateGraph(rows: readonly TeammateEdgeRow[]): TeammateGraph {
  const refs = [...new Set(rows.flatMap((row) => [row.a, row.b]))].sort();
  const indexOf = new Map(refs.map((ref, i) => [ref, i]));
  const adjacency: GraphEdge[][] = refs.map(() => []);

  for (const row of rows) {
    const from = indexOf.get(row.a);
    const to = indexOf.get(row.b);
    /* c8 ignore next -- both endpoints came from `refs`, so neither lookup can miss. */
    if (from === undefined || to === undefined) continue;
    const cost = linkCost(row.rated);
    adjacency[from]?.push({ to, rated: row.rated, cost });
    adjacency[to]?.push({ to: from, rated: row.rated, cost });
  }

  return { refs, indexOf, adjacency, edgeCount: rows.length };
}

/** The whole-archive graph, built once per TTL. */
export function readTeammateGraph(): TeammateGraph {
  return memoize('teammate-graph', SEASON_CACHE_TTL_MS, () =>
    buildTeammateGraph(Q_TEAMMATE_EDGES().all() as TeammateEdgeRow[]),
  );
}

/* -------------------------------------------------------------------------------- the search */

interface Label {
  /** `1000 × unmeasured links + hops`. */
  cost: number;
  /** The smallest `rated` on the path. `Infinity` at the source, so any first edge wins. */
  bottleneck: number;
  /** The sum of `rated` over the path. */
  total: number;
  /** Predecessor node index, or −1 at the source. */
  prev: number;
  /** Node indices along the path, for the final `reference`-ascending tiebreak. */
  trail: readonly number[];
}

/**
 * Is `candidate` a better label than `current` for the same node?
 *
 * The keys are the module header's, in order. `trail` is compared element by element and both
 * trails have the same length whenever `cost` is equal — see the header's decomposition — so this
 * is a total order over the candidates it is ever asked about.
 */
function isBetter(candidate: Label, current: Label): boolean {
  if (candidate.cost !== current.cost) return candidate.cost < current.cost;
  if (candidate.bottleneck !== current.bottleneck) return candidate.bottleneck > current.bottleneck;
  if (candidate.total !== current.total) return candidate.total > current.total;
  const n = Math.min(candidate.trail.length, current.trail.length);
  for (let i = 0; i < n; i += 1) {
    const x = candidate.trail[i] ?? 0;
    const y = current.trail[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

/**
 * The chain between two drivers, as a list of references from `fromRef` to `toRef` inclusive, or
 * `null` when either is not in the graph or the two are in different components.
 *
 * A driver is always in their own graph position, so `fromRef === toRef` returns a one-element
 * path; callers that would rather not draw that check the pair first.
 *
 * O(V²) selection rather than a heap: 777 nodes is 604k comparisons, and a heap would be a
 * dependency or fifty lines of code to save under a millisecond on the cold path.
 */
export function findChain(graph: TeammateGraph, fromRef: string, toRef: string): string[] | null {
  const source = graph.indexOf.get(fromRef);
  const target = graph.indexOf.get(toRef);
  if (source === undefined || target === undefined) return null;

  const n = graph.refs.length;
  const labels: (Label | null)[] = new Array<Label | null>(n).fill(null);
  const settled = new Array<boolean>(n).fill(false);
  labels[source] = {
    cost: 0,
    bottleneck: Number.POSITIVE_INFINITY,
    total: 0,
    prev: -1,
    trail: [source],
  };

  for (;;) {
    let current = -1;
    let best: Label | null = null;
    for (let i = 0; i < n; i += 1) {
      const label = labels[i];
      if (settled[i] || label === null || label === undefined) continue;
      if (best === null || isBetter(label, best)) {
        best = label;
        current = i;
      }
    }
    if (current === -1 || best === null) return null;
    if (current === target) break;
    settled[current] = true;

    for (const edge of graph.adjacency[current] ?? []) {
      if (settled[edge.to]) continue;
      const candidate: Label = {
        cost: best.cost + edge.cost,
        bottleneck: Math.min(best.bottleneck, edge.rated),
        total: best.total + edge.rated,
        prev: current,
        trail: [...best.trail, edge.to],
      };
      const existing = labels[edge.to];
      if (existing === null || existing === undefined || isBetter(candidate, existing)) {
        labels[edge.to] = candidate;
      }
    }
  }

  const trail = labels[target]?.trail ?? [];
  return trail.map((i) => graph.refs[i] ?? '');
}

/**
 * The connected components, largest first. Used only by the tests that pin the graph's shape
 * against the numbers this module's header quotes, so a database refresh that reshapes the archive
 * fails a test rather than quietly changing every chain on the page.
 */
export function componentSizes(graph: TeammateGraph): number[] {
  const seen = new Array<boolean>(graph.refs.length).fill(false);
  const sizes: number[] = [];
  for (let start = 0; start < graph.refs.length; start += 1) {
    if (seen[start]) continue;
    let size = 0;
    const stack = [start];
    seen[start] = true;
    while (stack.length > 0) {
      const node = stack.pop();
      if (node === undefined) break;
      size += 1;
      for (const edge of graph.adjacency[node] ?? []) {
        if (seen[edge.to]) continue;
        seen[edge.to] = true;
        stack.push(edge.to);
      }
    }
    sizes.push(size);
  }
  return sizes.sort((x, y) => y - x);
}
