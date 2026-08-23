import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { invalidateMemo } from '../cache/memo';
import { DB_PATH } from '../config';
import { __resetDb } from '../db';
import { compareDataSchema } from '../schemas/compare';
import type { ChampionshipRow, CompareRaceRow, SameTeamRow } from './compare';
import {
  SQL_COMPARE_CHAMPIONSHIPS,
  SQL_COMPARE_IDENTITIES,
  SQL_COMPARE_RACES,
  SQL_COMPARE_SAME_TEAM,
  SQL_COMPARE_TEAMMATE_TOTALS,
  buildArchive,
  buildCareerTotals,
  buildChainLinks,
  buildEntitySeasons,
  buildPairLedgers,
  collapseRaces,
  countTitles,
  groupSameTeam,
  pairKey,
  pickColorTeam,
  readCompare,
  relationFor,
  yearsApart,
} from './compare';
import { readDriver } from './drivers';

/**
 * The career lens.
 *
 * Everything above the live-database block runs in CI, where `data/f1.db` never exists. That is
 * where the rules live: the head-to-head definition, the collapse that trap 17 requires, and the
 * completeness gate that trap 25 requires are all pure functions here, driven by six-row fixtures
 * that state the case in the test rather than hiding it in an archive.
 */

const hasDatabase = existsSync(DB_PATH);

const raceRow = (overrides: Partial<CompareRaceRow> = {}): CompareRaceRow => ({
  driverRef: 'a',
  sessionId: 1,
  year: 2020,
  round: 1,
  teamRef: 'red',
  teamName: 'Red',
  position: 5,
  grid: 5,
  status: 0,
  isClassified: 1,
  ...overrides,
});

function racesOf(rows: readonly CompareRaceRow[], ref: string) {
  return collapseRaces(rows).get(ref) ?? [];
}

describe('collapseRaces — trap 17, one entry per driver per race', () => {
  it('folds two classification rows of one race into one race', () => {
    const races = racesOf(
      [
        raceRow({ position: 3, grid: 4 }),
        raceRow({ position: 9, grid: 11, isClassified: 0, status: 11 }),
      ],
      'a',
    );
    expect(races).toHaveLength(1);
    expect(races[0]?.position).toBe(3);
    expect(races[0]?.classifiedPosition).toBe(3);
    expect(races[0]?.gridPosition).toBe(4);
  });

  it('takes the best classified finish, not the best position, when only the later row counted', () => {
    /* The outcome row is the better *position*; the classified one is behind it. A head-to-head
     * may only use the classified figure — 9,683 race rows carry a position while unclassified,
     * where it records a retirement order (trap 3). */
    const races = racesOf(
      [
        raceRow({ position: 2, isClassified: 0, status: 11, grid: 0 }),
        raceRow({ position: 8, isClassified: 1, status: 1, grid: 6 }),
      ],
      'a',
    );
    expect(races[0]?.position).toBe(2);
    expect(races[0]?.isClassified).toBe(false);
    expect(races[0]?.classifiedPosition).toBe(8);
  });

  it('reports no classified position when the driver was never classified', () => {
    const races = racesOf([raceRow({ isClassified: 0, status: 10 })], 'a');
    expect(races[0]?.classifiedPosition).toBeNull();
  });

  it('excludes a pit-lane start from the grid slot (trap 9)', () => {
    expect(racesOf([raceRow({ grid: 0 })], 'a')[0]?.gridPosition).toBeNull();
    expect(racesOf([raceRow({ grid: null })], 'a')[0]?.gridPosition).toBeNull();
  });

  it('keeps every team of a race the driver was entered by twice', () => {
    const races = racesOf(
      [raceRow({ position: 4 }), raceRow({ position: 6, teamRef: 'blue', teamName: 'Blue' })],
      'a',
    );
    expect(races[0]?.teamRefs).toEqual(['red', 'blue']);
    expect(races[0]?.teamRef).toBe('red');
  });

  it('separates two drivers in the same rows', () => {
    const byDriver = collapseRaces([raceRow(), raceRow({ driverRef: 'b' })]);
    expect([...byDriver.keys()]).toEqual(['a', 'b']);
  });
});

