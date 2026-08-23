import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { DB_PATH } from '../config';
import { __resetDb, getDb } from '../db';
import { invalidateMemo } from '../cache/memo';
import { circuitListSchema, driverListSchema, teamListSchema } from '../schemas/directory';
import { readCircuit } from './circuits';
import { readDriver } from './drivers';
import { readTeam } from './teams';
import type {
  ChampionshipRecord,
  CircuitIndexRow,
  DriverIndexRow,
  TeamIndexRow,
  TitleStandingRow,
} from './directory';
import {
  NO_CHAMPIONSHIP_RECORD,
  SQL_CIRCUIT_INDEX,
  SQL_DRIVER_INDEX,
  SQL_DRIVER_TITLE_STANDINGS,
  SQL_TEAM_INDEX,
  SQL_TEAM_TITLE_STANDINGS,
  buildCircuitIndexItem,
  buildDriverIndexItem,
  buildTeamIndexItem,
  foldChampionshipStandings,
  readCircuitIndex,
  readDriverIndex,
  readTeamIndex,
} from './directory';

/* ==================================================================================
 * Pure builders — no database, so these run in CI where `data/f1.db` never exists.
 * ================================================================================== */

const driverRow = (overrides: Partial<DriverIndexRow> = {}): DriverIndexRow => ({
  ref: 'alonso',
  code: 'ALO',
  forename: 'Fernando',
  surname: 'Alonso',
  nationality: 'Spanish',
  countryCode: 'ESP',
  races: 438,
  starts: 435,
  wins: 32,
  podiums: 106,
  firstSeason: 2001,
  lastSeason: 2026,
  colorTeamRef: 'renault',
  ...overrides,
});

const ALONSO_TITLES: ChampionshipRecord = { championships: 2, bestChampionshipPosition: 1 };

describe('buildDriverIndexItem', () => {
  it('carries every published field through unchanged', () => {
    expect(buildDriverIndexItem(driverRow(), ALONSO_TITLES)).toEqual({
      ref: 'alonso',
      code: 'ALO',
      forename: 'Fernando',
      surname: 'Alonso',
      nationality: 'Spanish',
      countryCode: 'ESP',
      races: 438,
      starts: 435,
      wins: 32,
      podiums: 106,
      championships: 2,
      bestChampionshipPosition: 1,
      firstSeason: 2001,
      lastSeason: 2026,
      colorTeamRef: 'renault',
    });
  });

  /**
   * The 63-driver case. A zero here is a **measurement**, and the nulls beside it are what
   * let a client tell it apart from a driver whose span happens to be unknown.
   */
  it('publishes a never-raced driver as 0 races with a null span', () => {
    const item = buildDriverIndexItem(
      driverRow({
        ref: 'ecclestone',
        code: null,
        forename: 'Bernie',
        surname: 'Ecclestone',
        races: 0,
        starts: 0,
        wins: 0,
        podiums: 0,
        firstSeason: null,
        lastSeason: null,
      }),
      NO_CHAMPIONSHIP_RECORD,
    );
    expect(item.races).toBe(0);
    expect(item.firstSeason).toBeNull();
    expect(item.lastSeason).toBeNull();
    // Zero achievements *and* a null best placing: the row is separable on `races === 0`
    // alone, and nothing on it claims a career this driver did not have.
    expect(item.championships).toBe(0);
    expect(item.bestChampionshipPosition).toBeNull();
  });

  /**
   * The state `championships` alone cannot express, and the reason
   * `bestChampionshipPosition` is published: Pérez finished second in the 2023
   * championship. Without it, a page can only say "not a champion", which is the same
   * thing it says about a driver who started once in 1961.
   */
  it('distinguishes a runner-up from a driver who never placed', () => {
    const runnerUp = buildDriverIndexItem(driverRow({ ref: 'perez' }), {
      championships: 0,
      bestChampionshipPosition: 2,
    });
    const neverPlaced = buildDriverIndexItem(
      driverRow({ ref: 'ryan', races: 1, starts: 1, wins: 0, podiums: 0 }),
      NO_CHAMPIONSHIP_RECORD,
    );
    expect(runnerUp.championships).toBe(0);
    expect(runnerUp.bestChampionshipPosition).toBe(2);
    expect(neverPlaced.bestChampionshipPosition).toBeNull();
  });

  /**
   * Never a synthesised code. `surname.slice(0, 3).toUpperCase()` would invent `ECC`, a
   * three-letter code the sport never issued, for 774 of 881 drivers.
   */
  it('passes a null code through rather than deriving one', () => {
    expect(buildDriverIndexItem(driverRow({ code: null }), ALONSO_TITLES).code).toBeNull();
  });

  it('passes a null nationality through — 16 drivers have none', () => {
    expect(
      buildDriverIndexItem(driverRow({ nationality: null }), ALONSO_TITLES).nationality,
    ).toBeNull();
  });

  it('produces a row its own schema accepts', () => {
    const parsed = driverListSchema.safeParse({
      drivers: [buildDriverIndexItem(driverRow(), ALONSO_TITLES)],
    });
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3))).toBe(true);
  });
});

