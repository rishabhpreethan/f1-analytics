import { describe, expect, it } from 'vitest';
import { META_REAL } from '@schemas/meta.fixture';
import {
  makeClassificationRow,
  race1988Fixture,
  race1996Fixture,
  race2026Fixture,
  race2026R6Fixture,
} from '@schemas/race.fixture';
import type { Race, RaceOutcome } from '@schemas/race';
import type { ClassificationReference } from './selectors';
import {
  resolveRaceRef,
  selectClassificationKey,
  selectClassificationView,
  selectDriverShortLabel,
  selectGapDisplay,
  selectRaceCounts,
  selectRaceDataStates,
} from './selectors';

describe('resolveRaceRef — mirrors the server so a typo is a sentence, not a failed fetch', () => {
  it('resolves a valid address', () => {
    expect(resolveRaceRef('2026', '1')).toEqual({ status: 'resolved', year: 2026, round: 1 });
    expect(resolveRaceRef('1950', '7')).toEqual({ status: 'resolved', year: 1950, round: 7 });
    expect(resolveRaceRef('2026', '24')).toEqual({ status: 'resolved', year: 2026, round: 24 });
  });

  it.each([
    ['abc', 'not a number'],
    ['990', 'three digits'],
    ['19900', 'five digits'],
    ['1990.0', 'a float the server would 400'],
    ['0x7c6', 'hexadecimal'],
    ['1949', 'below the first season'],
    ['2101', 'above the format ceiling'],
    ['', 'missing'],
  ])('rejects year %s (%s) and names the parameter', (year) => {
    expect(resolveRaceRef(year, '1')).toEqual({ status: 'invalid', reason: 'year', value: year });
  });

  it.each([
    ['0', 'round zero does not exist'],
    ['01', 'a second spelling of round 1'],
    ['1.0', 'a float'],
    ['51', 'above the format ceiling'],
    ['abc', 'not a number'],
    ['', 'missing'],
  ])('rejects round %s (%s) and names the parameter', (round) => {
    expect(resolveRaceRef('2026', round)).toEqual({
      status: 'invalid',
      reason: 'round',
      value: round,
    });
  });

  it('treats an undefined parameter as missing rather than throwing', () => {
    expect(resolveRaceRef(undefined, '1').status).toBe('invalid');
    expect(resolveRaceRef('2026', undefined).status).toBe('invalid');
  });

  /**
   * The year is checked first, so a URL wrong in both places names the year. Arbitrary but
   * fixed, because a surface that reported whichever the implementation happened to reach
   * first would say different things on different runs.
   */
  it('reports the year when both are wrong', () => {
    expect(resolveRaceRef('abc', '0')).toMatchObject({ reason: 'year' });
  });
});

/* ==================================================================================
 * The five states.
 * ================================================================================== */

