import { describe, expect, it } from 'vitest';
import type { Meta } from '@schemas/meta';
import type { Season, StandingsProgression } from '@schemas/season';
import { progressionFixture, seasonFixture } from '@schemas/season.fixture';
import {
  resolveSeasonYear,
  selectCalendar,
  selectDriverStandings,
  selectGapToLeader,
  selectPositionSeries,
  selectProgressionSeries,
  selectRoundAxis,
  selectSeasonNotices,
  selectSeriesTable,
  selectTeamStandings,
} from './selectors';

const meta: Meta = {
  seasons: { firstYear: 1950, latestYear: 2026, count: 77 },
  latestSeason: {
    year: 2026,
    scheduledRounds: 22,
    completedRounds: 10,
    cancelledRounds: 2,
    isComplete: false,
  },
  latestCompletedRound: {
    year: 2026,
    round: 10,
    roundName: 'Belgian Grand Prix',
    date: '2026-07-19',
    circuitRef: 'spa',
    circuitName: 'Circuit de Spa-Francorchamps',
  },
  nextScheduledRound: null,
  coverage: {
    results: { from: 1950, to: null },
    qualifying: { from: 1994, to: null },
    qualifyingSegments: { from: 2006, to: null },
    laps: { from: 1996, to: null },
    pitStops: { from: 2011, to: null },
    sprint: { from: 2021, to: null },
    sprintQualifying: { from: 2023, to: null },
  },
};

describe('resolveSeasonYear', () => {
  it('resolves a bare /seasons from meta, and waits when meta has not answered', () => {
    expect(resolveSeasonYear(undefined, meta)).toEqual({
      year: 2026,
      status: 'resolved',
      rejected: null,
    });
    expect(resolveSeasonYear(undefined, undefined)).toEqual({
      year: null,
      status: 'resolving',
      rejected: null,
    });
  });

  it('accepts a four-digit year inside the data window', () => {
    expect(resolveSeasonYear('1996', meta)).toEqual({
      year: 1996,
      status: 'resolved',
      rejected: null,
    });
  });

  /**
   * ARCHITECTURE.md §5: an invalid parameter degrades to the default **with a visible
   * notice** — never a blank page and never a crash. `rejected` is what makes the notice
   * possible; dropping it silently would satisfy the "no crash" half only.
   */
  it.each(['abc', '1990.0', '0x7c6', '', '19900', '+1990'])(
    'falls back to the default and reports %s as rejected',
    (param) => {
      expect(resolveSeasonYear(param, meta)).toEqual({
        year: 2026,
        status: 'defaulted',
        rejected: param,
      });
    },
  );

  it('falls back for a well-formed year outside the data window', () => {
    expect(resolveSeasonYear('2099', meta).status).toBe('defaulted');
    expect(resolveSeasonYear('1949', meta).status).toBe('defaulted');
  });

  /**
   * Mirrors the server's rule so a typo does not become a failed fetch: a client that
   * accepted `1990.0` would send a request the server answers with a 400.
   */
  it('trusts a well-formed year while meta is still loading', () => {
    expect(resolveSeasonYear('1996', undefined)).toEqual({
      year: 1996,
      status: 'resolved',
      rejected: null,
    });
  });

  it('prefers the latest completed round over the latest season present', () => {
    const lagging: Meta = { ...meta, seasons: { ...meta.seasons, latestYear: 2027 } };
    expect(resolveSeasonYear(undefined, lagging).year).toBe(2026);
  });

  it('falls back to the latest season when nothing is complete', () => {
    const fresh: Meta = { ...meta, latestCompletedRound: null };
    expect(resolveSeasonYear(undefined, fresh).year).toBe(2026);
  });
});