describe('buildCareerTotals', () => {
  it('counts races, not classification rows', () => {
    const totals = buildCareerTotals(racesOf([raceRow(), raceRow({ position: 12 })], 'a'));
    expect(totals.races).toBe(1);
  });

  it('excludes did-not-start and did-not-qualify from starts (DATABASE.md §3)', () => {
    const races = racesOf(
      [
        raceRow({ sessionId: 1, status: 0 }),
        raceRow({ sessionId: 2, status: 30, isClassified: 0 }),
        raceRow({ sessionId: 3, status: 40, isClassified: 0 }),
      ],
      'a',
    );
    const totals = buildCareerTotals(races);
    expect(totals.races).toBe(3);
    expect(totals.starts).toBe(1);
  });

  it('counts only accident and mechanical as a DNF, never a disqualification', () => {
    const races = racesOf(
      [
        raceRow({ sessionId: 1, status: 10, isClassified: 0 }),
        raceRow({ sessionId: 2, status: 11, isClassified: 0 }),
        raceRow({ sessionId: 3, status: 20, isClassified: 0 }),
      ],
      'a',
    );
    expect(buildCareerTotals(races).dnfs).toBe(2);
  });

  it('counts a classified finish from the outcome row, not from any row', () => {
    const races = racesOf(
      [
        raceRow({ sessionId: 1, position: 1, isClassified: 1 }),
        raceRow({ sessionId: 2, position: 2, isClassified: 0, status: 11 }),
      ],
      'a',
    );
    const totals = buildCareerTotals(races);
    expect(totals.classifiedFinishes).toBe(1);
    expect(totals.wins).toBe(1);
    expect(totals.podiums).toBe(2);
  });
});

describe('pickColorTeam', () => {
  it('takes the team with the most starts', () => {
    const races = racesOf(
      [
        raceRow({ sessionId: 1, teamRef: 'red' }),
        raceRow({ sessionId: 2, teamRef: 'red' }),
        raceRow({ sessionId: 3, teamRef: 'blue' }),
      ],
      'a',
    );
    expect(pickColorTeam(races)).toBe('red');
  });

  it('breaks a tie towards the most recent, never alphabetically', () => {
    const races = racesOf(
      [
        raceRow({ sessionId: 1, year: 2018, teamRef: 'zulu' }),
        raceRow({ sessionId: 2, year: 2020, teamRef: 'alpha' }),
      ],
      'a',
    );
    expect(pickColorTeam(races)).toBe('alpha');
  });

  it('falls back to the first race for a career of nothing but non-starts', () => {
    const races = racesOf([raceRow({ status: 30, isClassified: 0, teamRef: 'ghost' })], 'a');
    expect(pickColorTeam(races)).toBe('ghost');
  });
});

describe('buildEntitySeasons', () => {
  const complete = new Map([
    [2020, true],
    [2026, false],
  ]);
  const championships: ChampionshipRow[] = [
    { ref: 'a', year: 2020, position: 1 },
    { ref: 'a', year: 2026, position: 1 },
  ];

  it('names every team of a split season in the order the driver raced for them', () => {
    const races = racesOf(
      [
        raceRow({ sessionId: 1, round: 1, teamRef: 'first' }),
        raceRow({ sessionId: 2, round: 2, teamRef: 'second' }),
      ],
      'a',
    );
    expect(buildEntitySeasons(races, [], complete)[0]?.teamRefs).toEqual(['first', 'second']);
  });

  /** Trap 25, one level down: a live standing is not a final placing. */
  it('marks a placing final only when its season is finished', () => {
    const races = racesOf(
      [raceRow({ sessionId: 1, year: 2020 }), raceRow({ sessionId: 2, year: 2026 })],
      'a',
    );
    const seasons = buildEntitySeasons(races, championships, complete);
    expect(
      seasons.map((s) => [s.year, s.championshipPosition, s.championshipPositionIsFinal]),
    ).toEqual([
      [2020, 1, true],
      [2026, 1, false],
    ]);
  });

  it('treats a year missing from the completeness map as unfinished', () => {
    const races = racesOf([raceRow({ year: 1999 })], 'a');
    expect(buildEntitySeasons(races, [], complete)[0]?.championshipPositionIsFinal).toBe(false);
  });

  it('sorts ascending whatever order the races arrived in', () => {
    const races = racesOf(
      [raceRow({ sessionId: 1, year: 2026 }), raceRow({ sessionId: 2, year: 2020 })],
      'a',
    );
    expect(buildEntitySeasons(races, [], complete).map((s) => s.year)).toEqual([2020, 2026]);
  });
});