describe('selectRaceDataStates — four reasons a chart has nothing, and two are not faults', () => {
  it('1988 — both lap-scale datasets are out of coverage, and the copy says why', () => {
    const states = selectRaceDataStates(META_REAL, race1988Fixture);
    expect(states.results.kind).toBe('available');
    expect(states.laps.kind).toBe('noCoverage');
    expect(states.pits.kind).toBe('noCoverage');
  });

  /**
   * §6.5.3: the copy must say **where the boundary is**, **which side this falls on**, and
   * **what is available instead** — the third being the one that gets dropped and the only
   * one that helps. Asserted on all three rather than on the string's presence.
   */
  it('the no-coverage copy names the boundary, the year, and what IS available', () => {
    const { laps } = selectRaceDataStates(META_REAL, race1988Fixture);
    expect(laps.kind).toBe('noCoverage');
    const notice = laps.kind === 'noCoverage' ? laps.notice : '';
    expect(notice).toContain('1996');
    expect(notice).toContain('1988');
    expect(notice).toMatch(/classification/i);
  });

  it('never hardcodes the boundary — it comes from /api/meta', () => {
    const shifted = {
      ...META_REAL,
      coverage: { ...META_REAL.coverage, laps: { from: 1999, to: null } },
    };
    const { laps } = selectRaceDataStates(shifted, race1988Fixture);
    const notice = laps.kind === 'noCoverage' ? laps.notice : '';
    expect(notice).toContain('1999');
    expect(notice).not.toContain('1996');
  });

  it('1996 — laps available, pit data out of coverage', () => {
    const states = selectRaceDataStates(META_REAL, race1996Fixture);
    expect(states.laps.kind).toBe('available');
    expect(states.pits.kind).toBe('noCoverage');
    const notice = states.pits.kind === 'noCoverage' ? states.pits.notice : '';
    expect(notice).toContain('2011');
  });

  it('2026 — everything available', () => {
    const states = selectRaceDataStates(META_REAL, race2026Fixture);
    expect(states.laps).toEqual({ kind: 'available' });
    expect(states.pits).toEqual({ kind: 'available' });
  });

  /**
   * 2021 R12 — the Belgian Grand Prix run behind the safety car. Inside the pit window
   * with no stops, which is a **different** fact from being before 2011 and needs a
   * different sentence. Telling a reader "pit data begins in 2011" about a 2021 race is
   * the defect this case exists to prevent.
   */
  it('distinguishes "absent for this race" from "out of coverage"', () => {
    const race: Race = {
      ...race2026Fixture,
      year: 2021,
      availability: { hasLapData: true, hasPitData: false },
    };
    const { pits } = selectRaceDataStates(META_REAL, race);
    expect(pits.kind).toBe('absent');
    const notice = pits.kind === 'absent' ? pits.notice : '';
    expect(notice).toMatch(/no pit stops are recorded for this race/i);
    // It still says where the boundary is — but as context, not as the reason.
    expect(notice).toContain('2011');
  });

  /**
   * A scheduled round is not a data gap (trap 13). And the copy must not claim to know
   * today's date: REQUIREMENTS.md §2.5 warns the dump can lag the calendar by ~2 weeks, so
   * "has not happened yet" is something this code cannot honestly assert.
   */
  it('a race with no results is notRun everywhere, and the copy claims no calendar knowledge', () => {
    const race: Race = {
      ...race2026Fixture,
      hasResults: false,
      raceLaps: null,
      classification: [],
      availability: { hasLapData: false, hasPitData: false },
    };
    const states = selectRaceDataStates(META_REAL, race);
    expect([states.results.kind, states.laps.kind, states.pits.kind]).toEqual([
      'notRun',
      'notRun',
      'notRun',
    ]);
    const notice = states.results.kind === 'notRun' ? states.results.notice : '';
    expect(notice).toMatch(/no results are recorded/i);
    expect(notice).not.toMatch(/yet to (happen|be run)|has not happened|in the future/i);
  });

  it('never paints a no-coverage state as a fault — the copy carries no error language', () => {
    for (const race of [race1988Fixture, race1996Fixture]) {
      const states = selectRaceDataStates(META_REAL, race);
      for (const state of [states.laps, states.pits]) {
        const notice = 'notice' in state ? state.notice : '';
        expect(notice).not.toMatch(/error|failed|unable|sorry|problem|wrong/i);
      }
    }
  });
});

/* ==================================================================================
 * Identity.
 * ================================================================================== */

describe('selectDriverShortLabel', () => {
  it('prefers the abbreviation', () => {
    expect(selectDriverShortLabel({ code: 'VER', surname: 'Verstappen' })).toBe('VER');
  });

  /**
   * 40 drivers with race lap data carry no abbreviation, so this is the ordinary path for
   * a 1996 race and not a fallback nobody hits.
   */
  it('falls back to the surname — never to a fabricated three-letter code', () => {
    expect(selectDriverShortLabel({ code: null, surname: 'Häkkinen' })).toBe('Häkkinen');
    expect(selectDriverShortLabel({ code: null, surname: 'Häkkinen' })).not.toBe('HÄK');
    expect(selectDriverShortLabel({ code: null, surname: 'Häkkinen' })).not.toBe('HAK');
  });
});

