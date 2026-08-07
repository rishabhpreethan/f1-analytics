import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { DB_PATH } from '../config';
import { __resetDb, getDb } from '../db';
import { seasonListSchema, seasonSchema, standingsProgressionSchema } from '../schemas/season';
import {
  buildDriverSeries,
  buildRounds,
  buildScoring,
  buildTeamSeries,
  classifyAdjustment,
  groupDriverTeams,
  readSeason,
  readSeasonList,
  readStandingsProgression,
  toBoolean,
  toCounting,
} from './seasons';

/* ==================================================================================
 * Pure builders — no database, so these run in CI where `data/f1.db` never exists.
 * This is deliberate: the shaping is where a data trap gets violated silently, and a
 * suite that only exercised it through a database would test nothing on the runner.
 * ================================================================================== */

describe('toCounting — the championship rule decode', () => {
  it.each([
    [4, 'bestN', 4, '1950-53: best 4 results'],
    [5, 'bestN', 5, '1954-57: best 5'],
    [6, 'bestN', 6, '1958: best 6'],
    [11, 'bestN', 11, '1981-90: best 11'],
  ])('%i decodes to %s/%i (%s)', (input, counting, bestResults) => {
    expect(toCounting(input)).toEqual({ counting, bestResults });
  });

  it('-1 means every result counted (1991 onward)', () => {
    expect(toCounting(-1)).toEqual({ counting: 'all', bestResults: null });
  });

  it('0 means no championship of this kind — the team side, 1950-57', () => {
    expect(toCounting(0)).toEqual({ counting: 'none', bestResults: null });
  });

  /**
   * The honest branch. 1967-78 carries `-2` for a split-season best-N rule whose N the
   * value does not give. Returning a number here would be a fabricated cross-era
   * normalization, which is the exact defect REQUIREMENTS.md §5.2 forbids.
   */
  it('-2 means a limit this dataset does not quantify — never a guessed N', () => {
    expect(toCounting(-2)).toEqual({ counting: 'limited', bestResults: null });
  });

  it('an unknown negative sentinel degrades to limited, not to all', () => {
    expect(toCounting(-99)).toEqual({ counting: 'limited', bestResults: null });
  });

  it('null degrades to limited rather than claiming every result counted', () => {
    expect(toCounting(null)).toEqual({ counting: 'limited', bestResults: null });
  });
});

describe('buildScoring', () => {
  it('never reports the driver championship as absent, even on a 0', () => {
    const scoring = buildScoring({
      systemRef: 'sX',
      systemName: 'X',
      driverBestResults: 0,
      teamBestResults: 0,
    });
    expect(scoring.driverCounting).toBe('limited');
    expect(scoring.teamCounting).toBe('none');
  });
});

describe('classifyAdjustment', () => {
  it('is none when there is no adjustment, whatever the position', () => {
    expect(classifyAdjustment(0, null)).toBe('none');
    expect(classifyAdjustment(0, 4)).toBe('none');
    expect(classifyAdjustment(null, null)).toBe('none');
  });

  /**
   * The distinction that matters on screen. A null position on its own is ordinary —
   * 13,701 rows have one because the entity scored nothing — so it must not read as a
   * stewards' decision.
   */
  it('is excluded when an adjustment removed the position (1997 MSC, 2007 McLaren)', () => {
    expect(classifyAdjustment(101, null)).toBe('excluded');
    expect(classifyAdjustment(102, null)).toBe('excluded');
  });

  it('is adjusted when the position survived (2020 Racing Point, -15 pts, still P4)', () => {
    expect(classifyAdjustment(1, 4)).toBe('adjusted');
  });
});

describe('toBoolean — SQLite has no boolean type', () => {
  it('maps EXISTS output', () => {
    expect(toBoolean(1)).toBe(true);
    expect(toBoolean(0)).toBe(false);
  });
});

