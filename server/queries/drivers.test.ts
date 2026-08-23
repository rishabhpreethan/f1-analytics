import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { DB_PATH } from '../config';
import { __resetDb, getDb } from '../db';
import { invalidateMemo } from '../cache/memo';
import { driverSchema } from '../schemas/driver';
import type { DriverChampionshipRow, DriverQualifyingRow, DriverRaceRow } from './drivers';
import {
  SQL_DRIVER_CHAMPIONSHIPS,
  SQL_DRIVER_QUALIFYING,
  SQL_DRIVER_RACES,
  ageYears,
  buildGridVsFinish,
  buildQualifyingVsRace,
  buildSeasons,
  buildTotals,
  collapseRaces,
  driverExists,
  pickQualifying,
  positionsGained,
  readDriver,
} from './drivers';

/* ==================================================================================
 * Pure builders — no database, so these run in CI where `data/f1.db` never exists.
 * The shaping is where a data trap gets violated silently, so it is tested where the
 * runner can see it.
 * ================================================================================== */

describe('ageYears — calendar arithmetic on the strings, never a Date', () => {
  it('counts whole years when the birthday has passed', () => {
    expect(ageYears('1911-07-02', '1950-09-03')).toBe(39);
  });

  it('subtracts a year when the birthday has not arrived yet', () => {
    expect(ageYears('1911-07-02', '1950-05-21')).toBe(38);
  });

  /**
   * The boundary a `Date`-based implementation gets wrong depending on the server's
   * timezone: on the birthday itself the driver **has** turned that age.
   */
  it('counts the birthday itself as the new age', () => {
    expect(ageYears('1911-07-02', '1950-07-02')).toBe(39);
  });

  it('is null when either date is absent — 16 drivers carry no date of birth', () => {
    expect(ageYears(null, '1950-09-03')).toBeNull();
    expect(ageYears('1911-07-02', null)).toBeNull();
    expect(ageYears(null, null)).toBeNull();
  });

  it('is null rather than negative if a race predates the birth', () => {
    expect(ageYears('1990-01-01', '1980-01-01')).toBeNull();
  });
});

describe('positionsGained — §5.1, and null is not zero', () => {
  it('is grid minus position', () => {
    expect(positionsGained(6, 2, true)).toBe(4);
    expect(positionsGained(2, 6, true)).toBe(-4);
  });

  it('is 0 only when the car finished exactly where it started', () => {
    expect(positionsGained(5, 5, true)).toBe(0);
  });

  /**
   * Three exclusions, one representation. A pit-lane start arrives here as a null
   * `gridPosition` (trap 9, `toGrid`), a retirement as `isClassified: false` — and
   * returning 0 for either would put a false measurement into the career mean.
   */
  it('is null — never 0 — when the driver did not finish or did not start from the grid', () => {
    expect(positionsGained(null, 2, true)).toBeNull();
    expect(positionsGained(6, null, true)).toBeNull();
    expect(positionsGained(null, null, true)).toBeNull();
  });

  /**
   * **Trap 27, and the regression this function shipped.** A retirement carries a real
   * `position` — the order the cars stopped, minimum 5 across the archive — so the shape
   * below is what the database actually hands over for a car that started 3rd and retired
   * 18th. The old two-argument form returned `-15` for it and put that in a career mean.
   */
  it('is null for an unclassified finish even though `position` is a real number', () => {
    expect(positionsGained(3, 18, false)).toBeNull();
  });
});

