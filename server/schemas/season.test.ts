import { describe, expect, it } from 'vitest';
import { progressionFixture, seasonFixture, seasonListFixture } from './season.fixture';
import {
  championshipPointsSchema,
  driverStandingSchema,
  seasonListSchema,
  seasonRoundSchema,
  seasonSchema,
  standingsProgressionSchema,
  yearParamSchema,
} from './season';

describe('server/schemas/season — the contracts', () => {
  it('accepts the season fixture', () => {
    expect(seasonSchema.safeParse(seasonFixture).success).toBe(true);
  });

  it('accepts the season-list fixture', () => {
    expect(seasonListSchema.safeParse(seasonListFixture).success).toBe(true);
  });

  it('accepts the progression fixture', () => {
    expect(standingsProgressionSchema.safeParse(progressionFixture).success).toBe(true);
  });

  it('rejects an unknown key anywhere (strictObject, so drift is a 500 not a render)', () => {
    const drifted = {
      ...seasonFixture,
      standings: {
        ...seasonFixture.standings,
        drivers: [{ ...seasonFixture.standings.drivers[0], teamColor: '#00D7B6' }],
      },
    };
    expect(seasonSchema.safeParse(drifted).success).toBe(false);
  });

  /**
   * The regression that matters most in this file. `src/lib/entityColor.ts` needs exactly
   * one field — `reference` — and a brand colour in the payload would be a second source
   * of truth beside `src/styles/entity.css` that still renders. Asserted structurally
   * rather than by reading the source, so adding the field anywhere fails here.
   */
  it('has no colour field on any entity in any payload', () => {
    const text = JSON.stringify([seasonFixture, seasonListFixture, progressionFixture]);
    expect(text).not.toMatch(/color|colour|#[0-9a-fA-F]{6}/i);
  });
});

describe('championship points — the era cases', () => {
  it('accepts half points (awarded for shortened races since 1975)', () => {
    expect(championshipPointsSchema.safeParse(71.5).success).toBe(true);
  });

  it('rejects a negative total — a penalty is applied by the snapshot, never by us', () => {
    expect(championshipPointsSchema.safeParse(-1).success).toBe(false);
  });

  it('accepts zero, which is what an excluded entry reads', () => {
    expect(championshipPointsSchema.safeParse(0).success).toBe(true);
  });
});

describe('a null position is not a fault', () => {
  const base = seasonFixture.standings.drivers[2];

  it('accepts a driver with no ranked position and no best finish', () => {
    expect(driverStandingSchema.safeParse(base).success).toBe(true);
  });

  it('accepts an excluded driver who keeps their points (1997 Schumacher)', () => {
    expect(
      driverStandingSchema.safeParse({
        ...base,
        driverRef: 'michael_schumacher',
        forename: 'Michael',
        surname: 'Schumacher',
        points: 78,
        wins: 5,
        position: null,
        adjustment: 'excluded',
      }).success,
    ).toBe(true);
  });

  it('rejects position 0 — positions are 1-based and 0 would sort first', () => {
    expect(driverStandingSchema.safeParse({ ...base, position: 0 }).success).toBe(false);
  });
});

describe('a round is identified by its number', () => {
  const round = seasonFixture.rounds[0];

  it('rejects a null round number — a cancelled round is a separate list (trap 15)', () => {
    expect(seasonRoundSchema.safeParse({ ...round, round: null }).success).toBe(false);
  });

  it('rejects round 0', () => {
    expect(seasonRoundSchema.safeParse({ ...round, round: 0 }).success).toBe(false);
  });

  it('accepts a scheduled round with no results and no winner', () => {
    expect(seasonRoundSchema.safeParse(seasonFixture.rounds[2]).success).toBe(true);
  });

  /**
   * Three races in the database have two `position = 1` rows — shared drives, verified by
   * query: 1951 French GP, 1956 Argentine GP, 1957 British GP. The contract has to admit
   * them or the second driver of each pair disappears without a trace.
   */
  it('accepts a shared drive — two winners splitting the points (1951 French GP)', () => {
    const parsed = seasonRoundSchema.safeParse({
      round: 4,
      name: 'French Grand Prix',
      date: '1951-07-01',
      circuitRef: 'reims',
      circuitName: 'Reims-Gueux',
      hasResults: true,
      hasSprint: false,
      hasLapData: false,
      winners: [
        {
          driverRef: 'fangio',
          code: null,
          forename: 'Juan',
          surname: 'Fangio',
          team: { ref: 'alfa', name: 'Alfa Romeo' },
          points: 5,
        },
        {
          driverRef: 'fagioli',
          code: null,
          forename: 'Luigi',
          surname: 'Fagioli',
          team: { ref: 'alfa', name: 'Alfa Romeo' },
          points: 4,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

/**
 * S-4. These are the cases `z.coerce.number()` would have let through, each of which is a
 * different URL for one page.
 */
describe('yearParamSchema — rejects, never coerces', () => {
  it.each([
    ['1950', 1950],
    ['2026', 2026],
    ['1996', 1996],
  ])('accepts %s', (input, expected) => {
    const parsed = yearParamSchema.safeParse(input);
    expect(parsed.success && parsed.data).toBe(expected);
  });

  it.each([
    ['', 'empty string — z.coerce.number() reads this as 0'],
    ['abc', 'not a number at all'],
    ['0x7c6', 'hexadecimal 1990'],
    ['1990.0', 'a float that rounds to a valid year'],
    [' 1990 ', 'surrounding whitespace'],
    ['+1990', 'a signed year'],
    ['-1990', 'a negative year'],
    ['19900', 'five digits'],
    ['990', 'three digits'],
    ['1e3', 'exponent notation'],
    ['1949', 'four digits, below the first season'],
    ['1950abc', 'a valid prefix'],
  ])('rejects %s (%s)', (input) => {
    expect(yearParamSchema.safeParse(input).success).toBe(false);
  });

  it('rejects a non-string, so an array param cannot slip through', () => {
    expect(yearParamSchema.safeParse(['1990']).success).toBe(false);
    expect(yearParamSchema.safeParse(1990).success).toBe(false);
  });
});
