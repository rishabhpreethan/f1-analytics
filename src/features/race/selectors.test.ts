import { describe, expect, it } from 'vitest';
import { META_REAL } from '@schemas/meta.fixture';
import { race1988Fixture, race1996Fixture, race2026Fixture } from '@schemas/race.fixture';
import type { Race } from '@schemas/race';
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

describe('selectGapDisplay — three kinds, because the sport shows three things', () => {
  it('shows the winner a total time, not a gap to itself', () => {
    expect(
      selectGapDisplay({ position: 1, totalTimeMs: 5_766_857, detail: 'Finished' }, 5_766_857),
    ).toEqual({ kind: 'total', text: '1:36:06.857' });
  });

  it('shows a full-distance finisher the gap to the leader', () => {
    expect(
      selectGapDisplay({ position: 2, totalTimeMs: 5_776_730, detail: 'Finished' }, 5_766_857),
    ).toEqual({ kind: 'gap', text: '+9.873' });
  });

  /**
   * The rule §6.6.1 states explicitly. 7,450 of 7,814 lapped finishers carry no duration,
   * so `detail` is the ordinary source here — and a gap column that computed a duration
   * anyway would be inventing one.
   */
  it('shows a lapped finisher its lap deficit from `detail`, never a duration', () => {
    expect(
      selectGapDisplay({ position: 6, totalTimeMs: null, detail: '+1 Lap' }, 5_766_857),
    ).toEqual({
      kind: 'status',
      text: '+1 Lap',
    });
  });

  it('shows a retirement its status text', () => {
    expect(
      selectGapDisplay({ position: null, totalTimeMs: null, detail: 'Engine' }, 5_766_857),
    ).toEqual({ kind: 'status', text: 'Engine' });
  });

  it('falls back to a total time when no leader time exists at all', () => {
    expect(
      selectGapDisplay({ position: 4, totalTimeMs: 100_000, detail: 'Finished' }, null),
    ).toEqual({
      kind: 'total',
      text: '1:40.000',
    });
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

  it('gives a shared drive two distinct keys', () => {
    const race: Race = {
      ...race1988Fixture,
      classification: [
        { ...race1988Fixture.classification[0], driverRef: 'ascari', carNumber: 12 },
        { ...race1988Fixture.classification[0], driverRef: 'ascari', carNumber: 34 },
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
        { ...race1988Fixture.classification[0], outcome: 'didNotStart', position: null },
        race1988Fixture.classification[1],
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
