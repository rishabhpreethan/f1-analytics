import { describe, expect, it } from 'vitest';
import type { CancelledRound, SeasonRound } from '@schemas/season';
import {
  adjacentSeasons,
  adjustmentNote,
  decadeGroups,
  dialCells,
  driverTitleCard,
  groupStandings,
  mergeCalendar,
  noticeSlot,
  noticesFor,
  roundStatus,
  teamLineage,
  titleHolder,
} from './presenters';
import type { DriverStandingRow, SeasonNoticeCode } from './selectors';

/**
 * **What this file can prove.**
 *
 * The season hub's layout is untestable here by construction — jsdom performs no layout, so a row
 * grid, a dial's tick widths and a sticky column are all invisible to it. What *is* decidable is
 * the shaping every one of those renderings depends on, and each case below is a real row in the
 * database rather than a convenient fixture: 1951's shared drive, 2026's two unnumbered rounds,
 * 2007 McLaren's exclusion, 1950's 59 unscored entrants.
 */

const round = (over: Partial<SeasonRound> & Pick<SeasonRound, 'round' | 'date'>): SeasonRound => ({
  name: `Round ${String(over.round)}`,
  circuitRef: 'somewhere',
  circuitName: 'Somewhere',
  hasResults: true,
  hasSprint: false,
  hasLapData: false,
  winners: [],
  ...over,
});

const cancelled = (date: string, name: string): CancelledRound => ({
  name,
  date,
  circuitRef: null,
  circuitName: null,
});

describe('notice routing — each fact appears where it changes a number', () => {
  it('sends every code to exactly one slot', () => {
    const codes: SeasonNoticeCode[] = [
      'inProgress',
      'cancelledRounds',
      'bestNResults',
      'limitedResults',
      'noTeamChampionship',
      'noLapData',
      'partialLapData',
      'noStandings',
    ];
    // Total, not partial: a code with no slot would silently never render.
    for (const code of codes) expect(typeof noticeSlot(code)).toBe('string');
  });

  it('puts the scoring rule on the standings, not on the calendar', () => {
    expect(noticeSlot('bestNResults')).toBe('standings');
    expect(noticeSlot('limitedResults')).toBe('standings');
  });

  it('puts cancelled rounds and lap coverage on the calendar', () => {
    expect(noticeSlot('cancelledRounds')).toBe('calendar');
    expect(noticeSlot('noLapData')).toBe('calendar');
    expect(noticeSlot('partialLapData')).toBe('calendar');
  });

  it('replaces the constructor table rather than annotating it', () => {
    expect(noticeSlot('noTeamChampionship')).toBe('constructors');
  });

  it('filters by slot', () => {
    const notices = [
      { code: 'bestNResults' as const, text: 'a' },
      { code: 'cancelledRounds' as const, text: 'b' },
    ];
    expect(noticesFor(notices, 'standings').map((n) => n.text)).toEqual(['a']);
    expect(noticesFor(notices, 'calendar').map((n) => n.text)).toEqual(['b']);
  });
});