describe('buildTeamIndexItem', () => {
  const row: TeamIndexRow = {
    ref: 'life',
    name: 'Life',
    nationality: 'Italian',
    countryCode: 'ITA',
    races: 0,
    wins: 0,
    podiums: 0,
    firstSeason: null,
    lastSeason: null,
  };

  it('publishes a team that entered and never started', () => {
    expect(buildTeamIndexItem(row, NO_CHAMPIONSHIP_RECORD)).toEqual({
      ...row,
      championships: 0,
      bestChampionshipPosition: null,
    });
  });

  /**
   * Alfa Romeo won the first two drivers' titles and holds **0** constructors' titles,
   * because that championship began in 1958. The null best position is what separates
   * "there was no such award" from "never won it".
   */
  it('publishes 0 titles for a team whose era predates the constructors championship', () => {
    const alfa = buildTeamIndexItem(
      { ...row, ref: 'alfa', name: 'Alfa Romeo', races: 216, wins: 10, podiums: 26 },
      { championships: 0, bestChampionshipPosition: 6 },
    );
    expect(alfa.wins).toBe(10);
    expect(alfa.championships).toBe(0);
    expect(alfa.bestChampionshipPosition).toBe(6);
  });

  it('produces a row its own schema accepts', () => {
    expect(
      teamListSchema.safeParse({ teams: [buildTeamIndexItem(row, NO_CHAMPIONSHIP_RECORD)] })
        .success,
    ).toBe(true);
  });
});

describe('buildCircuitIndexItem', () => {
  const madring: CircuitIndexRow = {
    ref: 'madring',
    name: 'Madring',
    locality: 'Madrid',
    country: 'Spain',
    countryCode: 'ESP',
    latitude: 40.46528,
    longitude: -3.61528,
    roundsHeld: 1,
    racesWithResults: 0,
    firstYear: null,
    lastYear: null,
    lastScheduledYear: 2026,
  };

  /**
   * Trap 13. A scheduled venue is not a gap, and the two counts are what says so — a
   * single `races: 0` would read as "nothing ever happened here".
   */
  it('keeps a scheduled round and a run race as two different facts', () => {
    const item = buildCircuitIndexItem(madring);
    expect(item.roundsHeld).toBe(1);
    expect(item.racesWithResults).toBe(0);
    expect(item.firstYear).toBeNull();
    // And the field that says it is *current* rather than merely scheduled at some point:
    // `lastYear` is null here, so it cannot carry that meaning.
    expect(item.lastScheduledYear).toBe(2026);
    expect(item.lastYear).toBeNull();
  });

  it('produces a row its own schema accepts', () => {
    expect(
      circuitListSchema.safeParse({ circuits: [buildCircuitIndexItem(madring)] }).success,
    ).toBe(true);
  });
});

/* ==================================================================================
 * foldChampionshipStandings — the 66-vs-35 trap, tested where it is decided.
 * ================================================================================== */