describe('selectCalendar', () => {
  const calendar = selectCalendar(seasonFixture);

  /**
   * The split is on `hasResults` and never on the date. 2026 R11's date has already
   * passed in the real world and it has no results (REQUIREMENTS.md §2.5) — a
   * date-driven split would show it as a completed race with nothing in it.
   */
  it('splits on results', () => {
    expect(calendar.completed.map((r) => r.round)).toEqual([1, 2]);
    expect(calendar.upcoming.map((r) => r.round)).toEqual([3]);
  });

  /**
   * The case a date-driven split gets wrong, constructed rather than hoped for: a round
   * whose date has already passed and which has no results. That is the live 2026 R11
   * situation and it is the ~2-week lag REQUIREMENTS.md §2.2 warns about, not a race that
   * happened and lost its data.
   */
  it('calls a past-dated round with no results upcoming, not completed', () => {
    const lagging: Season = {
      ...seasonFixture,
      rounds: [
        { ...seasonFixture.rounds[0], round: 1, date: '2026-03-08', hasResults: true },
        { ...seasonFixture.rounds[2], round: 2, date: '2026-03-01', hasResults: false },
      ] as Season['rounds'],
    };
    const split = selectCalendar(lagging);
    expect(split.completed.map((r) => r.round)).toEqual([1]);
    expect(split.upcoming.map((r) => r.round)).toEqual([2]);
    expect(split.upcoming[0]?.date).toBe('2026-03-01');
  });

  it('keeps cancelled rounds out of both, and out of the numbered calendar', () => {
    expect(calendar.cancelled.map((r) => r.name)).toEqual(['Bahrain Grand Prix']);
    expect([...calendar.completed, ...calendar.upcoming].map((r) => r.name)).not.toContain(
      'Bahrain Grand Prix',
    );
  });

  it('names the latest completed and the next round', () => {
    expect(calendar.latestCompleted?.round).toBe(2);
    expect(calendar.next?.round).toBe(3);
  });

  it('has no next round in a complete season', () => {
    const complete: Season = {
      ...seasonFixture,
      rounds: seasonFixture.rounds.filter((r) => r.hasResults),
      isComplete: true,
    };
    expect(selectCalendar(complete).next).toBeNull();
  });

  it('has no latest completed round before the season starts', () => {
    const notStarted: Season = {
      ...seasonFixture,
      rounds: seasonFixture.rounds.map((r) => ({ ...r, hasResults: false, winners: [] })),
    };
    expect(selectCalendar(notStarted).latestCompleted).toBeNull();
  });
});