describe('buildRounds — a round can have two winners', () => {
  const round = {
    round: 4,
    name: 'French Grand Prix',
    date: '1951-07-01',
    circuitRef: 'reims',
    circuitName: 'Reims-Gueux',
    hasResults: 1,
    hasSprint: 0,
    hasLapData: 0,
  };
  const fangio = {
    round: 4,
    driverRef: 'fangio',
    code: null,
    forename: 'Juan',
    surname: 'Fangio',
    teamRef: 'alfa',
    teamName: 'Alfa Romeo',
    points: 5,
  };
  const fagioli = {
    ...fangio,
    driverRef: 'fagioli',
    forename: 'Luigi',
    surname: 'Fagioli',
    points: 4,
  };

  it('keeps both drivers of a shared car', () => {
    const [built] = buildRounds([round], [fangio, fagioli]);
    expect(built?.winners.map((w) => w.driverRef)).toEqual(['fangio', 'fagioli']);
    expect(built?.winners.map((w) => w.points)).toEqual([5, 4]);
  });

  it('gives a round with no result an empty array, not a null to remember', () => {
    const [built] = buildRounds([{ ...round, hasResults: 0 }], []);
    expect(built?.winners).toEqual([]);
    expect(built?.hasResults).toBe(false);
  });

  it('does not leak a winner into a neighbouring round', () => {
    const built = buildRounds(
      [round, { ...round, round: 5, name: 'British Grand Prix' }],
      [fangio],
    );
    expect(built[0]?.winners).toHaveLength(1);
    expect(built[1]?.winners).toEqual([]);
  });
});

describe('groupDriverTeams — a mid-season change is ordinary', () => {
  it('keeps every team, in the query order', () => {
    const grouped = groupDriverTeams([
      {
        driverRef: 'a',
        teamRef: 'first',
        teamName: 'First',
        firstRound: 1,
        lastRound: 5,
        entries: 5,
      },
      {
        driverRef: 'a',
        teamRef: 'second',
        teamName: 'Second',
        firstRound: 6,
        lastRound: 9,
        entries: 4,
      },
      {
        driverRef: 'b',
        teamRef: 'first',
        teamName: 'First',
        firstRound: 1,
        lastRound: 9,
        entries: 9,
      },
    ]);
    expect(grouped.get('a')?.map((t) => t.ref)).toEqual(['first', 'second']);
    expect(grouped.get('b')).toHaveLength(1);
    expect(grouped.get('nobody')).toBeUndefined();
  });
});

describe('buildDriverSeries', () => {
  const row = (round: number, driverRef: string, points: number, position: number | null) => ({
    round,
    driverRef,
    code: null,
    forename: driverRef,
    surname: driverRef,
    points,
    position,
    adjustmentType: 0,
  });

  it('folds per-round rows into one series per driver, in round order', () => {
    const series = buildDriverSeries(
      [row(1, 'a', 10, 1), row(1, 'b', 6, 2), row(2, 'a', 18, 1), row(2, 'b', 16, 2)],
      new Map(),
    );
    expect(series.map((s) => s.driverRef)).toEqual(['a', 'b']);
    expect(series[0]?.progression).toEqual([
      { round: 1, points: 10, position: 1 },
      { round: 2, points: 18, position: 1 },
    ]);
  });

  it('orders by the position held at the end, not by the first round', () => {
    const series = buildDriverSeries(
      [row(1, 'a', 25, 1), row(1, 'b', 18, 2), row(2, 'a', 25, 2), row(2, 'b', 43, 1)],
      new Map(),
    );
    expect(series.map((s) => s.driverRef)).toEqual(['b', 'a']);
  });

  it('puts unranked series last, ordered by points then name', () => {
    const series = buildDriverSeries(
      [row(1, 'ranked', 25, 1), row(1, 'zero', 0, null), row(1, 'some', 4, null)],
      new Map(),
    );
    expect(series.map((s) => s.driverRef)).toEqual(['ranked', 'some', 'zero']);
  });

  /**
   * The reason `adjustment` reads the last row and not the first: an exclusion decided
   * after the season would appear only on the final snapshot, and a series reporting
   * 'none' because round 1 said so would be wrong in exactly the case that matters.
   */
  it('takes the adjustment from the last round, not the first', () => {
    const series = buildDriverSeries(
      [
        { ...row(1, 'a', 10, 1), adjustmentType: 0 },
        { ...row(2, 'a', 18, null), adjustmentType: 101 },
      ],
      new Map(),
    );
    expect(series[0]?.adjustment).toBe('excluded');
  });

  it('attaches the driver teams, and an empty array when there are none', () => {
    const teams = new Map([
      ['a', [{ ref: 't', name: 'T', firstRound: 1, lastRound: 1, entries: 1 }]],
    ]);
    const series = buildDriverSeries([row(1, 'a', 10, 1), row(1, 'b', 6, 2)], teams);
    expect(series[0]?.teams).toHaveLength(1);
    expect(series[1]?.teams).toEqual([]);
  });

  it('returns nothing for a season with no snapshots', () => {
    expect(buildDriverSeries([], new Map())).toEqual([]);
  });
});

