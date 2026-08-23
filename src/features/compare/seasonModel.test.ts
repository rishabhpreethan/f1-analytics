import { describe, expect, it } from 'vitest';
import { SEASON_LENS_FIXTURE } from './lensFixture';
import {
  absentFrom,
  FINISH_AXIS_FLOOR,
  finishStrip,
  plotTeamFor,
  racedRounds,
  seasonPairs,
  seatBreaks,
  seatGapSeries,
  seatLabel,
} from './seasonModel';
import type { CompareSeasonLens } from './types';

/**
 * The season lens's pure layer (`DESIGN_SYSTEM.md` §6.6.6.10).
 *
 * **Every assertion here runs against the real fixture**, which is queried from `data/f1.db` and
 * not written by hand. That is deliberate: the two rules most likely to be quietly wrong — a
 * shadow drawn twice, and a seat joined across two occupants — are wrong only for particular
 * shapes of season, and a hand-made fixture would be built from the same assumptions as the code.
 *
 * The four seasons in it were chosen because between them they hold every shape:
 *
 * | Season | What it exercises |
 * |---|---|
 * | **2021** | two principals, two different cars, one clean team-mate each — the ordinary case |
 * | **2016** | two principals **in the same car**, so both shadows must be suppressed; plus a mid-season team change |
 * | **2026** | a season in progress, 10 of 22 rounds raced |
 * | **1957** | best-5-of-8 dropped scores, and a works team fielding up to eleven other cars — no seat at all |
 *
 * ⚠ **Nothing here can say the chart is legible.** jsdom performs no layout. Whether eight lines
 * read as four pairs is named as unverified in `SeasonLens.tsx` and in §6.6.6.11.
 */

const lensFor = (year: number): CompareSeasonLens => {
  const found = SEASON_LENS_FIXTURE.find((entry) => entry.year === year);
  if (found === undefined) throw new Error(`no fixture for ${String(year)}`);
  return found;
};

const name = (ref: string) => ref.toUpperCase();

describe('the fixture premise these tests rest on', () => {
  it('holds the four seasons, queried, with the shapes each was chosen for', () => {
    expect(SEASON_LENS_FIXTURE.map((entry) => entry.year).sort()).toEqual([1957, 2016, 2021, 2026]);
    expect(lensFor(1957).bestResults).toBe(5);
    expect(lensFor(2021).bestResults).toBeNull();
    expect(lensFor(2026).complete).toBe(false);
    expect(lensFor(2021).complete).toBe(true);
  });

  it('carries 1957 net of dropped scores — the flat line is the data, not a bug', () => {
    /*
     * Fangio ends 1957 on 40 points. His gross was 46: rounds 6, 7 and 8 add 9, 6 and 0 gross but
     * only the best five counted, so the published total moves 34 → 40 → 40 while he was finishing
     * on the podium. `driver_championship` publishes the standing, which is what actually stood.
     */
    const fangio = lensFor(1957).entrants.find((entrant) => entrant.ref === 'fangio');
    expect(fangio?.points).toEqual([8, 17, 17, 25, 25, 34, 40, 40]);
  });
});