describe('selectSeasonNotices', () => {
  const codesFor = (season: Season) => selectSeasonNotices(season).map((n) => n.code);

  it('reports a season in progress with the rounds remaining', () => {
    const notice = selectSeasonNotices(seasonFixture).find((n) => n.code === 'inProgress');
    expect(notice?.text).toContain('2 of 3 rounds complete, 1 still to come');
  });

  it('says nothing about progress once a season is complete', () => {
    const complete: Season = {
      ...seasonFixture,
      rounds: seasonFixture.rounds.filter((r) => r.hasResults),
      scheduledRounds: 2,
      completedRounds: 2,
      isComplete: true,
    };
    expect(codesFor(complete)).not.toContain('inProgress');
  });

  it('names the cancelled rounds rather than only counting them', () => {
    const notice = selectSeasonNotices(seasonFixture).find((n) => n.code === 'cancelledRounds');
    expect(notice?.text).toContain('Bahrain Grand Prix');
    expect(notice?.text).toContain('1 round');
  });

  /**
   * The notice that prevents an actual error of fact. Without it a reader sees 1950's 30
   * points and 2026's 30 points as the same quantity, and they are not.
   */
  it('states the best-N rule for a best-N season', () => {
    const season: Season = {
      ...seasonFixture,
      year: 1950,
      scoring: {
        systemRef: 's1950',
        systemName: '1950 - 1953 Championship',
        driverCounting: 'bestN',
        driverBestResults: 4,
        teamCounting: 'none',
        teamBestResults: null,
      },
    };
    const notices = selectSeasonNotices(season);
    expect(notices.find((n) => n.code === 'bestNResults')?.text).toContain('best 4 results');
    expect(notices.find((n) => n.code === 'noTeamChampionship')?.text).toContain('began in 1958');
  });

  it('says a limit applied without inventing its size (1967-78)', () => {
    const season: Season = {
      ...seasonFixture,
      year: 1970,
      scoring: {
        systemRef: 's1967',
        systemName: '1967 - 1978 Championship',
        driverCounting: 'limited',
        driverBestResults: null,
        teamCounting: 'limited',
        teamBestResults: null,
      },
    };
    const text = selectSeasonNotices(season).find((n) => n.code === 'limitedResults')?.text ?? '';
    expect(text).toContain("isn't recorded in this dataset");
    expect(text).not.toMatch(/best \d/);
  });

  it('says nothing about scoring when every result counted', () => {
    expect(codesFor(seasonFixture)).not.toContain('bestNResults');
    expect(codesFor(seasonFixture)).not.toContain('limitedResults');
    expect(codesFor(seasonFixture)).not.toContain('noTeamChampionship');
  });

  /** NV-8, and DESIGN_SYSTEM.md §7.4: explain the boundary, never render a blank chart. */
  it('explains a season with no lap data at all', () => {
    const season: Season = {
      ...seasonFixture,
      year: 1950,
      rounds: seasonFixture.rounds.map((r) => ({ ...r, hasLapData: false })),
    };
    const text = selectSeasonNotices(season).find((n) => n.code === 'noLapData')?.text ?? '';
    expect(text).toContain("Lap-by-lap timing isn't available for 1950");
    expect(text).toContain('championship standings');
  });

  it('reports partial lap coverage with both counts', () => {
    const season: Season = {
      ...seasonFixture,
      year: 1996,
      rounds: [
        { ...seasonFixture.rounds[0], hasLapData: true },
        { ...seasonFixture.rounds[1], hasLapData: false },
      ] as Season['rounds'],
    };
    expect(selectSeasonNotices(season).find((n) => n.code === 'partialLapData')?.text).toContain(
      '1 of the 2 completed rounds',
    );
  });

  it('says nothing about laps when every completed round has them', () => {
    const season: Season = {
      ...seasonFixture,
      rounds: seasonFixture.rounds.filter((r) => r.hasResults),
    };
    expect(codesFor(season)).not.toContain('noLapData');
    expect(codesFor(season)).not.toContain('partialLapData');
  });

  it('short-circuits on a season with no rounds at all — the empty state', () => {
    const empty: Season = {
      ...seasonFixture,
      rounds: [],
      cancelledRounds: [],
      scheduledRounds: 0,
      completedRounds: 0,
    };
    expect(codesFor(empty)).toEqual(['noStandings']);
  });
});

describe('selectDriverStandings / selectTeamStandings', () => {
  it('resolves the principal team as the last one raced for', () => {
    const rows = selectDriverStandings(seasonFixture);
    expect(rows[0]?.principalTeam?.ref).toBe('mercedes');
    expect(rows[0]?.colorRef).toBe('mercedes');
    expect(rows[0]?.changedTeam).toBe(false);
  });

  it('flags a mid-season change and takes the later team', () => {
    const season: Season = {
      ...seasonFixture,
      standings: {
        ...seasonFixture.standings,
        drivers: [
          {
            ...seasonFixture.standings.drivers[0],
            teams: [
              { ref: 'first', name: 'First', firstRound: 1, lastRound: 5, entries: 5 },
              { ref: 'second', name: 'Second', firstRound: 6, lastRound: 9, entries: 4 },
            ],
          },
        ],
      } as Season['standings'],
    };
    const [row] = selectDriverStandings(season);
    expect(row?.changedTeam).toBe(true);
    expect(row?.principalTeam?.ref).toBe('second');
    expect(row?.colorRef).toBe('second');
  });

  /**
   * `colorRef` must always be a string, because it is the input to `entityColor` and an
   * undefined would resolve to no token, which paints nothing rather than failing.
   */
  it('falls back to the driver reference when they have no team in the season', () => {
    const season: Season = {
      ...seasonFixture,
      standings: {
        ...seasonFixture.standings,
        drivers: [{ ...seasonFixture.standings.drivers[0], teams: [] }],
      } as Season['standings'],
    };
    expect(selectDriverStandings(season)[0]?.colorRef).toBe('antonelli');
  });

  it('gives a team its own reference as the colour key', () => {
    expect(selectTeamStandings(seasonFixture)[0]?.colorRef).toBe('mercedes');
  });

  it('preserves the server ordering rather than re-sorting', () => {
    expect(selectDriverStandings(seasonFixture).map((r) => r.driverRef)).toEqual(
      seasonFixture.standings.drivers.map((d) => d.driverRef),
    );
  });
});