describe('countTitles — trap 25, both filters', () => {
  const complete = new Map([
    [2020, true],
    [2026, false],
  ]);

  it('counts a first place in a finished season', () => {
    expect(countTitles([{ ref: 'a', year: 2020, position: 1 }], complete)).toBe(1);
  });

  it('refuses one in a season still being run', () => {
    expect(countTitles([{ ref: 'a', year: 2026, position: 1 }], complete)).toBe(0);
  });

  it('refuses one in a season the map does not know about', () => {
    expect(countTitles([{ ref: 'a', year: 1899, position: 1 }], complete)).toBe(0);
  });

  it('ignores a null placing', () => {
    expect(countTitles([{ ref: 'a', year: 2020, position: null }], complete)).toBe(0);
  });
});

describe('buildPairLedgers', () => {
  const pair = (rows: readonly CompareRaceRow[]) => {
    const byDriver = collapseRaces(rows);
    return buildPairLedgers(byDriver.get('a') ?? [], byDriver.get('b') ?? []);
  };

  it('counts only races both entered', () => {
    const ledgers = pair([
      raceRow({ driverRef: 'a', sessionId: 1 }),
      raceRow({ driverRef: 'a', sessionId: 2 }),
      raceRow({ driverRef: 'b', sessionId: 2 }),
    ]);
    expect(ledgers.pool).toBe(1);
    expect(ledgers.race.pool).toBe(1);
  });

  it('rates a race only when both were classified', () => {
    const ledgers = pair([
      raceRow({ driverRef: 'a', sessionId: 1, position: 3 }),
      raceRow({ driverRef: 'b', sessionId: 1, position: 9, isClassified: 0, status: 11 }),
    ]);
    expect(ledgers.race).toEqual({ rated: 0, pool: 1, a: 0, b: 0, tied: 0 });
    expect(ledgers.grid.rated).toBe(1);
  });

  /**
   * A shared drive is a tie, on the race ledger. 85 same-team pairings in the archive have both
   * drivers classified in the same position — 1951 R4 put Fangio and Fagioli both on P1 — and
   * awarding it to whichever row sorted first would be an invention.
   */
  it('records a dead heat as a tie rather than a win', () => {
    const ledgers = pair([
      raceRow({ driverRef: 'a', sessionId: 1, position: 1, grid: 2 }),
      raceRow({ driverRef: 'b', sessionId: 1, position: 1, grid: 2 }),
    ]);
    expect(ledgers.race).toEqual({ rated: 1, pool: 1, a: 0, b: 0, tied: 1 });
    expect(ledgers.grid).toEqual({ rated: 1, pool: 1, a: 0, b: 0, tied: 1 });
  });

  it('keeps a + b + tied equal to rated on both ledgers', () => {
    const ledgers = pair([
      raceRow({ driverRef: 'a', sessionId: 1, position: 1, grid: 1 }),
      raceRow({ driverRef: 'b', sessionId: 1, position: 2, grid: 3 }),
      raceRow({ driverRef: 'a', sessionId: 2, position: 4, grid: 4 }),
      raceRow({ driverRef: 'b', sessionId: 2, position: 4, grid: 4 }),
    ]);
    expect(ledgers.race.a + ledgers.race.b + ledgers.race.tied).toBe(ledgers.race.rated);
    expect(ledgers.grid.a + ledgers.grid.b + ledgers.grid.tied).toBe(ledgers.grid.rated);
  });

  it('orients to the first argument', () => {
    const rows = [
      raceRow({ driverRef: 'a', sessionId: 1, position: 1 }),
      raceRow({ driverRef: 'b', sessionId: 1, position: 2 }),
    ];
    const byDriver = collapseRaces(rows);
    const forward = buildPairLedgers(byDriver.get('a') ?? [], byDriver.get('b') ?? []);
    const backward = buildPairLedgers(byDriver.get('b') ?? [], byDriver.get('a') ?? []);
    expect(forward.race.a).toBe(backward.race.b);
    expect(forward.race.b).toBe(backward.race.a);
  });

  it('lists the shared seasons, sorted and unique', () => {
    const ledgers = pair([
      raceRow({ driverRef: 'a', sessionId: 1, year: 2021 }),
      raceRow({ driverRef: 'b', sessionId: 1, year: 2021 }),
      raceRow({ driverRef: 'a', sessionId: 2, year: 2020 }),
      raceRow({ driverRef: 'b', sessionId: 2, year: 2020 }),
    ]);
    expect(ledgers.sharedSeasons).toEqual([2020, 2021]);
  });
});