describe('selectClassificationKey — driverRef alone is not unique within a race', () => {
  /**
   * 1951 R4: Fangio and Fagioli both classified P1 in car 8. Two rows, one driverRef each
   * — but 1950 R7 has Ascari twice, and that is the case `key={row.driverRef}` breaks on.
   */
  it('distinguishes two entries for one driver in one race', () => {
    const a = selectClassificationKey({ driverRef: 'ascari', carNumber: 12 });
    const b = selectClassificationKey({ driverRef: 'ascari', carNumber: 34 });
    expect(a).not.toBe(b);
  });

  it('is stable for the same entry', () => {
    expect(selectClassificationKey({ driverRef: 'fangio', carNumber: 8 })).toBe(
      selectClassificationKey({ driverRef: 'fangio', carNumber: 8 }),
    );
  });

  it('tolerates a null car number — 6 race entries have one', () => {
    expect(selectClassificationKey({ driverRef: 'x', carNumber: null })).toBe('x#x');
    expect(selectClassificationKey({ driverRef: 'x', carNumber: null })).not.toBe(
      selectClassificationKey({ driverRef: 'x', carNumber: 0 }),
    );
  });
});

/* ==================================================================================
 * RD-10.
 * ================================================================================== */

/**
 * **`selectGapDisplay` — the negative-gap regression, and the enum as the checklist.**
 *
 * The defect: `/seasons/2026/races/6` rendered six negative durations, down to
 * `−2:02:28.126`, because the branch keyed on `totalTimeMs !== null` and a retiree's
 * recorded time is their elapsed time *when they stopped* — smaller than the winner's.
 *
 * These tests are organised by `outcome` rather than by era, per `DESIGN_SYSTEM.md` §1.0b:
 * `raceOutcomeSchema` has eight members, 2026 R6 exercises three, and the state that
 * mattered was "non-finisher **with** a recorded time", which no era-chosen fixture had.
 */

/** The winner of 2026 R6. Every gap on that page is measured against this. */
const R6_LEADER = 8_611_243;

const ref = (over: Partial<ClassificationReference> = {}): ClassificationReference => ({
  leaderTimeMs: R6_LEADER,
  raceLaps: 78,
  ...over,
});

describe('selectGapDisplay — a finisher is the only row a duration belongs on', () => {
  it('shows the winner a total time, not a gap to itself', () => {
    expect(
      selectGapDisplay(makeClassificationRow({ position: 1, totalTimeMs: 5_766_857 }), {
        leaderTimeMs: 5_766_857,
        raceLaps: 60,
      }),
    ).toEqual({ kind: 'total', text: '1:36:06.857' });
  });

  it('shows a full-distance finisher the gap to the leader', () => {
    expect(
      selectGapDisplay(makeClassificationRow({ position: 2, totalTimeMs: 5_776_730 }), {
        leaderTimeMs: 5_766_857,
        raceLaps: 60,
      }),
    ).toEqual({ kind: 'gap', text: '+9.873' });
  });

  it('falls back to a total time when no leader time exists at all', () => {
    expect(
      selectGapDisplay(makeClassificationRow({ position: 4, totalTimeMs: 100_000 }), {
        leaderTimeMs: null,
        raceLaps: 58,
      }),
    ).toEqual({ kind: 'total', text: '1:40.000' });
  });

  /**
   * One row in the archive: 1950 R7 Ascari, P2, `detail: 'Finished'`, no recorded time. An
   * em dash in a column of times would read as a data gap; the recorded word does not.
   */
  it('falls back to `detail` for the one finisher with no recorded time', () => {
    expect(
      selectGapDisplay(
        makeClassificationRow({ position: 2, totalTimeMs: null, detail: 'Finished' }),
        ref(),
      ),
    ).toEqual({ kind: 'status', text: 'Finished' });
  });
});