describe('selectProgressionSeries (SC-1)', () => {
  it('builds one series per driver, keyed by reference and coloured by team', () => {
    const series = selectProgressionSeries(progressionFixture, 'driver');
    expect(series.map((s) => s.key)).toEqual(['antonelli', 'russell']);
    expect(series[0]?.colorRef).toBe('mercedes');
    expect(series[0]?.label).toBe('Andrea Kimi Antonelli');
    expect(series[0]?.shortLabel).toBe('ANT');
    expect(series[0]?.points).toEqual([
      { round: 1, value: 18 },
      { round: 2, value: 43 },
    ]);
  });

  it('builds team series with the team name and no short label', () => {
    const [series] = selectProgressionSeries(progressionFixture, 'team');
    expect(series?.key).toBe('mercedes');
    expect(series?.shortLabel).toBeNull();
  });

  it('honours an explicit selection, in the order given', () => {
    const series = selectProgressionSeries(progressionFixture, 'driver', {
      only: ['russell', 'antonelli'],
    });
    expect(series.map((s) => s.key)).toEqual(['russell', 'antonelli']);
  });

  it('drops an unknown reference from a selection rather than emitting a hole', () => {
    const series = selectProgressionSeries(progressionFixture, 'driver', {
      only: ['russell', 'nobody'],
    });
    expect(series.map((s) => s.key)).toEqual(['russell']);
  });

  it('limits to the first N of the field, which is already in standings order', () => {
    expect(selectProgressionSeries(progressionFixture, 'driver', { limit: 1 })).toHaveLength(1);
    expect(selectProgressionSeries(progressionFixture, 'driver', { limit: 0 })).toHaveLength(0);
    expect(selectProgressionSeries(progressionFixture, 'driver', { limit: -5 })).toHaveLength(0);
  });

  /**
   * DESIGN_SYSTEM.md §6.2: a filter that changes the series count must not repaint the
   * survivors. `colorRef` comes from the entity's own identity, so this holds by
   * construction — asserted anyway, because it is the invariant most easily broken by a
   * future "assign colours in order" change.
   */
  it('gives an entity the same colour key whether or not others are filtered out', () => {
    const all = selectProgressionSeries(progressionFixture, 'driver');
    const one = selectProgressionSeries(progressionFixture, 'driver', { only: ['russell'] });
    expect(one[0]?.colorRef).toBe(all.find((s) => s.key === 'russell')?.colorRef);
  });

  it('returns nothing for a season with no constructors championship', () => {
    const noTeams: StandingsProgression = { ...progressionFixture, teams: [] };
    expect(selectProgressionSeries(noTeams, 'team')).toEqual([]);
  });
});

describe('selectPositionSeries', () => {
  it('plots championship position instead of points', () => {
    const [series] = selectPositionSeries(progressionFixture, 'driver');
    expect(series?.points).toEqual([
      { round: 1, value: 2 },
      { round: 2, value: 1 },
    ]);
  });

  /** A null position is an absence, not last place and not zero. */
  it('carries a null position through as null', () => {
    const withNull: StandingsProgression = {
      ...progressionFixture,
      drivers: [
        {
          ...progressionFixture.drivers[0],
          progression: [
            { round: 1, points: 0, position: null },
            { round: 2, points: 8, position: 9 },
          ],
        },
      ] as StandingsProgression['drivers'],
    };
    expect(selectPositionSeries(withNull, 'driver')[0]?.points).toEqual([
      { round: 1, value: null },
      { round: 2, value: 9 },
    ]);
  });
});