describe('relationFor and yearsApart', () => {
  it('calls a shared car a teammate pairing', () => {
    expect(relationFor(3, 1)).toBe('teammate');
  });

  /**
   * **A shared season with no shared race is `contemporary`, not `disjoint`.** Senna entered
   * rounds 1–3 of 1994 and Coulthard debuted at round 5, both for Williams. `disjoint`'s own
   * sentence claims the two share no points system, and in 1994 they do.
   */
  it('calls a shared season with no shared race contemporary', () => {
    expect(relationFor(0, 1)).toBe('contemporary');
  });

  it('calls two careers that never met disjoint', () => {
    expect(relationFor(0, 0)).toBe('disjoint');
  });

  it('reports no gap between two careers that overlap', () => {
    expect(
      yearsApart({ firstSeason: 2007, lastSeason: 2026 }, { firstSeason: 2015, lastSeason: 2026 }),
    ).toBe(0);
  });

  it('measures the gap in whole years, whichever way round the pair arrives', () => {
    const modern = { firstSeason: 2007, lastSeason: 2026 };
    const ancient = { firstSeason: 1950, lastSeason: 1958 };
    expect(yearsApart(modern, ancient)).toBe(49);
    expect(yearsApart(ancient, modern)).toBe(49);
  });
});

describe('buildChainLinks', () => {
  const sameTeamRow = (overrides: Partial<SameTeamRow> = {}): SameTeamRow => ({
    a: 'alpha',
    b: 'bravo',
    year: 2020,
    teamRef: 'red',
    teamName: 'Red',
    pool: 10,
    raceRated: 8,
    raceA: 5,
    raceB: 3,
    raceTied: 0,
    gridRated: 10,
    gridA: 6,
    gridB: 4,
    gridTied: 0,
    ...overrides,
  });

  it('orients a link to its own direction of travel', () => {
    const byPair = groupSameTeam([sameTeamRow()]);
    const forward = buildChainLinks(['alpha', 'bravo'], byPair);
    const backward = buildChainLinks(['bravo', 'alpha'], byPair);
    expect(forward?.[0]?.race).toEqual({ rated: 8, pool: 10, a: 5, b: 3, tied: 0 });
    expect(backward?.[0]?.race).toEqual({ rated: 8, pool: 10, a: 3, b: 5, tied: 0 });
  });

  it('sums a multi-season pairing and spans its years', () => {
    const byPair = groupSameTeam([
      sameTeamRow({ year: 2019 }),
      sameTeamRow({ year: 2021, teamRef: 'blue', teamName: 'Blue' }),
    ]);
    const links = buildChainLinks(['alpha', 'bravo'], byPair);
    expect(links?.[0]?.firstYear).toBe(2019);
    expect(links?.[0]?.lastYear).toBe(2021);
    expect(links?.[0]?.race.pool).toBe(20);
    expect(links?.[0]?.teams.map((t) => t.teamRef)).toEqual(['red', 'blue']);
  });

  it('refuses the whole chain when a link has no measured pairing behind it', () => {
    expect(buildChainLinks(['alpha', 'charlie'], groupSameTeam([sameTeamRow()]))).toBeNull();
  });

  it('keys a pair by reference order, whichever way it is asked', () => {
    expect(pairKey('zulu', 'alpha')).toBe(pairKey('alpha', 'zulu'));
  });
});

/* ================================================================================================
 * Against the live database.
 * ============================================================================================== */

