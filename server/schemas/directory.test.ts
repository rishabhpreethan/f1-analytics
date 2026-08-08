import { describe, expect, it } from 'vitest';
import type { CircuitListItem, DriverListItem, TeamListItem } from './directory';
import {
  circuitListItemSchema,
  circuitListSchema,
  driverListItemSchema,
  driverListSchema,
  teamListItemSchema,
  teamListSchema,
} from './directory';
import { circuitListFixture, driverListFixture, teamListFixture } from './directory.fixture';

/** Look a fixture row up by its slug, so a test never depends on array position. */
function driverRow(ref: string): DriverListItem {
  const row = driverListFixture.drivers.find((item) => item.ref === ref);
  if (row === undefined) throw new Error(`the driver fixture holds no ${ref}`);
  return row;
}

function teamRow(ref: string): TeamListItem {
  const row = teamListFixture.teams.find((item) => item.ref === ref);
  if (row === undefined) throw new Error(`the team fixture holds no ${ref}`);
  return row;
}

function circuitRow(ref: string): CircuitListItem {
  const row = circuitListFixture.circuits.find((item) => item.ref === ref);
  if (row === undefined) throw new Error(`the circuit fixture holds no ${ref}`);
  return row;
}

/**
 * The index response contracts, exercised without a database so CI sees them.
 *
 * These assert the two things a schema can be wrong about in a way nothing else catches:
 * **what it refuses to let mean two things** — a null that must stay nullable, a count that
 * must be allowed to be a measured zero — and **what it refuses to accept**, which for a
 * `strictObject` includes a field a well-meaning change might add.
 */

describe('the three index payloads accept their fixtures', () => {
  it('accepts the driver list', () => {
    const parsed = driverListSchema.safeParse(driverListFixture);
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3))).toBe(true);
  });

  it('accepts the team list', () => {
    const parsed = teamListSchema.safeParse(teamListFixture);
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3))).toBe(true);
  });

  it('accepts the circuit list', () => {
    const parsed = circuitListSchema.safeParse(circuitListFixture);
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3))).toBe(true);
  });

  it('accepts an empty list rather than requiring rows', () => {
    expect(driverListSchema.safeParse({ drivers: [] }).success).toBe(true);
    expect(teamListSchema.safeParse({ teams: [] }).success).toBe(true);
    expect(circuitListSchema.safeParse({ circuits: [] }).success).toBe(true);
  });
});

/**
 * The never-raced case is the whole ruling in this module, so it is asserted rather than
 * described. 63 drivers, 9 teams and 1 circuit reach it.
 */
describe('a never-raced row is representable', () => {
  it('admits races: 0 with a null season span', () => {
    const ecclestone = driverRow('ecclestone');
    expect(ecclestone.races).toBe(0);
    expect(driverListItemSchema.safeParse(ecclestone).success).toBe(true);
  });

  it('admits a team that entered and never started', () => {
    const life = teamRow('life');
    expect(life.races).toBe(0);
    expect(teamListItemSchema.safeParse(life).success).toBe(true);
  });

  it('admits a venue with a scheduled round and no results', () => {
    const madring = circuitRow('madring');
    expect(madring.roundsHeld).toBe(1);
    expect(madring.racesWithResults).toBe(0);
    expect(circuitListItemSchema.safeParse(madring).success).toBe(true);
  });
});

/**
 * The two fields that are absent for most of the archive. Neither may be tightened: a
 * payload that fails its own schema is answered as a 500, so a non-nullable `code` would
 * take the whole directory offline for 774 of 881 drivers.
 */
describe('nullable identity fields stay nullable', () => {
  const base = driverRow('alonso');

  it('accepts a null code — 774 of 881 drivers have none', () => {
    expect(driverListItemSchema.safeParse({ ...base, code: null }).success).toBe(true);
  });

  it('accepts a null nationality — 16 drivers have none', () => {
    expect(driverListItemSchema.safeParse({ ...base, nationality: null }).success).toBe(true);
  });

  it('rejects an empty-string code, which is not the same statement as null', () => {
    expect(driverListItemSchema.safeParse({ ...base, code: '' }).success).toBe(false);
  });
});

describe('the row schemas reject what would let a figure mean two things', () => {
  const driver = driverRow('alonso');
  const circuit = circuitRow('monza');

  it('rejects a negative race count', () => {
    expect(driverListItemSchema.safeParse({ ...driver, races: -1 }).success).toBe(false);
  });

  it('rejects a fractional race count', () => {
    expect(driverListItemSchema.safeParse({ ...driver, races: 1.5 }).success).toBe(false);
  });

  it('rejects a season outside the format range', () => {
    expect(driverListItemSchema.safeParse({ ...driver, firstSeason: 1949 }).success).toBe(false);
    expect(driverListItemSchema.safeParse({ ...driver, lastSeason: 2101 }).success).toBe(false);
  });

  /**
   * `strictObject` is the guard against the field this product keeps being tempted to add.
   * Only 12 of 214 teams have a brand colour and they collide (trap 6), so colour is
   * resolved from `ref` by `src/lib/entityColor.ts` and never travels on a payload.
   */
  it('rejects a primaryColor field on a team row', () => {
    const team = { ...teamRow('ferrari'), primaryColor: '#DC0000' };
    expect(teamListItemSchema.safeParse(team).success).toBe(false);
  });

  it('rejects an internal integer id on any row (DL-3, trap 11)', () => {
    expect(driverListItemSchema.safeParse({ ...driver, id: 4 }).success).toBe(false);
    expect(circuitListItemSchema.safeParse({ ...circuit, id: 14 }).success).toBe(false);
  });

  it('rejects a reference that is not a slug', () => {
    expect(driverListItemSchema.safeParse({ ...driver, ref: '' }).success).toBe(false);
  });
});

/**
 * The invariant the client relies on to distinguish "never raced" from "raced": the season
 * span is null exactly when the count is zero. It is asserted on the fixture rather than
 * enforced by the schema, because a cross-field refinement would turn a data anomaly into
 * a 500 for the entire directory — `queries/directory.test.ts` asserts it against the live
 * database, which is where a violation would actually originate.
 */
describe('the fixture holds the span/count invariant the client depends on', () => {
  it.each(driverListFixture.drivers)('driver $ref', (row) => {
    expect(row.firstSeason === null).toBe(row.races === 0);
    expect(row.lastSeason === null).toBe(row.races === 0);
  });

  it.each(teamListFixture.teams)('team $ref', (row) => {
    expect(row.firstSeason === null).toBe(row.races === 0);
    expect(row.lastSeason === null).toBe(row.races === 0);
  });

  it.each(circuitListFixture.circuits)('circuit $ref', (row) => {
    expect(row.firstYear === null).toBe(row.racesWithResults === 0);
    expect(row.lastYear === null).toBe(row.racesWithResults === 0);
    // A venue can hold rounds it has not yet raced; it cannot hold results it never held.
    expect(row.racesWithResults).toBeLessThanOrEqual(row.roundsHeld);
  });
});