describe('selectGapToLeader (SC-2)', () => {
  it('puts the leader on zero and everyone else below it', () => {
    const series = selectGapToLeader(progressionFixture, 'driver');
    const byKey = new Map(series.map((s) => [s.key, s.points]));
    // Round 1: Russell 25 leads, Antonelli on 18. Round 2: Antonelli 43 leads.
    expect(byKey.get('russell')).toEqual([
      { round: 1, value: 0 },
      { round: 2, value: -10 },
    ]);
    expect(byKey.get('antonelli')).toEqual([
      { round: 1, value: -7 },
      { round: 2, value: 0 },
    ]);
  });

  /**
   * **The assertion this metric exists for.** The leader is the leader of the field, not
   * of the selection: comparing two midfielders must show both a long way below zero, not
   * artificially put one of them on the baseline. Computing the maximum after filtering
   * is the obvious implementation and it is wrong.
   */
  it('measures against the field leader, not the leader of the filtered selection', () => {
    const [russell] = selectGapToLeader(progressionFixture, 'driver', { only: ['russell'] });
    expect(russell?.points).toEqual([
      { round: 1, value: 0 },
      { round: 2, value: -10 },
    ]);
  });

  /** A driver who joined at round 6 was not level with the leader for five rounds. */
  it('emits no point for a round an entity has no snapshot in', () => {
    const lateJoiner: StandingsProgression = {
      ...progressionFixture,
      drivers: [
        progressionFixture.drivers[0],
        {
          ...progressionFixture.drivers[1],
          progression: [{ round: 2, points: 4, position: 5 }],
        },
      ] as StandingsProgression['drivers'],
    };
    const series = selectGapToLeader(lateJoiner, 'driver');
    expect(series.find((s) => s.key === 'russell')?.points).toEqual([{ round: 2, value: -39 }]);
  });

  it('is all zeroes for a single-entity field, and never NaN', () => {
    const solo: StandingsProgression = {
      ...progressionFixture,
      drivers: [progressionFixture.drivers[0]] as StandingsProgression['drivers'],
    };
    for (const point of selectGapToLeader(solo, 'driver')[0]?.points ?? []) {
      expect(point.value).toBe(0);
    }
  });

  it('handles an empty field without dividing by anything', () => {
    const empty: StandingsProgression = { ...progressionFixture, drivers: [] };
    expect(selectGapToLeader(empty, 'driver')).toEqual([]);
  });
});

describe('selectRoundAxis and selectSeriesTable', () => {
  it('takes the axis from the rounds that carry a snapshot', () => {
    expect(selectRoundAxis(progressionFixture)).toEqual([1, 2]);
  });

  /**
   * The table view is required on every chart (DESIGN_SYSTEM.md §6.2) and is built from
   * the same series the chart draws, so the two cannot disagree about a number.
   */
  it('aligns every row to the shared axis, with null where a series has no point', () => {
    const series = selectProgressionSeries(progressionFixture, 'driver');
    const table = selectSeriesTable(series, [1, 2, 3]);
    expect(table.rounds).toEqual([1, 2, 3]);
    expect(table.rows[0]).toEqual({
      key: 'antonelli',
      label: 'Andrea Kimi Antonelli',
      values: [18, 43, null],
    });
  });

  it('copies the axis rather than aliasing the caller’s array', () => {
    const rounds = [1, 2];
    const table = selectSeriesTable([], rounds);
    rounds.push(3);
    expect(table.rounds).toEqual([1, 2]);
  });
});

describe('purity — no selector mutates its input', () => {
  it('leaves the fixtures untouched', () => {
    const seasonBefore = JSON.stringify(seasonFixture);
    const progressionBefore = JSON.stringify(progressionFixture);

    selectCalendar(seasonFixture);
    selectSeasonNotices(seasonFixture);
    selectDriverStandings(seasonFixture);
    selectTeamStandings(seasonFixture);
    selectProgressionSeries(progressionFixture, 'driver');
    selectPositionSeries(progressionFixture, 'team');
    selectGapToLeader(progressionFixture, 'driver');
    selectSeriesTable(selectProgressionSeries(progressionFixture, 'driver'), [1, 2]);

    expect(JSON.stringify(seasonFixture)).toBe(seasonBefore);
    expect(JSON.stringify(progressionFixture)).toBe(progressionBefore);
  });
});