describe.skipIf(!hasDatabase)('the career lens against the live database', () => {
  afterAll(() => {
    invalidateMemo();
    __resetDb();
  });

  const REFS = ['hamilton', 'rosberg', 'max_verstappen', 'fangio'];

  it('answers null for a slug no driver holds', () => {
    expect(readCompare(['not_a_driver'])).toBeNull();
  });

  /** One of the 63 drivers in the dataset who never started a Grand Prix. */
  it('answers null for a driver with no race in the archive', () => {
    expect(readCompare(['ecclestone'])).toBeNull();
  });

  it('produces a payload that satisfies its own schema', () => {
    const parsed = compareDataSchema.safeParse(readCompare(REFS));
    expect(parsed.success).toBe(true);
  });

  /**
   * **The agreement that matters most.** If these two endpoints disagree, one page says Hamilton
   * won 106 races and another says 105, and nothing in the build would notice.
   */
  it.each(['hamilton', 'fangio', 'michael_schumacher', 'senna'])(
    'agrees with the driver profile on %s',
    (ref) => {
      const data = readCompare([ref]);
      const profile = readDriver(ref);
      const entity = data?.entities[0];
      expect(entity).toBeDefined();
      expect(profile).not.toBeNull();
      expect(entity?.totals.races).toBe(profile?.totals.races);
      expect(entity?.totals.starts).toBe(profile?.totals.starts);
      expect(entity?.totals.wins).toBe(profile?.totals.wins);
      expect(entity?.totals.podiums).toBe(profile?.totals.podiums);
      expect(entity?.totals.dnfs).toBe(profile?.totals.dnfs);
      expect(entity?.totals.championships).toBe(profile?.totals.championships);
      expect(entity?.firstSeason).toBe(profile?.career.firstSeason);
      expect(entity?.lastSeason).toBe(profile?.career.lastSeason);
    },
  );

  /** Checked against the record before anything was drawn (`DESIGN_SYSTEM.md` §6.6.6). */
  it('reproduces the head-to-heads the surface was designed against', () => {
    const data = readCompare(['hamilton', 'rosberg']);
    const pair = data?.pairs[0];
    expect(pair?.relation).toBe('teammate');
    expect(pair?.sharedRaces).toBe(188);
    expect(pair?.sameTeamRaces).toBe(78);
    expect(pair?.race).toEqual({ rated: 148, pool: 188, a: 103, b: 45, tied: 0 });
    expect(pair?.grid).toEqual({ rated: 188, pool: 188, a: 132, b: 56, tied: 0 });
    expect(pair?.sameTeamSeasons.map((s) => s.year)).toEqual([2013, 2014, 2015, 2016]);
  });

  it('reproduces 1988 Senna–Prost, 7–5 over 12 shared finishes', () => {
    const data = readCompare(['senna', 'prost']);
    const seasons = data?.pairs[0]?.sameTeamSeasons ?? [];
    expect(seasons.some((s) => s.year === 1988 && s.teamRef === 'mclaren')).toBe(true);
  });

  /**
   * `pool` and `rated` count **pairings**, not races, and the gap between them is the point:
   * Fangio's 51 starts produce 196 pairings because a 1950s constructor entered many cars.
   */
  it('counts career teammate pairings rather than races', () => {
    const fangio = readCompare(['fangio'])?.entities[0];
    expect(fangio?.totals.starts).toBe(51);
    expect(fangio?.teammates.count).toBe(46);
    expect(fangio?.teammates.race.pool).toBe(196);
    expect(fangio?.teammates.race.rated).toBe(93);
    expect(
      (fangio?.teammates.race.a ?? 0) +
        (fangio?.teammates.race.b ?? 0) +
        (fangio?.teammates.race.tied ?? 0),
    ).toBe(fangio?.teammates.race.rated);
  });

  it('publishes a tie on the race ledger where a shared drive produced one', () => {
    const fangio = readCompare(['fangio'])?.entities[0];
    expect(fangio?.teammates.race.tied).toBeGreaterThan(0);
  });

  /** The SQL path and the pure path must agree; they are two implementations of one rule. */
  it('gives the same same-team ledger whether SQL or the pure builder computed it', () => {
    const data = readCompare(['hamilton', 'rosberg']);
    const pair = data?.pairs[0];
    const link = data?.chains.find((c) => c.a === 'rosberg' || c.b === 'rosberg');
    /* Directly-teammate pairs get no chain, so this asserts the absence rather than the link. */
    expect(link).toBeUndefined();
    expect(pair?.sameTeamRaces).toBe(78);
  });

  it('publishes no chain for a pair who were teammates, and one for a pair who were not', () => {
    const data = readCompare(['hamilton', 'rosberg', 'max_verstappen']);
    expect(data?.chains.map((c) => `${c.a} ${c.b}`)).toEqual([
      'hamilton max_verstappen',
      'rosberg max_verstappen',
    ]);
  });

  it('names every driver on a chain in `people`', () => {
    const data = readCompare(REFS);
    for (const chain of data?.chains ?? []) {
      for (const link of chain.links) {
        expect(data?.people[link.from]).toBeDefined();
        expect(data?.people[link.to]).toBeDefined();
      }
    }
  });

  it('marks 2026 as a season still being run, and 1950 as finished', () => {
    const hamilton = readCompare(['hamilton'])?.entities[0];
    const current = hamilton?.seasons.find((s) => s.year === 2026);
    expect(current?.championshipPositionIsFinal).toBe(false);
    const archive = buildArchive();
    expect(archive.find((s) => s.year === 1950)?.isComplete).toBe(true);
    expect(archive.find((s) => s.year === 2026)?.isComplete).toBe(false);
  });

  /** `GET /api/seasons` is newest-first; a year axis is not. */
  it('publishes the archive oldest-first, with 2026 at 22 numbered rounds', () => {
    const archive = buildArchive();
    expect(archive[0]?.year).toBe(1950);
    expect(archive.at(-1)?.year).toBe(2026);
    expect(archive.at(-1)?.rounds).toBe(22);
    expect(archive).toHaveLength(77);
  });

  it('gives byte-identical payloads on two calls', () => {
    expect(JSON.stringify(readCompare(REFS))).toBe(JSON.stringify(readCompare(REFS)));
  });

  it('keeps the entity order the caller asked for', () => {
    const forward = readCompare(['fangio', 'hamilton'])?.entities.map((e) => e.identity.ref);
    const backward = readCompare(['hamilton', 'fangio'])?.entities.map((e) => e.identity.ref);
    expect(forward).toEqual(['fangio', 'hamilton']);
    expect(backward).toEqual(['hamilton', 'fangio']);
  });
});

