import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { DB_PATH } from '../config';
import { __resetDb, getDb } from '../db';
import { invalidateMemo } from '../cache/memo';
import { circuitListSchema, driverListSchema, teamListSchema } from '../schemas/directory';
import { readCircuit } from './circuits';
import { readDriver } from './drivers';
import { readTeam } from './teams';
import type { CircuitIndexRow, DriverIndexRow, TeamIndexRow } from './directory';
import {
  SQL_CIRCUIT_INDEX,
  SQL_DRIVER_INDEX,
  SQL_TEAM_INDEX,
  buildCircuitIndexItem,
  buildDriverIndexItem,
  buildTeamIndexItem,
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
  firstSeason: 2001,
  lastSeason: 2026,
  ...overrides,
});

describe('buildDriverIndexItem', () => {
  it('carries every published field through unchanged', () => {
    expect(buildDriverIndexItem(driverRow())).toEqual({
      ref: 'alonso',
      code: 'ALO',
      forename: 'Fernando',
      surname: 'Alonso',
      nationality: 'Spanish',
      countryCode: 'ESP',
      races: 438,
      firstSeason: 2001,
      lastSeason: 2026,
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
        firstSeason: null,
        lastSeason: null,
      }),
    );
    expect(item.races).toBe(0);
    expect(item.firstSeason).toBeNull();
    expect(item.lastSeason).toBeNull();
  });

  /**
   * Never a synthesised code. `surname.slice(0, 3).toUpperCase()` would invent `ECC`, a
   * three-letter code the sport never issued, for 774 of 881 drivers.
   */
  it('passes a null code through rather than deriving one', () => {
    expect(buildDriverIndexItem(driverRow({ code: null })).code).toBeNull();
  });

  it('passes a null nationality through — 16 drivers have none', () => {
    expect(buildDriverIndexItem(driverRow({ nationality: null })).nationality).toBeNull();
  });

  it('produces a row its own schema accepts', () => {
    const parsed = driverListSchema.safeParse({ drivers: [buildDriverIndexItem(driverRow())] });
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
    firstSeason: null,
    lastSeason: null,
  };

  it('publishes a team that entered and never started', () => {
    expect(buildTeamIndexItem(row)).toEqual(row);
  });

  it('produces a row its own schema accepts', () => {
    expect(teamListSchema.safeParse({ teams: [buildTeamIndexItem(row)] }).success).toBe(true);
  });
});

describe('buildCircuitIndexItem', () => {
  const madring: CircuitIndexRow = {
    ref: 'madring',
    name: 'Madring',
    locality: 'Madrid',
    country: 'Spain',
    countryCode: 'ESP',
    roundsHeld: 1,
    racesWithResults: 0,
    firstYear: null,
    lastYear: null,
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
  });

  it('produces a row its own schema accepts', () => {
    expect(
      circuitListSchema.safeParse({ circuits: [buildCircuitIndexItem(madring)] }).success,
    ).toBe(true);
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
      expect(item.firstSeason).toBe(profile.career.firstSeason);
      expect(item.lastSeason).toBe(profile.career.lastSeason);
      expect(item.code).toBe(profile.driver.code);
      expect(item.nationality).toBe(profile.driver.nationality);
    },
  );

  it.each(['ferrari', 'mclaren', 'life'])(
    'team %s reads the same in the index as on the profile',
    (ref) => {
      const item = readTeamIndex().teams.find((row) => row.ref === ref);
      const profile = readTeam(ref);
      expect(item).toBeDefined();
      expect(profile).not.toBeNull();
      if (item === undefined || profile === null) return;
      expect(item.races).toBe(profile.totals.races);
      expect(item.firstSeason).toBe(profile.career.firstSeason);
      expect(item.lastSeason).toBe(profile.career.lastSeason);
      expect(item.name).toBe(profile.team.name);
    },
  );

  it.each(['monza', 'silverstone', 'madring'])(
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
    },
  );

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
      'code',
      'countryCode',
      'firstSeason',
      'forename',
      'lastSeason',
      'nationality',
      'races',
      'ref',
      'surname',
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

  /** Memoised: the second call is the same object, not an equal one. */
  it('memoises each list, so a repeat request does no work', () => {
    invalidateMemo();
    expect(readDriverIndex()).toBe(readDriverIndex());
    expect(readTeamIndex()).toBe(readTeamIndex());
    expect(readCircuitIndex()).toBe(readCircuitIndex());
  });
});
