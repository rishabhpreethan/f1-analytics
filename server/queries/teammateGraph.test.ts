import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { invalidateMemo } from '../cache/memo';
import { DB_PATH } from '../config';
import { __resetDb } from '../db';
import type { TeammateEdgeRow } from './teammateGraph';
import {
  MEASURED_LINK_COST,
  UNMEASURED_LINK_COST,
  buildTeammateGraph,
  componentSizes,
  findChain,
  linkCost,
  readTeammateGraph,
} from './teammateGraph';

/**
 * The graph and the search.
 *
 * The search is pure and is tested on **hand-built graphs**, which is the only way to state what it
 * prefers: on the live archive every interesting case is buried under 4,678 edges and a test that
 * asserted one real chain would be pinning an answer rather than a rule.
 */

const hasDatabase = existsSync(DB_PATH);

const edge = (a: string, b: string, rated: number, pool = Math.max(rated, 1)): TeammateEdgeRow => ({
  a,
  b,
  pool,
  rated,
});

describe('linkCost', () => {
  it('prices an unmeasured pairing above a thousand measured hops', () => {
    expect(linkCost(0)).toBe(UNMEASURED_LINK_COST);
    expect(linkCost(1)).toBe(MEASURED_LINK_COST);
    expect(UNMEASURED_LINK_COST).toBeGreaterThan(1000 * MEASURED_LINK_COST);
  });
});

describe('buildTeammateGraph', () => {
  it('is undirected — every pairing is reachable from both ends', () => {
    const graph = buildTeammateGraph([edge('b', 'a', 4)]);
    expect(graph.refs).toEqual(['a', 'b']);
    expect(findChain(graph, 'a', 'b')).toEqual(['a', 'b']);
    expect(findChain(graph, 'b', 'a')).toEqual(['b', 'a']);
  });

  it('counts nodes from the pairings, not from a driver table', () => {
    const graph = buildTeammateGraph([edge('a', 'b', 1), edge('b', 'c', 0)]);
    expect(graph.refs).toEqual(['a', 'b', 'c']);
    expect(graph.edgeCount).toBe(2);
  });
});

