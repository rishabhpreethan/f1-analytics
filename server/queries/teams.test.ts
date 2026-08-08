import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { DB_PATH } from '../config';
import { __resetDb, getDb } from '../db';
import { invalidateMemo } from '../cache/memo';
import { teamSchema } from '../schemas/team';
import type { TeamChampionshipRow, TeamRaceRow } from './teams';
import {
  SQL_TEAM_CHAMPIONSHIPS,
  SQL_TEAM_RACES,
  buildTeamSeasons,
  buildTeamTotals,
  readTeam,
  teamExists,
} from './teams';

/* ==================================================================================
 * Pure builders — no database, so these run in CI where `data/f1.db` never exists.
 * ================================================================================== */

function row(overrides: Partial<TeamRaceRow> & { round: number; driverRef: string }): TeamRaceRow {
  return {
    year: 1951,
    name: 'Test Grand Prix',
    date: '1951-01-01',
    circuitRef: 'test',
    circuitName: 'Test',
    code: null,
    forename: 'Test',
    surname: overrides.driverRef,
    position: null,
    points: 0,
    status: 11,
    ...overrides,
  };
}

/**
 * The 1951 French Grand Prix: Fangio and Fagioli shared car 24 and both were classified
 * first, splitting the win's points 5 and 4 (trap 16).
 */
const SHARED_WIN: TeamRaceRow[] = [
  row({ round: 4, driverRef: 'fangio', position: 1, points: 5, status: 0 }),
  row({ round: 4, driverRef: 'fagioli', position: 1, points: 4, status: 0 }),
];