describe('pickQualifying — the highest segment reached is the overall result', () => {
  const rows = [
    { sessionType: 'Q1', position: 3 },
    { sessionType: 'Q2', position: 2 },
    { sessionType: 'Q3', position: 1 },
  ];

  /**
   * 2024 R1 verbatim: Verstappen is 3rd in Q1, 2nd in Q2 and takes pole in Q3. Reading Q1
   * for everybody would report the pole sitter third on the grid.
   */
  it('prefers Q3 over Q2 over Q1', () => {
    expect(pickQualifying(rows)).toEqual({ position: 1, session: 'Q3' });
    expect(pickQualifying(rows.slice(0, 2))).toEqual({ position: 2, session: 'Q2' });
    expect(pickQualifying(rows.slice(0, 1))).toEqual({ position: 3, session: 'Q1' });
  });

  it('reads the single-classification formats', () => {
    expect(pickQualifying([{ sessionType: 'QB', position: 7 }])).toEqual({
      position: 7,
      session: 'QB',
    });
    expect(pickQualifying([{ sessionType: 'QA', position: 4 }])).toEqual({
      position: 4,
      session: 'QA',
    });
  });

  it('is null when the weekend has no qualifying row for the driver', () => {
    expect(pickQualifying([])).toBeNull();
  });

  it('ignores a session type it does not know rather than guessing', () => {
    expect(pickQualifying([{ sessionType: 'SQ3', position: 1 }])).toBeNull();
  });
});

/**
 * The 1950 Italian Grand Prix, verbatim from the database: Ascari retired car 16 with an
 * engine failure and took over Serafini's car 48 to finish second.
 *
 * The rows arrive in the order `SQL_DRIVER_RACES` produces — classified first, ascending.
 */
const ASCARI_1950_R7: DriverRaceRow[] = [
  {
    year: 1950,
    round: 7,
    name: 'Italian Grand Prix',
    date: '1950-09-03',
    circuitRef: 'monza',
    circuitName: 'Autodromo Nazionale di Monza',
    teamRef: 'ferrari',
    teamName: 'Ferrari',
    carNumber: 48,
    position: 2,
    grid: 6,
    points: 3,
    status: 0,
    detail: 'Finished',
    isClassified: 1,
    lapsCompleted: 80,
    fastestLapRank: null,
    roundHasFastestLapData: 0,
    roundHasQualifying: 0,
  },
  {
    year: 1950,
    round: 7,
    name: 'Italian Grand Prix',
    date: '1950-09-03',
    circuitRef: 'monza',
    circuitName: 'Autodromo Nazionale di Monza',
    teamRef: 'ferrari',
    teamName: 'Ferrari',
    carNumber: 16,
    position: 17,
    grid: 2,
    points: 0,
    status: 11,
    detail: 'Engine',
    isClassified: 0,
    lapsCompleted: 21,
    fastestLapRank: null,
    roundHasFastestLapData: 0,
    roundHasQualifying: 0,
  },
];

describe('collapseRaces — trap 17, one race gives one result', () => {
  it('folds a shared drive into a single race whose result is the better car', () => {
    const races = collapseRaces(ASCARI_1950_R7, []);
    expect(races).toHaveLength(1);
    const race = races[0];
    expect(race?.entries).toBe(2);
    expect(race?.position).toBe(2);
    // NOT `mechanical`. Counting rows would give Ascari a retirement in a race he
    // finished second in — the whole reason this builder exists.
    expect(race?.outcome).toBe('finished');
    expect(race?.isClassified).toBe(true);
  });

  it('sums points across the entries, because both cars scored for the driver', () => {
    expect(collapseRaces(ASCARI_1950_R7, [])[0]?.points).toBe(3);
  });

  it('takes the grid from the car the driver was classified in', () => {
    const race = collapseRaces(ASCARI_1950_R7, [])[0];
    expect(race?.gridPosition).toBe(6);
    expect(race?.positionsGained).toBe(4);
  });

  it('keeps a fastest lap set on either entry', () => {
    const withFlag = ASCARI_1950_R7.map((row, index) =>
      index === 1 ? { ...row, fastestLapRank: 1 } : row,
    );
    expect(collapseRaces(withFlag, [])[0]?.hasFastestLap).toBe(true);
  });

  it('translates `grid = 0` to a pit-lane start with no position (trap 9)', () => {
    const row = { ...ASCARI_1950_R7[0], grid: 0 } as DriverRaceRow;
    const race = collapseRaces([row], [])[0];
    expect(race?.gridStatus).toBe('pitLane');
    expect(race?.gridPosition).toBeNull();
    expect(race?.positionsGained).toBeNull();
  });

  it('attaches the overall qualifying classification for that weekend only', () => {
    const qualifying: DriverQualifyingRow[] = [
      { year: 1950, round: 7, sessionType: 'Q1', position: 5 },
      { year: 1950, round: 7, sessionType: 'Q3', position: 2 },
      { year: 1950, round: 6, sessionType: 'Q3', position: 9 },
    ];
    const race = collapseRaces(ASCARI_1950_R7, qualifying)[0];
    expect(race?.qualifyingPosition).toBe(2);
    expect(race?.qualifyingSession).toBe('Q3');
  });
});