describe('selectGapDisplay — the regression: a non-finisher never gets a duration', () => {
  /**
   * The six rows from the report, with their real recorded times. Each one produced a
   * negative duration; each must now read the word the data records.
   */
  it.each([
    ['sainz', 8_012_889, 70, true, '−9:58.354'],
    ['leclerc', 5_142_849, 64, false, '−57:48.394'],
    ['stroll', 4_516_761, 56, false, '−1:08:14.482'],
    ['norris', 3_396_709, 43, false, '−1:26:54.534'],
    ['bearman', 2_217_098, 27, false, '−1:46:34.145'],
    ['bottas', 1_263_117, 15, false, '−2:02:28.126'],
  ])(
    '%s retired with a recorded time and reads "Retired", not %s',
    (driverRef, totalTimeMs, lapsCompleted, isClassified, wasRendering) => {
      const result = selectGapDisplay(
        makeClassificationRow({
          driverRef,
          position: 16,
          outcome: 'mechanical',
          detail: 'Retired',
          isClassified,
          lapsCompleted,
          totalTimeMs,
        }),
        ref(),
      );
      expect(result).toEqual({ kind: 'status', text: 'Retired' });
      expect(result.text).not.toBe(wasRendering);
    },
  );

  /**
   * **The case a `delta < 0` guard would have missed**, and the larger of the two: 372 rows
   * across 67 pages where a non-finisher's time is *above* the winner's, so the subtraction
   * is positive and entirely plausible. `+31.402` beside a retirement is not a small error,
   * it is a meaningless number that reads as a real one.
   */
  it('refuses a plausible POSITIVE gap for a non-finisher, which a sign guard would have let through', () => {
    const result = selectGapDisplay(
      makeClassificationRow({
        position: null,
        outcome: 'accident',
        detail: 'Collision',
        isClassified: false,
        lapsCompleted: 40,
        totalTimeMs: R6_LEADER + 31_402,
      }),
      ref(),
    );
    expect(result).toEqual({ kind: 'status', text: 'Collision' });
    expect(result.text).not.toBe('+31.402');
  });

  /**
   * Sainz is the row the ruling turns on. `isClassified: true` at 70 laps of 78, so he holds
   * P16 — but his `outcome` is `mechanical`. He stopped on lap 70; he did not circulate
   * eight laps down to the flag, so `+8 Laps` would assert something that did not happen.
   * `isClassified` decides whether he holds a position, not what the result column says.
   */
  it('does not give a CLASSIFIED retiree a lap deficit — he retired, he was not lapped', () => {
    const result = selectGapDisplay(
      makeClassificationRow({
        position: 16,
        outcome: 'mechanical',
        detail: 'Retired',
        isClassified: true,
        lapsCompleted: 70,
        totalTimeMs: 8_012_889,
      }),
      ref(),
    );
    expect(result).toEqual({ kind: 'status', text: 'Retired' });
    expect(result.text).not.toBe('+8 Laps');
  });
});