describe('foldChampionshipStandings', () => {
  const standing = (ref: string, year: number, position: number): TitleStandingRow => ({
    ref,
    year,
    position,
  });

  /** 1950–2025 finished; 2026 is 10 rounds into 22. The shape of the live map. */
  const COMPLETE = new Map<number, boolean>([
    [2021, true],
    [2022, true],
    [2023, true],
    [2024, true],
    [2025, true],
    [2026, false],
  ]);

  it('counts a title once per finished season won', () => {
    const folded = foldChampionshipStandings(
      [
        standing('max_verstappen', 2021, 1),
        standing('max_verstappen', 2022, 1),
        standing('max_verstappen', 2023, 1),
        standing('max_verstappen', 2024, 1),
        standing('max_verstappen', 2025, 3),
      ],
      COMPLETE,
    );
    expect(folded.get('max_verstappen')).toEqual({
      championships: 4,
      bestChampionshipPosition: 1,
    });
  });

  /**
   * **The defect this whole design exists to prevent.** The 2026 data ranks Antonelli
   * first after 10 of 22 rounds. Leading is not winning, and a payload that says otherwise
   * puts a championship next to a name in front of a reader.
   */
  it('awards nothing from a season that is still being run', () => {
    const folded = foldChampionshipStandings(
      [standing('antonelli', 2026, 1), standing('antonelli', 2025, 7)],
      COMPLETE,
    );
    expect(folded.get('antonelli')).toEqual({ championships: 0, bestChampionshipPosition: 7 });
  });

  /** The constructors' half of the same defect: Mercedes has 8 titles, not 9. */
  it('does not add a ninth constructors title from an unfinished season', () => {
    const folded = foldChampionshipStandings(
      [standing('mercedes', 2021, 1), standing('mercedes', 2026, 1)],
      COMPLETE,
    );
    expect(folded.get('mercedes')?.championships).toBe(1);
  });

  /**
   * An unmapped year is treated as unfinished, matching `seasonComplete.get(year) ?? false`
   * in `queries/drivers.ts`. The safe direction: withhold a title rather than invent one.
   */
  it('treats a year missing from the map as unfinished', () => {
    const folded = foldChampionshipStandings([standing('someone', 1899, 1)], COMPLETE);
    expect(folded.has('someone')).toBe(false);
  });

  it('keeps the best position, not the last or the first seen', () => {
    const folded = foldChampionshipStandings(
      [standing('perez', 2021, 4), standing('perez', 2023, 2), standing('perez', 2024, 8)],
      COMPLETE,
    );
    expect(folded.get('perez')).toEqual({ championships: 0, bestChampionshipPosition: 2 });
  });

  it('returns no entry at all for an entity with no qualifying standing', () => {
    expect(foldChampionshipStandings([], COMPLETE).size).toBe(0);
  });

  /** Pure: the same input twice, and no mutation of the caller's rows. */
  it('is pure', () => {
    const rows = [standing('a', 2021, 1)];
    const frozen = JSON.stringify(rows);
    expect(foldChampionshipStandings(rows, COMPLETE)).toEqual(
      foldChampionshipStandings(rows, COMPLETE),
    );
    expect(JSON.stringify(rows)).toBe(frozen);
  });
});

/* ==================================================================================
 * Against the live database.
 * ================================================================================== */

const hasDatabase = existsSync(DB_PATH);

interface PlanRow {
  detail: string;
}

const planOf = (sql: string): string =>
  (getDb().prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as PlanRow[])
    .map((row) => row.detail)
    .join('\n');

