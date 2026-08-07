import { describe, expect, it } from 'vitest';
import {
  laps2026Fixture,
  race1988Fixture,
  race1996Fixture,
  race2026Fixture,
  stints2026Fixture,
} from './race.fixture';
import {
  durationMsSchema,
  lapNumberSchema,
  lapRowSchema,
  raceClassificationRowSchema,
  raceLapsSchema,
  raceSchema,
  raceStintsSchema,
  roundParamSchema,
  stintSchema,
} from './race';

describe('server/schemas/race — the contracts', () => {
  it.each([
    ['1988 R1 — classification only, the common case', race1988Fixture],
    ['1996 R1 — laps, no pit data', race1996Fixture],
    ['2026 R1 — everything', race2026Fixture],
  ])('accepts %s', (_label, fixture) => {
    const parsed = raceSchema.safeParse(fixture);
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  it('accepts the lap fixture', () => {
    const parsed = raceLapsSchema.safeParse(laps2026Fixture);
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  it('accepts the stint fixture', () => {
    const parsed = raceStintsSchema.safeParse(stints2026Fixture);
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  it('rejects an unknown key anywhere (strictObject, so drift is a 500 not a render)', () => {
    const drifted = {
      ...race2026Fixture,
      classification: [{ ...race2026Fixture.classification[0], teamColor: '#00D7B6' }],
    };
    expect(raceSchema.safeParse(drifted).success).toBe(false);
  });

  /**
   * The same structural regression `season.test.ts` makes, for the same reason: a brand
   * colour in the payload would be a second source of truth beside `src/styles/entity.css`
   * that still renders. Asserted over the serialised fixtures so adding the field
   * *anywhere* — including inside a lap row — fails here.
   */
  it('has no colour field on any entity in any race payload', () => {
    const text = JSON.stringify([
      race1988Fixture,
      race1996Fixture,
      race2026Fixture,
      laps2026Fixture,
      stints2026Fixture,
    ]);
    expect(text).not.toMatch(/color|colour|#[0-9a-fA-F]{6}/i);
  });

  /**
   * Trap 11 / DL-3, asserted structurally rather than by reading the query. An internal
   * integer id in a payload is the thing that ends up in a URL.
   */
  it('exposes no internal integer id', () => {
    const keys = new Set<string>();
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const item of value) walk(item);
        return;
      }
      if (value !== null && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          keys.add(key);
          walk(child);
        }
      }
    };
    walk([race2026Fixture, laps2026Fixture, stints2026Fixture]);
    expect([...keys].filter((key) => /^id$|Id$|entryId|sessionId/.test(key))).toEqual([]);
  });
});

/* ==================================================================================
 * The collision rules. Each of these exists because "absent", "zero" and "not
 * recorded" sharing one representation has already shipped three defects here.
 * ================================================================================== */

describe('the three-state grid — `grid = 0` is a pit-lane start, not "no position"', () => {
  const base = race2026Fixture.classification[0];

  it('accepts a real grid slot', () => {
    expect(
      raceClassificationRowSchema.safeParse({ ...base, gridPosition: 3, gridStatus: 'grid' })
        .success,
    ).toBe(true);
  });

  it('accepts a pit-lane start, which carries no position', () => {
    expect(
      raceClassificationRowSchema.safeParse({
        ...base,
        gridPosition: null,
        gridStatus: 'pitLane',
      }).success,
    ).toBe(true);
  });

  it('accepts an unknown grid, which is distinguishable from a pit-lane start', () => {
    expect(
      raceClassificationRowSchema.safeParse({
        ...base,
        gridPosition: null,
        gridStatus: 'unknown',
      }).success,
    ).toBe(true);
  });

  /**
   * The whole point of the enum: a `0` must never be able to reach a reader as a
   * position. `positive()` refuses it, so the pit-lane case can only be expressed the
   * one way.
   */
  it('rejects a gridPosition of 0 outright — that value has a meaning, not a number', () => {
    expect(
      raceClassificationRowSchema.safeParse({ ...base, gridPosition: 0, gridStatus: 'grid' })
        .success,
    ).toBe(false);
  });

  it('rejects a grid status outside the three', () => {
    expect(raceClassificationRowSchema.safeParse({ ...base, gridStatus: 'pit-lane' }).success).toBe(
      false,
    );
  });
});

describe('a lap row that exists may lack a time or a position', () => {
  it('accepts a null position — 16 race lap rows have one', () => {
    expect(
      lapRowSchema.safeParse({ lap: 6, position: null, timeMs: 85_999, isDeleted: false }).success,
    ).toBe(true);
  });

  it('accepts a null time on a row that exists', () => {
    expect(
      lapRowSchema.safeParse({ lap: 6, position: 12, timeMs: null, isDeleted: false }).success,
    ).toBe(true);
  });

  it('rejects position 0 — there is no P0', () => {
    expect(
      lapRowSchema.safeParse({ lap: 6, position: 0, timeMs: 85_999, isDeleted: false }).success,
    ).toBe(false);
  });

  it('rejects lap 0 — lap numbering starts at 1', () => {
    expect(lapNumberSchema.safeParse(0).success).toBe(false);
    expect(lapNumberSchema.safeParse(1).success).toBe(true);
  });
});

describe('durations', () => {
  it('accepts the red-flag lap that forced the axis ceiling (1,168,144 ms)', () => {
    expect(durationMsSchema.safeParse(1_168_144).success).toBe(true);
  });

  it('accepts the 18-minute pit stop that forced the same treatment (1,081,553 ms)', () => {
    expect(durationMsSchema.safeParse(1_081_553).success).toBe(true);
  });

  it('accepts a full race distance (1988 R1 was 5,766,857 ms)', () => {
    expect(durationMsSchema.safeParse(5_766_857).success).toBe(true);
  });

  it('rejects a negative duration and a non-integer', () => {
    expect(durationMsSchema.safeParse(-1).success).toBe(false);
    expect(durationMsSchema.safeParse(82_091.5).success).toBe(false);
  });
});

describe('a stint may be one lap long — 494 pit stops fall on the lap after another', () => {
  it('accepts a single-lap stint', () => {
    expect(
      stintSchema.safeParse({ stint: 2, fromLap: 4, toLap: 4, laps: 1, endedByStop: 2 }).success,
    ).toBe(true);
  });

  it('accepts the final stint, which no stop ended', () => {
    expect(
      stintSchema.safeParse({ stint: 3, fromLap: 5, toLap: 58, laps: 54, endedByStop: null })
        .success,
    ).toBe(true);
  });

  it('rejects a zero-length stint', () => {
    expect(
      stintSchema.safeParse({ stint: 2, fromLap: 4, toLap: 4, laps: 0, endedByStop: 2 }).success,
    ).toBe(false);
  });
});

describe('the lap range is data, not the bounds of an array', () => {
  it('carries firstLap and lastLap at session level', () => {
    expect(laps2026Fixture.firstLap).toBe(1);
    expect(laps2026Fixture.lastLap).toBe(58);
  });

  /**
   * `d3.ticks([1, 58], 11)` emits 5, 10 … 55 and drops both ends, so a chart cannot
   * recover lap 1 or the final lap from a tick set. It also cannot recover them from a
   * driver's own array: Leclerc retired on lap 22.
   */
  it('carries them per driver too, and a retirement makes them differ from the session', () => {
    const leclerc = laps2026Fixture.drivers.find((d) => d.driverRef === 'leclerc');
    expect(leclerc?.lastLap).toBe(22);
    expect(laps2026Fixture.lastLap).toBe(58);
  });

  it('allows both to be null when the race has no lap rows at all', () => {
    const empty = {
      ...laps2026Fixture,
      firstLap: null,
      lastLap: null,
      lapCount: 0,
      drivers: [],
      pace: {
        timedLaps: 0,
        deletedLaps: 0,
        fastest: null,
        medianMs: null,
        p90Ms: null,
        p99Ms: null,
        slowestMs: null,
      },
    };
    expect(raceLapsSchema.safeParse(empty).success).toBe(true);
  });
});

/* ==================================================================================
 * S-4 — `:round` rejects rather than coerces. These need no database.
 * ================================================================================== */

describe('roundParamSchema — S-4, reject rather than coerce', () => {
  it.each([
    ['1', 1],
    ['9', 9],
    ['10', 10],
    ['22', 22],
    ['24', 24],
    ['50', 50],
  ])('accepts %s', (input, expected) => {
    expect(roundParamSchema.parse(input)).toBe(expected);
  });

  it.each([
    ['0', 'round zero does not exist'],
    ['01', 'a second spelling of round 1'],
    ['001', 'and a third'],
    ['', 'empty — `z.coerce.number()` reads this as 0'],
    [' 1', 'leading space'],
    ['1 ', 'trailing space'],
    ['1.0', 'a float that coerces to 1'],
    ['0x1', 'hexadecimal 1'],
    ['+1', 'signed'],
    ['-1', 'negative'],
    ['1e1', 'exponent notation'],
    ['100', 'three digits'],
    ['51', 'beyond the format ceiling'],
    ['abc', 'not a number'],
    ["1'--", 'a SQL fragment'],
    ['1 OR 1=1', 'an injection attempt'],
    ['１', 'a full-width digit'],
  ])('rejects %s (%s)', (input) => {
    expect(roundParamSchema.safeParse(input).success).toBe(false);
  });

  /**
   * The range is the **format's**, not the data's — 50 rather than 24 — so a well-formed
   * round the season does not hold reaches the query and becomes a 404, while only a
   * malformed one is a 400 (ARCHITECTURE.md §6 convention 2).
   */
  it('accepts a round no season has, so the 404 case stays distinct from the 400', () => {
    expect(roundParamSchema.parse('40')).toBe(40);
  });
});