/**
 * A minimal, hand-built career: a win, a DNS, a retirement and a pit-lane start.
 *
 * ⚠ **The default row is a retirement with `position: 18`, not `position: null`** — trap 27.
 * It used to be null, which is a row shape `session_entry` has never held: the column is
 * non-NULL on all 26,093 race rows and carries the order the cars stopped on the 9,683
 * unclassified ones. That single fixture value is what let `positionsGained` ship
 * `grid - retirement order` with a green suite, so the fixture is now the shape the
 * database actually produces and the tests below are the ones that would have caught it.
 */
function race(overrides: Partial<DriverRaceRow> & { round: number }): DriverRaceRow {
  return {
    year: 2000,
    name: 'Test Grand Prix',
    date: '2000-01-01',
    circuitRef: 'test',
    circuitName: 'Test',
    teamRef: 'alpha',
    teamName: 'Alpha',
    carNumber: 1,
    position: 18,
    grid: 5,
    points: 0,
    status: 11,
    detail: 'Engine',
    isClassified: 0,
    lapsCompleted: 10,
    fastestLapRank: null,
    roundHasFastestLapData: 0,
    roundHasQualifying: 0,
    ...overrides,
  };
}

describe('buildTotals — DR-2', () => {
  const rows: DriverRaceRow[] = [
    race({ round: 1, position: 1, grid: 1, points: 10, status: 0, isClassified: 1 }),
    race({ round: 2, position: 3, grid: 4, points: 4, status: 0, isClassified: 1 }),
    /* A withdrawal and an accident, both carrying the position the database gives them —
     * 22nd and 19th are retirement order, not results (trap 27). */
    race({ round: 3, position: 22, status: 30, detail: 'Withdrew' }),
    race({ round: 4, position: 19, status: 10, detail: 'Accident' }),
    race({ round: 5, position: 12, grid: 0, status: 1, isClassified: 1, detail: '+2 Laps' }),
  ];
  const totals = buildTotals(collapseRaces(rows, []), rows.length, 1);

  /**
   * The resolved doc conflict, asserted. `REQUIREMENTS.md` §5.1 said a start was
   * "appearing in race results, regardless of classification"; `DATABASE.md` §3 says
   * `status IN (30, 40)` is excluded. §5.1 is corrected to match, and this is the test
   * that pins it.
   */
  it('excludes a did-not-start from `starts` but not from `races`', () => {
    expect(totals.races).toBe(5);
    expect(totals.starts).toBe(4);
    expect(totals.nonStarts).toBe(1);
  });

  it('counts wins, podiums and points finishes from the finishing position', () => {
    expect(totals.wins).toBe(1);
    expect(totals.podiums).toBe(2);
    expect(totals.pointsFinishes).toBe(2);
  });

  it('counts a retirement by `status`, never by a null position (traps 3 and 27)', () => {
    expect(totals.dnfs).toBe(1);
    expect(totals.accidentDnfs).toBe(1);
    expect(totals.mechanicalDnfs).toBe(0);
  });

  it('publishes the row count beside the race count so a shared drive is visible', () => {
    const shared = buildTotals(collapseRaces(ASCARI_1950_R7, []), ASCARI_1950_R7.length, 0);
    expect(shared.races).toBe(1);
    expect(shared.entries).toBe(2);
  });

  it('reports poles and their denominator together, because the window is holed', () => {
    const withQualifying = collapseRaces(rows, [
      { year: 2000, round: 1, sessionType: 'Q3', position: 1 },
      { year: 2000, round: 2, sessionType: 'Q3', position: 4 },
    ]);
    const counted = buildTotals(withQualifying, rows.length, 0);
    expect(counted.poles).toBe(1);
    expect(counted.racesWithQualifying).toBe(2);
  });
});