describe('selectGapDisplay — a lapped finisher shows a deficit, never a duration', () => {
  /**
   * Up to 2022 the data states the deficit itself, on 7,279 rows. It is passed through
   * verbatim, so nothing here can disagree with the figure the dataset recorded.
   */
  it.each(['+1 Lap', '+2 Laps', '+15 Laps'])('passes through a stated deficit of %s', (detail) => {
    expect(
      selectGapDisplay(
        makeClassificationRow({
          position: 6,
          outcome: 'lapped',
          detail,
          lapsCompleted: 59,
          totalTimeMs: null,
        }),
        { leaderTimeMs: 5_766_857, raceLaps: 60 },
      ),
    ).toEqual({ kind: 'status', text: detail });
  });

  /**
   * **From 2023 the data stops stating it** — every lapped finisher reads the bare word
   * `"Lapped"`, on 363 rows, and those are almost exactly the 364 that carry a time. These
   * are 2026 R1's real P7 and P14 over a 58-lap race: the rows that were rendering `+4.593`
   * and `+8.487`, which look like ordinary gaps and mean nothing.
   */
  it.each([
    ['bearman', 57, 4_991_394, '+1 Lap', '+4.593'],
    ['colapinto', 56, 4_995_288, '+2 Laps', '+8.487'],
  ])(
    '%s is %i laps in and reads %s, not the duration %s it was showing',
    (driverRef, lapsCompleted, totalTimeMs, expected, wasRendering) => {
      const result = selectGapDisplay(
        makeClassificationRow({
          driverRef,
          position: 7,
          outcome: 'lapped',
          detail: 'Lapped',
          isClassified: true,
          lapsCompleted,
          totalTimeMs,
        }),
        { leaderTimeMs: 5_212_331, raceLaps: 58 },
      );
      expect(result).toEqual({ kind: 'status', text: expected });
      expect(result.text).not.toBe(wasRendering);
    },
  );

  /**
   * 172 `lapped` rows read `detail: 'Not classified'`, and 171 are `isClassified: false`. A
   * deficit relative to the winner is a claim about a car that holds a position, so those
   * keep their own words rather than being handed a derived "+13 Laps".
   */
  it('leaves an unclassified row its own words rather than deriving a deficit', () => {
    expect(
      selectGapDisplay(
        makeClassificationRow({
          position: null,
          outcome: 'lapped',
          detail: 'Not classified',
          isClassified: false,
          lapsCompleted: 45,
          totalTimeMs: null,
        }),
        ref(),
      ),
    ).toEqual({ kind: 'status', text: 'Not classified' });
  });

  it('falls back to `detail` when the race distance is unknown', () => {
    expect(
      selectGapDisplay(
        makeClassificationRow({
          outcome: 'lapped',
          detail: 'Lapped',
          isClassified: true,
          lapsCompleted: 57,
          totalTimeMs: 4_991_394,
        }),
        { leaderTimeMs: R6_LEADER, raceLaps: null },
      ),
    ).toEqual({ kind: 'status', text: 'Lapped' });
  });

  /**
   * A car on the winner's lap is not a lapped car, so a derived deficit of zero is not
   * `+0 Laps`. `lapsCompleted` disagrees with a driver's own lap rows on 105 of 11,720
   * entries, which is exactly how a zero or negative deficit arrives here.
   */
  it.each([
    [58, '58 laps of 58 — no deficit to state'],
    [60, 'more laps than the race distance'],
  ])('never prints "+0 Laps" or a negative deficit (%i laps: %s)', (lapsCompleted) => {
    const result = selectGapDisplay(
      makeClassificationRow({
        outcome: 'lapped',
        detail: 'Lapped',
        isClassified: true,
        lapsCompleted,
        totalTimeMs: 4_991_394,
      }),
      { leaderTimeMs: 5_212_331, raceLaps: 58 },
    );
    expect(result).toEqual({ kind: 'status', text: 'Lapped' });
  });
});

/**
 * §1.0b — the enum is the checklist. Every member gets a row, including the four that never
 * occur in a race session today (`didNotQualify` occurs in none; `unknown` exists so a
 * refresh introducing an undecoded `status` degrades honestly instead of joining a
 * neighbour).
 */