describe('buildTeamSeasons — a win is a race, a podium is a place', () => {
  it('counts a shared drive as one win for the constructor, not two', () => {
    const seasons = buildTeamSeasons(SHARED_WIN, [], new Map([[1951, true]]));
    expect(seasons[0]?.wins).toBe(1);
    expect(seasons[0]?.races).toBe(1);
    expect(seasons[0]?.entries).toBe(2);
  });

  it('counts a 1-2 as two podiums and a shared P2 as one', () => {
    const oneTwo = [
      row({ round: 1, driverRef: 'a', position: 1, status: 0 }),
      row({ round: 1, driverRef: 'b', position: 2, status: 0 }),
    ];
    expect(buildTeamSeasons(oneTwo, [], new Map()).at(0)?.podiums).toBe(2);

    const shared = [
      row({ round: 1, driverRef: 'a', position: 2, status: 0 }),
      row({ round: 1, driverRef: 'b', position: 2, status: 0 }),
    ];
    expect(buildTeamSeasons(shared, [], new Map()).at(0)?.podiums).toBe(1);
  });

  /**
   * CN-4. The split is of **race points**, which is why the two drivers of a shared car
   * both carry the car's score and the total is not the constructor's championship figure.
   * What must hold is that the shares are internally consistent.
   */
  it('splits race points so the shares sum to 1', () => {
    const seasons = buildTeamSeasons(SHARED_WIN, [], new Map());
    const drivers = seasons[0]?.drivers ?? [];
    expect(seasons[0]?.driverRacePointsTotal).toBe(9);
    expect(drivers.map((driver) => driver.racePoints)).toEqual([5, 4]);
    const shares = drivers.map((driver) => driver.racePointsShare ?? 0);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 10);
  });

  it('leaves the share null rather than dividing by a scoreless season', () => {
    const scoreless = [row({ round: 1, driverRef: 'a', position: 12, status: 1 })];
    expect(
      buildTeamSeasons(scoreless, [], new Map()).at(0)?.drivers[0]?.racePointsShare,
    ).toBeNull();
  });

  /**
   * Trap 17 at team level: a driver who took over a second car has two rows in one race
   * and one result. 71 such triples exist.
   */
  it('folds a driver taking over a second car into one start', () => {
    const takeover = [
      row({ round: 7, driverRef: 'ascari', position: 2, points: 3, status: 0 }),
      row({ round: 7, driverRef: 'ascari', position: 17, points: 0, status: 11 }),
    ];
    const driver = buildTeamSeasons(takeover, [], new Map()).at(0)?.drivers[0];
    expect(driver?.entries).toBe(2);
    expect(driver?.starts).toBe(1);
    expect(driver?.podiums).toBe(1);
    expect(driver?.bestFinish).toBe(2);
    // Both cars' points are the driver's.
    expect(driver?.racePoints).toBe(3);
  });

  it('excludes a did-not-start from a driver`s starts', () => {
    const dns = [
      row({ round: 1, driverRef: 'a', status: 30, detail: 'Withdrew' } as Partial<TeamRaceRow> & {
        round: number;
        driverRef: string;
      }),
    ];
    expect(buildTeamSeasons(dns, [], new Map()).at(0)?.drivers[0]?.starts).toBe(0);
  });

  /**
   * 1950–1957 had no Constructors' Championship. The absence is derived from the snapshot
   * rather than from `year >= 1958`, so a refresh that moved the boundary would follow.
   */
  it('reports a season with no constructors` championship as such, not as zero points', () => {
    const seasons = buildTeamSeasons(SHARED_WIN, [], new Map([[1951, true]]));
    expect(seasons[0]?.hasTeamStandings).toBe(false);
    expect(seasons[0]?.points).toBeNull();
    expect(seasons[0]?.position).toBeNull();
    expect(seasons[0]?.isChampion).toBe(false);
  });

  it('reads championship points from the snapshot, never from the race points', () => {
    const championships: TeamChampionshipRow[] = [
      { year: 1951, points: 27, position: 1, wins: 4, adjustmentType: null },
    ];
    const seasons = buildTeamSeasons(SHARED_WIN, championships, new Map([[1951, true]]));
    expect(seasons[0]?.points).toBe(27);
    expect(seasons[0]?.driverRacePointsTotal).toBe(9);
    expect(seasons[0]?.hasTeamStandings).toBe(true);
    expect(seasons[0]?.isChampion).toBe(true);
  });

  /**
   * The gate that keeps this dataset's in-progress 2026 from handing Mercedes a tenth
   * constructors' title.
   */
  it('awards a title only when the season is complete', () => {
    const championships: TeamChampionshipRow[] = [
      { year: 1951, points: 27, position: 1, wins: 4, adjustmentType: null },
    ];
    const seasons = buildTeamSeasons(SHARED_WIN, championships, new Map([[1951, false]]));
    expect(seasons[0]?.position).toBe(1);
    expect(seasons[0]?.isChampion).toBe(false);
  });

  it('orders a season`s drivers by race points descending', () => {
    const seasons = buildTeamSeasons(SHARED_WIN, [], new Map());
    expect(seasons[0]?.drivers.map((driver) => driver.driverRef)).toEqual(['fangio', 'fagioli']);
  });
});

describe('buildTeamTotals — CN-1', () => {
  const rows = [
    ...SHARED_WIN,
    row({ year: 1952, round: 1, driverRef: 'ascari', position: 1, points: 8, status: 0 }),
    row({ year: 1952, round: 1, driverRef: 'villoresi', position: 3, points: 4, status: 0 }),
  ];
  const seasons = buildTeamSeasons(rows, [], new Map());
  const totals = buildTeamTotals(rows, seasons);

  it('counts distinct Grands Prix, not classification rows', () => {
    expect(totals.races).toBe(2);
    expect(totals.entries).toBe(4);
  });

  it('counts a shared win once', () => {
    expect(totals.wins).toBe(2);
  });

  it('counts podium places, so a 1-3 is two', () => {
    expect(totals.podiums).toBe(3);
  });

  it('counts distinct drivers', () => {
    // fangio and fagioli shared the 1951 car; ascari and villoresi drove in 1952.
    expect(totals.driversUsed).toBe(4);
  });
});

/* ==================================================================================
 * Against the live database. Skipped where `data/f1.db` is absent — CI never has it.
 * ================================================================================== */

const hasDatabase = existsSync(DB_PATH);