describe('buildGridVsFinish — DR-4, with its exclusions counted', () => {
  const races = collapseRaces(
    [
      race({ round: 1, position: 1, grid: 5, status: 0, isClassified: 1 }),
      race({ round: 2, position: 8, grid: 3, status: 1, isClassified: 1 }),
      race({ round: 3, position: 6, grid: 6, status: 0, isClassified: 1 }),
      /*
       * The trap 27 row. It started 4th and stopped 14th, and `14` is not a result — it is
       * where this car came to rest in the retirement order. The two-argument
       * `positionsGained` scored it `-10` and dropped it into the career mean; the test
       * below now asserts it is excluded and *counted* as excluded instead.
       */
      race({ round: 4, position: 14, grid: 4, status: 11, isClassified: 0 }),
      race({ round: 5, position: 9, grid: 0, status: 0, isClassified: 1 }),
      race({ round: 6, position: 7, grid: null, status: 0, isClassified: 1 }),
    ],
    [],
  );
  const summary = buildGridVsFinish(races);

  it('counts only the races the metric applies to', () => {
    expect(summary.racesCounted).toBe(3);
    expect(summary.gained).toBe(1);
    expect(summary.lost).toBe(1);
    expect(summary.held).toBe(1);
    expect(summary.meanPositionsGained).toBeCloseTo((4 + -5 + 0) / 3, 10);
  });

  /**
   * The property that makes the exclusion counts readable as a caption rather than as
   * diagnostics: counted plus excluded is every race, with nothing double-counted.
   */
  it('partitions the career — counted plus excluded equals the races', () => {
    const excluded =
      summary.excluded.unclassified + summary.excluded.pitLaneStarts + summary.excluded.unknownGrid;
    expect(summary.racesCounted + excluded).toBe(races.length);
    expect(summary.excluded).toEqual({ unclassified: 1, pitLaneStarts: 1, unknownGrid: 1 });
  });

  it('reports the extremes as signed place counts', () => {
    expect(summary.bestGain).toBe(4);
    expect(summary.worstLoss).toBe(-5);
  });

  /**
   * **The regression test for the defect this metric shipped** (trap 27). Every row here is
   * a retirement carrying a real `position`, which is the only shape the database produces
   * for one. The old implementation measured all three and reported a mean of −7; the
   * honest answer is that there is nothing to measure and that three races are the reason.
   */
  it('measures nothing at all from a career of retirements, and says how many', () => {
    const retirements = buildGridVsFinish(
      collapseRaces(
        [
          race({ round: 1, position: 12, grid: 2, status: 11, isClassified: 0 }),
          race({ round: 2, position: 18, grid: 9, status: 10, isClassified: 0 }),
          race({ round: 3, position: 15, grid: 7, status: 11, isClassified: 0 }),
        ],
        [],
      ),
    );
    expect(retirements.racesCounted).toBe(0);
    expect(retirements.meanPositionsGained).toBeNull();
    expect(retirements.excluded.unclassified).toBe(3);
    expect(retirements.gained + retirements.lost + retirements.held).toBe(0);
  });

  it('is null rather than 0 for a career with nothing to measure', () => {
    const empty = buildGridVsFinish([]);
    expect(empty.meanPositionsGained).toBeNull();
    expect(empty.bestGain).toBeNull();
    expect(empty.worstLoss).toBeNull();
  });

  /** `gained + lost + held === racesCounted` is the invariant the surface captions with. */
  it('splits the counted races by sign with nothing left over', () => {
    expect(summary.gained + summary.lost + summary.held).toBe(summary.racesCounted);
  });
});

