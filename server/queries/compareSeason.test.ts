import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { invalidateMemo } from '../cache/memo';
import { DB_PATH } from '../config';
import { __resetDb } from '../db';
import { compareSeasonsSchema } from '../schemas/compare';
import type { LensEntryRow, LensProgressionRow, LensSeatRow } from './compareSeason';
import {
  SQL_SEASON_LENS_ENTRIES,
  SQL_SEASON_LENS_PROGRESSION,
  SQL_SEASON_LENS_ROUNDS,
  SQL_SEASON_LENS_SEAT,
  SQL_SEASON_LENS_SYSTEM,
  buildEntrant,
  collapseLensEntries,
  collapseSeatRows,
  indexProgression,
  readCompareSeasons,
  seatSegments,
} from './compareSeason';

/**
 * The season lens.
 *
 * **The other seat is what this file is mostly about.** It is the only genuinely new idea in the
 * payload, and its hard cases — a mid-season team change, a team that fielded more than one other
 * car, a round the principal missed, a season the driver did not race at all — are each rare enough
 * that a test against live data would pass on the common case and say nothing about the rest. So
 * they are stated here as six-row fixtures, and the live block pins the four seasons the surface
 * was designed against.
 */

const hasDatabase = existsSync(DB_PATH);

const entryRow = (overrides: Partial<LensEntryRow> = {}): LensEntryRow => ({
  driverRef: 'principal',
  year: 2020,
  round: 1,
  sessionId: 1,
  teamId: 1,
  teamRef: 'red',
  position: 5,
  status: 0,
  isClassified: 1,
  ...overrides,
});

const seatRow = (overrides: Partial<LensSeatRow> = {}): LensSeatRow => ({
  sessionId: 1,
  teamId: 1,
  driverRef: 'mate',
  position: 8,
  isClassified: 1,
  ...overrides,
});

const snapshot = (
  driverRef: string,
  round: number,
  points: number,
  position: number | null = 1,
): LensProgressionRow => ({ driverRef, year: 2020, round, points, position });

/** Assemble the inputs `buildEntrant` takes, from rows rather than from a database. */
function inputsFor(options: {
  rounds?: number;
  entries?: LensEntryRow[];
  seats?: LensSeatRow[];
  progression?: LensProgressionRow[];
  complete?: boolean;
  bestResults?: number | null;
}) {
  const roundCount = options.rounds ?? 2;
  const entries = collapseLensEntries(options.entries ?? []);
  return {
    year: 2020,
    roundCount,
    complete: options.complete ?? true,
    systemName: 'Test Championship',
    bestResults: options.bestResults ?? null,
    rounds: Array.from({ length: roundCount }, (_, i) => ({
      number: i + 1,
      name: `Round ${String(i + 1)}`,
    })),
    entries: new Map(
      entries.map((entry) => [
        `${entry.driverRef} ${String(entry.year)} ${String(entry.round)}`,
        entry,
      ]),
    ),
    cars: collapseSeatRows(options.seats ?? []),
    progression: indexProgression(options.progression ?? []),
    label: (ref: string) => `Name ${ref}`,
  };
}