describe('buildTeamSeries', () => {
  it('is empty for a season with no constructors championship', () => {
    expect(buildTeamSeries([])).toEqual([]);
  });

  it('orders by the final position', () => {
    const series = buildTeamSeries([
      { round: 1, teamRef: 'a', name: 'A', points: 10, position: 2, adjustmentType: 0 },
      { round: 1, teamRef: 'b', name: 'B', points: 20, position: 1, adjustmentType: 0 },
    ]);
    expect(series.map((s) => s.teamRef)).toEqual(['b', 'a']);
  });
});

/* ==================================================================================
 * Against the real database. Skipped where `data/f1.db` is absent, which is always
 * true in CI — `vitest.reporter.ts` prints that rather than letting it look green.
 * ================================================================================== */

const hasDatabase = existsSync(DB_PATH);

describe.skipIf(!hasDatabase)('server/queries/seasons — against the data', () => {
  afterAll(() => {
    __resetDb();
  });

  it('lists 77 seasons, newest first', () => {
    const { seasons } = readSeasonList();
    expect(seasons).toHaveLength(77);
    expect(seasons[0]?.year).toBe(2026);
    expect(seasons.at(-1)?.year).toBe(1950);
  });

  /** REQUIREMENTS.md §2.2 / §2.5, and trap 15: 24 round rows, 22 numbered. */
  it('counts 2026 as 22 rounds, 10 complete, 2 cancelled — never count(*)', () => {
    const season = readSeasonList().seasons.find((s) => s.year === 2026);
    expect(season).toEqual({
      year: 2026,
      rounds: 22,
      completedRounds: 10,
      cancelledRounds: 2,
      isComplete: false,
      hasTeamStandings: true,
    });
  });

  it('knows the Constructors Championship began in 1958', () => {
    const seasons = readSeasonList().seasons;
    expect(seasons.find((s) => s.year === 1957)?.hasTeamStandings).toBe(false);
    expect(seasons.find((s) => s.year === 1958)?.hasTeamStandings).toBe(true);
  });

  /**
   * Trap 15's re-verification (DATABASE.md §9), asserted from the code that depends on
   * it rather than left to a checklist. The calendar partitions on `number IS NULL`; this
   * asserts that partition is still exactly the cancelled/uncancelled one. If a refresh
   * ever introduces a numbered cancelled round, this fails here rather than silently
   * putting an unrunnable round in the calendar.
   */
  it('has number IS NULL exactly co-extensive with is_cancelled = 1', () => {
    const row = getDb()
      .prepare(
        `SELECT (SELECT count(*) FROM round WHERE is_cancelled = 1 AND number IS NOT NULL) AS cancelledButNumbered,
                (SELECT count(*) FROM round WHERE is_cancelled = 0 AND number IS NULL)      AS numberedGap,
                (SELECT count(*) FROM round WHERE is_cancelled IS NULL)                     AS cancelledUnknown`,
      )
      .get();
    expect(row).toEqual({ cancelledButNumbered: 0, numberedGap: 0, cancelledUnknown: 0 });
  });

  it('validates every one of the 77 seasons against its own schema', () => {
    const failures: number[] = [];
    for (let year = 1950; year <= 2026; year += 1) {
      const season = readSeason(year);
      if (season === null || !seasonSchema.safeParse(season).success) failures.push(year);
      const progression = readStandingsProgression(year);
      if (progression === null || !standingsProgressionSchema.safeParse(progression).success) {
        failures.push(year);
      }
    }
    expect(failures).toEqual([]);
  });

  it('validates the season list against its schema', () => {
    expect(seasonListSchema.safeParse(readSeasonList()).success).toBe(true);
  });

  it('returns null for a well-formed year the data does not hold', () => {
    expect(readSeason(2027)).toBeNull();
    expect(readStandingsProgression(2027)).toBeNull();
    expect(readSeason(1949)).toBeNull();
  });

  /* ------------------------------------------------ the cross-era correctness cases */

  /**
   * **The single most important assertion in this file.** 1950 counted only a driver's
   * best 4 results, so the championship total is not the sum of their race points.
   * These are the historical figures; a `sum(session_entry.points)` implementation
   * produces different ones and would look perfectly plausible on screen.
   */
  it('reproduces the 1950 championship exactly — Farina 30, Fangio 27, Fagioli 24', () => {
    const drivers = readSeason(1950)?.standings.drivers ?? [];
    expect(drivers.slice(0, 3).map((d) => [d.surname, d.points, d.position])).toEqual([
      ['Farina', 30, 1],
      ['Fangio', 27, 2],
      ['Fagioli', 24, 3],
    ]);
  });

  it('reports 1950 as a best-4-results season with no constructors championship', () => {
    expect(readSeason(1950)?.scoring).toEqual({
      systemRef: 's1950',
      systemName: '1950 - 1953 Championship',
      driverCounting: 'bestN',
      driverBestResults: 4,
      teamCounting: 'none',
      teamBestResults: null,
    });
    expect(readSeason(1950)?.standings.teams).toEqual([]);
  });

  it('reports 1970 as limited rather than inventing an N for the split season', () => {
    expect(readSeason(1970)?.scoring.driverCounting).toBe('limited');
    expect(readSeason(1970)?.scoring.driverBestResults).toBeNull();
  });

  /* --------------------------------------------------------- the adjustment cases */

  it('marks 2007 McLaren excluded — 8 wins, 0 points, no position', () => {
    const mclaren = readSeason(2007)?.standings.teams.find((t) => t.teamRef === 'mclaren');
    expect(mclaren).toMatchObject({ points: 0, wins: 8, position: null, adjustment: 'excluded' });
  });

  it('marks 1997 Schumacher excluded — points kept, position removed', () => {
    const msc = readSeason(1997)?.standings.drivers.find(
      (d) => d.driverRef === 'michael_schumacher',
    );
    expect(msc).toMatchObject({ points: 78, position: null, adjustment: 'excluded' });
  });

  /**
   * The penalty is **already in the snapshot** — 195 is the post-deduction figure in the
   * record. Anything that re-applied the 15-point penalty would read 180 here.
   */
  it('marks 2020 Racing Point adjusted at 195 points, and does not re-apply the penalty', () => {
    const racingPoint = readSeason(2020)?.standings.teams.find((t) => t.teamRef === 'racing_point');
    expect(racingPoint).toMatchObject({ points: 195, position: 4, adjustment: 'adjusted' });
  });

  it('marks an ordinary entry with no ranked position as none, not as excluded', () => {
    const unranked = readSeason(2026)?.standings.drivers.filter(
      (d) => d.position === null && d.adjustment !== 'none',
    );
    expect(unranked).toEqual([]);
  });

  /* --------------------------------------------------------------- the calendar */

  it('returns both winners of the 1951 French Grand Prix, higher share first', () => {
    const round = readSeason(1951)?.rounds.find((r) => r.round === 4);
    expect(round?.winners.map((w) => [w.surname, w.points])).toEqual([
      ['Fangio', 5],
      ['Fagioli', 4],
    ]);
  });

  it('finds all three shared drives and no fourth', () => {
    const shared: string[] = [];
    for (let year = 1950; year <= 2026; year += 1) {
      for (const round of readSeason(year)?.rounds ?? []) {
        if (round.winners.length > 1) shared.push(`${String(year)} R${String(round.round)}`);
      }
    }
    expect(shared).toEqual(['1951 R4', '1956 R1', '1957 R5']);
  });

  it('separates the two cancelled 2026 rounds from the numbered calendar', () => {
    const season = readSeason(2026);
    expect(season?.rounds).toHaveLength(22);
    expect(season?.cancelledRounds.map((r) => r.name)).toEqual([
      'Bahrain Grand Prix',
      'Saudi Arabian Grand Prix',
    ]);
    expect(season?.rounds.some((r) => r.name === 'Bahrain Grand Prix')).toBe(false);
  });

  it('renders a future round as scheduled, not as missing data', () => {
    const round11 = readSeason(2026)?.rounds.find((r) => r.round === 11);
    expect(round11).toMatchObject({
      name: 'Hungarian Grand Prix',
      hasResults: false,
      hasLapData: false,
      winners: [],
    });
  });

  /** Trap 1: 0 of the 484 races before 1990 have lap rows, whatever the flag says. */
  it('reports no lap data for 1950 and lap data for 2024', () => {
    expect(readSeason(1950)?.rounds.every((r) => !r.hasLapData)).toBe(true);
    expect(readSeason(1995)?.rounds.every((r) => !r.hasLapData)).toBe(true);
    expect(
      readSeason(2024)
        ?.rounds.filter((r) => r.hasResults)
        .every((r) => r.hasLapData),
    ).toBe(true);
  });

  it('flags the sprint rounds of 2026 and none in 2020', () => {
    expect(
      readSeason(2026)
        ?.rounds.filter((r) => r.hasSprint)
        .map((r) => r.round),
    ).toEqual([2, 4, 5, 9, 12, 16]);
    expect(readSeason(2020)?.rounds.some((r) => r.hasSprint)).toBe(false);
  });

  /* ------------------------------------------------------------- mid-season teams */

  it('keeps every team a driver raced for, ordered by their last round', () => {
    const drivers = readSeason(1976)?.standings.drivers ?? [];
    const multi = drivers.filter((d) => d.teams.length > 1);
    expect(multi.length).toBeGreaterThan(0);
    for (const driver of multi) {
      const lastRounds = driver.teams.map((t) => t.lastRound);
      expect([...lastRounds].sort((a, b) => a - b)).toEqual(lastRounds);
    }
  });

  /* ------------------------------------------------------------------ progression */

  it('gives one progression point per round, not one per session', () => {
    const progression = readStandingsProgression(2026);
    // 2026 writes a snapshot after Q1, Q2, Q3 and the race. One round, one point.
    expect(progression?.rounds.map((r) => r.round)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const driver of progression?.drivers ?? []) {
      const rounds = driver.progression.map((p) => p.round);
      expect(new Set(rounds).size).toBe(rounds.length);
    }
  });

  it('has monotonically non-decreasing cumulative points within a season', () => {
    for (const year of [1950, 1976, 1997, 2020, 2024, 2026]) {
      for (const driver of readStandingsProgression(year)?.drivers ?? []) {
        let previous = -1;
        for (const point of driver.progression) {
          expect(point.points).toBeGreaterThanOrEqual(previous);
          previous = point.points;
        }
      }
    }
  });

  it('stops the progression at the last completed round of a season in progress', () => {
    const progression = readStandingsProgression(2026);
    expect(progression?.rounds.at(-1)?.round).toBe(10);
    expect(progression?.rounds.at(-1)?.name).toBe('Belgian Grand Prix');
  });

  it('has no team progression before 1958 and some in 1958', () => {
    expect(readStandingsProgression(1957)?.teams).toEqual([]);
    expect((readStandingsProgression(1958)?.teams ?? []).length).toBeGreaterThan(0);
  });

  it('orders the progression series by final standing', () => {
    const progression = readStandingsProgression(2024);
    const standings = readSeason(2024)?.standings.drivers ?? [];
    expect(progression?.drivers.slice(0, 5).map((d) => d.driverRef)).toEqual(
      standings.slice(0, 5).map((d) => d.driverRef),
    );
  });

  /* ------------------------------------------------------------------------ DL-3 */

  it('exposes no internal integer id anywhere in any payload', () => {
    const text = JSON.stringify([
      readSeasonList(),
      readSeason(2026),
      readStandingsProgression(2026),
    ]);
    expect(text).not.toMatch(/"(id|driverId|teamId|seasonId|roundId|sessionId|circuitId)":/);
  });

  it('exposes no brand colour anywhere in any payload', () => {
    const text = JSON.stringify([
      readSeasonList(),
      readSeason(2026),
      readStandingsProgression(2026),
    ]);
    expect(text).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