describe('§6.6.6.10 — a shadow is the other seat, and it never duplicates a principal', () => {
  it('gives each principal one shadow in the ordinary two-car case', () => {
    const pairs = seasonPairs(lensFor(2021), ['hamilton', 'max_verstappen'], name);
    expect(pairs).toHaveLength(2);
    expect(pairs.every((pair) => pair.shadows.length === 1)).toBe(true);
    // Same car: the shadow plots against the principal's team, never its own.
    expect(pairs[0]?.shadows[0]?.teamReference).toBe(pairs[0]?.principal.teamReference);
    expect(pairs[0]?.shadows[0]?.role).toBe('shadow');
    expect(pairs[0]?.principal.role).toBe('principal');
  });

  it('suppresses BOTH shadows when the two principals are each other’s team-mate', () => {
    /*
     * 2016: Hamilton and Rosberg, one Mercedes. Drawing both shadows would put four Mercedes lines
     * on the chart carrying two drivers' data twice — the single worst thing this lens could do,
     * because the duplicate would look like a third and fourth competitor.
     */
    const pairs = seasonPairs(lensFor(2016), ['hamilton', 'rosberg'], name);
    expect(pairs).toHaveLength(2);
    expect(pairs.map((pair) => pair.shadows)).toEqual([[], []]);
  });

  it('keeps the shadow when only one of the two principals is in that car', () => {
    // Add Verstappen — a different car in 2016 — and nothing about the Mercedes pair changes.
    const pairs = seasonPairs(lensFor(2016), ['hamilton', 'rosberg', 'max_verstappen'], name);
    expect(pairs.map((pair) => pair.shadows.length)).toEqual([0, 0, 2]);
  });

  it('gives the shadow a reference that cannot collide with a driver’s', () => {
    const pairs = seasonPairs(lensFor(2021), ['hamilton'], name);
    expect(pairs[0]?.shadows[0]?.reference).toBe('hamilton::seat0');
  });

  it('draws no shadow at all where the car had no single other seat', () => {
    /*
     * 1957's Maserati entered between four and eleven other cars at every round Fangio started.
     * There is no second seat, so there is no dashed line — the modern two-car team is a
     * convention, not a rule of the sport, and inventing a "main team-mate" would be a fabrication.
     */
    const pairs = seasonPairs(lensFor(1957), ['fangio'], name);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.shadows).toEqual([]);
    expect(
      Math.max(...(lensFor(1957).entrants[3]?.seat.carsBeside.map((n) => n ?? 0) ?? [0])),
    ).toBeGreaterThan(1);
  });

  it('drops a driver who did not race that season rather than plotting a flat zero', () => {
    const pairs = seasonPairs(lensFor(1957), ['fangio', 'hamilton'], name);
    expect(pairs.map((pair) => pair.principal.reference)).toEqual(['fangio']);
    expect(absentFrom(lensFor(1957), ['fangio', 'hamilton']).map((row) => row.ref)).toEqual([
      'hamilton',
    ]);
  });
});

describe('§6.6.6.10 — a mid-season team change is made visible, not averaged away', () => {
  it('paints a two-team season in the car the driver raced most', () => {
    // Verstappen 2016: 4 rounds Toro Rosso, 17 Red Bull.
    const entrant = lensFor(2016).entrants.find((row) => row.ref === 'max_verstappen');
    expect(entrant?.teamRefs).toEqual(['toro_rosso', 'red_bull']);
    expect(entrant === undefined ? null : plotTeamFor(entrant)).toBe('red_bull');
  });

  it('reports the round at which the other seat changed hands', () => {
    const lens = lensFor(2016);
    const entrant = lens.entrants.find((row) => row.ref === 'max_verstappen');
    const rounds = lens.rounds.map((round) => round.number);
    expect(entrant === undefined ? [] : seatBreaks(entrant, rounds)).toEqual([5]);
  });

  it('breaks the shadow instead of joining two people’s cumulative totals', () => {
    /*
     * **The defect this test was written to catch, and it did.** At R4 the other Toro Rosso is
     * Sainz on 4 points; at R5 Verstappen is in a Red Bull and the other seat is Ricciardo on 48.
     * The first implementation drew one continuous series, so the line rose 44 points in a single
     * round for a "driver" who is two people. Two series, one per occupancy run, is the fix: each
     * carries `null` outside its own run, and the kit draws `null` as a gap.
     */
    const pairs = seasonPairs(lensFor(2016), ['max_verstappen'], name);
    const shadows = pairs[0]?.shadows ?? [];
    expect(shadows).toHaveLength(2);

    const [sainz, ricciardo] = shadows;
    expect(sainz?.points[3]?.y).toBe(4);
    expect(sainz?.points[4]?.y).toBeNull();
    expect(ricciardo?.points[3]?.y).toBeNull();
    expect(ricciardo?.points[4]?.y).toBe(48);

    // Both are the same seat of the same car, so both take the principal's colour and role…
    expect(new Set(shadows.map((series) => series.teamReference))).toEqual(new Set(['red_bull']));
    expect(shadows.every((series) => series.role === 'shadow')).toBe(true);
    // …and each names its own occupant and its own stretch of the season.
    expect(shadows.map((series) => series.label)).toEqual([
      'Other seat — SAINZ R1–R4',
      'Other seat — RICCIARDO R5–R21',
    ]);
  });
});

