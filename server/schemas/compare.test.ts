import { describe, expect, it } from 'vitest';
import type {
  CompareData as SurfaceCompareData,
  CompareSeasonLens as SurfaceSeasonLens,
} from '@/features/compare/types';
import type { CompareData, CompareSeasonLens } from './compare';
import {
  archiveSeasonSchema,
  compareEntitySeasonSchema,
  compareKindParamSchema,
  compareRefsParamSchema,
  ledgerSchema,
  seasonEntrantSchema,
  seatSegmentSchema,
} from './compare';

/**
 * The request parameters and the shapes that carry a claim.
 *
 * No database anywhere in this file, so it runs in CI — which is where the `?e=` cases belong,
 * since S-4 is the one control on this surface a code change can silently weaken.
 */

describe('compareRefsParamSchema', () => {
  it('accepts one to four references and keeps the reader’s order', () => {
    expect(compareRefsParamSchema.parse('hamilton')).toEqual(['hamilton']);
    expect(compareRefsParamSchema.parse('c,a,b,d')).toEqual(['c', 'a', 'b', 'd']);
  });

  /**
   * **Not lowercase-only.** Three driver references in the archive carry a capital, and a pattern
   * that reads as obviously right would answer 400 on three real drivers.
   */
  it.each(['scott_Brown', 'Changy', 'Cannoc', 'campbell-jones', 'brabham-alfa_romeo'])(
    'accepts the real reference %s',
    (ref) => {
      expect(compareRefsParamSchema.parse(ref)).toEqual([ref]);
    },
  );

  it.each([
    ['', 'empty'],
    [',', 'a bare separator'],
    ['a,,b', 'an empty element'],
    ['a,b,c,d,e', 'five entities'],
    ['a,a', 'a duplicate'],
    ['a,b,a', 'a duplicate at a distance'],
    ["hamilton'--", 'a SQL fragment'],
    ['hamilton lando', 'a space'],
    ['../etc', 'a traversal'],
    ['x'.repeat(33), 'a reference longer than the format allows'],
    ['x'.repeat(200), 'an oversized parameter'],
  ])('rejects %s (%s)', (raw) => {
    expect(compareRefsParamSchema.safeParse(raw).success).toBe(false);
  });

  it('rejects an absent parameter rather than defaulting to a comparison', () => {
    expect(compareRefsParamSchema.safeParse(undefined).success).toBe(false);
  });

  /** Four 32-character references and three commas is 131 bytes — the bound is exactly reachable. */
  it('accepts the longest well-formed parameter it is meant to', () => {
    const raw = ['a', 'b', 'c', 'd'].map((c) => c.repeat(32)).join(',');
    expect(raw).toHaveLength(131);
    expect(compareRefsParamSchema.parse(raw)).toHaveLength(4);
  });
});

describe('compareKindParamSchema', () => {
  it('defaults an absent lens to driver', () => {
    expect(compareKindParamSchema.parse(undefined)).toBe('driver');
  });

  /** `ARCHITECTURE.md` §5 promises `driver | team`; the team lens is not built, so it is a 400. */
  it.each(['team', '', 'DRIVER', 'drivers'])('rejects %s', (raw) => {
    expect(compareKindParamSchema.safeParse(raw).success).toBe(false);
  });
});

describe('the payload shapes', () => {
  const ledger = { rated: 3, pool: 5, a: 2, b: 1, tied: 0 };

  it('accepts a ledger whose ties are on the race side', () => {
    expect(ledgerSchema.parse({ ...ledger, a: 1, b: 1, tied: 1 })).toBeDefined();
  });

  it('refuses an unknown key rather than passing it through', () => {
    expect(ledgerSchema.safeParse({ ...ledger, wins: 4 }).success).toBe(false);
  });

  it('requires a season row to say whether its placing is final', () => {
    const season = {
      year: 2026,
      teamRefs: ['ferrari'],
      starts: 10,
      wins: 1,
      podiums: 5,
      dnfs: 0,
      championshipPosition: 2,
    };
    expect(compareEntitySeasonSchema.safeParse(season).success).toBe(false);
    expect(
      compareEntitySeasonSchema.safeParse({ ...season, championshipPositionIsFinal: false })
        .success,
    ).toBe(true);
  });

  it('requires an archive season to say whether it is finished', () => {
    expect(archiveSeasonSchema.safeParse({ year: 2026, rounds: 22 }).success).toBe(false);
    expect(
      archiveSeasonSchema.safeParse({ year: 2026, rounds: 22, isComplete: false }).success,
    ).toBe(true);
  });

  /** A run with nobody in the seat carries an empty label, never a name for nobody. */
  it('lets a seat segment name nobody', () => {
    expect(
      seatSegmentSchema.safeParse({ ref: null, label: '', fromRound: 1, toRound: 8 }).success,
    ).toBe(true);
    expect(
      seatSegmentSchema.safeParse({
        ref: 'bottas',
        label: 'Valtteri Bottas',
        fromRound: 1,
        toRound: 22,
      }).success,
    ).toBe(true);
  });

  /** Half points are real — Prost's 71.5 in 1984 — so a points array is not integers. */
  it('accepts a half-point total and a null round on an entrant', () => {
    const entrant = {
      ref: 'prost',
      entered: true,
      teamRefs: ['mclaren'],
      teamAt: ['mclaren', null],
      points: [71.5, null],
      standing: [2, null],
      finish: [1, null],
      seat: {
        occupant: [null, null],
        points: [null, null],
        finish: [null, null],
        segments: [{ ref: null, label: '', fromRound: 1, toRound: 2 }],
        carsBeside: [0, null],
      },
    };
    expect(seasonEntrantSchema.safeParse(entrant).success).toBe(true);
  });
});

/**
 * **The payload and the surface, checked against each other by the compiler.**
 *
 * `src/features/compare/types.ts` is the contract the surface wrote before this schema existed
 * (`DESIGN_SYSTEM.md` §6.6.5), and it re-declares the shapes rather than importing them. Two
 * hand-written copies of one contract is exactly the drift this project keeps paying for, and the
 * copy is not mine to delete — so the next best thing is that a divergence is a **compile error**
 * here rather than a runtime surprise on a page.
 *
 * The two directions are deliberately different:
 *
 * - **Career lens: the payload must satisfy the surface**, one way only. It carries two fields the
 *   surface's copy does not yet name — `CompareSeason.championshipPositionIsFinal` and
 *   `ArchiveSeason.isComplete` — because without them 2026's standing prints as a final one, and
 *   an extra field is assignable where a missing one is not. The surface adopts them when it is
 *   ready; nothing breaks meanwhile.
 * - **Season lens: the two must be identical**, both ways. That payload was specified field for
 *   field by a surface that is already built against it, so a rename in either direction is a
 *   defect and not an extension.
 */
describe('the payload and the surface agree', () => {
  it('publishes at least what the career lens asked for, and exactly what the season lens did', () => {
    const satisfiesSurface = (payload: CompareData): SurfaceCompareData => payload;
    const matchesSurface = (payload: CompareSeasonLens): SurfaceSeasonLens => payload;
    const matchesPayload = (surface: SurfaceSeasonLens): CompareSeasonLens => surface;
    expect([satisfiesSurface, matchesSurface, matchesPayload]).toHaveLength(3);
  });
});