describe('buildQualifyingVsRace — DR-5', () => {
  const races = collapseRaces(
    [
      race({ round: 1, position: 1, grid: 1, status: 0, isClassified: 1 }),
      race({ round: 2, position: 5, grid: 3, status: 0, isClassified: 1 }),
      /* Qualified 4th, retired 16th — trap 27, so the delta is excluded, not −12. */
      race({ round: 3, position: 16, status: 11, isClassified: 0 }),
    ],
    [
      { year: 2000, round: 1, sessionType: 'Q3', position: 3 },
      { year: 2000, round: 2, sessionType: 'Q3', position: 2 },
      { year: 2000, round: 3, sessionType: 'Q3', position: 4 },
    ],
  );
  const summary = buildQualifyingVsRace(races);

  it('measures only races with both a qualifying position and a classified finish', () => {
    expect(summary.racesCounted).toBe(2);
    expect(summary.meanDelta).toBeCloseTo((3 - 1 + (2 - 5)) / 2, 10);
  });

  it('counts the qualifying sample separately from the delta sample', () => {
    expect(summary.racesWithQualifying).toBe(3);
    expect(summary.meanQualifyingPosition).toBeCloseTo(3, 10);
  });

  it('is null for a driver whose era holds no qualifying classification', () => {
    const none = buildQualifyingVsRace(collapseRaces(ASCARI_1950_R7, []));
    expect(none.racesWithQualifying).toBe(0);
    expect(none.meanDelta).toBeNull();
    expect(none.meanQualifyingPosition).toBeNull();
  });
});

describe('buildSeasons — DR-3, and the mid-season team change', () => {
  const races = collapseRaces(
    [
      race({
        year: 2001,
        round: 1,
        teamRef: 'alpha',
        teamName: 'Alpha',
        position: 4,
        status: 0,
        isClassified: 1,
      }),
      race({
        year: 2001,
        round: 2,
        teamRef: 'alpha',
        teamName: 'Alpha',
        position: 6,
        status: 0,
        isClassified: 1,
      }),
      race({
        year: 2001,
        round: 3,
        teamRef: 'beta',
        teamName: 'Beta',
        position: 1,
        status: 0,
        isClassified: 1,
      }),
      race({
        year: 2002,
        round: 1,
        teamRef: 'beta',
        teamName: 'Beta',
        position: 2,
        status: 0,
        isClassified: 1,
      }),
    ],
    [],
  );
  const championships: DriverChampionshipRow[] = [
    { year: 2001, points: 30, position: 4, wins: 1, bestFinish: 1, adjustmentType: null },
    { year: 2002, points: 90, position: 1, wins: 6, bestFinish: 1, adjustmentType: null },
  ];

  /**
   * 318 driver-seasons in this data map one driver to more than one team. A single `team`
   * field would have to pick one, and picking the last quietly rewrites the season.
   */
  it('lists every team of a season, earliest span first', () => {
    const seasons = buildSeasons(
      races,
      championships,
      new Map([
        [2001, true],
        [2002, true],
      ]),
    );
    expect(seasons[0]?.teams.map((team) => team.ref)).toEqual(['alpha', 'beta']);
    expect(seasons[0]?.teams[0]).toMatchObject({ firstRound: 1, lastRound: 2, entries: 2 });
    expect(seasons[0]?.teams[1]).toMatchObject({ firstRound: 3, lastRound: 3, entries: 1 });
  });

  it('reads points and position from the snapshot rather than summing race points', () => {
    const seasons = buildSeasons(
      races,
      championships,
      new Map([
        [2001, true],
        [2002, true],
      ]),
    );
    expect(seasons[0]?.points).toBe(30);
    expect(seasons[0]?.position).toBe(4);
  });

  /**
   * The gate that is live rather than defensive. This dataset's 2026 snapshot ranks a
   * leader first with 12 of 22 rounds unrun; without the completeness test that leader
   * would hold a championship on the profile page.
   */
  it('awards a title only when the season is complete', () => {
    const complete = buildSeasons(
      races,
      championships,
      new Map([
        [2001, true],
        [2002, true],
      ]),
    );
    expect(complete[1]?.isChampion).toBe(true);

    const inProgress = buildSeasons(
      races,
      championships,
      new Map([
        [2001, true],
        [2002, false],
      ]),
    );
    expect(inProgress[1]?.position).toBe(1);
    expect(inProgress[1]?.isChampion).toBe(false);
    expect(inProgress[1]?.isSeasonComplete).toBe(false);
  });

  it('treats an unknown season as incomplete rather than crowning it', () => {
    const seasons = buildSeasons(races, championships, new Map());
    expect(seasons.every((season) => !season.isChampion)).toBe(true);
  });

  it('leaves points null when the season holds no snapshot for the driver', () => {
    const seasons = buildSeasons(races, [], new Map([[2001, true]]));
    expect(seasons[0]?.points).toBeNull();
    expect(seasons[0]?.position).toBeNull();
    expect(seasons[0]?.championshipWins).toBeNull();
  });
});