describe('seatLabel — never a team name', () => {
  it('names the occupant, and nothing else, when the seat never changed hands', () => {
    expect(seatLabel('Valtteri Bottas', null)).toBe('Other seat — Valtteri Bottas');
  });

  it('adds the stretch of season only when there is a second run to tell it from', () => {
    expect(seatLabel('Carlos Sainz', 'R1–R4')).toBe('Other seat — Carlos Sainz R1–R4');
  });
});

describe('§6.6.6.10 — points against the other seat', () => {
  it('is the difference of two totals scored in one car, one season, one system', () => {
    const gaps = seatGapSeries(lensFor(2021), ['hamilton'], name);
    const lens = lensFor(2021);
    const entrant = lens.entrants.find((row) => row.ref === 'hamilton');
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.points[0]?.y).toBe((entrant?.points[0] ?? 0) - (entrant?.seat.points[0] ?? 0));
    // R1 2021: Hamilton 25, Bottas 16.
    expect(gaps[0]?.points[0]?.y).toBe(9);
  });

  it('draws nothing rather than a flat zero where there is no second seat', () => {
    // 1957 again. A zero here would say Fangio was level with a team-mate who did not exist.
    expect(seatGapSeries(lensFor(1957), ['fangio'], name)).toEqual([]);
  });

  it('carries no shadow of its own — a difference already has both sides in it', () => {
    const gaps = seatGapSeries(lensFor(2021), ['hamilton', 'max_verstappen'], name);
    expect(gaps).toHaveLength(2);
    expect(gaps.every((series) => series.role === 'principal')).toBe(true);
    expect(gaps.map((series) => series.reference)).toEqual(['hamilton', 'max_verstappen']);
  });

  it('breaks at a seat change, where the jump would be the biggest lie on the page', () => {
    /*
     * Larger and worse than the shadow's break, because this is a difference of two levels rather
     * than one. Verstappen 2016 is +9 on Sainz at R4 and −10 on Ricciardo at R5, and nothing about
     * his racing caused the 19-point swing: the man in the other car changed.
     */
    const gaps = seatGapSeries(lensFor(2016), ['max_verstappen'], name);
    expect(gaps).toHaveLength(2);
    expect(gaps[0]?.points[3]?.y).toBe(9);
    expect(gaps[0]?.points[4]?.y).toBeNull();
    expect(gaps[1]?.points[3]?.y).toBeNull();
    expect(gaps[1]?.points[4]?.y).toBe(-10);
    expect(gaps.map((series) => series.label)).toEqual([
      'MAX_VERSTAPPEN vs SAINZ R1–R4',
      'MAX_VERSTAPPEN vs RICCIARDO R5–R21',
    ]);
  });
});

describe('an unfinished season is drawn against its whole calendar', () => {
  it('reports the rounds actually raced, short of the calendar', () => {
    const lens = lensFor(2026);
    expect(lens.rounds).toHaveLength(22);
    expect(racedRounds(lens)).toBe(10);
  });

  it('leaves the unraced rounds as null, so the kit draws a gap and not a plateau', () => {
    const pairs = seasonPairs(lensFor(2026), ['max_verstappen'], name);
    expect(pairs[0]?.principal.points[9]?.y).not.toBeNull();
    expect(pairs[0]?.principal.points[10]?.y).toBeNull();
    expect(pairs[0]?.principal.points.at(-1)?.y).toBeNull();
  });
});