describe('selectGapDisplay — exhaustive over raceOutcomeSchema, with a recorded time present', () => {
  const OUTCOMES: readonly RaceOutcome[] = [
    'finished',
    'lapped',
    'accident',
    'mechanical',
    'disqualified',
    'didNotStart',
    'didNotQualify',
    'unknown',
  ];

  /**
   * The property that makes the whole class of defect impossible: **give every outcome a
   * time below the leader's, and none of them may render a duration.** This is the test that
   * would have caught the original bug on any of the seven members, not just the two that
   * happened to be on the page someone opened.
   *
   * `finished` is excluded and tested separately below — not as an exemption, but because on
   * that one row a below-leader time means the *data* is wrong, and the deliberate choice is
   * to show it rather than clamp it.
   */
  const NON_FINISHERS = OUTCOMES.filter((outcome) => outcome !== 'finished');

  it.each(NON_FINISHERS)('outcome %s never renders a negative duration', (outcome) => {
    const result = selectGapDisplay(
      makeClassificationRow({
        position: 12,
        outcome,
        detail: 'Retired',
        isClassified: false,
        lapsCompleted: 15,
        // Well below the leader — the exact shape that produced `−2:02:28.126`.
        totalTimeMs: 1_263_117,
      }),
      ref(),
    );
    expect(result.text.startsWith('−')).toBe(false);
    expect(result.text.startsWith('-')).toBe(false);
  });

  it.each(OUTCOMES)('outcome %s renders a non-empty result and never the em dash', (outcome) => {
    const result = selectGapDisplay(
      makeClassificationRow({
        position: 12,
        outcome,
        detail: 'Retired',
        isClassified: true,
        lapsCompleted: 70,
        totalTimeMs: 8_012_889,
      }),
      ref(),
    );
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.text).not.toBe('—');
  });

  /**
   * **The one place a negative gap is still possible, and it is intentional.** Every one of
   * the 8,109 finishers carrying a time is at or above the winner's, counted — so this row
   * cannot arise from today's data, and if it ever does it is upstream corruption. Clamping
   * it would replace a visible defect with a plausible wrong number and hide the fact that
   * the data needs fixing. `formatGap`'s `−` glyph is the report.
   */
  it('still shows a negative gap for a FINISHER below the leader, because that is a data defect', () => {
    expect(
      selectGapDisplay(
        makeClassificationRow({ position: 2, outcome: 'finished', totalTimeMs: R6_LEADER - 1_000 }),
        ref(),
      ),
    ).toEqual({ kind: 'gap', text: '−1.000' });
  });

  /** Only `finished` may produce a `total` or a `gap`. Everything else is a `status`. */
  it.each(OUTCOMES)('outcome %s produces a duration kind only when it is `finished`', (outcome) => {
    const result = selectGapDisplay(
      makeClassificationRow({
        position: 5,
        outcome,
        detail: 'Retired',
        isClassified: true,
        lapsCompleted: 78,
        totalTimeMs: R6_LEADER + 6_271,
      }),
      ref(),
    );
    expect(result.kind === 'gap' || result.kind === 'total').toBe(outcome === 'finished');
  });
});

