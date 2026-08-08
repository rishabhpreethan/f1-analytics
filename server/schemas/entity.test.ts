import { describe, expect, it } from 'vitest';
import { circuitSchema } from './circuit';
import { driverSchema } from './driver';
import { referenceParamSchema } from './entity';
import { circuitFixture, driverFixture, teamFixture } from './entity.fixture';
import { teamSchema } from './team';

/**
 * The entity response contracts, exercised without a database so CI sees them.
 *
 * These assert the two things a schema can be wrong about in a way nothing else catches:
 * **what it accepts** (`referenceParamSchema` is the only user input on this surface) and
 * **what it refuses to let mean two things** — a coverage-limited count that could be
 * mistaken for a measured zero, a nullable that must stay nullable.
 */

describe('referenceParamSchema — S-4, reject rather than coerce', () => {
  it.each(['alonso', 'max_verstappen', 'campbell-jones', 'brabham-alfa_romeo', 'monza', 'a'])(
    'accepts %s',
    (reference) => {
      expect(referenceParamSchema.safeParse(reference).success).toBe(true);
    },
  );

  /**
   * The measured reason the pattern is not `[a-z0-9_-]`. Three driver references in this
   * database carry an uppercase letter, and a lowercase-only allowlist would answer 400 on
   * all three — a defect nobody would find, because nobody types those URLs by hand.
   */
  it.each(['scott_Brown', 'Changy', 'Cannoc'])(
    'accepts the uppercase reference %s',
    (reference) => {
      expect(referenceParamSchema.safeParse(reference).success).toBe(true);
    },
  );

  it.each([
    ['', 'empty'],
    [' alonso', 'leading space'],
    ['alonso ', 'trailing space'],
    ['max verstappen', 'an internal space'],
    ['max.verstappen', 'a dot'],
    ['max/verstappen', 'a path separator'],
    ['../../etc/passwd', 'path traversal'],
    ["alonso'--", 'a SQL fragment'],
    ['alonso;DROP TABLE driver', 'a statement terminator'],
    ['<script>', 'markup'],
    ['dräger', 'a non-ASCII letter'],
    ['%20', 'a percent escape as a literal'],
    ['a'.repeat(33), '33 characters'],
  ])('rejects %s (%s)', (reference) => {
    expect(referenceParamSchema.safeParse(reference).success).toBe(false);
  });

  /**
   * The format's ceiling, not the data's. The longest reference in the archive is 20
   * characters; the schema admits 32 so a well-formed reference the dataset does not hold
   * is a **404** and only a malformed one is a 400 (ARCHITECTURE.md §6 convention 2).
   */
  it('admits the format`s length rather than the data`s', () => {
    expect(referenceParamSchema.safeParse('a'.repeat(32)).success).toBe(true);
  });
});

describe('driverSchema', () => {
  it('accepts the fixture', () => {
    expect(driverSchema.safeParse(driverFixture).success).toBe(true);
  });

  it('is strict — an unknown field is a failure, not silently carried', () => {
    expect(driverSchema.safeParse({ ...driverFixture, extra: 1 }).success).toBe(false);
  });

  /**
   * `code` is null for 774 of 881 drivers and must stay expressible as null. A schema that
   * required a string would push a surface into inventing one from the surname — which
   * would render `HÄK` for a driver the timing screens called `HAK`.
   */
  it('allows a null driver code rather than forcing a placeholder', () => {
    const parsed = driverSchema.safeParse({
      ...driverFixture,
      driver: { ...driverFixture.driver, code: null },
    });
    expect(parsed.success).toBe(true);
  });

  it('allows a null date of birth, and the ages that depend on it', () => {
    const parsed = driverSchema.safeParse({
      ...driverFixture,
      driver: { ...driverFixture.driver, dateOfBirth: null },
      career: { ...driverFixture.career, ageAtFirstRace: null, ageAtLastRace: null },
    });
    expect(parsed.success).toBe(true);
  });

  /**
   * The DR-4 rule the payload exists to preserve: a race the metric does not apply to
   * carries `null`, never `0`. `0` means the car finished exactly where it started.
   */
  it('allows a null positionsGained on a race, and a signed value otherwise', () => {
    const races = driverFixture.races.map((race) => ({ ...race, positionsGained: null }));
    expect(driverSchema.safeParse({ ...driverFixture, races }).success).toBe(true);
    const negative = driverFixture.races.map((race) => ({ ...race, positionsGained: -12 }));
    expect(driverSchema.safeParse({ ...driverFixture, races: negative }).success).toBe(true);
  });

  it('refuses a negative count in the totals', () => {
    const parsed = driverSchema.safeParse({
      ...driverFixture,
      totals: { ...driverFixture.totals, wins: -1 },
    });
    expect(parsed.success).toBe(false);
  });
});

describe('teamSchema', () => {
  it('accepts the fixture', () => {
    expect(teamSchema.safeParse(teamFixture).success).toBe(true);
  });

  it('is strict — an unknown field is a failure', () => {
    expect(teamSchema.safeParse({ ...teamFixture, extra: 1 }).success).toBe(false);
  });

  /**
   * 1950–1957 had no Constructors' Championship, so a season must be able to say "no
   * championship" rather than "zero points" — which would read as a team that scored
   * nothing.
   */
  it('allows a season with no constructors championship', () => {
    const seasons = teamFixture.seasons.map((season) => ({
      ...season,
      points: null,
      position: null,
      championshipWins: null,
      hasTeamStandings: false,
      isChampion: false,
    }));
    expect(teamSchema.safeParse({ ...teamFixture, seasons }).success).toBe(true);
  });

  /** A scoreless season has no share to state; null is the answer, not 0. */
  it('allows a null race-points share', () => {
    const seasons = teamFixture.seasons.map((season) => ({
      ...season,
      driverRacePointsTotal: 0,
      drivers: season.drivers.map((driver) => ({
        ...driver,
        racePoints: 0,
        racePointsShare: null,
      })),
    }));
    expect(teamSchema.safeParse({ ...teamFixture, seasons }).success).toBe(true);
  });

  it('refuses a share outside 0–1', () => {
    const seasons = teamFixture.seasons.map((season) => ({
      ...season,
      drivers: season.drivers.map((driver) => ({ ...driver, racePointsShare: 1.5 })),
    }));
    expect(teamSchema.safeParse({ ...teamFixture, seasons }).success).toBe(false);
  });
});

describe('circuitSchema', () => {
  it('accepts the fixture', () => {
    expect(circuitSchema.safeParse(circuitFixture).success).toBe(true);
  });

  it('is strict — an unknown field is a failure', () => {
    expect(circuitSchema.safeParse({ ...circuitFixture, extra: 1 }).success).toBe(false);
  });

  it('refuses coordinates outside their range', () => {
    const parsed = circuitSchema.safeParse({
      ...circuitFixture,
      circuit: { ...circuitFixture.circuit, latitude: 91 },
    });
    expect(parsed.success).toBe(false);
  });

  /**
   * An empty `poleSitters` beside `hasQualifying: false` is the pre-1994 state and must be
   * expressible; the same array beside `hasQualifying: true` would be a different claim.
   */
  it('allows a race with results and no pole sitter', () => {
    const race = circuitFixture.races.find((row) => !row.hasQualifying);
    expect(race?.hasResults).toBe(true);
    expect(race?.poleSitters).toEqual([]);
  });
});