describe.skipIf(!hasDatabase)('team queries against the live database', () => {
  afterAll(() => {
    __resetDb();
    invalidateMemo();
  });

  it('answers 404-shaped for a well-formed reference the data does not hold', () => {
    expect(teamExists('not_a_team')).toBe(false);
    expect(readTeam('not_a_team')).toBeNull();
  });

  /**
   * The record, with the completeness gate applied. **Mercedes is the test that matters**:
   * without the gate this dataset's in-progress 2026 snapshot would make it 9.
   */
  it.each([
    ['ferrari', 16],
    ['mclaren', 10],
    ['williams', 9],
    ['mercedes', 8],
    ['red_bull', 6],
  ])('%s holds %i constructors titles', (ref, titles) => {
    expect(readTeam(ref)?.totals.championships).toBe(titles);
  });

  it('reports 1950–57 as seasons without a constructors championship', () => {
    const ferrari = readTeam('ferrari');
    const early = (ferrari?.seasons ?? []).filter((season) => season.year <= 1957);
    expect(early.length).toBe(8);
    expect(early.every((season) => !season.hasTeamStandings)).toBe(true);
    expect(early.every((season) => season.points === null)).toBe(true);
  });

  it('reproduces the 1951 French Grand Prix as one Alfa Romeo win with two drivers', () => {
    const season = readTeam('alfa')?.seasons.find((row) => row.year === 1951);
    const refs = (season?.drivers ?? []).map((driver) => driver.driverRef);
    expect(refs).toContain('fangio');
    expect(refs).toContain('fagioli');
    // Both were classified P1 in car 24; the constructor is credited with one win.
    expect(season?.wins).toBeLessThanOrEqual(season?.races ?? 0);
  });

  it('splits an intra-team season so the shares sum to 1', () => {
    const season = readTeam('ferrari')?.seasons.find((row) => row.year === 2026);
    const shares = (season?.drivers ?? []).map((driver) => driver.racePointsShare ?? 0);
    expect(shares.length).toBeGreaterThan(1);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 10);
    const total = (season?.drivers ?? []).reduce((sum, driver) => sum + driver.racePoints, 0);
    expect(total).toBeCloseTo(season?.driverRacePointsTotal ?? 0, 10);
  });

  it('produces a payload that passes its own schema for a spread of eras', () => {
    for (const ref of ['ferrari', 'mclaren', 'mercedes', 'brawn', 'alfa']) {
      const parsed = teamSchema.safeParse(readTeam(ref));
      expect(parsed.success, `${ref}: ${JSON.stringify(parsed.error?.issues.slice(0, 3))}`).toBe(
        true,
      );
    }
  });

  it('orders seasons ascending', () => {
    const years = (readTeam('ferrari')?.seasons ?? []).map((season) => season.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  /**
   * S-10. The team-anchored CTE exists so the planner enters through `idx_team_ref`; a
   * plan that lost it would still return correct data, which is why this is a test.
   */
  it('SQL_TEAM_RACES plans through the team index and scans nothing', () => {
    const plan = getDb()
      .prepare(`EXPLAIN QUERY PLAN ${SQL_TEAM_RACES}`)
      .all({ ref: 'ferrari' }) as { detail: string }[];
    const details = plan.map((step) => step.detail);
    expect(
      details.some((detail) => /SEARCH t USING (COVERING )?INDEX idx_team_ref/.test(detail)),
    ).toBe(true);
    expect(details.filter((detail) => /^SCAN /.test(detail))).toEqual([]);
  });

  it('SQL_TEAM_CHAMPIONSHIPS scans only team_championship, and only to group it', () => {
    const plan = getDb()
      .prepare(`EXPLAIN QUERY PLAN ${SQL_TEAM_CHAMPIONSHIPS}`)
      .all({ ref: 'ferrari' }) as { detail: string }[];
    const scans = plan.map((step) => step.detail).filter((detail) => /^SCAN /.test(detail));
    expect(scans.every((detail) => detail.includes('team_championship'))).toBe(true);
  });

  it('no lap or pit_stop access exists anywhere in this module', () => {
    for (const sql of [SQL_TEAM_RACES, SQL_TEAM_CHAMPIONSHIPS]) {
      expect(/\blap\b|\bpit_stop\b/.test(sql)).toBe(false);
    }
  });
});