describe('collapseLensEntries', () => {
  it('folds two classification rows of one round into one entry (trap 17)', () => {
    const entries = collapseLensEntries([entryRow({ position: 7 }), entryRow({ position: 3 })]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.finish).toBe(3);
  });

  /** `position` is populated on all 26,093 race rows; only `is_classified` says it is a result. */
  it('reports no finish for a car that held a position without being classified (trap 3)', () => {
    const entries = collapseLensEntries([entryRow({ position: 14, isClassified: 0, status: 11 })]);
    expect(entries[0]?.finish).toBeNull();
  });

  it.each([30, 40])('produces no entry for status %i — the driver did not start', (status) => {
    expect(collapseLensEntries([entryRow({ status, isClassified: 0 })])).toEqual([]);
  });

  it('keeps a classified row of a round whose other row was a non-start', () => {
    const entries = collapseLensEntries([
      entryRow({ status: 30, isClassified: 0 }),
      entryRow({ status: 0, position: 4 }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.finish).toBe(4);
  });
});

describe('collapseSeatRows', () => {
  it('groups the other cars by session and team', () => {
    const cars = collapseSeatRows([seatRow(), seatRow({ driverRef: 'other' })]);
    expect(cars.get('1 1')?.map((car) => car.driverRef)).toEqual(['mate', 'other']);
  });

  it('collapses one driver’s two rows in one race to their best classified finish', () => {
    const cars = collapseSeatRows([
      seatRow({ position: 9 }),
      seatRow({ position: 4 }),
      seatRow({ position: 2, isClassified: 0 }),
    ]);
    expect(cars.get('1 1')).toEqual([{ driverRef: 'mate', finish: 4 }]);
  });

  it('separates two teams in one session', () => {
    const cars = collapseSeatRows([seatRow(), seatRow({ teamId: 2, driverRef: 'rival' })]);
    expect([...cars.keys()]).toEqual(['1 1', '1 2']);
  });
});

describe('seatSegments', () => {
  it('runs one segment per contiguous occupant, numbering rounds from one', () => {
    expect(seatSegments(['a', 'a', 'b', 'b', 'b'], (ref) => ref.toUpperCase())).toEqual([
      { ref: 'a', label: 'A', fromRound: 1, toRound: 2 },
      { ref: 'b', label: 'B', fromRound: 3, toRound: 5 },
    ]);
  });

  /** A null run is a statement — *this car had no single other seat here* — not a gap. */
  it('carries the empty runs, with an empty label rather than a name for nobody', () => {
    expect(seatSegments(['a', null, null], (ref) => ref)).toEqual([
      { ref: 'a', label: 'a', fromRound: 1, toRound: 1 },
      { ref: null, label: '', fromRound: 2, toRound: 3 },
    ]);
  });

  it('reports nothing for a season with no rounds', () => {
    expect(seatSegments([], (ref) => ref)).toEqual([]);
  });
});

describe('buildEntrant — the arrays', () => {
  it('is one entry per numbered round, whether or not the round has been run', () => {
    const entrant = buildEntrant(
      'principal',
      inputsFor({
        rounds: 4,
        entries: [entryRow({ round: 1 })],
        progression: [snapshot('principal', 1, 10, 3)],
      }),
    );
    expect(entrant.points).toEqual([10, null, null, null]);
    expect(entrant.standing).toEqual([3, null, null, null]);
    expect(entrant.teamAt).toEqual(['red', null, null, null]);
    expect(entrant.finish).toEqual([5, null, null, null]);
  });

  /** The championship total is defined at every round once a driver is in the standings. */
  it('keeps the line flat through a round the driver missed', () => {
    const entrant = buildEntrant(
      'principal',
      inputsFor({
        rounds: 2,
        entries: [entryRow({ round: 1 })],
        progression: [snapshot('principal', 1, 10, 3), snapshot('principal', 2, 10, 4)],
      }),
    );
    expect(entrant.points).toEqual([10, 10]);
    expect(entrant.teamAt).toEqual(['red', null]);
    expect(entrant.finish).toEqual([5, null]);
  });

  it('reads points from the snapshot rather than summing anything (trap 4)', () => {
    const entrant = buildEntrant(
      'principal',
      inputsFor({
        rounds: 1,
        entries: [entryRow()],
        progression: [snapshot('principal', 1, 9.5, 1)],
      }),
    );
    expect(entrant.points).toEqual([9.5]);
  });

  it('names every team of a split season, in round order', () => {
    const entrant = buildEntrant(
      'principal',
      inputsFor({
        rounds: 2,
        entries: [
          entryRow({ round: 1, teamId: 1, teamRef: 'first' }),
          entryRow({ round: 2, teamId: 2, teamRef: 'second' }),
        ],
      }),
    );
    expect(entrant.teamRefs).toEqual(['first', 'second']);
    expect(entrant.teamAt).toEqual(['first', 'second']);
  });

  /**
   * **A designed state, not an empty array.** "Fangio did not race in 2026" and "the payload
   * failed" look identical from an absent entrant, and only one of them should reach a reader.
   */
  it('reports a driver who did not race that season as entered: false, with every array null', () => {
    const entrant = buildEntrant('absentee', inputsFor({ rounds: 3 }));
    expect(entrant.entered).toBe(false);
    expect(entrant.teamRefs).toEqual([]);
    expect(entrant.points).toEqual([null, null, null]);
    expect(entrant.standing).toEqual([null, null, null]);
    expect(entrant.teamAt).toEqual([null, null, null]);
    expect(entrant.seat.occupant).toEqual([null, null, null]);
    expect(entrant.seat.carsBeside).toEqual([null, null, null]);
    expect(entrant.seat.segments).toEqual([{ ref: null, label: '', fromRound: 1, toRound: 3 }]);
  });
});

describe('buildEntrant — the other seat', () => {
  it('names the one other car and carries its own championship total', () => {
    const entrant = buildEntrant(
      'principal',
      inputsFor({
        rounds: 1,
        entries: [entryRow()],
        seats: [seatRow({ position: 8 })],
        progression: [snapshot('principal', 1, 10, 3), snapshot('mate', 1, 4, 9)],
      }),
    );
    expect(entrant.seat.occupant).toEqual(['mate']);
    expect(entrant.seat.points).toEqual([4]);
    expect(entrant.seat.finish).toEqual([8]);
    expect(entrant.seat.carsBeside).toEqual([1]);
    expect(entrant.seat.segments).toEqual([
      { ref: 'mate', label: 'Name mate', fromRound: 1, toRound: 1 },
    ]);
  });

  /**
   * **A team that fielded several other cars has no single other seat**, and the occupant is null
   * rather than a guess. 1957's Maserati entered between four and eleven other cars at every round
   * Fangio started; the Indianapolis 500 once had 29 Kurtis Krafts in it.
   */
  it('names nobody when the team fielded more than one other car, and says how many', () => {
    const entrant = buildEntrant(
      'principal',
      inputsFor({
        rounds: 1,
        entries: [entryRow()],
        seats: [
          seatRow({ driverRef: 'a' }),
          seatRow({ driverRef: 'b' }),
          seatRow({ driverRef: 'c' }),
        ],
      }),
    );
    expect(entrant.seat.occupant).toEqual([null]);
    expect(entrant.seat.points).toEqual([null]);
    expect(entrant.seat.carsBeside).toEqual([3]);
  });

  it('reports a lone car as no seat, with a measured zero beside it', () => {
    const entrant = buildEntrant(
      'principal',
      inputsFor({ rounds: 1, entries: [entryRow()], seats: [] }),
    );
    expect(entrant.seat.occupant).toEqual([null]);
    expect(entrant.seat.carsBeside).toEqual([0]);
  });

  /** The seat moves with the principal; there is no special case for a mid-season change. */
  it('follows the principal through a mid-season team change', () => {
    const entrant = buildEntrant(
      'principal',
      inputsFor({
        rounds: 2,
        entries: [
          entryRow({ round: 1, sessionId: 1, teamId: 1, teamRef: 'red' }),
          entryRow({ round: 2, sessionId: 2, teamId: 2, teamRef: 'blue' }),
        ],
        seats: [
          seatRow({ sessionId: 1, teamId: 1, driverRef: 'red_mate' }),
          seatRow({ sessionId: 2, teamId: 2, driverRef: 'blue_mate' }),
        ],
      }),
    );
    expect(entrant.seat.occupant).toEqual(['red_mate', 'blue_mate']);
    expect(entrant.seat.segments.map((segment) => segment.ref)).toEqual(['red_mate', 'blue_mate']);
  });

  it('leaves a round the principal missed out of the seat entirely', () => {
    const entrant = buildEntrant(
      'principal',
      inputsFor({
        rounds: 2,
        entries: [entryRow({ round: 1 })],
        seats: [seatRow(), seatRow({ sessionId: 2, driverRef: 'mate' })],
      }),
    );
    expect(entrant.seat.occupant).toEqual(['mate', null]);
    expect(entrant.seat.carsBeside).toEqual([1, null]);
  });

  /** The occupant's points are their own, so the line steps rather than accumulating a seat. */
  it('steps to the new occupant’s own total when the seat changes hands', () => {
    const entrant = buildEntrant(
      'principal',
      inputsFor({
        rounds: 2,
        entries: [entryRow({ round: 1, sessionId: 1 }), entryRow({ round: 2, sessionId: 2 })],
        seats: [
          seatRow({ sessionId: 1, driverRef: 'first_mate' }),
          seatRow({ sessionId: 2, driverRef: 'second_mate' }),
        ],
        progression: [snapshot('first_mate', 1, 40, 2), snapshot('second_mate', 2, 3, 18)],
      }),
    );
    expect(entrant.seat.points).toEqual([40, 3]);
    expect(entrant.seat.occupant).toEqual(['first_mate', 'second_mate']);
  });
});

describe('the statements this lens runs', () => {
  const STATEMENTS = {
    SQL_SEASON_LENS_ENTRIES,
    SQL_SEASON_LENS_SEAT,
    SQL_SEASON_LENS_ROUNDS,
    SQL_SEASON_LENS_SYSTEM,
    SQL_SEASON_LENS_PROGRESSION,
  };

  it.each(Object.entries(STATEMENTS))('%s reaches neither lap nor pit_stop', (_name, sql) => {
    expect(sql).not.toMatch(/\blap\b|\bpit_stop\b/i);
  });

  it.each(Object.entries(STATEMENTS))('%s interpolates no value', (_name, sql) => {
    expect(sql).not.toMatch(/\$\{(?!PICKED_CTE)/);
  });

  it('takes only numbered rounds, so a cancelled round is never on the axis (trap 15)', () => {
    expect(SQL_SEASON_LENS_ROUNDS).toMatch(/r\.number IS NOT NULL/);
    expect(SQL_SEASON_LENS_ENTRIES).toMatch(/r\.number IS NOT NULL/);
  });

  /** Trap 26, and §6.5's `last_of_round`: 2026 writes four snapshots per round. */
  it('takes one snapshot per round, joined on year and round rather than season_id', () => {
    expect(SQL_SEASON_LENS_PROGRESSION).not.toMatch(/season_id/);
    expect(SQL_SEASON_LENS_PROGRESSION).toMatch(/max\(session_number\)/);
  });
});

/* ================================================================================================
 * Against the live database.
 * ============================================================================================== */

describe.skipIf(!hasDatabase)('the season lens against the live database', () => {
  afterAll(() => {
    invalidateMemo();
    __resetDb();
  });

  const lensFor = (year: number, refs: string[]) =>
    readCompareSeasons(refs)?.seasons.find((season) => season.year === year);

  it('answers null for a slug no driver holds', () => {
    expect(readCompareSeasons(['not_a_driver'])).toBeNull();
  });

  it('answers null for a driver in the dataset who never started a Grand Prix', () => {
    expect(readCompareSeasons(['ecclestone'])).toBeNull();
  });

  it('produces a payload that satisfies its own schema', () => {
    const parsed = compareSeasonsSchema.safeParse(
      readCompareSeasons(['hamilton', 'rosberg', 'max_verstappen', 'fangio']),
    );
    expect(parsed.success).toBe(true);
  });

  it('covers every season the selection entered, oldest first', () => {
    const seasons = readCompareSeasons(['fangio', 'max_verstappen'])?.seasons ?? [];
    const years = seasons.map((season) => season.year);
    expect(years[0]).toBe(1950);
    expect(years.at(-1)).toBe(2026);
    expect([...years].sort((x, y) => x - y)).toEqual(years);
    /* Fangio 1950–58 without 1952, Verstappen 2015–26. */
    expect(years).toHaveLength(20);
    expect(years).not.toContain(1952);
  });

  it('publishes 22 numbered rounds for 2026, not 24 calendar rows (trap 15)', () => {
    const lens = lensFor(2026, ['hamilton']);
    expect(lens?.rounds).toHaveLength(22);
    expect(lens?.complete).toBe(false);
  });

  it('marks a finished season finished', () => {
    expect(lensFor(1957, ['fangio'])?.complete).toBe(true);
  });

  /** Trap 4's one exemption, and the rule that explains a flat line. */
  it('publishes the season’s counting rule, so a flat line can be explained', () => {
    const lens = lensFor(1957, ['fangio']);
    expect(lens?.bestResults).toBe(5);
    expect(lens?.systemName).toBe('1954 - 1957 Championship');
    expect(lensFor(2021, ['hamilton'])?.bestResults).toBeNull();
  });

  it('reproduces the 2021 standings after rounds 1 and 5', () => {
    const lens = lensFor(2021, ['hamilton', 'max_verstappen']);
    const hamilton = lens?.entrants.find((entrant) => entrant.ref === 'hamilton');
    const verstappen = lens?.entrants.find((entrant) => entrant.ref === 'max_verstappen');
    expect(hamilton?.points[0]).toBe(25);
    expect(verstappen?.points[4]).toBe(105);
    expect(hamilton?.points[4]).toBe(101);
    expect(verstappen?.standing[4]).toBe(1);
  });

  it('keeps every array the length of the round list', () => {
    for (const season of readCompareSeasons(['hamilton', 'fangio'])?.seasons ?? []) {
      const n = season.rounds.length;
      for (const entrant of season.entrants) {
        expect(entrant.teamAt).toHaveLength(n);
        expect(entrant.points).toHaveLength(n);
        expect(entrant.standing).toHaveLength(n);
        expect(entrant.finish).toHaveLength(n);
        expect(entrant.seat.occupant).toHaveLength(n);
        expect(entrant.seat.points).toHaveLength(n);
        expect(entrant.seat.finish).toHaveLength(n);
        expect(entrant.seat.carsBeside).toHaveLength(n);
      }
    }
  });

  it('carries one entrant per selected driver, in the order asked, raced or not', () => {
    const lens = lensFor(2026, ['fangio', 'hamilton']);
    expect(lens?.entrants.map((entrant) => [entrant.ref, entrant.entered])).toEqual([
      ['fangio', false],
      ['hamilton', true],
    ]);
  });

  it('follows Verstappen from Toro Rosso to Red Bull at round 5 of 2016, and the seat with him', () => {
    const lens = lensFor(2016, ['max_verstappen']);
    const entrant = lens?.entrants[0];
    expect(entrant?.teamRefs).toEqual(['toro_rosso', 'red_bull']);
    expect(entrant?.teamAt[3]).toBe('toro_rosso');
    expect(entrant?.teamAt[4]).toBe('red_bull');
    expect(entrant?.seat.segments.map((segment) => segment.ref)).toEqual(['sainz', 'ricciardo']);
    expect(entrant?.seat.segments[0]).toEqual({
      ref: 'sainz',
      label: 'Carlos Sainz',
      fromRound: 1,
      toRound: 4,
    });
  });

  /**
   * ⚠ **Iwasa is not Verstappen's 2026 team-mate on this lens, and that is correct.** His only Red
   * Bull appearances that season are two FP1 sessions, and practice holds no result at all
   * (trap 2). Reading `round_entry` would have invented a third car for round 7 and broken the
   * seat model there.
   */
  it('does not admit a practice-only entry as a car beside the principal', () => {
    const entrant = lensFor(2026, ['max_verstappen'])?.entrants[0];
    expect(entrant?.seat.occupant.slice(0, 10)).toEqual(new Array<string>(10).fill('hadjar'));
    expect(entrant?.seat.carsBeside.slice(0, 10)).toEqual(new Array<number>(10).fill(1));
  });

  /** A works team of the 1950s has no single other seat, and the count says so. */
  it('names nobody in a many-car season and reports how many cars there were', () => {
    const entrant = lensFor(1957, ['fangio'])?.entrants[0];
    expect(entrant?.seat.occupant.every((ref) => ref === null)).toBe(true);
    expect(entrant?.seat.carsBeside[0]).toBe(6);
    expect(entrant?.seat.segments).toEqual([{ ref: null, label: '', fromRound: 1, toRound: 8 }]);
  });

  it('leaves the rounds a season has not run as nulls after the ones it has', () => {
    const entrant = lensFor(2026, ['hamilton'])?.entrants[0];
    expect(entrant?.points.slice(0, 10).every((value) => value !== null)).toBe(true);
    expect(entrant?.points.slice(10).every((value) => value === null)).toBe(true);
  });

  it('gives byte-identical payloads on two calls', () => {
    expect(JSON.stringify(readCompareSeasons(['fangio', 'hamilton']))).toBe(
      JSON.stringify(readCompareSeasons(['fangio', 'hamilton'])),
    );
  });
});