/* ================================================================================================
 * The statements themselves. No database needed, so these run in CI — which is the point: they are
 * the two properties a well-meaning edit is most likely to break.
 * ============================================================================================== */

const STATEMENTS = {
  SQL_COMPARE_RACES,
  SQL_COMPARE_TEAMMATE_TOTALS,
  SQL_COMPARE_SAME_TEAM,
  SQL_COMPARE_CHAMPIONSHIPS,
  SQL_COMPARE_IDENTITIES,
};

describe('the statements this lens runs', () => {
  /**
   * ⚠ **`driver_championship.season_id` is NULL on 32,963 of 36,091 rows (91.3 %).** The natural
   * join is through it, and it fails silently — returning only the ~3,128 rows that carry one,
   * which happen to be final snapshots, so the answer looks plausible. `DATABASE.md` §7 trap 26.
   */
  it('joins the championship table on year and round, never on season_id', () => {
    expect(SQL_COMPARE_CHAMPIONSHIPS).not.toMatch(/season_id/);
    expect(SQL_COMPARE_CHAMPIONSHIPS).toMatch(/round_number \* 1000 \+ dc\.session_number/);
  });

  it.each(Object.entries(STATEMENTS))('%s reaches neither lap nor pit_stop', (_name, sql) => {
    expect(sql).not.toMatch(/\blap\b|\bpit_stop\b/i);
  });

  it.each(Object.entries(STATEMENTS))('%s binds every value, interpolating none', (_name, sql) => {
    expect(sql).not.toMatch(/\$\{/);
    /* Trap 15: a round-number query that forgets this counts cancelled rounds. */
    if (sql.includes('round r')) expect(sql).toMatch(/r\.number IS NOT NULL/);
  });
});