describe('the finishing strip (§6.6.6.14 D)', () => {
  const strip2021 = () =>
    finishStrip(lensFor(2021), ['hamilton', 'rosberg', 'max_verstappen', 'fangio'], name);

  it('draws a row only for a driver who actually raced that season', () => {
    // Rosberg and Fangio have entries for 2021 with `entered: false`. A row of 22 blanks would be
    // an accusation rather than a fact; they are named in the notes above the plot instead.
    expect(strip2021().rows.map((row) => row.ref)).toEqual(['hamilton', 'max_verstappen']);
  });

  it('places P1 at the top and the deepest finish at the bottom', () => {
    const row = strip2021().rows[0];
    const first = row?.cells.find((cell) => cell.finish === 1);
    expect(first?.y).toBe(0);
    const deepest = strip2021().deepest;
    const worst = row?.cells.find((cell) => cell.finish === deepest);
    if (worst !== undefined) expect(worst.y).toBe(1);
  });

  it('never runs the axis shallower than P10, however well the selection finished', () => {
    /*
     * Four front-runners whose worst result is fourth would otherwise spread P1–P4 over the full
     * height and draw a one-place difference as the height of the chart. Hamilton's 2021 reaches
     * P15, so this fixture exercises the other branch too.
     */
    expect(strip2021().deepest).toBeGreaterThanOrEqual(FINISH_AXIS_FLOOR);
    const shallow = finishStrip(
      {
        ...lensFor(2021),
        entrants: lensFor(2021).entrants.map((entrant) => ({
          ...entrant,
          finish: entrant.finish.map((value) => (value === null ? null : Math.min(value, 3))),
        })),
      },
      ['hamilton'],
      name,
    );
    expect(shallow.deepest).toBe(FINISH_AXIS_FLOOR);
  });

  it('separates a start with no classification from a round he did not start', () => {
    /*
     * ⚠ The distinction the whole component exists to draw. `finish === null` means both in the
     * payload, and `teamAt` is the only thing that separates them: null exactly where he did not
     * start. Verstappen's 2021 round 6 is a retirement — a ring below the axis — and it must not
     * be drawn the same way as a weekend he was not at.
     */
    const row = strip2021().rows.find((entry) => entry.ref === 'max_verstappen');
    const retired = row?.cells[5];
    expect(retired?.started).toBe(true);
    expect(retired?.finish).toBeNull();
    expect(retired?.y).toBeNull();
    expect(row?.unclassified).toBeGreaterThan(0);
    expect(row?.missed).toBe(0);
  });

  it('spaces the rounds evenly from 0 to 1, first to last', () => {
    // Percentages, because jsdom measures nothing: the geometry is decided here and readable off
    // the element, which is the only way any of it can be asserted at all.
    const cells = strip2021().rows[0]?.cells ?? [];
    expect(cells[0]?.x).toBe(0);
    expect(cells.at(-1)?.x).toBe(1);
    expect(cells).toHaveLength(lensFor(2021).rounds.length);
  });

  it('puts the podium rule two places down the axis, not at a third of the height', () => {
    // P3 is `(3 − 1) / (deepest − 1)`, so the rule moves when the axis deepens — it is a position
    // on the scale and not a fraction of the box.
    const strip = strip2021();
    expect(strip.podium).toBeCloseTo(2 / (strip.deepest - 1), 12);
  });

  it('survives a one-position axis without dividing by zero', () => {
    const single = finishStrip(
      {
        ...lensFor(2021),
        rounds: lensFor(2021).rounds.slice(0, 1),
        entrants: lensFor(2021).entrants.map((entrant) => ({
          ...entrant,
          finish: entrant.finish.slice(0, 1),
          teamAt: entrant.teamAt.slice(0, 1),
        })),
      },
      ['hamilton'],
      name,
    );
    for (const cell of single.rows[0]?.cells ?? []) {
      expect(Number.isFinite(cell.y ?? 0)).toBe(true);
    }
    expect(single.rows[0]?.cells[0]?.x).toBe(0);
  });

  it('carries the round’s own name on every cell, for the mark and for the table', () => {
    const cell = strip2021().rows[0]?.cells[0];
    expect(cell?.name).toBe(lensFor(2021).rounds[0]?.name);
    expect(cell?.round).toBe(lensFor(2021).rounds[0]?.number);
  });
});