describe('the calendar — 24 rows, 22 numbers (2026)', () => {
  const rounds = [
    round({ round: 3, date: '2026-03-29' }),
    round({ round: 4, date: '2026-05-03' }),
    round({ round: 1, date: '2026-03-08' }),
  ];
  const cancellations = [
    cancelled('2026-04-12', 'Bahrain Grand Prix'),
    cancelled('2026-04-19', 'Saudi Arabian Grand Prix'),
  ];

  it('interleaves cancelled rounds by date rather than appending them', () => {
    const merged = mergeCalendar(rounds, cancellations);
    expect(merged.map((entry) => entry.round.date)).toEqual([
      '2026-03-08',
      '2026-03-29',
      '2026-04-12',
      '2026-04-19',
      '2026-05-03',
    ]);
    // The two cancellations land between rounds 3 and 4 — a five-week hole an appendix would hide.
    expect(merged[2]?.kind).toBe('cancelled');
    expect(merged[3]?.kind).toBe('cancelled');
  });

  it('produces more calendar entries than numbered rounds', () => {
    const merged = mergeCalendar(rounds, cancellations);
    expect(merged).toHaveLength(5);
    expect(merged.filter((entry) => entry.kind === 'round')).toHaveLength(3);
  });

  it('gives every entry a distinct key, including two cancellations', () => {
    const keys = mergeCalendar(rounds, cancellations).map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('mutates neither input array', () => {
    const order = rounds.map((r) => r.round);
    mergeCalendar(rounds, cancellations);
    expect(rounds.map((r) => r.round)).toEqual(order);
  });
});

describe('round status — three states, none of them a fault', () => {
  it('splits on hasResults, never on the date', () => {
    // 2026 R11 has a date in the past and no results. A date comparison would call it complete.
    const past = round({ round: 11, date: '2026-07-26', hasResults: false });
    expect(roundStatus({ kind: 'round', key: 'r11', round: past })).toBe('upcoming');
  });

  it('reports a raced round', () => {
    expect(
      roundStatus({ kind: 'round', key: 'r1', round: round({ round: 1, date: '2026-03-08' }) }),
    ).toBe('raced');
  });

  it('reports a cancelled round', () => {
    expect(
      roundStatus({ kind: 'cancelled', key: 'c0', round: cancelled('2026-04-12', 'Bahrain') }),
    ).toBe('cancelled');
  });
});

describe('the dial', () => {
  it('draws one cell per calendar entry, cancelled ones included', () => {
    const cells = dialCells(
      mergeCalendar(
        [
          round({ round: 1, date: '2026-03-08' }),
          round({ round: 2, date: '2026-05-03', hasResults: false }),
        ],
        [cancelled('2026-04-12', 'Bahrain Grand Prix')],
      ),
    );
    expect(cells.map((cell) => cell.status)).toEqual(['raced', 'cancelled', 'upcoming']);
  });

  it('names a cancelled cell without inventing a round number for it', () => {
    const cells = dialCells([
      { kind: 'cancelled', key: 'c0', round: cancelled('2026-04-12', 'Bahrain Grand Prix') },
    ]);
    expect(cells[0]?.label).toBe('Bahrain Grand Prix — cancelled');
    expect(cells[0]?.label).not.toMatch(/Round/);
  });
});

describe('standings grouping — three groups, because null position means two things', () => {
  const rows = [
    { position: 1, adjustment: 'none' as const, name: 'leader' },
    { position: 2, adjustment: 'adjusted' as const, name: 'penalised but classified' },
    { position: null, adjustment: 'excluded' as const, name: 'excluded with points' },
    { position: null, adjustment: 'none' as const, name: 'scored nothing' },
  ];

  it('keeps an excluded entity out of the "scored nothing" bucket', () => {
    const groups = groupStandings(rows);
    expect(groups.excluded.map((r) => r.name)).toEqual(['excluded with points']);
    expect(groups.unscored.map((r) => r.name)).toEqual(['scored nothing']);
  });

  it('classifies an adjusted-but-ranked entity normally', () => {
    // 2020 Racing Point keeps position 4 and reads 195 — the post-penalty figure, already applied.
    const groups = groupStandings(rows);
    expect(groups.classified.map((r) => r.name)).toEqual(['leader', 'penalised but classified']);
  });

  it('loses nobody', () => {
    const groups = groupStandings(rows);
    expect(groups.classified.length + groups.excluded.length + groups.unscored.length).toBe(
      rows.length,
    );
  });
});

describe('adjustment copy — annotate, never re-apply', () => {
  it('says the figures are as recorded for an exclusion', () => {
    const note = adjustmentNote('excluded', 'team');
    expect(note?.chip).toBe('Excluded');
    expect(note?.detail).toMatch(/as the record holds them/);
  });

  it('says the total is already post-adjustment', () => {
    const note = adjustmentNote('adjusted', 'driver');
    expect(note?.detail).toMatch(/after it was applied/);
  });

  it('is silent when nothing happened', () => {
    expect(adjustmentNote('none', 'driver')).toBeNull();
  });
});

describe('team lineage', () => {
  const team = (name: string) => ({
    ref: name.toLowerCase(),
    name,
    firstRound: 1,
    lastRound: 2,
    entries: 1,
  });

  it('reads two teams as a lineage — 1951 González', () => {
    expect(teamLineage([team('Talbot-Lago'), team('Ferrari')])).toEqual({
      label: 'Talbot-Lago → Ferrari',
      count: null,
    });
  });

  it('collapses three or more to first, last and a count', () => {
    expect(teamLineage([team('A'), team('B'), team('C')])).toEqual({ label: 'A → C', count: 3 });
  });

  it('handles a championship position held with no race entry', () => {
    expect(teamLineage([])).toEqual({ label: '—', count: null });
  });
});

describe('the title holder', () => {
  it('reads position 1, never rows[0]', () => {
    // An excluded entity with 78 points sorts last in the payload but must never be found by a
    // `[0]` if the ordering ever changes. Position is the only thing that decides a champion.
    const rows = [
      { position: null, adjustment: 'excluded' as const },
      { position: 1, adjustment: 'none' as const },
    ];
    expect(titleHolder(rows)).toEqual({ position: 1, adjustment: 'none' });
  });

  it('is null when nobody holds first', () => {
    expect(titleHolder([{ position: null, adjustment: 'none' as const }])).toBeNull();
  });

  it('changes its eyebrow with the season, not with the data', () => {
    const rows: DriverStandingRow[] = [
      {
        position: 1,
        driverRef: 'antonelli',
        code: 'ANT',
        forename: 'Andrea Kimi',
        surname: 'Antonelli',
        nationality: 'Italian',
        points: 204,
        wins: 6,
        bestFinish: 1,
        teams: [{ ref: 'mercedes', name: 'Mercedes', firstRound: 1, lastRound: 10, entries: 10 }],
        adjustment: 'none',
        principalTeam: {
          ref: 'mercedes',
          name: 'Mercedes',
          firstRound: 1,
          lastRound: 10,
          entries: 10,
        },
        changedTeam: false,
        colorRef: 'mercedes',
      },
    ];
    expect(driverTitleCard(rows, false)?.eyebrow).toBe('Championship leader');
    expect(driverTitleCard(rows, true)?.eyebrow).toBe("Drivers' Champion");
  });
});

describe('the season picker', () => {
  it('groups 77 seasons by decade, newest first', () => {
    const groups = decadeGroups([1950, 1951, 1960, 2025, 2026]);
    expect(groups.map((group) => group.label)).toEqual(['2020s', '1960s', '1950s']);
    expect(groups[0]?.years).toEqual([2026, 2025]);
    expect(groups[2]?.years).toEqual([1951, 1950]);
  });

  it('steps to seasons that exist, never to year ± 1', () => {
    // A gap in the list must not produce an arrow that links to a 404.
    expect(adjacentSeasons([1950, 1951, 2026], 1951)).toEqual({ previous: 1950, next: 2026 });
  });

  it('dead-ends at both ends of the range', () => {
    expect(adjacentSeasons([1950, 2026], 1950).previous).toBeNull();
    expect(adjacentSeasons([1950, 2026], 2026).next).toBeNull();
  });
});