describe('selectClassificationView', () => {
  it('shapes 1988 R1: winner total, second a gap, lapped from detail, DSQ from detail', () => {
    const view = selectClassificationView(race1988Fixture);
    expect(view.map((entry) => entry.gap)).toEqual([
      { kind: 'total', text: '1:36:06.857' },
      { kind: 'gap', text: '+9.873' },
      { kind: 'status', text: '+1 Lap' },
      { kind: 'status', text: 'Disqualified' },
    ]);
  });

  it('carries teamRef as the colour reference and nothing resembling a colour', () => {
    const view = selectClassificationView(race2026Fixture);
    expect(view[0]?.colorRef).toBe('mercedes');
    expect(JSON.stringify(view)).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it('marks a retirement from `status`, never from a null position (trap 3)', () => {
    const view = selectClassificationView(race2026Fixture);
    const leclerc = view.find((entry) => entry.row.driverRef === 'leclerc');
    const verstappen = view.find((entry) => entry.row.driverRef === 'max_verstappen');
    expect(leclerc?.isRetirement).toBe(true);
    expect(verstappen?.isRetirement).toBe(false);
  });

  /**
   * A disqualification has a null position and is **not** a retirement. This is exactly
   * the distinction `position IS NULL` cannot make: Senna's 1988 DSQ and Leclerc's 2026
   * engine failure both have no position and are different events.
   */
  it('does not call a disqualification a retirement, though both lack a position', () => {
    const senna = selectClassificationView(race1988Fixture).find(
      (entry) => entry.row.driverRef === 'senna',
    );
    expect(senna?.row.position).toBeNull();
    expect(senna?.isRetirement).toBe(false);
  });

  /**
   * **The reported page, end to end.** Nine of 2026 R6's twenty-two entries: the winner, the
   * runner-up, the six retirements that carry a recorded time, and Verstappen, who retired
   * with none and was the one row the original code got right.
   *
   * Before the fix these read `1:23:31.243`, `+6.271`, then `−9:58.354`, `−57:48.394`,
   * `−1:08:14.482`, `−1:26:54.534`, `−1:46:34.145`, `−2:02:28.126`, `Retired`.
   */
  it('shapes 2026 R6 with no negative duration anywhere', () => {
    const view = selectClassificationView(race2026R6Fixture);
    expect(view.map((entry) => entry.gap)).toEqual([
      { kind: 'total', text: '2:23:31.243' },
      { kind: 'gap', text: '+6.271' },
      { kind: 'status', text: 'Retired' },
      { kind: 'status', text: 'Retired' },
      { kind: 'status', text: 'Retired' },
      { kind: 'status', text: 'Retired' },
      { kind: 'status', text: 'Retired' },
      { kind: 'status', text: 'Retired' },
      { kind: 'status', text: 'Retired' },
    ]);
  });

  /**
   * Stated as a property rather than only as expected strings, because the property is what
   * generalises to the 67 other pages that carry one of these rows.
   */
  it('produces no negative time on any of the four fixtures', () => {
    for (const race of [race1988Fixture, race1996Fixture, race2026Fixture, race2026R6Fixture]) {
      for (const entry of selectClassificationView(race)) {
        expect(entry.gap.text.startsWith('−')).toBe(false);
        expect(entry.gap.text.startsWith('-')).toBe(false);
      }
    }
  });

  /**
   * The leader reference must come from a **finisher** at P1. All 1,162 P1 rows in the data
   * are finishers with a time, so this changes nothing today — but 9 disqualified entries do
   * carry a recorded time, and one of those at P1 must not become the reference every other
   * row is measured against.
   */
  it('does not take the leader time from a P1 row that is not a finisher', () => {
    const race: Race = {
      ...race2026Fixture,
      classification: [
        makeClassificationRow({
          position: 1,
          outcome: 'disqualified',
          detail: 'Disqualified',
          isClassified: false,
          totalTimeMs: 5_212_331,
        }),
        makeClassificationRow({ driverRef: 'hamilton', position: 2, totalTimeMs: 5_214_602 }),
      ],
    };
    const view = selectClassificationView(race);
    expect(view[0]?.gap).toEqual({ kind: 'status', text: 'Disqualified' });
    // With no usable leader time, P2 shows its own total rather than a gap to a DSQ row.
    expect(view[1]?.gap).toEqual({ kind: 'total', text: '1:26:54.602' });
  });

  it('gives a shared drive two distinct keys', () => {
    const race: Race = {
      ...race1988Fixture,
      classification: [
        makeClassificationRow({ driverRef: 'ascari', carNumber: 12 }),
        makeClassificationRow({ driverRef: 'ascari', carNumber: 34 }),
      ],
    };
    const keys = selectClassificationView(race).map((entry) => entry.key);
    expect(new Set(keys).size).toBe(2);
  });
});

describe('selectRaceCounts — derived from `status`, not from a null position', () => {
  it('counts 1988 R1 as the data records it', () => {
    expect(selectRaceCounts(race1988Fixture)).toEqual({
      entries: 4,
      starters: 4,
      finishers: 3,
      retirements: 0,
      disqualified: 1,
      nonStarters: 0,
    });
  });

  /**
   * §3 requires `status IN (30, 40)` be excluded from "starts" counts, so a non-starter is
   * counted separately rather than folded into either side.
   */
  it('excludes a non-starter from the starters count', () => {
    const race: Race = {
      ...race1988Fixture,
      classification: [
        makeClassificationRow({ outcome: 'didNotStart', position: null, isClassified: false }),
        makeClassificationRow({ position: 1 }),
      ],
    };
    expect(selectRaceCounts(race)).toMatchObject({ entries: 2, starters: 1, nonStarters: 1 });
  });

  it('counts a lapped finisher as a finisher — is_classified, not status === 0', () => {
    const counts = selectRaceCounts(race1988Fixture);
    const lapped = race1988Fixture.classification.filter((row) => row.outcome === 'lapped');
    expect(lapped).toHaveLength(1);
    expect(counts.finishers).toBe(3);
  });
});