describe.skipIf(!hasDatabase)('directory queries against the live database', () => {
  afterAll(() => {
    __resetDb();
    invalidateMemo();
  });

  it('lists every driver, team and circuit in the archive', () => {
    expect(readDriverIndex().drivers).toHaveLength(881);
    expect(readTeamIndex().teams).toHaveLength(214);
    expect(readCircuitIndex().circuits).toHaveLength(78);
  });

  it('produces payloads that pass their own schemas', () => {
    for (const [schema, payload] of [
      [driverListSchema, readDriverIndex()],
      [teamListSchema, readTeamIndex()],
      [circuitListSchema, readCircuitIndex()],
    ] as const) {
      const parsed = schema.safeParse(payload);
      expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3))).toBe(true);
    }
  });

  /**
   * **The ruling, asserted rather than described.** These counts are the whole reason the
   * joins are `LEFT`, and an inner join would pass every other test in this file.
   */
  it('includes the entities that never raced, with the counts that identify them', () => {
    const drivers = readDriverIndex().drivers;
    expect(drivers.filter((row) => row.races === 0)).toHaveLength(63);
    expect(readTeamIndex().teams.filter((row) => row.races === 0)).toHaveLength(9);
    expect(readCircuitIndex().circuits.filter((row) => row.racesWithResults === 0)).toHaveLength(1);

    // The two groups behind the 63, named so a refresh that changes either is visible.
    for (const ref of ['ecclestone', 'langes', 'amati', 'desire_wilson']) {
      expect(drivers.find((row) => row.ref === ref)?.races).toBe(0);
    }
    for (const ref of ['colton_herta', 'felipe_drugovich', 'paul_aron']) {
      expect(drivers.find((row) => row.ref === ref)?.races).toBe(0);
    }
  });

  /**
   * The invariant the client uses to tell an entered-only entity from a racing one. Not
   * enforced by clamping in the builder — asserted here on all 1,173 rows, so a database
   * anomaly fails a test rather than being quietly rewritten.
   */
  it('holds the span/count invariant on every row', () => {
    for (const row of readDriverIndex().drivers) {
      expect(row.firstSeason === null, row.ref).toBe(row.races === 0);
      expect(row.lastSeason === null, row.ref).toBe(row.races === 0);
    }
    for (const row of readTeamIndex().teams) {
      expect(row.firstSeason === null, row.ref).toBe(row.races === 0);
      expect(row.lastSeason === null, row.ref).toBe(row.races === 0);
    }
    for (const row of readCircuitIndex().circuits) {
      expect(row.firstYear === null, row.ref).toBe(row.racesWithResults === 0);
      expect(row.lastYear === null, row.ref).toBe(row.racesWithResults === 0);
      expect(row.racesWithResults, row.ref).toBeLessThanOrEqual(row.roundsHeld);
    }
  });

  /**
   * **The guard that matters most.** The index and the profile publish the same numbers
   * under the same names from *different* SQL, so nothing but this test stops them
   * drifting — and a number that changes when the reader clicks through is precisely the
   * class of defect this project keeps shipping.
   */
  it.each(['alonso', 'michael_schumacher', 'ascari', 'ecclestone', 'scott_Brown'])(
    'driver %s reads the same in the index as on the profile',
    (ref) => {
      const item = readDriverIndex().drivers.find((row) => row.ref === ref);
      const profile = readDriver(ref);
      expect(item).toBeDefined();
      expect(profile).not.toBeNull();
      if (item === undefined || profile === null) return;
      expect(item.races).toBe(profile.totals.races);
      expect(item.starts).toBe(profile.totals.starts);
      expect(item.wins).toBe(profile.totals.wins);
      expect(item.podiums).toBe(profile.totals.podiums);
      expect(item.championships).toBe(profile.totals.championships);
      expect(item.firstSeason).toBe(profile.career.firstSeason);
      expect(item.lastSeason).toBe(profile.career.lastSeason);
      expect(item.code).toBe(profile.driver.code);
      expect(item.nationality).toBe(profile.driver.nationality);

      // `bestChampionshipPosition` has no profile field of its own, so it is checked
      // against the array the profile builds it from — the same completeness gate, reached
      // by a different route.
      const placings = profile.seasons
        .filter((season) => season.isSeasonComplete && season.position !== null)
        .map((season) => season.position ?? 0);
      expect(item.bestChampionshipPosition).toBe(
        placings.length === 0 ? null : Math.min(...placings),
      );
    },
  );

  it.each(['ferrari', 'mclaren', 'life', 'alfa', 'mercedes'])(
    'team %s reads the same in the index as on the profile',
    (ref) => {
      const item = readTeamIndex().teams.find((row) => row.ref === ref);
      const profile = readTeam(ref);
      expect(item).toBeDefined();
      expect(profile).not.toBeNull();
      if (item === undefined || profile === null) return;
      expect(item.races).toBe(profile.totals.races);
      expect(item.wins).toBe(profile.totals.wins);
      expect(item.podiums).toBe(profile.totals.podiums);
      expect(item.championships).toBe(profile.totals.championships);
      expect(item.firstSeason).toBe(profile.career.firstSeason);
      expect(item.lastSeason).toBe(profile.career.lastSeason);
      expect(item.name).toBe(profile.team.name);

      const placings = profile.seasons
        .filter((season) => season.isSeasonComplete && season.position !== null)
        .map((season) => season.position ?? 0);
      expect(item.bestChampionshipPosition).toBe(
        placings.length === 0 ? null : Math.min(...placings),
      );
    },
  );

  it.each(['monza', 'silverstone', 'madring', 'nurburgring'])(
    'circuit %s reads the same in the index as on the profile',
    (ref) => {
      const item = readCircuitIndex().circuits.find((row) => row.ref === ref);
      const profile = readCircuit(ref);
      expect(item).toBeDefined();
      expect(profile).not.toBeNull();
      if (item === undefined || profile === null) return;
      expect(item.roundsHeld).toBe(profile.roundsHeld);
      expect(item.racesWithResults).toBe(profile.racesWithResults);
      expect(item.firstYear).toBe(profile.firstYear);
      expect(item.lastYear).toBe(profile.lastYear);
      expect(item.locality).toBe(profile.circuit.locality);
      expect(item.latitude).toBe(profile.circuit.latitude);
      expect(item.longitude).toBe(profile.circuit.longitude);

      // The profile's `races` array holds every numbered round, run or not, so its highest
      // year is `lastScheduledYear` by a different derivation.
      const years = profile.races.map((race) => race.year);
      expect(item.lastScheduledYear).toBe(years.length === 0 ? null : Math.max(...years));
    },
  );

  /**
   * **The 66-vs-35 trap, asserted against the whole archive rather than a sample.**
   *
   * `SELECT count(DISTINCT driver_id) FROM driver_championship WHERE position = 1` returns
   * 66, because that table is a per-round snapshot. The published answer is 35, and 17 for
   * constructors. If either of these numbers moves without the database moving, a gate has
   * been removed.
   */
  it('publishes titles, not championship leads', () => {
    const drivers = readDriverIndex().drivers;
    expect(drivers.filter((row) => row.championships > 0)).toHaveLength(35);
    expect(readTeamIndex().teams.filter((row) => row.championships > 0)).toHaveLength(17);

    // The record, spot-checked where a reader would notice: seven each, and Mercedes on
    // eight rather than the nine an ungated query gives it from the 2026 standings.
    const titlesOf = (ref: string) => drivers.find((row) => row.ref === ref)?.championships;
    expect(titlesOf('michael_schumacher')).toBe(7);
    expect(titlesOf('hamilton')).toBe(7);
    expect(titlesOf('fangio')).toBe(5);
    const teams = readTeamIndex().teams;
    const teamTitlesOf = (ref: string) => teams.find((row) => row.ref === ref)?.championships;
    expect(teamTitlesOf('ferrari')).toBe(16);
    expect(teamTitlesOf('mercedes')).toBe(8);
    expect(teamTitlesOf('mclaren')).toBe(10);
  });

  /**
   * The populations the index exists to let a page stratify by. Each is a fact about the
   * sport that a redesign will put on screen, so each is pinned: **116 of 881 drivers ever
   * won a race and 47 of 214 teams did**, which is why a list sorted on wins alone is
   * mostly zeroes and why `bestChampionshipPosition` is published beside them.
   */
  it('measures the populations a page can group by', () => {
    const drivers = readDriverIndex().drivers;
    expect(drivers.filter((row) => row.wins > 0)).toHaveLength(116);
    expect(drivers.filter((row) => row.races > 0)).toHaveLength(818);
    expect(drivers.filter((row) => row.races === 1)).toHaveLength(172);
    expect(drivers.filter((row) => row.bestChampionshipPosition !== null)).toHaveLength(383);

    const teams = readTeamIndex().teams;
    expect(teams.filter((row) => row.wins > 0)).toHaveLength(47);
    expect(teams.filter((row) => row.races > 0)).toHaveLength(205);

    // `lastScheduledYear` against the latest season is the circuit "still current" test.
    const circuits = readCircuitIndex().circuits;
    expect(
      circuits.filter((row) => row.lastScheduledYear !== null && row.lastScheduledYear >= 2026),
    ).toHaveLength(22);
    expect(
      circuits.filter((row) => row.lastScheduledYear !== null && row.lastScheduledYear < 2025),
    ).toHaveLength(53);
  });

  /**
   * Arithmetic that must hold on **every** row, not on the five that are spot-checked. A
   * driver with more wins than starts, or a title and no win, is a broken aggregate — and
   * these are the shapes a mis-scoped `count(DISTINCT …)` actually produces.
   */
  it('holds the achievement invariants on every row', () => {
    for (const row of readDriverIndex().drivers) {
      expect(row.starts, row.ref).toBeLessThanOrEqual(row.races);
      expect(row.wins, row.ref).toBeLessThanOrEqual(row.starts);
      expect(row.podiums, row.ref).toBeGreaterThanOrEqual(row.wins);
      expect(row.podiums, row.ref).toBeLessThanOrEqual(row.races);
      // Equivalent by construction — both read `position === 1` from the same rows.
      expect(row.championships > 0, row.ref).toBe(row.bestChampionshipPosition === 1);
      if (row.races === 0) {
        expect(row.wins, row.ref).toBe(0);
        expect(row.bestChampionshipPosition, row.ref).toBeNull();
      }
    }
    for (const row of readTeamIndex().teams) {
      expect(row.wins, row.ref).toBeLessThanOrEqual(row.races);
      expect(row.podiums, row.ref).toBeGreaterThanOrEqual(row.wins);
      expect(row.championships > 0, row.ref).toBe(row.bestChampionshipPosition === 1);
      if (row.races === 0) expect(row.bestChampionshipPosition, row.ref).toBeNull();
    }
    for (const row of readCircuitIndex().circuits) {
      expect(row.lastScheduledYear === null, row.ref).toBe(row.roundsHeld === 0);
      if (row.lastYear !== null && row.lastScheduledYear !== null) {
        expect(row.lastScheduledYear, row.ref).toBeGreaterThanOrEqual(row.lastYear);
      }
    }
  });

  /**
   * Trap 17, from the other side. A row count would report 3 for Ascari's 1950, which had
   * two races: the index must agree with the profile's race count, not with `count(*)`.
   */
  it('counts races rather than classification rows', () => {
    const ascari = readDriverIndex().drivers.find((row) => row.ref === 'ascari');
    const profile = readDriver('ascari');
    expect(ascari?.races).toBe(profile?.totals.races);
    expect(profile?.totals.entries).toBeGreaterThan(profile?.totals.races ?? 0);
  });

  /** The order the payload promises. A stable default; the reader's sort is client-side. */
  it('returns each list in its documented order', () => {
    const drivers = readDriverIndex().drivers;
    const key = (row: (typeof drivers)[number]) => `${row.surname} ${row.forename} ${row.ref}`;
    expect(drivers.map(key)).toEqual([...drivers.map(key)].sort());

    const teams = readTeamIndex().teams.map((row) => `${row.name} ${row.ref}`);
    expect(teams).toEqual([...teams].sort());

    const circuits = readCircuitIndex().circuits.map((row) => `${row.name} ${row.ref}`);
    expect(circuits).toEqual([...circuits].sort());
  });

  /**
   * No internal id, no brand colour, no field the schema does not name. `strictObject`
   * already refuses these on the way out; this asserts the SQL never selects one, so the
   * failure would be a test rather than a 500 in front of a reader.
   */
  it('publishes slugs and nothing that identifies a row internally', () => {
    const row = readDriverIndex().drivers[0];
    expect(row).toBeDefined();
    expect(Object.keys(row ?? {}).sort()).toEqual([
      'bestChampionshipPosition',
      'championships',
      'code',
      'colorTeamRef',
      'countryCode',
      'firstSeason',
      'forename',
      'lastSeason',
      'nationality',
      'podiums',
      'races',
      'ref',
      'starts',
      'surname',
      'wins',
    ]);
    expect(Object.keys(readTeamIndex().teams[0] ?? {}).sort()).toEqual([
      'bestChampionshipPosition',
      'championships',
      'countryCode',
      'firstSeason',
      'lastSeason',
      'name',
      'nationality',
      'podiums',
      'races',
      'ref',
      'wins',
    ]);
    expect(Object.keys(readCircuitIndex().circuits[0] ?? {}).sort()).toEqual([
      'country',
      'countryCode',
      'firstYear',
      'lastScheduledYear',
      'lastYear',
      'latitude',
      'locality',
      'longitude',
      'name',
      'racesWithResults',
      'ref',
      'roundsHeld',
    ]);
  });

  /* -------------------------------------------------------------------------- S-10 */

  /**
   * The plans, asserted because a plan regresses silently: the statement keeps returning
   * the same rows while the work behind them changes.
   *
   * The driver and team statements enter through `idx_session_type` and aggregate the
   * 26,093 race classification rows once; the dimension scan rides an index. No statement
   * touches `lap` or `pit_stop`, and **no statement takes a parameter**, so the bound is
   * structural rather than validated.
   */
  it('drivers: aggregates once and scans the dimension by index', () => {
    const plan = planOf(SQL_DRIVER_INDEX);
    expect(plan).toContain('MATERIALIZE agg');
    expect(plan).toContain('idx_session_type');
    expect(plan).toContain('SCAN d USING INDEX idx_driver_surname');
    expect(plan).not.toMatch(/\blap\b|pit_stop/);
  });

  it('teams: the same shape, grouped by team', () => {
    const plan = planOf(SQL_TEAM_INDEX);
    expect(plan).toContain('MATERIALIZE agg');
    expect(plan).toContain('idx_session_type');
    expect(plan).not.toMatch(/\blap\b|pit_stop/);
  });

  /**
   * `MATERIALIZED` on `circuit_round` is what stops the `EXISTS` being re-evaluated once
   * per referencing aggregate. Inlined, the plan prints `CORRELATED SCALAR SUBQUERY`
   * **three** times — once for each of `count`, `sum` and the `CASE` pair — and measures
   * 3.27 ms against 1.83 ms materialised (p50 of 15 warm runs, identical 78 rows and an
   * identical 1,171-round total).
   *
   * The count of that line is therefore the assertion, not an index name: materialising
   * also turns the round access from `SEARCH r USING INDEX idx_round_circuit` into a plain
   * `SCAN r`, which is the faster of the two over a 1,173-row table and is why the naive
   * "assert the index" version of this test failed on the correct query.
   */
  it('circuits: materialises the round scan so the EXISTS runs once per round', () => {
    const plan = planOf(SQL_CIRCUIT_INDEX);
    expect(plan).toContain('MATERIALIZE circuit_round');
    expect(plan.match(/CORRELATED SCALAR SUBQUERY/g)).toHaveLength(1);
    expect(plan).toContain('SCAN c USING INDEX idx_circuit_ref');
    expect(plan).not.toMatch(/\blap\b|pit_stop/);
  });

  /**
   * The two standings statements read a championship table end to end and nothing else.
   * The assertion that matters is the **absence** of `lap` and `pit_stop`, and the presence
   * of the `last_snapshot` co-routine — which is the structural half of the title gate. A
   * plan without it would mean the CTE had been optimised into something that can see
   * mid-season rows.
   */
  it.each([
    ['drivers', SQL_DRIVER_TITLE_STANDINGS, 'idx_dc_year'],
    ['teams', SQL_TEAM_TITLE_STANDINGS, 'idx_tc_year'],
  ])('%s standings: reads only the championship table, final snapshots first', (_, sql, index) => {
    const plan = planOf(sql);
    expect(plan).toContain('CO-ROUTINE last_snapshot');
    expect(plan).toContain(index);
    expect(plan).not.toMatch(/\blap\b|pit_stop|session_entry/);
  });

  /** Memoised: the second call is the same object, not an equal one. */
  it('memoises each list, so a repeat request does no work', () => {
    invalidateMemo();
    expect(readDriverIndex()).toBe(readDriverIndex());
    expect(readTeamIndex()).toBe(readTeamIndex());
    expect(readCircuitIndex()).toBe(readCircuitIndex());
  });
});