describe('findChain', () => {
  it('returns null for a reference the graph does not hold', () => {
    const graph = buildTeammateGraph([edge('a', 'b', 3)]);
    expect(findChain(graph, 'a', 'zzz')).toBeNull();
    expect(findChain(graph, 'zzz', 'b')).toBeNull();
  });

  it('returns null across two components rather than inventing a link', () => {
    const graph = buildTeammateGraph([edge('a', 'b', 3), edge('y', 'z', 3)]);
    expect(findChain(graph, 'a', 'z')).toBeNull();
  });

  it('takes the shortest path when every link is measured', () => {
    const graph = buildTeammateGraph([
      edge('a', 'b', 5),
      edge('b', 'd', 5),
      edge('a', 'c', 5),
      edge('c', 'e', 5),
      edge('e', 'd', 5),
    ]);
    expect(findChain(graph, 'a', 'd')).toEqual(['a', 'b', 'd']);
  });

  /**
   * **The rule the whole cost function exists for.** Over half the pairings in the real archive
   * are unmeasured, so a hop-minimal chain is very often a chain of links that say nothing.
   */
  it('prefers a longer measured path to a shorter one containing an unmeasured link', () => {
    const graph = buildTeammateGraph([
      edge('a', 'x', 0),
      edge('x', 'd', 0),
      edge('a', 'b', 2),
      edge('b', 'c', 2),
      edge('c', 'd', 2),
    ]);
    expect(findChain(graph, 'a', 'd')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('still crosses an unmeasured link when it is the only way through', () => {
    const graph = buildTeammateGraph([edge('a', 'b', 0), edge('b', 'c', 9)]);
    expect(findChain(graph, 'a', 'c')).toEqual(['a', 'b', 'c']);
  });

  /** Among equal-cost paths: the one whose weakest link carries the most evidence. */
  it('breaks a tie on the strongest weakest link', () => {
    const graph = buildTeammateGraph([
      edge('a', 'thin', 1),
      edge('thin', 'z', 40),
      edge('a', 'thick', 12),
      edge('thick', 'z', 30),
    ]);
    expect(findChain(graph, 'a', 'z')).toEqual(['a', 'thick', 'z']);
  });

  /** Then on total evidence, with the bottleneck held equal. */
  it('breaks a remaining tie on total evidence', () => {
    const graph = buildTeammateGraph([
      edge('a', 'lean', 10),
      edge('lean', 'z', 11),
      edge('a', 'rich', 10),
      edge('rich', 'z', 50),
    ]);
    expect(findChain(graph, 'a', 'z')).toEqual(['a', 'rich', 'z']);
  });

  /** And finally on the reference, so the answer never depends on row order. */
  it('breaks a full tie on the reference, ascending', () => {
    const graph = buildTeammateGraph([
      edge('a', 'mm', 7),
      edge('mm', 'z', 7),
      edge('a', 'bb', 7),
      edge('bb', 'z', 7),
    ]);
    expect(findChain(graph, 'a', 'z')).toEqual(['a', 'bb', 'z']);
  });

  it('is deterministic under a reordering of the rows', () => {
    const rows = [
      edge('a', 'mm', 7),
      edge('mm', 'z', 7),
      edge('a', 'bb', 7),
      edge('bb', 'z', 7),
      edge('a', 'cc', 7),
      edge('cc', 'z', 7),
    ];
    const forward = findChain(buildTeammateGraph(rows), 'a', 'z');
    const backward = findChain(buildTeammateGraph([...rows].reverse()), 'a', 'z');
    expect(forward).toEqual(backward);
  });

  it('answers a one-element path for a driver against themself', () => {
    const graph = buildTeammateGraph([edge('a', 'b', 3)]);
    expect(findChain(graph, 'a', 'a')).toEqual(['a']);
  });
});

describe('componentSizes', () => {
  it('reports every component, largest first', () => {
    const graph = buildTeammateGraph([edge('a', 'b', 1), edge('b', 'c', 1), edge('y', 'z', 1)]);
    expect(componentSizes(graph)).toEqual([3, 2]);
  });
});

/* ================================================================================================
 * Against the live database. These pin the numbers the module header and `schemas/compare.ts`
 * quote, so a refresh that reshapes the archive fails here rather than silently changing every
 * chain the page draws.
 * ============================================================================================== */

describe.skipIf(!hasDatabase)('the teammate graph against the live database', () => {
  afterAll(() => {
    invalidateMemo();
    __resetDb();
  });

  it('holds 777 drivers, 4,678 pairings and one component of 759', () => {
    const graph = readTeammateGraph();
    expect(graph.refs.length).toBe(777);
    expect(graph.edgeCount).toBe(4678);
    const sizes = componentSizes(graph);
    expect(sizes[0]).toBe(759);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(777);
  });

  /**
   * **The measurement the edge rule rests on.** A roster graph — anyone against the same team in
   * the same season — would join Coulthard and Senna, who were both Williams drivers in 1994 and
   * never once lined up together: Senna entered rounds 1, 2 and 3, Coulthard debuted at round 5.
   */
  it('does not join two drivers who shared a team in a season but never a race', () => {
    const graph = readTeammateGraph();
    const senna = graph.indexOf.get('senna');
    const coulthard = graph.indexOf.get('coulthard');
    expect(senna).toBeDefined();
    expect(coulthard).toBeDefined();
    const neighbours = graph.adjacency[senna ?? -1] ?? [];
    expect(neighbours.some((e) => e.to === coulthard)).toBe(false);
  });

  it('leaves over half the pairings unmeasured — which is why cost is not hop count', () => {
    const graph = readTeammateGraph();
    let unmeasured = 0;
    for (const list of graph.adjacency) {
      for (const e of list) if (e.rated === 0) unmeasured += 1;
    }
    /* Each pairing appears once per endpoint. */
    expect(unmeasured / 2).toBe(2419);
  });

  it('finds a chain every link of which is measured, for two drivers 68 years apart', () => {
    const graph = readTeammateGraph();
    const path = findChain(graph, 'max_verstappen', 'fangio');
    expect(path?.[0]).toBe('max_verstappen');
    expect(path?.at(-1)).toBe('fangio');
    for (let i = 0; i + 1 < (path?.length ?? 0); i += 1) {
      const from = graph.indexOf.get(path?.[i] ?? '') ?? -1;
      const to = graph.indexOf.get(path?.[i + 1] ?? '') ?? -1;
      const link = (graph.adjacency[from] ?? []).find((e) => e.to === to);
      expect(link?.rated).toBeGreaterThan(0);
    }
  });

  it('gives the same chain on two calls', () => {
    const graph = readTeammateGraph();
    expect(findChain(graph, 'hamilton', 'fangio')).toEqual(findChain(graph, 'hamilton', 'fangio'));
  });
});