/* ==================================================================================
 * Against the live database. Skipped where `data/f1.db` is absent — CI never has it.
 * ================================================================================== */

const hasDatabase = existsSync(DB_PATH);

describe.skipIf(!hasDatabase)('driver queries against the live database', () => {
  afterAll(() => {
    __resetDb();
    invalidateMemo();
  });

  it('answers 404-shaped for a well-formed reference the data does not hold', () => {
    expect(driverExists('not_a_driver')).toBe(false);
    expect(readDriver('not_a_driver')).toBeNull();
  });

  /**
   * Three driver references carry an uppercase letter. They are reachable, and a
   * lowercase-only route pattern would 404 them — see `schemas/entity.ts`.
   */
  it.each(['scott_Brown', 'Changy', 'Cannoc'])('reaches the uppercase reference %s', (ref) => {
    expect(driverExists(ref)).toBe(true);
    expect(readDriver(ref)?.driver.ref).toBe(ref);
  });

  /**
   * The figures the whole module is verified against. Every one is the historical record,
   * checked against it rather than against the code's own output.
   */
  it.each([
    ['fangio', { races: 51, starts: 51, wins: 24, podiums: 35, championships: 5 }],
    ['senna', { races: 161, starts: 161, wins: 41, podiums: 80, championships: 3 }],
    ['clark', { races: 72, starts: 72, wins: 25, podiums: 32, championships: 2 }],
    ['ascari', { races: 32, starts: 32, wins: 13, podiums: 17, championships: 2 }],
    ['michael_schumacher', { races: 308, starts: 307, wins: 91, podiums: 155, championships: 7 }],
    ['hamilton', { races: 390, starts: 390, wins: 106, podiums: 207, championships: 7 }],
    ['max_verstappen', { races: 243, starts: 243, wins: 71, podiums: 130, championships: 4 }],
  ])('%s matches the record', (ref, expected) => {
    const totals = readDriver(ref)?.totals;
    expect(totals).toMatchObject(expected);
  });

  it('reproduces 1950 R7 as one race with two entries — the trap-17 case, live', () => {
    const race = readDriver('ascari')?.races.find((row) => row.year === 1950 && row.round === 7);
    expect(race).toMatchObject({
      entries: 2,
      position: 2,
      outcome: 'finished',
      points: 3,
      gridPosition: 6,
      positionsGained: 4,
    });
  });

  /**
   * The invariant behind every count in `buildTotals`. If a refresh ever made `starts`
   * exceed `races`, a row would be being counted as a race somewhere.
   */
  it.each(['ascari', 'clark', 'fangio', 'alonso', 'michael_schumacher'])(
    '%s: entries >= races >= starts',
    (ref) => {
      const totals = readDriver(ref)?.totals;
      expect(totals?.entries).toBeGreaterThanOrEqual(totals?.races ?? 0);
      expect(totals?.races).toBeGreaterThanOrEqual(totals?.starts ?? 0);
      expect((totals?.starts ?? 0) + (totals?.nonStarts ?? 0)).toBe(totals?.races);
    },
  );

  /**
   * ================================================================== trap 27, at the source
   *
   * The fact the whole defect rests on, asserted against the archive rather than assumed:
   * **`session_entry.position` is never NULL on a race row**, so every `position === null`
   * guard in this module was dead code, and the value on an unclassified row is a
   * retirement order whose minimum is 5 — low enough to be plausible, high enough that a
   * `<= 3` podium test can never see it.
   *
   * If a refresh ever introduces a NULL, or an unclassified row inside the top three, this
   * fails and the guards above have to be revisited together.
   */
  it('holds no race row with a null position, and none unclassified inside the top three', () => {
    const db = getDb();
    const counts = db
      .prepare(
        `SELECT sum(se.position IS NULL) AS nulls,
                sum(se.is_classified = 0 AND se.position <= 3) AS unclassifiedPodiums,
                min(CASE WHEN se.is_classified = 0 THEN se.position END) AS lowestRetirement
         FROM session_entry se
         JOIN session ses ON ses.id = se.session_id AND ses.type = 'R'
         JOIN round r ON r.id = ses.round_id AND r.number IS NOT NULL`,
      )
      .get() as { nulls: number; unclassifiedPodiums: number; lowestRetirement: number };
    expect(counts.nulls).toBe(0);
    expect(counts.unclassifiedPodiums).toBe(0);
    expect(counts.lowestRetirement).toBe(5);
  });

  /**
   * The corrected DR-4 figures, against the historical record.
   *
   * Every one of these was wrong before 2026-08-23 — Verstappen read **−0.62** and Senna
   * **−4.99**, because the mean included `grid - retirement order` for every race that
   * ended early. `racesCounted + unclassified` is the driver's whole race count on all four,
   * which is the partition the caption depends on.
   */
  it.each([
    ['max_verstappen', { racesCounted: 210, unclassified: 33, mean: 1.2238, races: 243 }],
    ['hamilton', { racesCounted: 358, unclassified: 32, mean: 0.7626, races: 390 }],
    ['senna', { racesCounted: 108, unclassified: 53, mean: -0.2963, races: 161 }],
    ['fangio', { racesCounted: 41, unclassified: 10, mean: 0.4878, races: 51 }],
  ])('%s gains places over classified finishes only', (ref, expected) => {
    const driver = readDriver(ref);
    const summary = driver?.gridVsFinish;
    expect(summary?.racesCounted).toBe(expected.racesCounted);
    expect(summary?.excluded.unclassified).toBe(expected.unclassified);
    expect(summary?.meanPositionsGained).toBeCloseTo(expected.mean, 4);
    expect(
      (summary?.racesCounted ?? 0) +
        (summary?.excluded.unclassified ?? 0) +
        (summary?.excluded.pitLaneStarts ?? 0) +
        (summary?.excluded.unknownGrid ?? 0),
    ).toBe(expected.races);
    expect((summary?.gained ?? 0) + (summary?.lost ?? 0) + (summary?.held ?? 0)).toBe(
      expected.racesCounted,
    );
  });

  /**
   * A retirement reaches the per-race row as `positionsGained: null` **while carrying a
   * finishing position**, which is the shape that made the defect invisible. Verstappen's
   * 2015 R6 is the case in one row: started 9th, out on lap 63 in the barrier at Sainte
   * Dévote, `position` 18 — and the old code published "9 places lost" for it.
   */
  it('publishes no place change for a race that ended in the barrier', () => {
    const race = readDriver('max_verstappen')?.races.find(
      (row) => row.year === 2015 && row.round === 6,
    );
    expect(race?.isClassified).toBe(false);
    expect(race?.gridPosition).toBe(9);
    expect(race?.position).toBe(18);
    expect(race?.positionsGained).toBeNull();
  });

  /**
   * `bestFinish` is a **finish**, not the lowest number in the season's `position` column.
   * Button entered one race in 2017, at Monaco, and was not classified in it; the season row
   * read "P18" until this was corrected. 648 driver-seasons in the archive have the shape.
   */
  it('reports no best finish for a season the driver was never classified in', () => {
    const season = readDriver('button')?.seasons.find((row) => row.year === 2017);
    expect(season?.starts).toBe(1);
    expect(season?.bestFinish).toBeNull();
  });

  /**
   * The measured coverage hole, asserted so it cannot be forgotten by whoever renders
   * `poles`. Senna raced 161 times and this dataset holds a qualifying classification for
   * three of them.
   */
  it('states the qualifying denominator honestly for a pre-1994 career', () => {
    const totals = readDriver('senna')?.totals;
    expect(totals?.racesWithQualifying).toBe(3);
    expect(totals?.poles).toBeLessThanOrEqual(totals?.racesWithQualifying ?? 0);
  });

  /** The 1960–2003 hole in `fastest_lap_rank`, stated the same way. */
  it('states the fastest-lap denominator honestly for a 1960s career', () => {
    const totals = readDriver('clark')?.totals;
    expect(totals?.racesWithFastestLapData).toBe(0);
    expect(totals?.fastestLaps).toBe(0);
  });

  /**
   * The completeness gate, against the live in-progress season rather than a fixture.
   * Whoever leads 2026 after round 10 of 22 must not hold a championship.
   */
  it('does not crown the leader of the season in progress', () => {
    const leaders = getDb()
      .prepare(
        `WITH last_snapshot AS (
           SELECT year, max(round_number * 1000 + session_number) AS k
           FROM driver_championship GROUP BY year)
         SELECT d.reference AS ref, dc.year AS year
         FROM driver_championship dc
         JOIN last_snapshot ls ON ls.year = dc.year
           AND (dc.round_number * 1000 + dc.session_number) = ls.k
         JOIN driver d ON d.id = dc.driver_id
         WHERE dc.position = 1 AND dc.year = (SELECT max(year) FROM driver_championship)`,
      )
      .all() as { ref: string; year: number }[];
    expect(leaders.length).toBeGreaterThan(0);
    for (const leader of leaders) {
      const season = readDriver(leader.ref)?.seasons.find((row) => row.year === leader.year);
      expect(season?.position).toBe(1);
      // The season is in progress, so the standing is real and the title is not.
      if (season?.isSeasonComplete === false) expect(season.isChampion).toBe(false);
    }
  });

  it('produces a payload that passes its own schema for a spread of eras', () => {
    for (const ref of ['fangio', 'clark', 'senna', 'hamilton', 'alonso', 'scott_Brown']) {
      const parsed = driverSchema.safeParse(readDriver(ref));
      expect(parsed.success, `${ref}: ${JSON.stringify(parsed.error?.issues.slice(0, 3))}`).toBe(
        true,
      );
    }
  });

  it('orders races ascending and seasons ascending', () => {
    const driver = readDriver('alonso');
    const keys = (driver?.races ?? []).map((row) => row.year * 1000 + row.round);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
    const years = (driver?.seasons ?? []).map((row) => row.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  /**
   * S-10, asserted rather than asserted-about. **No statement may scan `session_entry` or
   * `lap`**: the driver-anchored CTE exists precisely so the planner enters through
   * `idx_driver_ref`, and a plan that lost that would still return correct data — which is
   * why it needs a test rather than a reading.
   */
  it.each([
    ['SQL_DRIVER_RACES', SQL_DRIVER_RACES],
    ['SQL_DRIVER_QUALIFYING', SQL_DRIVER_QUALIFYING],
  ])('%s plans through the driver index and scans nothing', (_name, sql) => {
    const plan = getDb().prepare(`EXPLAIN QUERY PLAN ${sql}`).all({ ref: 'alonso' }) as {
      detail: string;
    }[];
    const details = plan.map((step) => step.detail);
    expect(
      details.some((detail) => /SEARCH d USING (COVERING )?INDEX idx_driver_ref/.test(detail)),
    ).toBe(true);
    expect(details.filter((detail) => /^SCAN /.test(detail))).toEqual([]);
    expect(details.filter((detail) => /\blap\b/.test(detail))).toEqual([]);
  });

  /**
   * The one statement that reads a whole table, and the reason that is acceptable: the
   * scan is of `driver_championship`, it is fixed at 36,091 rows, and **no parameter can
   * widen it**. Stated as a test so a future edit that made it parameter-dependent fails.
   */
  it('SQL_DRIVER_CHAMPIONSHIPS scans only driver_championship, and only to group it', () => {
    const plan = getDb()
      .prepare(`EXPLAIN QUERY PLAN ${SQL_DRIVER_CHAMPIONSHIPS}`)
      .all({ ref: 'alonso' }) as { detail: string }[];
    const scans = plan.map((step) => step.detail).filter((detail) => /^SCAN /.test(detail));
    expect(scans.every((detail) => detail.includes('driver_championship'))).toBe(true);
  });

  it('no lap or pit_stop access exists anywhere in this module', () => {
    for (const sql of [SQL_DRIVER_RACES, SQL_DRIVER_QUALIFYING, SQL_DRIVER_CHAMPIONSHIPS]) {
      expect(/\blap\b|\bpit_stop\b/.test(sql)).toBe(false);
    }
  });
});
